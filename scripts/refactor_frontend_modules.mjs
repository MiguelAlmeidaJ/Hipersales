import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1))), "..");
const frontendRoot = path.join(projectRoot, "frontend");
const appPath = path.join(frontendRoot, "app.js");
const stylesPath = path.join(frontendRoot, "styles.css");
const indexPath = path.join(frontendRoot, "index.html");
const serviceWorkerPath = path.join(frontendRoot, "sw.js");
const backupRoot = path.join(projectRoot, ".refactor-backup");
const parserRoot = path.join(os.tmpdir(), "hipersales-js-refactor-parser", "node_modules");

const expectedHashes = {
  "app.js": "1AC57924CBD6D089FAE085A5AC5887FA83B14066DAB199D16EA22C31B1E1D8BA",
  "styles.css": "0A91E32F8AC3FD9E0F16EE3DDD8AD48A2DEAF96761612F1A00F51905C259586E",
  "index.html": "744548137E6E2BCA25372B8A4498F9F4B2E32666D3514F6FEE183D69CC5F3124",
  "sw.js": "2DBC2BC127B568C5C2F8DE22D8BD55178A6BD00162A350ADDB5F92BF794EFFC4",
};

const require = createRequire(import.meta.url);
const acorn = require(path.join(parserRoot, "acorn"));
const eslintScope = require(path.join(parserRoot, "eslint-scope", "dist", "eslint-scope.cjs"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function readAuditedFile(filename) {
  const filePath = path.join(frontendRoot, filename);
  const buffer = fs.readFileSync(filePath);
  const actual = sha256(buffer);
  if (actual !== expectedHashes[filename]) {
    throw new Error(`${filename} nao corresponde a versao auditada. Esperado ${expectedHashes[filename]}, encontrado ${actual}.`);
  }
  return buffer;
}

function backup(filename, buffer) {
  fs.mkdirSync(backupRoot, { recursive: true });
  const target = path.join(backupRoot, `frontend_${filename.replaceAll(".", "_")}_original`);
  if (fs.existsSync(target) && sha256(fs.readFileSync(target)) !== sha256(buffer)) {
    throw new Error(`Backup existente diverge do arquivo auditado: ${target}`);
  }
  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, buffer);
  }
}

function parse(source) {
  return acorn.parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    ranges: true,
  });
}

function topLevelNode(source, predicate) {
  const node = parse(source).body.find(predicate);
  if (!node) throw new Error("Declaracao esperada nao encontrada no app.js.");
  return node;
}

function removeNodes(source, nodes) {
  let result = source;
  for (const node of [...nodes].sort((left, right) => right.start - left.start)) {
    result = result.slice(0, node.start) + result.slice(node.end);
  }
  return result;
}

function splitByMarkers(source, definitions) {
  const offsets = definitions.map((definition) => {
    const offset = source.indexOf(definition.marker);
    if (offset < 0) throw new Error(`Marcador nao encontrado: ${definition.marker}`);
    return offset;
  });
  if (offsets[0] !== 0 || offsets.some((offset, index) => index > 0 && offset <= offsets[index - 1])) {
    throw new Error("Marcadores de modulos JS fora da ordem esperada.");
  }
  return definitions.map((definition, index) => ({
    ...definition,
    source: source.slice(offsets[index], offsets[index + 1] ?? source.length).trim() + "\n",
  }));
}

function declarationNames(node) {
  const declaration = node.type === "ExportNamedDeclaration" ? node.declaration : node;
  if (!declaration) return [];
  if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") {
    return declaration.id ? [declaration.id.name] : [];
  }
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.map((item) => {
      if (item.id.type !== "Identifier") throw new Error("Declaracao desestruturada nao suportada pelo extrator.");
      return item.id.name;
    });
  }
  return [];
}

function exportTopLevelDeclarations(source) {
  const tree = parse(source);
  const declarations = tree.body.filter((node) =>
    ["FunctionDeclaration", "ClassDeclaration", "VariableDeclaration"].includes(node.type)
  );
  let result = source;
  for (const node of [...declarations].sort((left, right) => right.start - left.start)) {
    result = result.slice(0, node.start) + "export " + result.slice(node.start);
  }
  return result;
}

function moduleExports(source) {
  return parse(source).body.flatMap(declarationNames);
}

function relativeImport(fromFile, toFile) {
  let relative = path.relative(path.dirname(fromFile), toFile).replaceAll("\\", "/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

function addImports(modules) {
  const ownerByName = new Map();
  for (const module of modules) {
    module.exports = moduleExports(module.source);
    for (const name of module.exports) {
      if (ownerByName.has(name)) throw new Error(`Simbolo duplicado: ${name}`);
      ownerByName.set(name, module);
    }
  }

  for (const module of modules) {
    const tree = parse(module.source);
    const scopeManager = eslintScope.analyze(tree, {
      ecmaVersion: 2022,
      sourceType: "module",
      optimistic: true,
      ignoreEval: true,
    });
    const dependencies = new Map();
    for (const reference of scopeManager.globalScope.through) {
      const name = reference.identifier.name;
      const owner = ownerByName.get(name);
      if (!owner || owner === module) continue;
      if (reference.isWrite()) {
        throw new Error(`Escrita cruzada entre modulos: ${module.file} tenta alterar ${name} de ${owner.file}.`);
      }
      if (!dependencies.has(owner.file)) dependencies.set(owner.file, new Set());
      dependencies.get(owner.file).add(name);
    }

    const importBlocks = [...dependencies.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([ownerFile, names]) => {
        const target = modules.find((item) => item.file === ownerFile);
        const specifier = relativeImport(path.join(frontendRoot, module.file), path.join(frontendRoot, target.file));
        const sortedNames = [...names].sort();
        return `import {\n${sortedNames.map((name) => `  ${name},`).join("\n")}\n} from "${specifier}";`;
      });
    module.source = `${importBlocks.join("\n\n")}${importBlocks.length ? "\n\n" : ""}${module.source}`;
  }
}

function findCssMarker(source, marker, after = 0) {
  const offset = source.indexOf(marker, after);
  if (offset < 0) throw new Error(`Marcador CSS nao encontrado: ${marker}`);
  return offset;
}

const appBuffer = readAuditedFile("app.js");
const stylesBuffer = readAuditedFile("styles.css");
const indexBuffer = readAuditedFile("index.html");
const serviceWorkerBuffer = readAuditedFile("sw.js");
for (const [filename, buffer] of Object.entries({
  "app.js": appBuffer,
  "styles.css": stylesBuffer,
  "index.html": indexBuffer,
  "sw.js": serviceWorkerBuffer,
})) {
  backup(filename, buffer);
}

const originalApp = appBuffer.toString("utf8");
const originalTree = parse(originalApp);
const timerNode = originalTree.body.find(
  (node) => node.type === "VariableDeclaration" && declarationNames(node).includes("whatsappSettingsRefreshTimer")
);
const clearTimerNode = originalTree.body.find(
  (node) => node.type === "FunctionDeclaration" && node.id?.name === "clearWhatsAppSettingsRefresh"
);
if (!timerNode || !clearTimerNode) throw new Error("Estado do temporizador WhatsApp nao encontrado.");
const timerSource = originalApp.slice(timerNode.start, timerNode.end);
const clearTimerSource = originalApp.slice(clearTimerNode.start, clearTimerNode.end);
const appWithoutMovedTimer = removeNodes(originalApp, [timerNode, clearTimerNode]);

const jsDefinitions = [
  { file: "modules/core/state.js", marker: "const state = {" },
  { file: "modules/core/ui.js", marker: "function renderPagination(" },
  { file: "modules/core/api.js", marker: "async function api(" },
  { file: "modules/core/shell.js", marker: "function renderSuperAdminShell(" },
  { file: "modules/features/dashboard.js", marker: "async function renderDashboard(" },
  { file: "modules/features/customer-requests.js", marker: "function renderCustomerApprovals(" },
  { file: "modules/features/occurrences.js", marker: "function occurrenceStatusLabel(" },
  { file: "modules/features/customers.js", marker: "function renderCustomersTable(" },
  { file: "modules/features/catalog-views.js", marker: "function renderProducts(" },
  { file: "modules/features/proposals.js", marker: "function renderProposalCustomerPreview(" },
  { file: "modules/admin/orders.js", marker: "function legacyRenderAdmin(" },
  { file: "modules/admin/modals.js", marker: "function renderUsersTable(" },
  { file: "modules/admin/catalog.js", marker: "function renderProductsTable(" },
  { file: "modules/admin/settings.js", marker: "function sanitizeHexColor(" },
];

const modules = splitByMarkers(appWithoutMovedTimer, jsDefinitions).map((module) => {
  if (module.file === "modules/admin/settings.js") {
    module.source = `${timerSource}\n\n${clearTimerSource}\n\n${module.source}`;
  }
  module.source = exportTopLevelDeclarations(module.source);
  return module;
});
addImports(modules);

for (const module of modules) {
  const target = path.join(frontendRoot, module.file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, module.source, "utf8");
}
fs.writeFileSync(appPath, 'import "./modules/admin/settings.js";\n', "utf8");

const originalStyles = stylesBuffer.toString("utf8");
const cssOffsets = [];
cssOffsets.push(0);
cssOffsets.push(findCssMarker(originalStyles, "/* HiperSales purple management theme */"));
cssOffsets.push(findCssMarker(originalStyles, ".icon-text-btn {", cssOffsets.at(-1)));
cssOffsets.push(findCssMarker(originalStyles, ".settings-modal {", cssOffsets.at(-1) + 1));
cssOffsets.push(findCssMarker(originalStyles, ".proposal-customer-preview {", cssOffsets.at(-1)));
cssOffsets.push(findCssMarker(originalStyles, ".section-head.compact {", cssOffsets.at(-1)));
cssOffsets.push(findCssMarker(originalStyles, ".order-card-title {", cssOffsets.at(-1)));
cssOffsets.push(findCssMarker(originalStyles, "@media (max-width: 1180px) {", cssOffsets.at(-1)));
cssOffsets.push(findCssMarker(originalStyles, "/* Final visual layer: purple console identity */", cssOffsets.at(-1)));

const cssFiles = [
  "styles/01-occurrences.css",
  "styles/02-theme-foundation.css",
  "styles/03-admin-components.css",
  "styles/04-modals-and-settings.css",
  "styles/05-proposals.css",
  "styles/06-shared-components.css",
  "styles/07-orders.css",
  "styles/08-responsive.css",
  "styles/09-final-overrides.css",
];
if (cssOffsets.length !== cssFiles.length) throw new Error("Particionamento CSS incompleto.");
for (let index = 0; index < cssFiles.length; index += 1) {
  const content = originalStyles.slice(cssOffsets[index], cssOffsets[index + 1] ?? originalStyles.length).trim() + "\n";
  const target = path.join(frontendRoot, cssFiles[index]);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

const version = "20261008-frontend-modules-1";
const styleImports = cssFiles.map((file) => `@import url("/${file}?v=${version}");`).join("\n");
fs.writeFileSync(stylesPath, `${styleImports}\n`, "utf8");

const updatedIndex = indexBuffer
  .toString("utf8")
  .replace("/styles.css?v=20260820-customers-save-1", `/styles.css?v=${version}`)
  .replace("/app.js?v=20260820-customers-save-1", `/app.js?v=${version}`);
fs.writeFileSync(indexPath, updatedIndex, "utf8");

const precacheAssets = [
  "/",
  "/index.html",
  `/styles.css?v=${version}`,
  `/app.js?v=${version}`,
  ...cssFiles.map((file) => `/${file}?v=${version}`),
  ...modules.map((module) => `/${module.file}`),
  "/manifest.webmanifest?v=20260609-multitenant-1",
  "/assets/iconapp.png?v=20260608-logo-3",
];
let updatedServiceWorker = serviceWorkerBuffer.toString("utf8");
updatedServiceWorker = updatedServiceWorker.replace('const CACHE_NAME = "hypersales-v74";', 'const CACHE_NAME = "hypersales-v75-modules";');
updatedServiceWorker = updatedServiceWorker.replace(
  /const ASSETS = \[[\s\S]*?\n\];/,
  `const ASSETS = ${JSON.stringify(precacheAssets, null, 2)};`
);
fs.writeFileSync(serviceWorkerPath, updatedServiceWorker, "utf8");

const backupReadme = [
  "Backups criados antes da modularizacao do frontend.",
  ...Object.entries(expectedHashes).map(([filename, hash]) => `${filename}: ${hash}`),
  "Os arquivos sao somente para recuperacao e nao participam da aplicacao.",
  "",
].join("\n");
fs.writeFileSync(path.join(backupRoot, "FRONTEND_README.txt"), backupReadme, "utf8");

console.log(`Frontend modularizado: ${modules.length} modulos JS e ${cssFiles.length} folhas CSS.`);
console.log(`Funcoes e estados exportados: ${modules.reduce((total, module) => total + module.exports.length, 0)}.`);

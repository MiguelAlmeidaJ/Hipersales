import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(process.cwd(), "../..");
const read = path => readFileSync(resolve(root, path), "utf8");
const backend = ["auth/auth.controller.ts","proposals/proposals.controller.ts","customers/assignments.controller.ts",
  "goals/goals.controller.ts","settings/settings.controller.ts","dashboard/dashboard.controller.ts","documents/documents.controller.ts"]
  .map(path=>read(`apps/api/src/${path}`)).join("\n");
const statusSource = read("apps/api/src/settings/settings.constants.ts");
const orders = read("apps/web/components/order-admin.tsx");
const listing = read("apps/web/components/orders-view.tsx");
const assignments = read("apps/web/components/seller-assignments.tsx");
const reports = read("apps/web/components/reports-view.tsx");
const navigation = read("apps/web/lib/navigation.ts");
const shell = read("apps/web/components/app-shell.tsx");
const nestAuth = read("apps/api/src/auth/auth.controller.ts");
const authContracts = read("packages/contracts/src/auth.ts");

const requiredRoutes = [
  "/api/me/password", "/api/proposals", "/api/admin/proposals/",
  "/api/admin/customer-assignments", "/api/admin/company-assignments",
  "/api/admin/reports/pdf", "/api/admin/goals", "/api/admin/settings",
  "/api/admin/executive-dashboard"
];
for (const route of requiredRoutes) {
  const fragment=route.split("/").filter(Boolean).at(-1)?.replace(/:\w+/,"")||route;
  assert.ok(backend.includes(fragment)||backend.includes(route.replace("/api/","")), `Missing backend route: ${route}`);
}
const allowedStatuses = ["em_analise","pedido_aprovado","recusado","em_producao","faturado","entregue"];
for (const status of allowedStatuses) {
  assert.ok(statusSource.includes(`${status}:`), `Backend missing status: ${status}`);
  assert.ok(orders.includes(`"${status}"`), `Editor missing status: ${status}`);
}
assert.match(listing, /product_id\s*:\s*number/, "Order items need product_id for editing");
assert.match(listing, /company_id\s*:\s*number/, "Order editing needs company_id");
assert.match(orders, /items\s*:\s*rows\.map/, "Order editor must send item rows");
assert.match(assignments, /seller_id\s*:\s*sellerId/, "Assignments need seller_id");
assert.ok(reports.includes("date_from") && reports.includes("seller_id"), "Report filters missing");
const segments=["painel","pedidos","ocorrencias","clientes","empresas","produtos","relatorios","metas","usuarios","configuracoes","aprovacoes","solicitar-cliente"];
for(const segment of segments){
  assert.ok(existsSync(resolve(root,`apps/web/app/(workspace)/app/${segment}/page.tsx`)), `Missing Next page: ${segment}`);
  assert.match(navigation, new RegExp(`slug\\s*:\\s*\"${segment}\"`), `Missing navigation registry: ${segment}`);
}
assert.ok(shell.includes("SessionContext.Provider") && shell.includes("visibleModules"), "Shared authentication shell missing");
for (const route of ["login", "logout", "me", "me/password"]) {
  assert.ok(nestAuth.includes(`\"${route}\"`), `Missing migrated Nest auth route: ${route}`);
}
for (const schema of ["loginRequestSchema", "publicUserSchema", "changePasswordRequestSchema"]) {
  assert.ok(authContracts.includes(`export const ${schema}`), `Missing shared contract: ${schema}`);
}
console.log(`Frontend contract checks passed: ${requiredRoutes.length} routes, ${allowedStatuses.length} statuses, 5 integration assertions plus ${segments.length} App Router modules.`);

const debuggerUrl = process.env.HIPERSALES_DEBUGGER_URL || "http://localhost:9222";
const appUrl = process.env.HIPERSALES_WEB_URL || "http://localhost:8081";

const pages = await fetch(`${debuggerUrl}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("Nenhuma página disponível no navegador de verificação.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const runtimeErrors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result);
    }
    return;
  }
  if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    runtimeErrors.push(message.params.args.map((item) => item.value || item.description || "").join(" "));
  }
});

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function evaluate(expression) {
  const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

await command("Runtime.enable");
await command("Page.enable");
await command("Page.navigate", { url: `${appUrl}/login` });
await pause(3500);

let loginReady = await evaluate(`document.body.innerText.includes("Bem-vindo") && document.body.innerText.includes("AMBIENTE DE DEMONSTRAÇÃO")`);
if (loginReady) {
  const clicked = await evaluate(`(() => { const button = [...document.querySelectorAll('[role="button"],button')].find((item) => item.textContent.includes('Entrar')); button?.click(); return Boolean(button); })()`);
  if (!clicked) throw new Error("O botão Entrar não foi localizado.");
  await pause(4000);
} else {
  loginReady = await evaluate(`document.body.innerText.includes("Olá,")`);
  if (!loginReady) throw new Error("Nem o login nem uma sessão mock ativa foram encontrados.");
}

const routes = [
  ["/", "Olá,"],
  ["/customers", "Meus clientes"],
  ["/orders", "Pedidos"],
  ["/price-tables", "Tabelas de preço"],
  ["/new-order", "NOVO PEDIDO"],
  ["/occurrences", "Ocorrências"],
  ["/activities", "Minhas atividades"],
  ["/goals", "Minhas metas"],
  ["/notifications", "Notificações"],
];
const results = [];
for (const [route, expected] of routes) {
  await command("Page.navigate", { url: `${appUrl}${route}` });
  await pause(2600);
  const state = await evaluate(`({ url: location.pathname, text: document.body.innerText, title: document.title })`);
  const matched = state.text.includes(expected);
  const visibleError = /Não foi possível|Erro ao|Falha ao carregar/i.test(state.text);
  results.push({ route, expected, matched, visibleError, url: state.url });
}

console.log(JSON.stringify({ loginReady, routes: results, runtimeErrors }, null, 2));
socket.close();
if (results.some((item) => !item.matched || item.visibleError) || runtimeErrors.length) process.exitCode = 1;

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(process.cwd(), "../..");
const read = path => readFileSync(resolve(root, path), "utf8");
const handler = read("apps/api/http_handler.py");
const foundation = read("apps/api/foundation.py");
const orders = read("apps/web/components/order-admin.tsx");
const listing = read("apps/web/components/orders-view.tsx");
const assignments = read("apps/web/components/seller-assignments.tsx");
const reports = read("apps/web/components/reports-view.tsx");
const navigation = read("apps/web/lib/navigation.ts");
const shell = read("apps/web/components/app-shell.tsx");

const requiredRoutes = [
  "/api/me/password", "/api/proposals", "/api/admin/proposals/",
  "/api/admin/customer-assignments", "/api/admin/company-assignments",
  "/api/admin/reports/pdf", "/api/admin/goals", "/api/admin/settings",
  "/api/admin/executive-dashboard"
];
for (const route of requiredRoutes) {
  assert.ok(handler.includes(route), `Missing backend route: ${route}`);
}
const allowedStatuses = ["em_analise","pedido_aprovado","recusado","em_producao","faturado","entregue"];
for (const status of allowedStatuses) {
  assert.ok(foundation.includes(`"${status}":`), `Backend missing status: ${status}`);
  assert.ok(orders.includes(`"${status}"`), `Editor missing status: ${status}`);
}
assert.ok(listing.includes("product_id:number"), "Order items need product_id for editing");
assert.ok(listing.includes("company_id:number"), "Order editing needs company_id");
assert.ok(orders.includes("items:rows.map"), "Order editor must send item rows");
assert.ok(assignments.includes("seller_id:sellerId"), "Assignments need seller_id");
assert.ok(reports.includes("date_from") && reports.includes("seller_id"), "Report filters missing");
const segments=["painel","pedidos","ocorrencias","clientes","empresas","produtos","relatorios","metas","usuarios","configuracoes","aprovacoes","solicitar-cliente"];
for(const segment of segments){
  assert.ok(existsSync(resolve(root,`apps/web/app/app/${segment}/page.tsx`)), `Missing Next page: ${segment}`);
  assert.ok(navigation.includes(`slug:"${segment}"`), `Missing navigation registry: ${segment}`);
}
assert.ok(shell.includes("SessionContext.Provider") && shell.includes("visibleModules"), "Shared authentication shell missing");
console.log(`Frontend contract checks passed: ${requiredRoutes.length} routes, ${allowedStatuses.length} statuses, 5 integration assertions plus ${segments.length} App Router modules.`);

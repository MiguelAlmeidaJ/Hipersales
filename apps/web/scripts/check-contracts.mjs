import { readFileSync } from "node:fs";
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
const superadmin = read("apps/web/components/superadmin-view.tsx");

const requiredRoutes = [
  "/api/me/password", "/api/proposals", "/api/admin/proposals/",
  "/api/admin/customer-assignments", "/api/admin/company-assignments",
  "/api/admin/reports/pdf", "/api/admin/goals", "/api/admin/settings",
  "/api/super-admin/overview", "/api/super-admin/tenants"
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
assert.ok(superadmin.includes("admin_password") && superadmin.includes("summary"), "Superadmin contract missing");
console.log(`Frontend contract checks passed: ${requiredRoutes.length} routes, ${allowedStatuses.length} statuses, 6 integration assertions.`);

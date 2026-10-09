import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.cwd(),"../..");
const file=path=>readFileSync(resolve(root,path),"utf8");
const dependencies=[
 ["apps/web/app/page.tsx","/legacy","Classic fallback remains in the React shell"],
 ["apps/web/next.config.ts","/legacy","Legacy route is still proxied"],
 ["apps/web/next.config.ts","/modules/:path*","Legacy JS modules are still served"],
 ["apps/web/next.config.ts","/styles/:path*","Legacy stylesheets are still served"],
 ["apps/web/next.config.ts","/app.js","Legacy script is still proxied"]
];
const blockers=dependencies.filter(([path,token])=>file(path).includes(token));
const legacy=["apps/web/app.js","apps/web/index.html","apps/web/styles.css","apps/web/modules/admin/orders.js","apps/web/sw.js","apps/web/manifest.webmanifest"];
const existing=legacy.filter(path=>existsSync(resolve(root,path)));
console.log("Legacy removal readiness:");
for(const [path,,reason] of blockers)console.log(`BLOCKED: ${reason} (${path})`);
console.log(`Existing legacy entrypoints: ${existing.length} / ${legacy.length}`);
if(blockers.length||existing.length){
 console.log("NOT READY: Preserve legacy frontend until functional parity and local tests are approved.");
 process.exitCode=1;
}else{
 assert.ok(!blockers.length&&!existing.length);
 console.log("READY: No known legacy application dependencies remain (manual acceptance still required).");
}

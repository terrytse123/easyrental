import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "node_modules/@electric-sql/pglite/dist");
const dest = join(process.cwd(), ".vercel/output/functions/__server.func/_libs");
if (!existsSync(dest)) {
  console.log("[pglite] no server bundle yet, skip asset copy");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  copyFileSync(join(dist, name), join(dest, name));
}
console.log("[pglite] copied data and wasm into the server bundle");

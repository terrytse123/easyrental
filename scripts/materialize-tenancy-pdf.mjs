import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const b64Path = join(root, "public/tenancy-template-blank.pdf.b64");
const pdfPath = join(root, "public/tenancy-template-blank.pdf");

if (!existsSync(b64Path)) {
  console.error("missing", b64Path);
  process.exit(1);
}

const b64 = readFileSync(b64Path, "utf8").replace(/\s+/g, "");
writeFileSync(pdfPath, Buffer.from(b64, "base64"));
console.log("materialized", pdfPath, `(${b64.length} b64 chars)`);

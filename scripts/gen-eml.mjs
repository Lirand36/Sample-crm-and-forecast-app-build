// Regenerates src/seed/eml-raw.ts from the .eml fixtures.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const dir = "src/seed/eml";
const files = readdirSync(dir).filter((f) => f.endsWith(".eml")).sort();
let out = "// Generated from src/seed/eml by `npm run gen:eml`. Bundled so the browser can offer the sample emails.\n// A test checks this file matches the .eml files.\n\nexport const EML_RAW: Record<string, string> = {\n";
for (const f of files) out += `  ${JSON.stringify(f)}: ${JSON.stringify(readFileSync(join(dir, f), "utf8"))},\n`;
out += "};\n";
writeFileSync("src/seed/eml-raw.ts", out);

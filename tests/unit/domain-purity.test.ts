import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("the domain has no UI, storage, network, environment or clock dependency (Part V)", () => {
  const sources = files(join(process.cwd(), "src/domain")).map((p) => [p, readFileSync(p, "utf8")] as const);
  it.each(sources)("%s", (_path, text) => {
    const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const spec of imports) expect(spec.startsWith("./") || spec.startsWith("../")).toBe(true);
    expect(text).not.toMatch(/\bnew Date\b|\bDate\.now\b|\bMath\.random\b|\bprocess\.env\b|\bfetch\(|\bindexedDB\b|\blocalStorage\b/);
  });
});

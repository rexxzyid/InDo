import { chmodSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const kandidat = [resolve(dir, "../dist/cli/index.js"), resolve(dir, "../dist/cli/index.mjs")];

for (const bin of kandidat) {
  try {
    if (existsSync(bin)) chmodSync(bin, 0o755);
  } catch {
    continue;
  }
}

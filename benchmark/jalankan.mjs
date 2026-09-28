import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const berkas = readdirSync("benchmark").filter((n) => n.endsWith(".wni")).sort();
console.log("Benchmark InDo (detik):");
for (const b of berkas) {
  const mulai = performance.now();
  execFileSync("node", ["dist/cli/index.js", "jalankan", `benchmark/${b}`], { stdio: "ignore" });
  const durasi = ((performance.now() - mulai) / 1000).toFixed(3);
  console.log(`  ${b.replace(".wni", "").padEnd(12)} ${durasi} s`);
}

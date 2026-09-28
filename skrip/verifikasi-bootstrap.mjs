import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "verifikasi-bootstrap-"));
const berkas = join(dir, "coba.wni");

const program = `fungsi fib(n) { jika (n < 2) kembalikan n
  kembalikan fib(n - 1) + fib(n - 2) }
untuk (misal i = 0; i < 12; i++) cetak(fib(i))
kelas Titik { konstruktor(x, y) { ini.x = x
    ini.y = y } jarak() { kembalikan Matematika.akar(ini.x ** 2 + ini.y ** 2) } }
cetak(baru Titik(3, 4).jarak())
misal daftar = [5, 3, 8, 1]
cetak(daftar.diurutkan((a, b) => a - b).gabung(","))`;

writeFileSync(berkas, program);

function jalankan(perintah) {
  return execFileSync("node", ["dist/cli/index.js", perintah, berkas], { encoding: "utf8" });
}

const benih = jalankan("jalankan");
const mandiri = jalankan("mandiri");

if (benih !== mandiri) {
  console.error("GAGAL: keluaran pipeline benih dan compiler mandiri berbeda.");
  console.error("== benih ==\n" + benih);
  console.error("== mandiri ==\n" + mandiri);
  process.exit(1);
}

console.log("LULUS: compiler InDo (mandiri) menghasilkan keluaran identik dengan pipeline benih.");
console.log(mandiri.trimEnd());

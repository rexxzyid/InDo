import { test } from "node:test";
import assert from "node:assert/strict";
import { rapikanSumber } from "./format.js";
import { urai } from "../parser/parser.js";
import { Kompiler } from "../compiler/kompiler.js";
import { Mesin } from "../vm/mesin.js";

function jalankan(sumber: string): string {
  const baris: string[] = [];
  const mesin = new Mesin({ cetak: (t) => baris.push(t) });
  mesin.jalankan(Kompiler.kompilasiProgram(urai(sumber, "u.wni"), "u.wni"));
  mesin.jalankanEventLoop();
  return baris.join("\n");
}

const CONTOH = [
  "misal x = 1 + 2 * 3\ncetak(x)",
  "fungsi f(a, b = 2, ...s) { kembalikan a + b + s.panjang }\ncetak(f(1, 5, 9))",
  'jika (3 > 2) { cetak("ya") } lainnya { cetak("tidak") }',
  "kelas A { konstruktor(n) { ini.n = n }\n dapatkan nilai() { kembalikan ini.n } }\ncetak(baru A(7).nilai)",
  "misal [a, b, ...c] = [1, 2, 3, 4]\ncetak(a, b, c)",
  "misal o = { nama: `Sari`, sapa() { kembalikan `Hai ${ini.nama}` } }\ncetak(o.sapa())",
  "untuk (misal i = 0; i < 3; i++) cetak(i)",
  "misal g = [1, 2, 3].petakan((x) => x * 2).saring((x) => x > 2)\ncetak(g)",
];

test("format idempoten (format(format(x)) == format(x))", () => {
  for (const sumber of CONTOH) {
    const sekali = rapikanSumber(sumber);
    const duakali = rapikanSumber(sekali);
    assert.equal(duakali, sekali, `tidak idempoten untuk:\n${sumber}`);
  }
});

test("format mempertahankan perilaku", () => {
  for (const sumber of CONTOH) {
    const asli = jalankan(sumber);
    const diformat = jalankan(rapikanSumber(sumber));
    assert.equal(diformat, asli, `perilaku berubah untuk:\n${sumber}`);
  }
});

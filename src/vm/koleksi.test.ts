import { test } from "node:test";
import assert from "node:assert/strict";
import { urai } from "../parser/parser.js";
import { Kompiler } from "../compiler/kompiler.js";
import { Mesin } from "./mesin.js";

function satu(sumber: string): string {
  const baris: string[] = [];
  const mesin = new Mesin({ cetak: (t) => baris.push(t), galat: (t) => baris.push(t) });
  mesin.jalankan(Kompiler.kompilasiProgram(urai(sumber, "uji.wni"), "uji.wni"));
  mesin.jalankanEventLoop();
  return baris.join("\n");
}

test("Peta", () => {
  assert.equal(satu('misal p = baru Peta()\np.tetapkan("a", 1).tetapkan("b", 2)\ncetak(p.ambil("a"), p.ukuran, p.punya("b"))'), "1 2 benar");
  assert.equal(satu('misal p = baru Peta([["x", 10]])\nmisal s = 0\nuntuk (misal [k, v] dari p) s += v\ncetak(s)'), "10");
});

test("Himpunan", () => {
  assert.equal(satu("misal h = baru Himpunan([1, 2, 2, 3])\ncetak(h.ukuran, h.punya(2))"), "3 benar");
  assert.equal(satu("misal h = baru Himpunan()\nh.tambah(5).tambah(5)\ncetak([...h])"), "[5]");
});

test("bilanganbesar", () => {
  assert.equal(satu("cetak(10n * 10n, 2n ** 64n)"), "100 18446744073709551616");
  assert.equal(satu("cetak(jenisdari 5n)"), "bilanganbesar");
});

test("larik bertipe", () => {
  assert.equal(satu("misal a = baru LarikInt32(3)\na[0] = 10\na[1] = 20\ncetak(a[0] + a[1], a.panjang)"), "30 3");
  assert.equal(satu("misal a = baru LarikUint8([256, 255, 1])\ncetak(a[0], a[1])"), "0 255");
});

test("Wakil dan Refleksi", () => {
  assert.equal(
    satu('misal w = baru Wakil({ n: 1 }, { ambil(t, k) { kembalikan t[k] * 10 } })\ncetak(w.n)'),
    "10",
  );
  assert.equal(satu('cetak(Refleksi.ambil({ a: 7 }, "a"), Refleksi.punya({ a: 1 }, "a"))'), "7 benar");
});

test("RefLemah", () => {
  assert.equal(satu("misal o = { x: 1 }\nmisal r = baru RefLemah(o)\ncetak(r.deref().x)"), "1");
});

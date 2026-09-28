import { test } from "node:test";
import assert from "node:assert/strict";
import { urai } from "../parser/parser.js";
import { Kompiler } from "../compiler/kompiler.js";
import { Mesin } from "./mesin.js";

function jalankanModul(utama: string, modul: Record<string, string>): string[] {
  const baris: string[] = [];
  const mesin = new Mesin({
    cetak: (t) => baris.push(t),
    galat: (t) => baris.push(t),
    muatSumberModul: (spesifikasi) => ({ jalur: spesifikasi, sumber: modul[spesifikasi] ?? "" }),
  });
  const fungsi = Kompiler.kompilasiProgram(urai(utama, "utama.wni"), "utama.wni");
  mesin.jalankan(fungsi);
  mesin.jalankanEventLoop();
  return baris;
}

test("impor bernama dan bawaan", () => {
  const modul = {
    "./mat.wni": "ekspor tetap PI = 3\nekspor fungsi kuadrat(x) { kembalikan x * x }\nekspor bawaan fungsi(a, b) { kembalikan a + b }",
  };
  const keluaran = jalankanModul(
    'impor tambah, { PI, kuadrat } dari "./mat.wni"\ncetak(PI, kuadrat(4), tambah(2, 3))',
    modul,
  );
  assert.deepEqual(keluaran, ["3 16 5"]);
});

test("impor namespace", () => {
  const modul = { "./a.wni": "ekspor misal x = 10\nekspor misal y = 20" };
  assert.deepEqual(jalankanModul('impor * sebagai a dari "./a.wni"\ncetak(a.x + a.y)', modul), ["30"]);
});

test("impor bernama dengan rename", () => {
  const modul = { "./a.wni": "ekspor fungsi halo() { kembalikan `hai` }" };
  assert.deepEqual(jalankanModul('impor { halo sebagai sapa } dari "./a.wni"\ncetak(sapa())', modul), ["hai"]);
});

test("modul dieksekusi sekali (cache)", () => {
  const modul = { "./sekali.wni": 'cetak("modul dimuat")\nekspor misal nilai = 1' };
  const keluaran = jalankanModul(
    'impor { nilai } dari "./sekali.wni"\nimpor * sebagai lagi dari "./sekali.wni"\ncetak(nilai, lagi.nilai)',
    modul,
  );
  assert.deepEqual(keluaran, ["modul dimuat", "1 1"]);
});

test("impor dinamis mengembalikan Janji", () => {
  const modul = { "./d.wni": "ekspor bawaan 42" };
  assert.deepEqual(jalankanModul('impor("./d.wni").lalu((m) => cetak(m.bawaan))', modul), ["42"]);
});

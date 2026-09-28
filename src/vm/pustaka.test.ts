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

test("Matematika", () => {
  assert.equal(satu("cetak(Matematika.akar(9), Matematika.pangkat(2, 10), Matematika.mutlak(-5))"), "3 1024 5");
  assert.equal(satu("cetak(Matematika.maks(1, 9, 3), Matematika.min(4, 2, 8), Matematika.bawah(3.9), Matematika.atas(3.1))"), "9 2 3 4");
});

test("metode Teks", () => {
  assert.equal(satu('cetak("abc".besar(), "ABC".kecil())'), "ABC abc");
  assert.equal(satu('cetak("a,b,c".pisah(","))'), '["a", "b", "c"]');
  assert.equal(satu('cetak("halo".ulangi(3), "  x  ".rapikan())'), "halohalohalo x");
  assert.equal(satu('cetak("halo dunia".ganti("dunia", "indo"))'), "halo indo");
  assert.equal(satu('cetak("abcdef".iris(1, 3), "abc".diawali("ab"), "abc".diakhiri("bc"))'), "bc benar benar");
});

test("metode Larik dasar dan fungsional", () => {
  assert.equal(satu("cetak([1, 2, 3].petakan((x) => x * x))"), "[1, 4, 9]");
  assert.equal(satu("cetak([1, 2, 3, 4].saring((x) => x % 2 == 0))"), "[2, 4]");
  assert.equal(satu("cetak([1, 2, 3, 4].kurangi((a, b) => a + b, 0))"), "10");
  assert.equal(satu("cetak([3, 1, 2].diurutkan((a, b) => a - b))"), "[1, 2, 3]");
  assert.equal(satu('cetak([1, 2, 3].gabung("-"))'), "1-2-3");
  assert.equal(satu("cetak([[1, 2], [3, [4]]].ratakan(2))"), "[1, 2, 3, 4]");
  assert.equal(satu("misal a = [1, 2]\na.tambah(3)\ncetak(a)\ncetak(a.hapusAkhir())\ncetak(a)"), "[1, 2, 3]\n3\n[1, 2]");
});

test("Objek statik", () => {
  assert.equal(satu('cetak(Objek.kunci({ a: 1, b: 2 }))'), '["a", "b"]');
  assert.equal(satu('cetak(Objek.nilai({ a: 1, b: 2 }))'), "[1, 2]");
  assert.equal(satu('misal o = Objek.dariEntri([["x", 1], ["y", 2]])\ncetak(o.x, o.y)'), "1 2");
  assert.equal(satu('misal o = { a: 1 }\nObjek.bekukan(o)\no.a = 2\ncetak(o.a, Objek.adalahBeku(o))'), "1 benar");
});

test("JSON", () => {
  assert.equal(satu('cetak(JSON.teks({ a: 1, b: [2, 3], c: "x" }))'), '{"a":1,"b":[2,3],"c":"x"}');
  assert.equal(satu('misal o = JSON.urai(`{"n":5,"a":[1,2]}`)\ncetak(o.n, o.a[1])'), "5 2");
});

test("Angka dan Teks statik", () => {
  assert.equal(satu("cetak(Angka.adalahBulat(4), Angka.adalahBulat(4.5))"), "benar salah");
  assert.equal(satu("cetak((3.14159).keTetap(2))"), "3.14");
  assert.equal(satu("cetak(Teks.dariKode(65, 66, 67))"), "ABC");
});

test("RegEx", () => {
  assert.equal(satu('cetak(/\\d+/.uji("abc123"), /\\d+/.uji("abc"))'), "benar salah");
  assert.equal(satu('misal m = "budi@mail".cocok(/(\\w+)@(\\w+)/)\ncetak(m[1], m[2])'), "budi mail");
  assert.equal(satu('cetak(baru RegEx("a", "g").sumber)'), "a");
});

test("Tanggal format Indonesia", () => {
  assert.equal(satu("misal t = baru Tanggal(2026, 8, 28)\ncetak(t.ambilTahun(), t.ambilTanggal())"), "2026 28");
  assert.equal(satu("cetak(baru Tanggal(2026, 8, 28).keTeksIndonesia())"), "Senin, 28 September 2026");
});

test("Kripto dan Jalur", () => {
  assert.equal(satu("cetak(Kripto.acakUUID().panjang)"), "36");
  assert.equal(satu('cetak(Kripto.hash("halo").panjang)'), "64");
  assert.equal(satu('cetak(Jalur.gabung("a", "b"), Jalur.ekstensi("x.wni"))'), "a/b .wni");
});

test("Larik statik", () => {
  assert.equal(satu('cetak(Larik.dari("abc"))'), '["a", "b", "c"]');
  assert.equal(satu("cetak(Larik.adalahLarik([1]), Larik.adalahLarik(5))"), "benar salah");
  assert.equal(satu("cetak(Larik.dari([1, 2, 3], (x) => x * 10))"), "[10, 20, 30]");
});

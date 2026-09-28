import { test } from "node:test";
import assert from "node:assert/strict";
import { urai } from "./parser.js";
import type * as A from "./ast.js";
import { GalatSintaks } from "../galat/kompilasi.js";

function program(sumber: string): A.Program {
  return urai(sumber, "uji.wni");
}

function ekspresi(sumber: string): A.Ekspresi {
  const p = program(sumber);
  const pertama = p.tubuh[0];
  assert.equal(pertama?.jenis, "PernyataanEkspresi");
  return (pertama as A.PernyataanEkspresi).ekspresi;
}

test("deklarasi variabel dengan tiga ragam", () => {
  assert.equal((program("misal x = 1").tubuh[0] as A.DeklarasiVariabel).ragam, "misal");
  assert.equal((program("tetap y = 2").tubuh[0] as A.DeklarasiVariabel).ragam, "tetap");
  assert.equal((program("var z = 3").tubuh[0] as A.DeklarasiVariabel).ragam, "var");
});

test("presedensi aritmatika", () => {
  const e = ekspresi("1 + 2 * 3") as A.Biner;
  assert.equal(e.jenis, "Biner");
  assert.equal(e.operator, "+");
  assert.equal((e.kanan as A.Biner).operator, "*");
});

test("pangkat asosiatif kanan", () => {
  const e = ekspresi("2 ** 3 ** 2") as A.Biner;
  assert.equal(e.operator, "**");
  assert.equal((e.kanan as A.Biner).operator, "**");
});

test("logika menghasilkan simpul Logika", () => {
  const e = ekspresi("a dan b atau c");
  assert.equal(e.jenis, "Logika");
  assert.equal((e as A.Logika).operator, "||");
});

test("perbandingan bersifat ketat sebagai == dan !=", () => {
  assert.equal((ekspresi("a == b") as A.Biner).operator, "==");
  assert.equal((ekspresi("a === b") as A.Biner).operator, "===");
});

test("penugasan dan penugasan gabungan", () => {
  assert.equal((ekspresi("x = 1") as A.Penugasan).operator, "=");
  assert.equal((ekspresi("x += 1") as A.Penugasan).operator, "+=");
  assert.equal((ekspresi("x ??= 1") as A.Penugasan).operator, "??=");
});

test("ternary", () => {
  const e = ekspresi("a ? b : c");
  assert.equal(e.jenis, "Kondisional");
});

test("optional chaining dibungkus RantaiOpsional", () => {
  const e = ekspresi("a?.b.c");
  assert.equal(e.jenis, "RantaiOpsional");
});

test("template teks dengan substitusi", () => {
  const e = ekspresi("`halo ${nama} umur ${umur}`") as A.TemplateTeks;
  assert.equal(e.jenis, "TemplateTeks");
  assert.deepEqual(e.bagian, ["halo ", " umur ", ""]);
  assert.equal(e.ekspresi.length, 2);
});

test("tagged template", () => {
  const e = ekspresi("tag`x ${y}`");
  assert.equal(e.jenis, "TemplateTertag");
});

test("fungsi panah satu parameter", () => {
  const e = ekspresi("x => x + 1") as A.Fungsi;
  assert.equal(e.jenis, "Fungsi");
  assert.equal(e.panah, true);
  assert.equal(e.parameter.length, 1);
});

test("fungsi panah dengan tanda kurung dan async", () => {
  const e = ekspresi("asinkron (a, b) => a") as A.Fungsi;
  assert.equal(e.panah, true);
  assert.equal(e.asinkron, true);
  assert.equal(e.parameter.length, 2);
});

test("kurung sebagai pengelompokan bukan panah", () => {
  const e = ekspresi("(1 + 2) * 3") as A.Biner;
  assert.equal(e.operator, "*");
});

test("deklarasi fungsi, generator, async", () => {
  assert.equal((program("fungsi f() {}").tubuh[0] as A.DeklarasiFungsi).fungsi.generator, false);
  assert.equal((program("fungsi* g() {}").tubuh[0] as A.DeklarasiFungsi).fungsi.generator, true);
  assert.equal((program("asinkron fungsi h() {}").tubuh[0] as A.DeklarasiFungsi).fungsi.asinkron, true);
});

test("kelas lengkap", () => {
  const d = program(
    `kelas Hewan mewarisi Makhluk {
      konstruktor(n) { ini.n = n }
      statis buat() {}
      dapatkan nama() {}
      #rahasia = 1
      statis { }
    }`,
  ).tubuh[0] as A.DeklarasiKelas;
  const anggota = d.kelas.anggota;
  assert.equal(d.kelas.induk?.jenis, "Identifier");
  assert.equal((anggota[0] as A.MetodeKelas).ragam, "konstruktor");
  assert.equal((anggota[1] as A.MetodeKelas).statis, true);
  assert.equal((anggota[2] as A.MetodeKelas).ragam, "dapatkan");
  assert.equal(anggota[3]?.jenis, "FieldKelas");
  assert.equal(anggota[4]?.jenis, "BlokStatis");
});

test("destrukturisasi larik dan objek dengan default dan sisa", () => {
  const d = program("misal [a, b = 2, ...sisa] = daftar").tubuh[0] as A.DeklarasiVariabel;
  assert.equal(d.deklarasi[0]?.id.jenis, "PolaLarik");
  const d2 = program("misal { x, y: z, ...rest } = objek").tubuh[0] as A.DeklarasiVariabel;
  assert.equal(d2.deklarasi[0]?.id.jenis, "PolaObjek");
});

test("kontrol alur", () => {
  assert.equal(program("jika (a) b; lainnya c;").tubuh[0]?.jenis, "Jika");
  assert.equal(program("selama (a) {}").tubuh[0]?.jenis, "Selama");
  assert.equal(program("lakukan {} selama (a)").tubuh[0]?.jenis, "LakukanSelama");
  assert.equal(program("untuk (misal i = 0; i < 3; i++) {}").tubuh[0]?.jenis, "UntukKlasik");
  assert.equal(program("untuk (misal x dari daftar) {}").tubuh[0]?.jenis, "UntukDari");
  assert.equal(program("untuk (misal k dalam objek) {}").tubuh[0]?.jenis, "UntukDalam");
  assert.equal((program("untuk tunggu (misal x dari a) {}").tubuh[0] as A.UntukDari).tunggu, true);
});

test("pilih kasus bawaan", () => {
  const p = program("pilih (x) { kasus 1: a; henti; bawaan: b; }").tubuh[0] as A.Pilih;
  assert.equal(p.jenis, "Pilih");
  assert.equal(p.kasus.length, 2);
  assert.equal(p.kasus[1]?.uji, null);
});

test("coba tangkap akhirnya", () => {
  const c = program("coba {} tangkap (e) {} akhirnya {}").tubuh[0] as A.Coba;
  assert.equal(c.penangkap?.param?.jenis, "Identifier");
  assert.notEqual(c.akhirnya, null);
  const c2 = program("coba {} tangkap {}").tubuh[0] as A.Coba;
  assert.equal(c2.penangkap?.param, null);
});

test("henti dan lanjut dengan label", () => {
  const p = program("luar: untuk (;;) { henti luar; }").tubuh[0] as A.Berlabel;
  assert.equal(p.jenis, "Berlabel");
  assert.equal(p.label.nama, "luar");
});

test("impor beragam bentuk", () => {
  assert.equal((program('impor x dari "./a.wni"').tubuh[0] as A.Impor).penentu[0]?.ragam, "bawaan");
  assert.equal((program('impor { a, b sebagai c } dari "./a.wni"').tubuh[0] as A.Impor).penentu[1]?.impor, "b");
  assert.equal((program('impor * sebagai m dari "./a.wni"').tubuh[0] as A.Impor).penentu[0]?.ragam, "namespace");
});

test("ekspor beragam bentuk", () => {
  assert.equal(program("ekspor misal x = 1").tubuh[0]?.jenis, "EksporBernama");
  assert.equal(program("ekspor bawaan 42").tubuh[0]?.jenis, "EksporBawaan");
  assert.equal(program('ekspor * dari "./a.wni"').tubuh[0]?.jenis, "EksporSemua");
  assert.equal((program('ekspor { a, b sebagai c } dari "./a.wni"').tubuh[0] as A.EksporBernama).penentu.length, 2);
});

test("impor dinamis sebagai ekspresi", () => {
  const e = ekspresi('impor("./a.wni")');
  assert.equal(e.jenis, "ImporDinamis");
});

test("spread pada pemanggilan, larik, objek", () => {
  assert.equal(((ekspresi("f(...a)") as A.Pemanggilan).argumen[0] as A.Sebar).jenis, "Sebar");
  assert.equal(((ekspresi("[...a]") as A.Larik).elemen[0] as A.Sebar).jenis, "Sebar");
  assert.equal(((ekspresi("({...a})") as A.Objek).properti[0] as A.Sebar).jenis, "Sebar");
});

test("objek shorthand, terhitung, metode", () => {
  const o = ekspresi("({ a, [b]: 1, m() {}, dapatkan x() {} })") as A.Objek;
  const p0 = o.properti[0] as A.PropertiObjek;
  assert.equal(p0.singkat, true);
  assert.equal((o.properti[1] as A.PropertiObjek).terhitung, true);
  assert.equal((o.properti[2] as A.PropertiObjek).metode, true);
  assert.equal((o.properti[3] as A.PropertiObjek).ragam, "dapatkan");
});

test("kata kunci boleh jadi nama properti", () => {
  const e = ekspresi("obj.hapus") as A.AksesAnggota;
  assert.equal((e.properti as A.Identifier).nama, "hapus");
  const c = ekspresi("obj.kelas()") as A.Pemanggilan;
  assert.equal(c.jenis, "Pemanggilan");
});

test("baru dengan dan tanpa argumen", () => {
  assert.equal((ekspresi("baru Orang(1)") as A.Baru).argumen.length, 1);
  assert.equal((ekspresi("baru Orang") as A.Baru).argumen.length, 0);
});

test("angka literal beragam", () => {
  assert.equal((ekspresi("0xFF") as A.LiteralAngka).nilai, 255);
  assert.equal((ekspresi("0b1010") as A.LiteralAngka).nilai, 10);
  assert.equal((ekspresi("1_000") as A.LiteralAngka).nilai, 1000);
  assert.equal((ekspresi("10n") as A.LiteralBilanganBesar).nilai, 10n);
});

test("galat: kurung tidak ditutup", () => {
  assert.throws(() => program("(1 + 2"), GalatSintaks);
});

test("galat: token tak terduga", () => {
  assert.throws(() => program("misal = 1"), GalatSintaks);
});

test("galat: larik dengan lubang", () => {
  assert.throws(() => program("misal a = [1, , 2]"), GalatSintaks);
});

test("galat: coba tanpa tangkap maupun akhirnya", () => {
  assert.throws(() => program("coba {}"), GalatSintaks);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenisasi } from "./lexer.js";
import { JenisToken } from "./token.js";
import { GalatSintaks } from "../galat/kompilasi.js";

function jenisDari(sumber: string): JenisToken[] {
  return tokenisasi(sumber)
    .filter((t) => t.jenis !== JenisToken.AkhirBerkas)
    .map((t) => t.jenis);
}

function teksDari(sumber: string): string[] {
  return tokenisasi(sumber)
    .filter((t) => t.jenis !== JenisToken.AkhirBerkas)
    .map((t) => t.teks);
}

test("kata kunci dan identifier dibedakan", () => {
  assert.deepEqual(jenisDari("misal x"), [JenisToken.KkMisal, JenisToken.Identifier]);
  assert.deepEqual(jenisDari("tetap fungsi kembalikan"), [
    JenisToken.KkTetap,
    JenisToken.KkFungsi,
    JenisToken.KkKembalikan,
  ]);
});

test("operator kata logika dipetakan ke simbol", () => {
  assert.deepEqual(jenisDari("a dan b atau bukan c"), [
    JenisToken.Identifier,
    JenisToken.DanDan,
    JenisToken.Identifier,
    JenisToken.AtauAtau,
    JenisToken.Seru,
    JenisToken.Identifier,
  ]);
});

test("angka desimal, hex, biner, oktal, pemisah, eksponen", () => {
  assert.deepEqual(jenisDari("42"), [JenisToken.Angka]);
  assert.deepEqual(jenisDari("0xFF"), [JenisToken.Angka]);
  assert.deepEqual(jenisDari("0b1010"), [JenisToken.Angka]);
  assert.deepEqual(jenisDari("0o755"), [JenisToken.Angka]);
  assert.deepEqual(teksDari("1_000_000"), ["1_000_000"]);
  assert.deepEqual(jenisDari("1.5e-3"), [JenisToken.Angka]);
  assert.deepEqual(jenisDari(".5"), [JenisToken.Angka]);
});

test("bilangan besar dengan akhiran n", () => {
  assert.deepEqual(jenisDari("10n"), [JenisToken.BilanganBesar]);
  assert.deepEqual(jenisDari("0xFFn"), [JenisToken.BilanganBesar]);
});

test("teks dengan escape", () => {
  assert.deepEqual(jenisDari('"halo"'), [JenisToken.Teks]);
  assert.deepEqual(teksDari('"a\\"b"'), ['"a\\"b"']);
});

test("template utuh dan dengan substitusi", () => {
  assert.deepEqual(jenisDari("`halo`"), [JenisToken.TemplateUtuh]);
  assert.deepEqual(jenisDari("`halo ${nama}!`"), [
    JenisToken.TemplateKepala,
    JenisToken.Identifier,
    JenisToken.TemplateEkor,
  ]);
  assert.deepEqual(jenisDari("`${a}${b}`"), [
    JenisToken.TemplateKepala,
    JenisToken.Identifier,
    JenisToken.TemplateTengah,
    JenisToken.Identifier,
    JenisToken.TemplateEkor,
  ]);
});

test("template dengan objek bersarang di ekspresi", () => {
  assert.deepEqual(jenisDari("`${ {a:1} }`"), [
    JenisToken.TemplateKepala,
    JenisToken.KurawalBuka,
    JenisToken.Identifier,
    JenisToken.TitikDua,
    JenisToken.Angka,
    JenisToken.KurawalTutup,
    JenisToken.TemplateEkor,
  ]);
});

test("regex dibedakan dari pembagian", () => {
  assert.deepEqual(jenisDari("/ab+c/gi"), [JenisToken.Regex]);
  assert.deepEqual(jenisDari("a / b"), [JenisToken.Identifier, JenisToken.Bagi, JenisToken.Identifier]);
  assert.deepEqual(jenisDari("kembalikan /x/"), [JenisToken.KkKembalikan, JenisToken.Regex]);
});

test("operator gabungan multi-karakter", () => {
  assert.deepEqual(jenisDari(">>>="), [JenisToken.GeserKananNolSama]);
  assert.deepEqual(jenisDari("**="), [JenisToken.PangkatSama]);
  assert.deepEqual(jenisDari("?."), [JenisToken.TanyaTitik]);
  assert.deepEqual(jenisDari("??="), [JenisToken.NullishSama]);
  assert.deepEqual(jenisDari("..."), [JenisToken.Elipsis]);
  assert.deepEqual(jenisDari("=>"), [JenisToken.Panah]);
  assert.deepEqual(jenisDari("&&= ||="), [JenisToken.DanDanSama, JenisToken.AtauAtauSama]);
});

test("optional chaining tidak menelan angka", () => {
  assert.deepEqual(jenisDari("a?.5"), [
    JenisToken.Identifier,
    JenisToken.Tanya,
    JenisToken.Angka,
  ]);
});

test("nama privat", () => {
  assert.deepEqual(jenisDari("#rahasia"), [JenisToken.PrivatNama]);
});

test("komentar baris dan blok dilewati", () => {
  assert.deepEqual(jenisDari("a // komentar\nb"), [JenisToken.Identifier, JenisToken.Identifier]);
  assert.deepEqual(jenisDari("a /* blok */ b"), [JenisToken.Identifier, JenisToken.Identifier]);
});

test("posisi baris dan kolom tercatat", () => {
  const token = tokenisasi("misal\n  x");
  assert.equal(token[1]?.baris, 2);
  assert.equal(token[1]?.kolom, 3);
});

test("penanda baris baru sebelum token", () => {
  const token = tokenisasi("a\nb");
  assert.equal(token[0]?.didahuluiBarisBaru, false);
  assert.equal(token[1]?.didahuluiBarisBaru, true);
});

test("galat: teks tidak ditutup", () => {
  assert.throws(() => tokenisasi('"belum tutup'), GalatSintaks);
});

test("galat: pemisah ganda pada angka", () => {
  assert.throws(() => tokenisasi("1__000"), GalatSintaks);
});

test("galat: komentar blok tidak ditutup", () => {
  assert.throws(() => tokenisasi("/* tak selesai"), GalatSintaks);
});

test("galat: karakter tidak dikenal", () => {
  assert.throws(() => tokenisasi("@"), GalatSintaks);
});

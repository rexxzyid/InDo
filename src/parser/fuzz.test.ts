import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenisasi } from "../lexer/lexer.js";
import { urai } from "./parser.js";
import { GalatSintaks } from "../galat/kompilasi.js";

function acakTerkendali(benih: number): () => number {
  let keadaan = benih >>> 0;
  return () => {
    keadaan = (keadaan + 0x6d2b79f5) >>> 0;
    let t = keadaan;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POTONGAN = [
  "misal ", "tetap ", "fungsi ", "kembalikan ", "jika", "lainnya", "untuk", "selama",
  "kelas", "baru", "ini", "coba", "tangkap", "lempar", "impor", "ekspor", "dari", "sebagai",
  "a", "b", "x", "y", "nama", "1", "42", "0xFF", "1_000", "10n", "3.14", '"teks"', "`t${a}`",
  "+", "-", "*", "/", "%", "**", "==", "!=", "===", "&&", "||", "??", "?.", "=>", "...", "?",
  ":", ";", ",", ".", "(", ")", "[", "]", "{", "}", "=", "+=", "<", ">", "<=", ">=", "!",
  "\n", " ", "//c\n", "/*c*/", "/re/g", "dan", "atau", "bukan", "jenisdari", "contohdari",
  "hasilkan", "tunggu", "asinkron", "#p", "dapatkan", "tetapkan", "statis", "@", "\\", "'",
];

function bangunMasukan(acak: () => number): string {
  const jumlah = Math.floor(acak() * 25) + 1;
  let hasil = "";
  for (let i = 0; i < jumlah; i += 1) {
    hasil += POTONGAN[Math.floor(acak() * POTONGAN.length)];
  }
  return hasil;
}

test("fuzz lexer tidak pernah crash di luar GalatSintaks", () => {
  const acak = acakTerkendali(12345);
  for (let i = 0; i < 3000; i += 1) {
    const masukan = bangunMasukan(acak);
    try {
      tokenisasi(masukan, "fuzz.wni");
    } catch (galat) {
      assert.ok(galat instanceof GalatSintaks, `lexer melempar galat tak terduga untuk: ${JSON.stringify(masukan)}`);
    }
  }
});

test("fuzz parser tidak pernah crash di luar GalatSintaks", () => {
  const acak = acakTerkendali(67890);
  for (let i = 0; i < 3000; i += 1) {
    const masukan = bangunMasukan(acak);
    try {
      urai(masukan, "fuzz.wni");
    } catch (galat) {
      assert.ok(galat instanceof GalatSintaks, `parser melempar galat tak terduga untuk: ${JSON.stringify(masukan)}`);
    }
  }
});

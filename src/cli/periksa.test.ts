import { test } from "node:test";
import assert from "node:assert/strict";
import { periksaSumber } from "./periksa.js";
import type { Keluaran } from "./cli.js";

function penangkap(): { keluaran: Keluaran; baris: string[]; galat: string[] } {
  const baris: string[] = [];
  const galat: string[] = [];
  return {
    baris,
    galat,
    keluaran: { tulis: (p) => baris.push(p), galat: (p) => galat.push(p) },
  };
}

test("periksa sumber benar mengembalikan 0", () => {
  const p = penangkap();
  const kode = periksaSumber("misal x = 1\nfungsi f() { kembalikan x }", "ok.wni", p.keluaran);
  assert.equal(kode, 0);
  assert.ok(p.baris[0]?.includes("Tidak ada galat"));
});

test("periksa sumber salah menampilkan penanda posisi", () => {
  const p = penangkap();
  const kode = periksaSumber("misal x = ", "salah.wni", p.keluaran);
  assert.equal(kode, 1);
  const pesan = p.galat.join("\n");
  assert.ok(pesan.includes("GalatSintaks"));
  assert.ok(pesan.includes("salah.wni"));
  assert.ok(pesan.includes("^"));
});

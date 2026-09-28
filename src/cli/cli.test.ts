import { test } from "node:test";
import assert from "node:assert/strict";
import { jalankanCli, type Keluaran } from "./cli.js";
import { VERSI } from "../versi.js";

function penangkap(): { keluaran: Keluaran; baris: string[]; galat: string[] } {
  const baris: string[] = [];
  const galat: string[] = [];
  return {
    baris,
    galat,
    keluaran: {
      tulis: (pesan) => baris.push(pesan),
      galat: (pesan) => galat.push(pesan),
    },
  };
}

test("perintah versi menampilkan versi", () => {
  const p = penangkap();
  const kode = jalankanCli(["versi"], p.keluaran);
  assert.equal(kode, 0);
  assert.ok(p.baris[0]?.includes(VERSI));
});

test("perintah bantuan berhasil", () => {
  const p = penangkap();
  const kode = jalankanCli(["bantuan"], p.keluaran);
  assert.equal(kode, 0);
  assert.ok(p.baris[0]?.includes("Penggunaan"));
});

test("perintah tidak dikenal mengembalikan kode 1", () => {
  const p = penangkap();
  const kode = jalankanCli(["ngawur"], p.keluaran);
  assert.equal(kode, 1);
  assert.ok(p.galat.some((b) => b.includes("tidak dikenal")));
});

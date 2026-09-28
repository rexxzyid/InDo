import { test } from "node:test";
import assert from "node:assert/strict";
import { jalankanSumber } from "../cli/jalankan.js";
import type { Keluaran } from "../cli/cli.js";

test("server HTTP + Jaringan.ambil lokal", async () => {
  const baris: string[] = [];
  const keluaran: Keluaran = { tulis: (t) => baris.push(t), galat: (t) => baris.push(t) };
  const sumber = `
misal server = Jaringan.buatServer((permintaan, respon) => {
  respon.kirim(200, "Halo " + permintaan.url)
})
server.dengar(0)
asinkron fungsi uji() {
  misal port = server.alamat()
  misal r = tunggu Jaringan.ambil("http://127.0.0.1:" + port + "/dunia")
  misal teks = tunggu r.teks()
  cetak(r.status, teks)
  server.tutup()
}
uji()
`;
  const kode = await jalankanSumber(sumber, "uji.wni", keluaran);
  assert.equal(kode, 0);
  assert.deepEqual(baris, ["200 Halo /dunia"]);
});

test("Berkas asinkron baca/tulis", async () => {
  const baris: string[] = [];
  const keluaran: Keluaran = { tulis: (t) => baris.push(t), galat: (t) => baris.push(t) };
  const jalur = `/tmp/indo-uji-${process.pid}.txt`;
  const sumber = `
asinkron fungsi uji() {
  tunggu BerkasAsinkron.tulis(${JSON.stringify(jalur)}, "isi asinkron")
  misal isi = tunggu BerkasAsinkron.baca(${JSON.stringify(jalur)})
  cetak(isi)
  tunggu BerkasAsinkron.hapus(${JSON.stringify(jalur)})
}
uji()
`;
  const kode = await jalankanSumber(sumber, "uji.wni", keluaran);
  assert.equal(kode, 0);
  assert.deepEqual(baris, ["isi asinkron"]);
});

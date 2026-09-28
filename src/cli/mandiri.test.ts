import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { jalankanBerkasMandiri } from "./mandiri.js";
import { jalankanSumber } from "./jalankan.js";
import type { Keluaran } from "./cli.js";

const SEMENTARA = mkdtempSync(join(tmpdir(), "cli-mandiri-"));

function penangkap(): { keluaran: Keluaran; keluar: string[]; galat: string[] } {
  const keluar: string[] = [];
  const galat: string[] = [];
  return { keluar, galat, keluaran: { tulis: (t) => keluar.push(t), galat: (t) => galat.push(t) } };
}

const PROGRAM: { nama: string; sumber: string }[] = [
  { nama: "aritmatika", sumber: "cetak(1 + 2 * 3)\ncetak(10 % 3, 2 ** 8)" },
  { nama: "closure", sumber: "fungsi buat() { misal n = 0\n kembalikan () => { n = n + 1\n kembalikan n } }\nmisal c = buat()\ncetak(c(), c(), c())" },
  { nama: "kelas", sumber: "kelas A { konstruktor(x) { ini.x = x } lipat() { kembalikan ini.x * 2 } }\nkelas B mewarisi A { lipat() { kembalikan induk.lipat() + 1 } }\ncetak(baru B(5).lipat())" },
  { nama: "koleksi", sumber: "misal a = [1, 2, 3, 4]\ncetak(a.petakan((x) => x * x).gabung(\",\"))\ncetak(a.kurangi((s, x) => s + x, 0))" },
  { nama: "generator", sumber: "fungsi* g() { hasilkan 1\n hasilkan 2\n hasilkan 3 }\nmisal t = 0\nuntuk (tetap v dari g()) t = t + v\ncetak(t)" },
  { nama: "coba", sumber: "coba { lempar baru Galat(\"x\") } tangkap (e) { cetak(\"tangkap \" + e.pesan) } akhirnya { cetak(\"akhir\") }" },
];

for (const { nama, sumber } of PROGRAM) {
  test(`indo mandiri = pipeline TS: ${nama}`, async () => {
    const berkas = join(SEMENTARA, `${nama}.wni`);
    writeFileSync(berkas, sumber);

    const ts = penangkap();
    const kodeTs = await jalankanSumber(sumber, berkas, ts.keluaran);
    assert.equal(kodeTs, 0);
    assert.equal(ts.galat.join("\n"), "");

    const m = penangkap();
    const kodeM = await jalankanBerkasMandiri(berkas, m.keluaran);
    assert.equal(m.galat.join("\n"), "", `mandiri galat untuk ${nama}`);
    assert.equal(kodeM, 0);
    assert.equal(m.keluar.join("\n"), ts.keluar.join("\n"));
  });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { jalankanBerkas } from "../cli/jalankan.js";
import { jalankanBerkasMandiri } from "../cli/mandiri.js";
import type { Keluaran } from "../cli/cli.js";

const DIR = resolve(process.cwd(), "contoh");

function penangkap(): { keluaran: Keluaran; keluar: string[]; galat: string[] } {
  const keluar: string[] = [];
  const galat: string[] = [];
  return { keluar, galat, keluaran: { tulis: (t) => keluar.push(t), galat: (t) => galat.push(t) } };
}

const berkas = existsSync(DIR) ? readdirSync(DIR).filter((n) => n.endsWith(".wni")).sort() : [];

for (const nama of berkas) {
  test(`contoh berjalan (benih & mandiri) identik: ${nama}`, async () => {
    const jalur = join(DIR, nama);

    const benih = penangkap();
    const kodeBenih = await jalankanBerkas(jalur, benih.keluaran);
    assert.equal(benih.galat.join("\n"), "", `contoh ${nama} galat di pipeline benih`);
    assert.equal(kodeBenih, 0);

    const mandiri = penangkap();
    const kodeMandiri = await jalankanBerkasMandiri(jalur, mandiri.keluaran);
    assert.equal(mandiri.galat.join("\n"), "", `contoh ${nama} galat di compiler mandiri`);
    assert.equal(kodeMandiri, 0);

    assert.equal(mandiri.keluar.join("\n"), benih.keluar.join("\n"));
  });
}

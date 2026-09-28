import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { jalankanSumber } from "../cli/jalankan.js";
import type { Keluaran } from "../cli/cli.js";

const AKAR_TES = resolve(process.cwd(), "tes");

function penangkap(): { keluaran: Keluaran; keluar: string[]; galat: string[] } {
  const keluar: string[] = [];
  const galat: string[] = [];
  return { keluar, galat, keluaran: { tulis: (t) => keluar.push(t), galat: (t) => galat.push(t) } };
}

function daftarBerkasIndo(): string[] {
  if (!existsSync(AKAR_TES)) return [];
  return readdirSync(AKAR_TES, { recursive: true })
    .map((n) => String(n))
    .filter((n) => n.endsWith(".wni") && !n.endsWith(".tes.wni"))
    .sort();
}

for (const relatif of daftarBerkasIndo()) {
  const jalur = join(AKAR_TES, relatif);
  const dasar = jalur.slice(0, -".wni".length);
  const berkasKeluaran = `${dasar}.keluaran`;
  const berkasGalat = `${dasar}.galat`;

  if (existsSync(berkasKeluaran)) {
    test(`emas: ${relatif} (berhasil)`, async () => {
      const sumber = readFileSync(jalur, "utf8");
      const p = penangkap();
      const kode = await jalankanSumber(sumber, jalur, p.keluaran);
      const diharapkan = readFileSync(berkasKeluaran, "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
      assert.equal(p.galat.join("\n"), "", `tidak boleh ada galat untuk ${relatif}`);
      assert.equal(kode, 0);
      assert.equal(p.keluar.join("\n"), diharapkan);
    });
  } else if (existsSync(berkasGalat)) {
    test(`emas: ${relatif} (galat)`, async () => {
      const sumber = readFileSync(jalur, "utf8");
      const p = penangkap();
      const kode = await jalankanSumber(sumber, jalur, p.keluaran);
      const diharapkan = readFileSync(berkasGalat, "utf8").replace(/\r\n/g, "\n").trim();
      assert.equal(kode, 1);
      assert.ok(
        p.galat.join("\n").includes(diharapkan),
        `galat untuk ${relatif} harus memuat "${diharapkan}", tetapi:\n${p.galat.join("\n")}`,
      );
    });
  }
}

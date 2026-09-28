import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { tokenisasi } from "../lexer/lexer.js";
import { jalankanSumber } from "../cli/jalankan.js";
import type { Keluaran } from "../cli/cli.js";

const AKAR = process.cwd();
const HARNESS = resolve(AKAR, "mandiri/uji-lexer.wni");
const HARNESS_SUMBER = readFileSync(HARNESS, "utf8");
const SEMENTARA = mkdtempSync(join(tmpdir(), "mandiri-lexer-"));

function kanonikTS(sumber: string, namaBerkas: string): string {
  return tokenisasi(sumber, namaBerkas)
    .map(
      (t) =>
        `${t.jenis}|${t.baris}|${t.kolom}|${t.awal}|${t.akhir}|${t.didahuluiBarisBaru ? "1" : "0"}|${JSON.stringify(t.teks)}`,
    )
    .join("\n");
}

async function kanonikInDo(sumber: string, nama: string): Promise<string> {
  const jalurMasukan = join(SEMENTARA, nama.replace(/[^\w.-]/g, "_"));
  writeFileSync(jalurMasukan, sumber);
  const keluar: string[] = [];
  const galat: string[] = [];
  const keluaran: Keluaran = { tulis: (t) => keluar.push(t), galat: (t) => galat.push(t) };
  const lama = process.env.MASUKAN_MANDIRI;
  process.env.MASUKAN_MANDIRI = jalurMasukan;
  try {
    const kode = await jalankanSumber(HARNESS_SUMBER, HARNESS, keluaran);
    assert.equal(galat.join("\n"), "", `harness galat untuk ${nama}`);
    assert.equal(kode, 0, `harness kode bukan 0 untuk ${nama}`);
  } finally {
    if (lama === undefined) delete process.env.MASUKAN_MANDIRI;
    else process.env.MASUKAN_MANDIRI = lama;
  }
  return keluar.join("\n");
}

function korpus(): { nama: string; sumber: string }[] {
  const hasil: { nama: string; sumber: string }[] = [];
  for (const dir of ["tes", "mandiri", "contoh"]) {
    const penuh = resolve(AKAR, dir);
    if (!existsSync(penuh)) continue;
    for (const rel of readdirSync(penuh, { recursive: true }).map(String)) {
      if (!rel.endsWith(".wni")) continue;
      hasil.push({ nama: `${dir}/${rel}`, sumber: readFileSync(join(penuh, rel), "utf8") });
    }
  }
  return hasil;
}

const SAMPEL: { nama: string; sumber: string }[] = [
  { nama: "regex.wni", sumber: "misal r = /[a-z]+\\/\\d/gi\nmisal b = a / c / d" },
  { nama: "template.wni", sumber: "misal t = `halo ${nama} umur ${1 + 2}`\nmisal u = `baris\nbaris2`" },
  { nama: "template-bersarang.wni", sumber: "misal t = `luar ${ `dalam ${x}` } akhir`" },
  { nama: "bigint.wni", sumber: "misal a = 123n\nmisal b = 0xFFn\nmisal c = 0b101n\nmisal d = 0o17n" },
  { nama: "angka.wni", sumber: "misal a = 3.14\nmisal b = .5\nmisal c = 1e10\nmisal d = 1_000_000\nmisal e = 0xDEAD_BEEF" },
  {
    nama: "operator.wni",
    sumber: "a ??= b\nc ||= d\ne &&= f\ng >>>= h\ni <<= j\nk **= l\nm ?. n\no ?? p\nq...r\ns => t\n~u\na>>>b\na>>b\na<<b",
  },
  { nama: "privat.wni", sumber: "kelas A { #rahasia = 1\n metode() { kembalikan ini.#rahasia } }" },
  { nama: "komentar.wni", sumber: "misal a = 1 // baris\nmisal b = 2 /* blok\nlanjut */ misal c = 3" },
  { nama: "kata-kunci.wni", sumber: "asinkron fungsi f() { tunggu g() }\njika (a dan b atau bukan c) {}" },
  { nama: "banding.wni", sumber: "a < b > c <= d >= e == f != g === h !== i" },
];

for (const { nama, sumber } of [...korpus(), ...SAMPEL]) {
  test(`lexer .wni cocok dengan lexer TS: ${nama}`, async () => {
    const ts = kanonikTS(sumber, nama);
    const indo = await kanonikInDo(sumber, nama);
    assert.equal(indo, ts);
  });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { urai } from "../parser/parser.js";
import { jalankanSumber } from "../cli/jalankan.js";
import type { Keluaran } from "../cli/cli.js";

const AKAR = process.cwd();
const HARNESS = resolve(AKAR, "mandiri/uji-parser.wni");
const HARNESS_SUMBER = readFileSync(HARNESS, "utf8");
const SEMENTARA = mkdtempSync(join(tmpdir(), "mandiri-parser-"));

function encodeTeks(t: string): string {
  const kode: number[] = [];
  for (let i = 0; i < t.length; i += 1) kode.push(t.charCodeAt(i));
  return "s" + kode.join(",");
}

function teksAngka(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "Takhingga";
  if (n === -Infinity) return "-Takhingga";
  return String(n);
}

function serial(v: unknown): string {
  if (v === null) return "N";
  if (v === undefined) return "U";
  const t = typeof v;
  if (t === "boolean") return v ? "b1" : "b0";
  if (t === "number") return "n" + teksAngka(v as number);
  if (t === "bigint") return "B" + (v as bigint).toString();
  if (t === "string") return encodeTeks(v as string);
  if (Array.isArray(v)) return "[" + v.map(serial).join(",") + "]";
  const o = v as Record<string, unknown>;
  const kunci = Object.keys(o).sort();
  return "{" + kunci.map((k) => `${k}=${serial(o[k])}`).join(",") + "}";
}

async function serialInDo(sumber: string, nama: string): Promise<string> {
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
  { nama: "presedensi", sumber: "misal a = 1 + 2 * 3 - 4 / 2 ** 2 % 3" },
  { nama: "logika", sumber: "misal a = x dan y atau bukan z ?? w" },
  { nama: "ternari", sumber: "misal a = k ? v1 : k2 ? v2 : v3" },
  { nama: "panah", sumber: "tetap f = (a, b = 2, ...sisa) => a + b\ntetap g = x => x * 2\ntetap h = asinkron () => tunggu p()" },
  { nama: "kelas", sumber: "kelas A mewarisi B { statis x = 1\n #p = 2\n konstruktor() { induk() }\n dapatkan nilai() { kembalikan ini.#p }\n metode() {} }" },
  { nama: "destrukturisasi", sumber: "tetap { a, b: c, d = 5, ...sisa } = obj\ntetap [x, , ...y] = arr\n[a, b] = [b, a]" },
  { nama: "objek", sumber: "misal o = { a: 1, b, [k]: 2, metode() {}, dapatkan g() { kembalikan 1 }, ...lain }" },
  { nama: "coba", sumber: "coba { f() } tangkap (e) { g(e) } akhirnya { h() }" },
  { nama: "alur", sumber: "untuk (misal i = 0; i < 10; i++) { jika (i == 5) henti\n lanjut }\nselama (x) { y() }\nlakukan { z() } selama (w)" },
  { nama: "untuk-dari", sumber: "untuk (tetap x dari daftar) { cetak(x) }\nuntuk (tetap k dalam obj) { cetak(k) }\nuntuk tunggu (tetap v dari aliran) { pakai(v) }" },
  { nama: "pilih", sumber: "pilih (x) { kasus 1: a()\n henti\n kasus 2: bawaan: b() }" },
  { nama: "rantai-opsional", sumber: "misal a = obj?.prop?.[key]?.(arg)\nmisal b = f?.()" },
  { nama: "template", sumber: "misal t = `a ${x + 1} b ${y} c`\nmisal tag = penanda`halo ${nama}`" },
  { nama: "modul", sumber: "impor bawaan, { a, b sebagai c } dari \"m\"\nimpor * sebagai ns dari \"n\"\nekspor { a, b sebagai d }\nekspor bawaan 42\nekspor * dari \"o\"" },
  { nama: "generator", sumber: "fungsi* gen() { hasilkan 1\n hasilkan* lain()\n misal x = hasilkan }" },
  { nama: "uner", sumber: "misal a = -x + +y - ~z\nmisal b = bukan p\nmisal c = jenisdari q\nhapus obj.x\nabaikan f()" },
];

for (const { nama, sumber } of [...korpus(), ...SAMPEL]) {
  test(`parser .wni cocok dengan parser TS: ${nama}`, async () => {
    let ts: string;
    try {
      ts = serial(urai(sumber, nama));
    } catch {
      return;
    }
    const indo = await serialInDo(sumber, nama);
    assert.equal(indo, ts);
  });
}

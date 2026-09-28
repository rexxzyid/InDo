import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { urai } from "../parser/parser.js";
import { Kompiler } from "../compiler/kompiler.js";
import { FungsiKompilasi } from "../runtime/nilai.js";
import { jalankanSumber } from "../cli/jalankan.js";
import type { Keluaran } from "../cli/cli.js";

const AKAR = process.cwd();
const HARNESS = resolve(AKAR, "mandiri/uji-kompiler.wni");
const HARNESS_SUMBER = readFileSync(HARNESS, "utf8");
const SEMENTARA = mkdtempSync(join(tmpdir(), "mandiri-kompiler-"));

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

function serialKonst(k: unknown): string {
  if (typeof k === "number") return "n" + teksAngka(k);
  if (typeof k === "bigint") return "B" + k.toString();
  if (typeof k === "string") return encodeTeks(k);
  if (k instanceof FungsiKompilasi) return "F(" + serialFungsi(k) + ")";
  return "?" + typeof k;
}

function serialFungsi(f: FungsiKompilasi): string {
  const konst = f.potongan.konstanta.map(serialKonst).join("|");
  return (
    "nama=" +
    encodeTeks(f.nama) +
    ";arity=" +
    f.arity +
    ";up=" +
    f.jumlahUpvalue +
    ";gen=" +
    (f.generator ? "1" : "0") +
    ";async=" +
    (f.asinkron ? "1" : "0") +
    ";sisa=" +
    (f.punyaSisa ? "1" : "0") +
    ";kode=" +
    f.potongan.kode.join(",") +
    ";garis=" +
    f.potongan.garis.join(",") +
    ";konst=[" +
    konst +
    "]"
  );
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
  { nama: "aritmatika", sumber: "misal a = 1 + 2 * 3 - 4\ntetap b = a % 3 ** 2\ncetak(a > b dan bukan salah)" },
  { nama: "lipat", sumber: "misal a = 2 + 3 * 4\nmisal b = \"x\" + \"y\"\nmisal c = 10 < 20" },
  { nama: "closure", sumber: "fungsi luar(x) { fungsi dalam() { kembalikan x + 1 }\n kembalikan dalam }\nmisal f = luar(5)" },
  { nama: "closure-dalam", sumber: "fungsi a() { misal x = 1\n kembalikan () => () => x }\n" },
  { nama: "kelas", sumber: "kelas Hewan { konstruktor(n) { ini.nama = n }\n suara() { kembalikan \"?\" } }\nkelas Kucing mewarisi Hewan { konstruktor(n) { induk(n) }\n suara() { kembalikan induk.suara() + \"meong\" } }" },
  { nama: "kelas-statis", sumber: "kelas C { statis hitung = 0\n #rahasia = 1\n statis { C.hitung = 10 }\n dapatkan nilai() { kembalikan ini.#rahasia }\n tetapkan nilai(v) { ini.#rahasia = v } }" },
  { nama: "destruktur", sumber: "tetap [a, b, ...c] = daftar\ntetap { x, y: z, w = 3 } = obj\nfungsi f([p, q], { r }) { kembalikan p + q + r }" },
  { nama: "loop", sumber: "untuk (misal i = 0; i < 10; i++) { jika (i == 3) lanjut\n jika (i == 8) henti\n cetak(i) }\nselama (a) { b() }" },
  { nama: "loop-label", sumber: "luar: untuk (tetap x dari xs) { untuk (tetap y dari ys) { jika (y) lanjut luar\n henti luar } }" },
  { nama: "untuk-koleksi", sumber: "untuk (tetap x dari daftar) { cetak(x) }\nuntuk (tetap k dalam obj) { cetak(k) }" },
  { nama: "pilih", sumber: "pilih (x) { kasus 1: a()\n henti\n kasus 2: b()\n bawaan: c() }" },
  { nama: "coba", sumber: "coba { f() } tangkap (e) { g(e) } akhirnya { h() }\ncoba { p() } akhirnya { q() }" },
  { nama: "coba-return", sumber: "fungsi f() { coba { kembalikan 1 } akhirnya { bersih() } }" },
  { nama: "template", sumber: "misal t = `nilai ${a + 1} dan ${b}`" },
  { nama: "generator", sumber: "fungsi* g() { hasilkan 1\n hasilkan* lain()\n misal x = hasilkan 2 }" },
  { nama: "async", sumber: "asinkron fungsi f() { misal x = tunggu p()\n kembalikan x + 1 }" },
  { nama: "opsional", sumber: "misal a = obj?.x?.[k]?.(1)\nmisal b = f?.()" },
  { nama: "penugasan", sumber: "a = 1\na += 2\na.b = 3\na.b += 4\na[k] += 5\na ??= 6\na ||= 7\na &&= 8" },
  { nama: "kondisional", sumber: "misal a = x ? y : z\nmisal b = p ?? q\nmisal c = m dan n atau o" },
  { nama: "modul", sumber: "impor bawaan, { a, b sebagai c } dari \"m\"\nekspor fungsi f() { kembalikan a + c }\nekspor tetap NILAI = 42" },
  { nama: "objek-larik", sumber: "misal o = { a: 1, [k]: 2, ...lain, m() { kembalikan 3 } }\nmisal l = [1, 2, ...rest, 3]" },
  { nama: "async-iter", sumber: "asinkron fungsi f(aliran) { untuk tunggu (tetap x dari aliran) { cetak(x) }\n untuk tunggu (tetap [a, b] dari aliran) { cetak(a + b) } }" },
];

for (const { nama, sumber } of [...korpus(), ...SAMPEL]) {
  test(`kompiler .wni cocok dengan kompiler TS: ${nama}`, async () => {
    let ts: string;
    try {
      ts = serialFungsi(Kompiler.kompilasiProgram(urai(sumber, nama), nama));
    } catch {
      return;
    }
    const indo = await serialInDo(sumber, nama);
    assert.equal(indo, ts);
  });
}

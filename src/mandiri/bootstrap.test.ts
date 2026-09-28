import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Mesin } from "../vm/mesin.js";
import { FungsiKompilasi, type Nilai } from "../runtime/nilai.js";
import { Potongan } from "../compiler/potongan.js";
import { jalankanSumber } from "../cli/jalankan.js";
import type { Keluaran } from "../cli/cli.js";

const AKAR = process.cwd();
const HARNESS = resolve(AKAR, "mandiri/bootstrap.wni");
const HARNESS_SUMBER = readFileSync(HARNESS, "utf8");
const SEMENTARA = mkdtempSync(join(tmpdir(), "mandiri-bootstrap-"));

interface KonstJSON {
  t: "n" | "B" | "s" | "F";
  v: number | string | FungsiJSON;
}
interface FungsiJSON {
  nama: string;
  arity: number;
  jumlahUpvalue: number;
  generator: boolean;
  asinkron: boolean;
  punyaSisa: boolean;
  kode: number[];
  garis: number[];
  konstanta: KonstJSON[];
}

function reifyKonst(k: KonstJSON): Nilai {
  if (k.t === "n") return k.v as number;
  if (k.t === "B") return BigInt(k.v as string);
  if (k.t === "s") return k.v as string;
  return reify(k.v as FungsiJSON);
}

function reify(o: FungsiJSON, namaBerkas = "<bootstrap>"): FungsiKompilasi {
  const pot = new Potongan(namaBerkas);
  pot.kode = o.kode;
  pot.garis = o.garis;
  pot.konstanta = o.konstanta.map(reifyKonst);
  const f = new FungsiKompilasi(o.nama, pot);
  f.arity = o.arity;
  f.jumlahUpvalue = o.jumlahUpvalue;
  f.generator = o.generator;
  f.asinkron = o.asinkron;
  f.punyaSisa = o.punyaSisa;
  return f;
}

async function chunkDariInDo(sumber: string, nama: string): Promise<FungsiJSON> {
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
  return JSON.parse(keluar.join("\n")) as FungsiJSON;
}

async function jalankanChunk(f: FungsiKompilasi): Promise<{ keluar: string[]; galat: string[] }> {
  const keluar: string[] = [];
  const galat: string[] = [];
  const mesin = new Mesin({
    cetak: (t) => keluar.push(t),
    galat: (t) => galat.push(t),
  });
  mesin.jalankan(f);
  await mesin.jalankanEventLoop();
  return { keluar, galat };
}

async function jalankanTS(sumber: string, nama: string): Promise<string> {
  const keluar: string[] = [];
  const galat: string[] = [];
  const keluaran: Keluaran = { tulis: (t) => keluar.push(t), galat: (t) => galat.push(t) };
  const kode = await jalankanSumber(sumber, nama, keluaran);
  assert.equal(galat.join("\n"), "", `pipeline TS galat untuk ${nama}`);
  assert.equal(kode, 0);
  return keluar.join("\n");
}

const SAMPEL: { nama: string; sumber: string }[] = [
  { nama: "fib", sumber: "fungsi fib(n) { jika (n < 2) kembalikan n\n kembalikan fib(n-1) + fib(n-2) }\nuntuk (misal i = 0; i < 10; i++) cetak(fib(i))" },
  { nama: "closure", sumber: "fungsi buat() { misal n = 0\n kembalikan () => { n = n + 1\n kembalikan n } }\nmisal c = buat()\ncetak(c(), c(), c())" },
  { nama: "kelas", sumber: "kelas Hewan { konstruktor(n) { ini.nama = n }\n suara() { kembalikan ini.nama + \" bersuara\" } }\nkelas Kucing mewarisi Hewan { suara() { kembalikan induk.suara() + \": meong\" } }\ncetak(baru Kucing(\"Kiki\").suara())" },
  { nama: "koleksi", sumber: "misal a = [1, 2, 3, 4, 5]\ncetak(a.petakan((x) => x * 2).saring((x) => x > 4).gabung(\",\"))" },
  { nama: "destruktur", sumber: "tetap [a, b, ...c] = [1, 2, 3, 4]\ntetap { x, y = 10 } = { x: 5 }\ncetak(a, b, c.gabung(\"-\"), x, y)" },
  { nama: "generator", sumber: "fungsi* hitung() { hasilkan 1\n hasilkan 2\n hasilkan 3 }\nmisal jumlah = 0\nuntuk (tetap v dari hitung()) jumlah = jumlah + v\ncetak(jumlah)" },
  { nama: "coba", sumber: "fungsi f(x) { coba { jika (x < 0) lempar baru Galat(\"negatif\")\n kembalikan \"ok\" } tangkap (e) { kembalikan \"tangkap: \" + e.pesan } akhirnya { cetak(\"selesai\") } }\ncetak(f(1))\ncetak(f(-1))" },
  { nama: "template-pilih", sumber: "fungsi warna(n) { pilih (n) { kasus 1: kembalikan \"merah\"\n kasus 2: kembalikan \"hijau\"\n bawaan: kembalikan \"?\" } }\ncetak(`warna: ${warna(1)}, ${warna(2)}, ${warna(9)}`)" },
  { nama: "rekursi-objek", sumber: "misal memo = {}\nfungsi f(n) { jika (n < 2) kembalikan n\n jika (memo[n]) kembalikan memo[n]\n memo[n] = f(n-1) + f(n-2)\n kembalikan memo[n] }\ncetak(f(20))" },
  {
    nama: "async-iterator",
    sumber:
      "fungsi buat(maks) { misal i = 0\n kembalikan { [Simbol.iteratorAsinkron]: fungsi() { kembalikan { lanjut: fungsi() { jika (i < maks) { tetap n = i\n i = i + 1\n kembalikan Janji.selesaikan({ nilai: n, selesai: salah }) }\n kembalikan Janji.selesaikan({ nilai: taktentu, selesai: benar }) } } } } }\nasinkron fungsi utama() { misal total = 0\n untuk tunggu (tetap x dari buat(5)) total = total + x\n cetak(total)\n untuk tunggu (tetap v dari [Janji.selesaikan(1), 2, 3]) cetak(v) }\nutama()",
  },
];

for (const { nama, sumber } of SAMPEL) {
  test(`bootstrap: bytecode InDo dieksekusi = pipeline TS: ${nama}`, async () => {
    const diharapkan = await jalankanTS(sumber, nama);
    const chunk = await chunkDariInDo(sumber, nama);
    const f = reify(chunk);
    const hasil = await jalankanChunk(f);
    assert.equal(hasil.galat.join("\n"), "", `eksekusi bytecode InDo galat untuk ${nama}`);
    assert.equal(hasil.keluar.join("\n"), diharapkan);
  });
}

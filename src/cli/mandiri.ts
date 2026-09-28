import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Mesin } from "../vm/mesin.js";
import { FungsiKompilasi, type Nilai } from "../runtime/nilai.js";
import { Potongan } from "../compiler/potongan.js";
import { jalankanSumber } from "./jalankan.js";
import { GalatEksekusi, LemparInDo } from "../galat/eksekusi.js";
import { keTeks } from "../runtime/nilai.js";
import { ObjekInDo } from "../runtime/objek.js";
import type { Keluaran } from "./cli.js";

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

const DIR_INI = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(DIR_INI, "../../mandiri/bootstrap.wni");

function reifyKonstanta(k: KonstJSON, namaBerkas: string): Nilai {
  if (k.t === "n") return k.v as number;
  if (k.t === "B") return BigInt(k.v as string);
  if (k.t === "s") return k.v as string;
  return reifyFungsi(k.v as FungsiJSON, namaBerkas);
}

function reifyFungsi(o: FungsiJSON, namaBerkas: string): FungsiKompilasi {
  const potongan = new Potongan(namaBerkas);
  potongan.kode = o.kode;
  potongan.garis = o.garis;
  potongan.konstanta = o.konstanta.map((k) => reifyKonstanta(k, namaBerkas));
  const fungsi = new FungsiKompilasi(o.nama, potongan);
  fungsi.arity = o.arity;
  fungsi.jumlahUpvalue = o.jumlahUpvalue;
  fungsi.generator = o.generator;
  fungsi.asinkron = o.asinkron;
  fungsi.punyaSisa = o.punyaSisa;
  return fungsi;
}

export async function jalankanBerkasMandiri(namaBerkas: string, keluaran: Keluaran): Promise<number> {
  const jalurAbsolut = resolve(process.cwd(), namaBerkas);
  if (!existsSync(jalurAbsolut)) {
    keluaran.galat(`Tidak dapat membaca berkas: ${namaBerkas}`);
    return 1;
  }
  if (!existsSync(HARNESS)) {
    keluaran.galat(`Compiler mandiri tidak ditemukan: ${HARNESS}`);
    return 1;
  }

  const harnessSumber = readFileSync(HARNESS, "utf8");
  const barisJSON: string[] = [];
  const galatKompilasi: string[] = [];
  const penampung: Keluaran = { tulis: (t) => barisJSON.push(t), galat: (t) => galatKompilasi.push(t) };

  const lama = process.env.MASUKAN_MANDIRI;
  process.env.MASUKAN_MANDIRI = jalurAbsolut;
  let kodeKompilasi: number;
  try {
    kodeKompilasi = await jalankanSumber(harnessSumber, HARNESS, penampung);
  } finally {
    if (lama === undefined) delete process.env.MASUKAN_MANDIRI;
    else process.env.MASUKAN_MANDIRI = lama;
  }

  if (kodeKompilasi !== 0 || galatKompilasi.length > 0) {
    for (const b of galatKompilasi) keluaran.galat(b);
    return 1;
  }

  let chunk: FungsiJSON;
  try {
    chunk = JSON.parse(barisJSON.join("\n")) as FungsiJSON;
  } catch {
    keluaran.galat("Gagal membaca hasil kompilasi mandiri");
    return 1;
  }

  const fungsi = reifyFungsi(chunk, jalurAbsolut);
  const mesin = new Mesin({
    cetak: (teks) => keluaran.tulis(teks),
    galat: (teks) => keluaran.galat(teks),
    muatSumberModul: (spesifikasi, dariJalur) => {
      const jalur = resolve(dirname(dariJalur), spesifikasi);
      return { jalur, sumber: readFileSync(jalur, "utf8") };
    },
  });

  try {
    mesin.jalankan(fungsi);
    await mesin.jalankanEventLoop();
  } catch (galat) {
    if (galat instanceof LemparInDo) {
      keluaran.galat(formatNilaiTerlempar(galat.nilai as Nilai));
      return 1;
    }
    if (galat instanceof GalatEksekusi) {
      keluaran.galat(`${galat.name}: ${galat.message}`);
      return 1;
    }
    throw galat;
  }
  return mesin.galatTerjadi ? 1 : 0;
}

function formatNilaiTerlempar(nilai: Nilai): string {
  if (nilai instanceof ObjekInDo) {
    const nama = nilai.ambil("nama");
    const pesan = nilai.ambil("pesan");
    if (typeof nama === "string") {
      return pesan !== undefined && pesan !== "" ? `Galat tak tertangani: ${nama}: ${keTeks(pesan)}` : `Galat tak tertangani: ${nama}`;
    }
  }
  return `Galat tak tertangani: ${keTeks(nilai)}`;
}

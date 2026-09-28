import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { urai } from "../parser/parser.js";
import { Kompiler } from "../compiler/kompiler.js";
import { Mesin } from "../vm/mesin.js";
import { formatGalatSintaks, GalatKompilasi, GalatSintaks } from "../galat/kompilasi.js";
import { GalatEksekusi, LemparInDo } from "../galat/eksekusi.js";
import { keTeks, type Nilai } from "../runtime/nilai.js";
import { ObjekInDo } from "../runtime/objek.js";
import type { Keluaran } from "./cli.js";

export async function jalankanBerkas(namaBerkas: string, keluaran: Keluaran): Promise<number> {
  let sumber: string;
  try {
    sumber = readFileSync(namaBerkas, "utf8");
  } catch {
    keluaran.galat(`Tidak dapat membaca berkas: ${namaBerkas}`);
    return 1;
  }
  return jalankanSumber(sumber, namaBerkas, keluaran);
}

export async function jalankanSumber(sumber: string, namaBerkas: string, keluaran: Keluaran): Promise<number> {
  try {
    const program = urai(sumber, namaBerkas);
    const fungsi = Kompiler.kompilasiProgram(program, namaBerkas);
    const mesin = new Mesin({
      cetak: (teks) => keluaran.tulis(teks),
      galat: (teks) => keluaran.galat(teks),
      muatSumberModul: (spesifikasi, dariJalur) => {
        const jalur = resolve(dirname(dariJalur), spesifikasi);
        return { jalur, sumber: readFileSync(jalur, "utf8") };
      },
    });
    mesin.jalankan(fungsi);
    await mesin.jalankanEventLoop();
    return mesin.galatTerjadi ? 1 : 0;
  } catch (galat) {
    if (galat instanceof GalatSintaks || galat instanceof GalatKompilasi) {
      keluaran.galat(formatGalatSintaks(sumber, galat));
      return 1;
    }
    if (galat instanceof LemparInDo) {
      keluaran.galat(formatNilaiTerlempar(galat.nilai as Nilai));
      return 1;
    }
    if (galat instanceof GalatEksekusi) {
      keluaran.galat(`${galat.name}: ${galat.message}`);
      if (galat.tumpukan) keluaran.galat(galat.tumpukan);
      else keluaran.galat(`  di ${galat.namaBerkas}:${galat.garis}`);
      return 1;
    }
    throw galat;
  }
}

function formatNilaiTerlempar(nilai: Nilai): string {
  if (nilai instanceof ObjekInDo) {
    const nama = nilai.ambil("nama");
    const pesan = nilai.ambil("pesan");
    const tumpukan = nilai.ambil("tumpukan");
    if (typeof nama === "string") {
      const kepala = pesan !== undefined && pesan !== "" ? `${nama}: ${keTeks(pesan)}` : nama;
      const jejak = typeof tumpukan === "string" && tumpukan !== "" ? `\n${tumpukan}` : "";
      return `Galat tak tertangani: ${kepala}${jejak}`;
    }
  }
  return `Galat tak tertangani: ${keTeks(nilai)}`;
}

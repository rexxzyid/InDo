import { readFileSync, writeFileSync } from "node:fs";
import { rapikanSumber } from "../formatter/format.js";
import { formatGalatSintaks, GalatSintaks } from "../galat/kompilasi.js";
import type { Keluaran } from "./cli.js";

export function rapikanBerkas(namaBerkas: string, keluaran: Keluaran): number {
  let sumber: string;
  try {
    sumber = readFileSync(namaBerkas, "utf8");
  } catch {
    keluaran.galat(`Tidak dapat membaca berkas: ${namaBerkas}`);
    return 1;
  }
  try {
    const hasil = rapikanSumber(sumber, namaBerkas);
    writeFileSync(namaBerkas, hasil);
    keluaran.tulis(`Dirapikan: ${namaBerkas}`);
    return 0;
  } catch (galat) {
    if (galat instanceof GalatSintaks) {
      keluaran.galat(formatGalatSintaks(sumber, galat));
      return 1;
    }
    throw galat;
  }
}

import { readFileSync } from "node:fs";
import { urai } from "../parser/parser.js";
import { formatGalatSintaks, GalatSintaks } from "../galat/kompilasi.js";
import type { Keluaran } from "./cli.js";

export function periksaBerkas(namaBerkas: string, keluaran: Keluaran): number {
  let sumber: string;
  try {
    sumber = readFileSync(namaBerkas, "utf8");
  } catch {
    keluaran.galat(`Tidak dapat membaca berkas: ${namaBerkas}`);
    return 1;
  }
  return periksaSumber(sumber, namaBerkas, keluaran);
}

export function periksaSumber(sumber: string, namaBerkas: string, keluaran: Keluaran): number {
  try {
    urai(sumber, namaBerkas);
    keluaran.tulis(`Tidak ada galat sintaks pada ${namaBerkas}.`);
    return 0;
  } catch (galat) {
    if (galat instanceof GalatSintaks) {
      keluaran.galat(formatGalatSintaks(sumber, galat));
      return 1;
    }
    throw galat;
  }
}

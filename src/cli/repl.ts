import { createInterface } from "node:readline";
import { urai } from "../parser/parser.js";
import { Kompiler } from "../compiler/kompiler.js";
import { Mesin } from "../vm/mesin.js";
import { keTampilan, type Nilai } from "../runtime/nilai.js";
import { formatGalatSintaks, GalatKompilasi, GalatSintaks } from "../galat/kompilasi.js";
import { GalatEksekusi, LemparInDo } from "../galat/eksekusi.js";
import { NAMA_BAHASA, VERSI } from "../versi.js";

const AWALAN_PERNYATAAN = /^\s*(misal|tetap|var|fungsi|kelas|jika|untuk|selama|lakukan|coba|kembalikan|lempar|impor|ekspor|henti|lanjut|pilih|\{|\/\/|asinkron)\b/;

export function jalankanRepl(): Promise<number> {
  return new Promise((selesai) => {
    const mesin = new Mesin({});
    const antarmuka = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(`${NAMA_BAHASA} v${VERSI} — REPL. Ketik program InDo, atau Ctrl+D untuk keluar.\n`);
    antarmuka.setPrompt("indo> ");
    antarmuka.prompt();

    antarmuka.on("line", (baris) => {
      const teks = baris.trim();
      if (teks !== "") {
        const sumber = AWALAN_PERNYATAAN.test(teks) || teks.includes(";") ? teks : `cetak(${teks})`;
        evaluasi(mesin, sumber, teks);
      }
      antarmuka.prompt();
    });

    antarmuka.on("close", () => {
      process.stdout.write("\nSampai jumpa!\n");
      selesai(0);
    });
  });
}

function evaluasi(mesin: Mesin, sumber: string, asli: string): void {
  try {
    const program = urai(sumber, "<repl>");
    const fungsi = Kompiler.kompilasiProgram(program, "<repl>");
    mesin.jalankan(fungsi);
    void mesin.jalankanEventLoop();
  } catch (galat) {
    if (galat instanceof GalatSintaks || galat instanceof GalatKompilasi) {
      if (sumber !== asli) {
        evaluasi(mesin, asli, asli);
        return;
      }
      process.stderr.write(formatGalatSintaks(sumber, galat) + "\n");
    } else if (galat instanceof LemparInDo) {
      process.stderr.write("Galat: " + keTampilan(galat.nilai as Nilai) + "\n");
    } else if (galat instanceof GalatEksekusi) {
      process.stderr.write(`${galat.name}: ${galat.message}\n`);
    } else {
      throw galat;
    }
  }
}

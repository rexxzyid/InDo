import type { Nilai } from "../runtime/nilai.js";
import { keTeks } from "../runtime/nilai.js";
import { INFO_OP, Op } from "./opcode.js";

export class Potongan {
  kode: number[] = [];
  konstanta: Nilai[] = [];
  garis: number[] = [];
  namaBerkas: string;

  constructor(namaBerkas = "<masukan>") {
    this.namaBerkas = namaBerkas;
  }

  tulis(nilai: number, garis: number): number {
    this.kode.push(nilai);
    this.garis.push(garis);
    return this.kode.length - 1;
  }

  tambahKonstanta(nilai: Nilai): number {
    const adaIndeks = this.konstanta.indexOf(nilai);
    if (adaIndeks !== -1) return adaIndeks;
    this.konstanta.push(nilai);
    return this.konstanta.length - 1;
  }

  bongkar(nama: string): string {
    const baris: string[] = [`== ${nama} ==`];
    let i = 0;
    while (i < this.kode.length) {
      const { teks, panjang } = this.bongkarInstruksi(i);
      baris.push(teks);
      i += panjang;
    }
    return baris.join("\n");
  }

  bongkarInstruksi(i: number): { teks: string; panjang: number } {
    const op = this.kode[i] as Op;
    const info = INFO_OP[op];
    const alamat = String(i).padStart(4, "0");
    if (info === undefined) {
      return { teks: `${alamat} ??? (${op})`, panjang: 1 };
    }
    if (op === Op.Penutup) {
      const indeksKonstanta = this.kode[i + 1]!;
      const fungsi = this.konstanta[indeksKonstanta];
      return { teks: `${alamat} ${info.nama} ${indeksKonstanta} (${keTeks(fungsi ?? null)})`, panjang: 2 };
    }
    if (info.operan === 2) {
      return { teks: `${alamat} ${info.nama} ${this.kode[i + 1]} ${this.kode[i + 2]}`, panjang: 3 };
    }
    if (info.operan === 1) {
      const operan = this.kode[i + 1]!;
      let ekstra = "";
      if (op === Op.Konstanta) ekstra = ` (${keTeks(this.konstanta[operan] ?? null)})`;
      return { teks: `${alamat} ${info.nama} ${operan}${ekstra}`, panjang: 2 };
    }
    return { teks: `${alamat} ${info.nama}`, panjang: 1 };
  }
}

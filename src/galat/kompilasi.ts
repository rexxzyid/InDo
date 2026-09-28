export interface PosisiGalat {
  baris: number;
  kolom: number;
  panjang: number;
}

export class GalatSintaks extends Error {
  readonly namaBerkas: string;
  readonly baris: number;
  readonly kolom: number;
  readonly panjang: number;

  constructor(pesan: string, namaBerkas: string, posisi: PosisiGalat) {
    super(pesan);
    this.name = "GalatSintaks";
    this.namaBerkas = namaBerkas;
    this.baris = posisi.baris;
    this.kolom = posisi.kolom;
    this.panjang = Math.max(1, posisi.panjang);
  }
}

export class GalatKompilasi extends Error {
  readonly namaBerkas: string;
  readonly baris: number;
  readonly kolom: number;
  readonly panjang: number;

  constructor(pesan: string, namaBerkas: string, posisi: PosisiGalat) {
    super(pesan);
    this.name = "GalatKompilasi";
    this.namaBerkas = namaBerkas;
    this.baris = posisi.baris;
    this.kolom = posisi.kolom;
    this.panjang = Math.max(1, posisi.panjang);
  }
}

export function formatGalatSintaks(sumber: string, galat: GalatSintaks | GalatKompilasi): string {
  const barisSumber = sumber.split("\n");
  const indeksBaris = galat.baris - 1;
  const barisTeks = barisSumber[indeksBaris] ?? "";
  const nomor = String(galat.baris);
  const lekuk = " ".repeat(nomor.length);
  const spasiPenanda = " ".repeat(Math.max(0, galat.kolom - 1));
  const penanda = "^".repeat(Math.min(galat.panjang, Math.max(1, barisTeks.length - galat.kolom + 1)) || 1);

  return [
    `${galat.name}: ${galat.message}`,
    `  di ${galat.namaBerkas}:${galat.baris}:${galat.kolom}`,
    ``,
    `  ${nomor} | ${barisTeks}`,
    `  ${lekuk} | ${spasiPenanda}${penanda}`,
  ].join("\n");
}

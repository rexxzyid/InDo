export class GalatEksekusi extends Error {
  garis: number;
  namaBerkas: string;
  tumpukan: string;

  constructor(pesan: string, namaBerkas = "<masukan>", garis = 0, tumpukan = "") {
    super(pesan);
    this.name = "GalatEksekusi";
    this.namaBerkas = namaBerkas;
    this.garis = garis;
    this.tumpukan = tumpukan;
  }
}

export class LemparInDo extends Error {
  nilai: unknown;

  constructor(nilai: unknown) {
    super("nilai dilempar dari program InDo");
    this.name = "LemparInDo";
    this.nilai = nilai;
  }
}

export class SinyalHasilkan extends Error {
  nilai: unknown;

  constructor(nilai: unknown) {
    super("hasilkan");
    this.name = "SinyalHasilkan";
    this.nilai = nilai;
  }
}

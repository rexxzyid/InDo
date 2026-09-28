import type { Nilai, Penutup } from "./nilai.js";

export type KunciProperti = string | symbol;

export interface Aksesor {
  dapatkan: Nilai;
  tetapkan: Nilai;
}

export class ObjekInDo {
  properti: Map<KunciProperti, Nilai>;
  aksesor: Map<KunciProperti, Aksesor> | null;
  prototipe: ObjekInDo | null;
  dibekukan: boolean;
  disegel: boolean;
  kelasNama: string;

  constructor(prototipe: ObjekInDo | null = null) {
    this.properti = new Map();
    this.aksesor = null;
    this.prototipe = prototipe;
    this.dibekukan = false;
    this.disegel = false;
    this.kelasNama = "Objek";
  }

  tetapkanAksesor(kunci: KunciProperti, dapatkan: Nilai, tetapkan: Nilai): void {
    if (this.aksesor === null) this.aksesor = new Map();
    const ada = this.aksesor.get(kunci);
    this.aksesor.set(kunci, {
      dapatkan: dapatkan !== undefined ? dapatkan : (ada?.dapatkan ?? undefined),
      tetapkan: tetapkan !== undefined ? tetapkan : (ada?.tetapkan ?? undefined),
    });
  }

  cariAksesor(kunci: KunciProperti): Aksesor | null {
    let sekarang: ObjekInDo | null = this;
    while (sekarang !== null) {
      if (sekarang.aksesor !== null && sekarang.aksesor.has(kunci)) return sekarang.aksesor.get(kunci)!;
      if (sekarang.properti.has(kunci)) return null;
      sekarang = sekarang.prototipe;
    }
    return null;
  }

  punyaSendiri(kunci: KunciProperti): boolean {
    return this.properti.has(kunci);
  }

  ambil(kunci: KunciProperti): Nilai {
    let sekarang: ObjekInDo | null = this;
    while (sekarang !== null) {
      if (sekarang.properti.has(kunci)) return sekarang.properti.get(kunci);
      sekarang = sekarang.prototipe;
    }
    return undefined;
  }

  punya(kunci: KunciProperti): boolean {
    let sekarang: ObjekInDo | null = this;
    while (sekarang !== null) {
      if (sekarang.properti.has(kunci)) return true;
      sekarang = sekarang.prototipe;
    }
    return false;
  }

  tetapkan(kunci: KunciProperti, nilai: Nilai): boolean {
    if (this.dibekukan) return false;
    if (this.disegel && !this.properti.has(kunci)) return false;
    this.properti.set(kunci, nilai);
    return true;
  }

  hapus(kunci: KunciProperti): boolean {
    if (this.dibekukan || this.disegel) return false;
    return this.properti.delete(kunci);
  }

  kunciSendiri(): KunciProperti[] {
    return [...this.properti.keys()];
  }
}

export class LarikInDo {
  elemen: Nilai[];

  constructor(elemen: Nilai[] = []) {
    this.elemen = elemen;
  }

  get panjang(): number {
    return this.elemen.length;
  }
}

export interface FieldInstance {
  kunci: KunciProperti;
  inisiator: Nilai;
}

export class KelasInDo extends ObjekInDo {
  namaKelas: string;
  indukKelas: KelasInDo | null;
  prototipeInstance: ObjekInDo;
  konstruktor: Nilai;
  fieldInstance: FieldInstance[];

  constructor(nama: string, induk: KelasInDo | null) {
    super(induk);
    this.namaKelas = nama;
    this.indukKelas = induk;
    this.prototipeInstance = new ObjekInDo(induk ? induk.prototipeInstance : null);
    this.prototipeInstance.kelasNama = nama;
    this.konstruktor = null;
    this.fieldInstance = [];
  }

  konstruktorTerdekat(): Nilai {
    let sekarang: KelasInDo | null = this;
    while (sekarang !== null) {
      if (sekarang.konstruktor !== null && sekarang.konstruktor !== undefined) return sekarang.konstruktor;
      sekarang = sekarang.indukKelas;
    }
    return null;
  }

  semuaField(): FieldInstance[] {
    const daftar: FieldInstance[] = [];
    const rantai: KelasInDo[] = [];
    let sekarang: KelasInDo | null = this;
    while (sekarang !== null) {
      rantai.push(sekarang);
      sekarang = sekarang.indukKelas;
    }
    for (let i = rantai.length - 1; i >= 0; i -= 1) {
      for (const f of rantai[i]!.fieldInstance) daftar.push(f);
    }
    return daftar;
  }
}

export class PetaInDo {
  m: Map<Nilai, Nilai>;
  constructor() {
    this.m = new Map();
  }
}

export class HimpunanInDo {
  s: Set<Nilai>;
  constructor() {
    this.s = new Set();
  }
}

export class PetaLemahInDo {
  m: WeakMap<object, Nilai>;
  constructor() {
    this.m = new WeakMap();
  }
}

export class HimpunanLemahInDo {
  s: WeakSet<object>;
  constructor() {
    this.s = new WeakSet();
  }
}

export class RefLemahInDo {
  ref: WeakRef<object>;
  constructor(objek: object) {
    this.ref = new WeakRef(objek);
  }
}

export class PenyanggaLarikInDo {
  buf: ArrayBuffer;
  constructor(buf: ArrayBuffer) {
    this.buf = buf;
  }
}

export type JenisLarikBertipe = "Uint8" | "Int8" | "Uint16" | "Int16" | "Uint32" | "Int32" | "Float32" | "Float64";

export class LarikBertipeInDo {
  ta: { length: number; buffer: ArrayBuffer; [i: number]: number };
  jenis: JenisLarikBertipe;
  constructor(ta: { length: number; buffer: ArrayBuffer; [i: number]: number }, jenis: JenisLarikBertipe) {
    this.ta = ta;
    this.jenis = jenis;
  }
}

export class WakilInDo {
  sasaran: Nilai;
  penangan: ObjekInDo;
  constructor(sasaran: Nilai, penangan: ObjekInDo) {
    this.sasaran = sasaran;
    this.penangan = penangan;
  }
}

export class RegExInDo {
  re: RegExp;

  constructor(re: RegExp) {
    this.re = re;
  }
}

export class TanggalInDo {
  d: Date;

  constructor(d: Date) {
    this.d = d;
  }
}

export type KeadaanJanji = "menunggu" | "terpenuhi" | "tertolak";

export class JanjiInDo {
  keadaan: KeadaanJanji;
  nilai: Nilai;
  reaksiPenuh: Array<(n: Nilai) => void>;
  reaksiTolak: Array<(e: Nilai) => void>;
  ditangani: boolean;

  constructor() {
    this.keadaan = "menunggu";
    this.nilai = undefined;
    this.reaksiPenuh = [];
    this.reaksiTolak = [];
    this.ditangani = false;
  }
}

export interface PenanganTersimpan {
  addr: number;
  offsetTumpukan: number;
}

export class GeneratorInDo {
  penutup: Penutup;
  ip: number;
  savedStack: Nilai[];
  savedPenangan: PenanganTersimpan[];
  selesai: boolean;
  dimulai: boolean;

  constructor(penutup: Penutup, savedStack: Nilai[]) {
    this.penutup = penutup;
    this.ip = 0;
    this.savedStack = savedStack;
    this.savedPenangan = [];
    this.selesai = false;
    this.dimulai = false;
  }
}

export class IteratorInDo {
  jenis: "larik" | "teks" | "objek" | "generator" | "objek-async";
  sumber: LarikInDo | null;
  teks: string;
  indeks: number;
  objekIter: ObjekInDo | null;
  generator: GeneratorInDo | null;

  constructor(jenis: "larik" | "teks" | "objek" | "generator" | "objek-async") {
    this.jenis = jenis;
    this.sumber = null;
    this.teks = "";
    this.indeks = 0;
    this.objekIter = null;
    this.generator = null;
  }
}

export const SIMBOL_ITERATOR: unique symbol = Symbol("Simbol.iterator");
export const SIMBOL_ITERATOR_ASINKRON: unique symbol = Symbol("Simbol.iteratorAsinkron");

export function normalisasiKunci(kunci: Nilai): KunciProperti {
  if (typeof kunci === "symbol") return kunci;
  if (typeof kunci === "string") return kunci;
  if (typeof kunci === "number") return String(kunci);
  if (typeof kunci === "bigint") return kunci.toString();
  if (kunci === null) return "kosong";
  if (kunci === undefined) return "taktentu";
  if (typeof kunci === "boolean") return kunci ? "benar" : "salah";
  return String(kunci as unknown);
}

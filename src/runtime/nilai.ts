export class FungsiKompilasi {
  nama: string;
  arity: number;
  jumlahUpvalue: number;
  punyaSisa: boolean;
  generator: boolean;
  asinkron: boolean;
  potongan: import("../compiler/potongan.js").Potongan;

  constructor(nama: string, potongan: import("../compiler/potongan.js").Potongan) {
    this.nama = nama;
    this.arity = 0;
    this.jumlahUpvalue = 0;
    this.punyaSisa = false;
    this.generator = false;
    this.asinkron = false;
    this.potongan = potongan;
  }
}

export class Upvalue {
  tertutup: boolean;
  nilai: Nilai;
  slot: number;

  constructor(slot: number) {
    this.tertutup = false;
    this.nilai = undefined;
    this.slot = slot;
  }
}

export class Penutup {
  fungsi: FungsiKompilasi;
  upvalue: Upvalue[];

  constructor(fungsi: FungsiKompilasi) {
    this.fungsi = fungsi;
    this.upvalue = [];
  }
}

export type FungsiNatifImpl = (argumen: Nilai[]) => Nilai;

export class FungsiNatif {
  nama: string;
  arity: number;
  fungsi: FungsiNatifImpl;
  properti: Map<string | symbol, Nilai> | null;

  constructor(nama: string, arity: number, fungsi: FungsiNatifImpl) {
    this.nama = nama;
    this.arity = arity;
    this.fungsi = fungsi;
    this.properti = null;
  }

  taruh(kunci: string | symbol, nilai: Nilai): this {
    if (this.properti === null) this.properti = new Map();
    this.properti.set(kunci, nilai);
    return this;
  }
}

import {
  GeneratorInDo,
  HimpunanInDo,
  HimpunanLemahInDo,
  IteratorInDo,
  JanjiInDo,
  KelasInDo,
  LarikBertipeInDo,
  LarikInDo,
  ObjekInDo,
  PenyanggaLarikInDo,
  PetaInDo,
  PetaLemahInDo,
  RefLemahInDo,
  RegExInDo,
  TanggalInDo,
  WakilInDo,
} from "./objek.js";

export type Nilai =
  | number
  | boolean
  | string
  | bigint
  | null
  | undefined
  | symbol
  | Penutup
  | FungsiNatif
  | FungsiKompilasi
  | ObjekInDo
  | LarikInDo
  | IteratorInDo
  | GeneratorInDo
  | JanjiInDo
  | RegExInDo
  | TanggalInDo
  | PetaInDo
  | HimpunanInDo
  | PetaLemahInDo
  | HimpunanLemahInDo
  | RefLemahInDo
  | PenyanggaLarikInDo
  | LarikBertipeInDo
  | WakilInDo;

export function jenisNilai(nilai: Nilai): string {
  if (nilai === null) return "kosong";
  if (nilai === undefined) return "taktentu";
  const t = typeof nilai;
  if (t === "number") return "angka";
  if (t === "bigint") return "bilanganbesar";
  if (t === "string") return "teks";
  if (t === "boolean") return "boolean";
  if (t === "symbol") return "simbol";
  if (
    nilai instanceof Penutup ||
    nilai instanceof FungsiNatif ||
    nilai instanceof FungsiKompilasi ||
    nilai instanceof KelasInDo
  ) {
    return "fungsi";
  }
  return "objek";
}

export function benarKah(nilai: Nilai): boolean {
  if (nilai === null || nilai === undefined || nilai === false) return false;
  if (nilai === 0 || (typeof nilai === "number" && Number.isNaN(nilai))) return false;
  if (nilai === 0n) return false;
  if (nilai === "") return false;
  return true;
}

export function samaKetat(a: Nilai, b: Nilai): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b;
  return a === b;
}

export function keTeks(nilai: Nilai): string {
  if (nilai === null) return "kosong";
  if (nilai === undefined) return "taktentu";
  if (typeof nilai === "boolean") return nilai ? "benar" : "salah";
  if (typeof nilai === "string") return nilai;
  if (typeof nilai === "bigint") return nilai.toString();
  if (typeof nilai === "number") return teksAngka(nilai);
  if (typeof nilai === "symbol") return nilai.toString();
  if (nilai instanceof FungsiNatif) return `fungsi ${nilai.nama}() { [natif] }`;
  if (nilai instanceof Penutup) return `fungsi ${nilai.fungsi.nama || "anonim"}()`;
  if (nilai instanceof FungsiKompilasi) return `fungsi ${nilai.nama || "anonim"}()`;
  if (nilai instanceof KelasInDo) return `kelas ${nilai.namaKelas}`;
  if (nilai instanceof RegExInDo) return `/${nilai.re.source}/${nilai.re.flags}`;
  if (nilai instanceof TanggalInDo) return nilai.d.toString();
  if (nilai instanceof LarikInDo) return nilai.elemen.map((e) => keTeks(e)).join(",");
  if (nilai instanceof ObjekInDo) return `[objek ${nilai.kelasNama}]`;
  return String(nilai);
}

export function teksAngka(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "Takhingga";
  if (n === -Infinity) return "-Takhingga";
  return String(n);
}

export function keTampilan(nilai: Nilai, dalam = false): string {
  if (typeof nilai === "string") return dalam ? `"${nilai}"` : nilai;
  if (nilai instanceof LarikInDo) {
    return `[${nilai.elemen.map((e) => keTampilan(e, true)).join(", ")}]`;
  }
  if (nilai instanceof KelasInDo) return `[kelas ${nilai.namaKelas}]`;
  if (nilai instanceof RegExInDo) return `/${nilai.re.source}/${nilai.re.flags}`;
  if (nilai instanceof TanggalInDo) return nilai.d.toISOString();
  if (nilai instanceof JanjiInDo) return `Janji { ${nilai.keadaan} }`;
  if (nilai instanceof GeneratorInDo) return "[generator]";
  if (nilai instanceof IteratorInDo) return "[iterator]";
  if (nilai instanceof WakilInDo) return keTampilan(nilai.sasaran, dalam);
  if (nilai instanceof PetaInDo) {
    const isi = [...nilai.m.entries()].map(([k, v]) => `${keTampilan(k, true)} => ${keTampilan(v, true)}`);
    return `Peta(${nilai.m.size}) {${isi.length ? " " + isi.join(", ") + " " : ""}}`;
  }
  if (nilai instanceof HimpunanInDo) {
    const isi = [...nilai.s.values()].map((v) => keTampilan(v, true));
    return `Himpunan(${nilai.s.size}) {${isi.length ? " " + isi.join(", ") + " " : ""}}`;
  }
  if (nilai instanceof LarikBertipeInDo) {
    const isi: string[] = [];
    for (let i = 0; i < nilai.ta.length; i += 1) isi.push(String(nilai.ta[i]));
    return `Larik${nilai.jenis}(${nilai.ta.length}) [${isi.join(", ")}]`;
  }
  if (nilai instanceof ObjekInDo) {
    const isi = [...nilai.properti.entries()].map(([k, v]) => `${String(k)}: ${keTampilan(v, true)}`);
    const badan = isi.length === 0 ? "{}" : `{ ${isi.join(", ")} }`;
    return nilai.kelasNama !== "Objek" ? `${nilai.kelasNama} ${badan}` : badan;
  }
  return keTeks(nilai);
}

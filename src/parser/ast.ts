export interface Simpul {
  jenis: string;
  baris: number;
  kolom: number;
  awal: number;
  akhir: number;
}

export interface Program extends Simpul {
  jenis: "Program";
  tubuh: Pernyataan[];
}

export interface LiteralAngka extends Simpul {
  jenis: "LiteralAngka";
  nilai: number;
}

export interface LiteralBilanganBesar extends Simpul {
  jenis: "LiteralBilanganBesar";
  nilai: bigint;
}

export interface LiteralTeks extends Simpul {
  jenis: "LiteralTeks";
  nilai: string;
}

export interface LiteralBoolean extends Simpul {
  jenis: "LiteralBoolean";
  nilai: boolean;
}

export interface LiteralKosong extends Simpul {
  jenis: "LiteralKosong";
}

export interface LiteralTaktentu extends Simpul {
  jenis: "LiteralTaktentu";
}

export interface LiteralRegex extends Simpul {
  jenis: "LiteralRegex";
  pola: string;
  bendera: string;
}

export interface Identifier extends Simpul {
  jenis: "Identifier";
  nama: string;
}

export interface NamaPrivat extends Simpul {
  jenis: "NamaPrivat";
  nama: string;
}

export interface Ini extends Simpul {
  jenis: "Ini";
}

export interface Induk extends Simpul {
  jenis: "Induk";
}

export interface TemplateTeks extends Simpul {
  jenis: "TemplateTeks";
  bagian: string[];
  mentah: string[];
  ekspresi: Ekspresi[];
}

export interface TemplateTertag extends Simpul {
  jenis: "TemplateTertag";
  tag: Ekspresi;
  quasi: TemplateTeks;
}

export interface Sebar extends Simpul {
  jenis: "Sebar";
  argumen: Ekspresi;
}

export interface Larik extends Simpul {
  jenis: "Larik";
  elemen: (Ekspresi | Sebar)[];
}

export interface PropertiObjek extends Simpul {
  jenis: "PropertiObjek";
  kunci: Ekspresi;
  nilai: Ekspresi;
  terhitung: boolean;
  singkat: boolean;
  ragam: "init" | "dapatkan" | "tetapkan";
  metode: boolean;
}

export interface Objek extends Simpul {
  jenis: "Objek";
  properti: (PropertiObjek | Sebar)[];
}

export interface Fungsi extends Simpul {
  jenis: "Fungsi";
  nama: Identifier | null;
  parameter: Pola[];
  tubuh: Blok | Ekspresi;
  asinkron: boolean;
  generator: boolean;
  panah: boolean;
}

export interface Pemanggilan extends Simpul {
  jenis: "Pemanggilan";
  callee: Ekspresi | Induk;
  argumen: (Ekspresi | Sebar)[];
  opsional: boolean;
}

export interface Baru extends Simpul {
  jenis: "Baru";
  callee: Ekspresi;
  argumen: (Ekspresi | Sebar)[];
}

export interface AksesAnggota extends Simpul {
  jenis: "AksesAnggota";
  objek: Ekspresi | Induk;
  properti: Ekspresi | NamaPrivat;
  terhitung: boolean;
  opsional: boolean;
}

export interface RantaiOpsional extends Simpul {
  jenis: "RantaiOpsional";
  ekspresi: Ekspresi;
}

export interface Penugasan extends Simpul {
  jenis: "Penugasan";
  operator: string;
  sasaran: Ekspresi | Pola;
  nilai: Ekspresi;
}

export interface Biner extends Simpul {
  jenis: "Biner";
  operator: string;
  kiri: Ekspresi;
  kanan: Ekspresi;
}

export interface Logika extends Simpul {
  jenis: "Logika";
  operator: string;
  kiri: Ekspresi;
  kanan: Ekspresi;
}

export interface Uner extends Simpul {
  jenis: "Uner";
  operator: string;
  argumen: Ekspresi;
}

export interface Perbarui extends Simpul {
  jenis: "Perbarui";
  operator: string;
  argumen: Ekspresi;
  prefiks: boolean;
}

export interface Kondisional extends Simpul {
  jenis: "Kondisional";
  uji: Ekspresi;
  konsekuen: Ekspresi;
  alternatif: Ekspresi;
}

export interface Urutan extends Simpul {
  jenis: "Urutan";
  ekspresi: Ekspresi[];
}

export interface Tunggu extends Simpul {
  jenis: "Tunggu";
  argumen: Ekspresi;
}

export interface Hasilkan extends Simpul {
  jenis: "Hasilkan";
  argumen: Ekspresi | null;
  delegasi: boolean;
}

export interface ImporDinamis extends Simpul {
  jenis: "ImporDinamis";
  sumber: Ekspresi;
}

export interface KelasEkspresi extends Simpul {
  jenis: "KelasEkspresi";
  nama: Identifier | null;
  induk: Ekspresi | null;
  anggota: AnggotaKelas[];
}

export type Ekspresi =
  | LiteralAngka
  | LiteralBilanganBesar
  | LiteralTeks
  | LiteralBoolean
  | LiteralKosong
  | LiteralTaktentu
  | LiteralRegex
  | Identifier
  | Ini
  | TemplateTeks
  | TemplateTertag
  | Larik
  | Objek
  | Fungsi
  | Pemanggilan
  | Baru
  | AksesAnggota
  | RantaiOpsional
  | Penugasan
  | Biner
  | Logika
  | Uner
  | Perbarui
  | Kondisional
  | Urutan
  | Tunggu
  | Hasilkan
  | ImporDinamis
  | KelasEkspresi;

export interface PolaSisa extends Simpul {
  jenis: "PolaSisa";
  argumen: Pola;
}

export interface PolaBawaan extends Simpul {
  jenis: "PolaBawaan";
  kiri: Pola;
  bawaan: Ekspresi;
}

export interface PolaLarik extends Simpul {
  jenis: "PolaLarik";
  elemen: (Pola | PolaSisa | null)[];
}

export interface PropertiPola extends Simpul {
  jenis: "PropertiPola";
  kunci: Ekspresi;
  nilai: Pola;
  terhitung: boolean;
  singkat: boolean;
}

export interface PolaObjek extends Simpul {
  jenis: "PolaObjek";
  properti: (PropertiPola | PolaSisa)[];
}

export type Pola = Identifier | AksesAnggota | PolaLarik | PolaObjek | PolaBawaan | PolaSisa;

export interface MetodeKelas extends Simpul {
  jenis: "MetodeKelas";
  kunci: Ekspresi | NamaPrivat;
  nilai: Fungsi;
  ragam: "metode" | "dapatkan" | "tetapkan" | "konstruktor";
  statis: boolean;
  terhitung: boolean;
}

export interface FieldKelas extends Simpul {
  jenis: "FieldKelas";
  kunci: Ekspresi | NamaPrivat;
  nilai: Ekspresi | null;
  statis: boolean;
  terhitung: boolean;
}

export interface BlokStatis extends Simpul {
  jenis: "BlokStatis";
  tubuh: Pernyataan[];
}

export type AnggotaKelas = MetodeKelas | FieldKelas | BlokStatis;

export interface PernyataanEkspresi extends Simpul {
  jenis: "PernyataanEkspresi";
  ekspresi: Ekspresi;
}

export interface Deklarator extends Simpul {
  jenis: "Deklarator";
  id: Pola;
  awalNilai: Ekspresi | null;
}

export interface DeklarasiVariabel extends Simpul {
  jenis: "DeklarasiVariabel";
  ragam: "misal" | "tetap" | "var";
  deklarasi: Deklarator[];
}

export interface Blok extends Simpul {
  jenis: "Blok";
  tubuh: Pernyataan[];
}

export interface PernyataanKosong extends Simpul {
  jenis: "PernyataanKosong";
}

export interface Jika extends Simpul {
  jenis: "Jika";
  uji: Ekspresi;
  konsekuen: Pernyataan;
  alternatif: Pernyataan | null;
}

export interface Kasus extends Simpul {
  jenis: "Kasus";
  uji: Ekspresi | null;
  tubuh: Pernyataan[];
}

export interface Pilih extends Simpul {
  jenis: "Pilih";
  diskriminan: Ekspresi;
  kasus: Kasus[];
}

export interface Selama extends Simpul {
  jenis: "Selama";
  uji: Ekspresi;
  tubuh: Pernyataan;
}

export interface LakukanSelama extends Simpul {
  jenis: "LakukanSelama";
  tubuh: Pernyataan;
  uji: Ekspresi;
}

export interface UntukKlasik extends Simpul {
  jenis: "UntukKlasik";
  init: DeklarasiVariabel | Ekspresi | null;
  uji: Ekspresi | null;
  perbarui: Ekspresi | null;
  tubuh: Pernyataan;
}

export interface UntukDari extends Simpul {
  jenis: "UntukDari";
  kidal: DeklarasiVariabel | Pola;
  kanan: Ekspresi;
  tubuh: Pernyataan;
  tunggu: boolean;
}

export interface UntukDalam extends Simpul {
  jenis: "UntukDalam";
  kidal: DeklarasiVariabel | Pola;
  kanan: Ekspresi;
  tubuh: Pernyataan;
}

export interface Henti extends Simpul {
  jenis: "Henti";
  label: Identifier | null;
}

export interface Lanjut extends Simpul {
  jenis: "Lanjut";
  label: Identifier | null;
}

export interface Kembalikan extends Simpul {
  jenis: "Kembalikan";
  argumen: Ekspresi | null;
}

export interface Lempar extends Simpul {
  jenis: "Lempar";
  argumen: Ekspresi;
}

export interface Penangkap extends Simpul {
  jenis: "Penangkap";
  param: Pola | null;
  tubuh: Blok;
}

export interface Coba extends Simpul {
  jenis: "Coba";
  blok: Blok;
  penangkap: Penangkap | null;
  akhirnya: Blok | null;
}

export interface DeklarasiFungsi extends Simpul {
  jenis: "DeklarasiFungsi";
  fungsi: Fungsi;
}

export interface DeklarasiKelas extends Simpul {
  jenis: "DeklarasiKelas";
  kelas: KelasEkspresi;
}

export interface Berlabel extends Simpul {
  jenis: "Berlabel";
  label: Identifier;
  tubuh: Pernyataan;
}

export interface PenentuImpor extends Simpul {
  jenis: "PenentuImpor";
  ragam: "bawaan" | "namespace" | "bernama";
  impor: string | null;
  lokal: Identifier;
}

export interface Impor extends Simpul {
  jenis: "Impor";
  penentu: PenentuImpor[];
  sumber: string;
}

export interface PenentuEkspor extends Simpul {
  jenis: "PenentuEkspor";
  lokal: string;
  diekspor: string;
}

export interface EksporBernama extends Simpul {
  jenis: "EksporBernama";
  deklarasi: Pernyataan | null;
  penentu: PenentuEkspor[];
  sumber: string | null;
}

export interface EksporBawaan extends Simpul {
  jenis: "EksporBawaan";
  nilai: Pernyataan | Ekspresi;
}

export interface EksporSemua extends Simpul {
  jenis: "EksporSemua";
  sumber: string;
  sebagai: string | null;
}

export type Pernyataan =
  | PernyataanEkspresi
  | DeklarasiVariabel
  | Blok
  | PernyataanKosong
  | Jika
  | Pilih
  | Selama
  | LakukanSelama
  | UntukKlasik
  | UntukDari
  | UntukDalam
  | Henti
  | Lanjut
  | Kembalikan
  | Lempar
  | Coba
  | DeklarasiFungsi
  | DeklarasiKelas
  | Berlabel
  | Impor
  | EksporBernama
  | EksporBawaan
  | EksporSemua;

export type Node = Program | Ekspresi | Pernyataan | Pola | AnggotaKelas | Deklarator | Kasus | Penangkap | PenentuImpor | PenentuEkspor | PropertiObjek | PropertiPola | NamaPrivat | Induk;

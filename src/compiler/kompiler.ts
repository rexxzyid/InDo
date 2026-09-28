import { GalatKompilasi } from "../galat/kompilasi.js";
import type * as A from "../parser/ast.js";
import { FungsiKompilasi, type Nilai } from "../runtime/nilai.js";
import { Op } from "./opcode.js";
import { Potongan } from "./potongan.js";

interface Lokal {
  nama: string;
  kedalaman: number;
  siap: boolean;
  tetap: boolean;
  tertangkap: boolean;
}

interface DeskripsiUpvalue {
  indeks: number;
  lokal: boolean;
}

interface KonteksAlur {
  jenis: "loop" | "pilih";
  label: string | null;
  awalLanjut: number;
  tambalanLanjut: number[];
  tambalanHenti: number[];
  kedalamanScope: number;
  kedalamanProteksi: number;
}

interface Proteksi {
  finallyNode: import("../parser/ast.js").Blok | null;
  adaHandler: boolean;
}

const OP_BINER: Record<string, Op> = {
  "+": Op.Tambah,
  "-": Op.Kurang,
  "*": Op.Kali,
  "/": Op.Bagi,
  "%": Op.Sisa,
  "**": Op.Pangkat,
  "&": Op.Dan,
  "|": Op.Atau,
  "^": Op.Xor,
  "<<": Op.GeserKiri,
  ">>": Op.GeserKanan,
  ">>>": Op.GeserKananNol,
  "==": Op.SamaDengan,
  "!=": Op.TidakSama,
  "===": Op.SamaDengan,
  "!==": Op.TidakSama,
  "<": Op.KurangDari,
  ">": Op.LebihDari,
  "<=": Op.KurangSamaDari,
  ">=": Op.LebihSamaDari,
};

export class Kompiler {
  private readonly induk: Kompiler | null;
  private readonly namaBerkas: string;
  private readonly fungsi: FungsiKompilasi;
  private readonly lokal: Lokal[] = [];
  private readonly upvalue: DeskripsiUpvalue[] = [];
  private readonly globalTetap: Set<string>;
  private readonly konteks: KonteksAlur[] = [];
  private readonly proteksi: Proteksi[] = [];
  private labelTertunda: string | null = null;
  private kedalamanScope = 0;
  private penghitungTemp = 0;
  private konstruktorAktif = false;
  private modeModul = false;
  private readonly eksporModul: { nama: string; slot: number }[] = [];
  private slotDefault = -1;

  constructor(nama: string, namaBerkas: string, induk: Kompiler | null) {
    this.namaBerkas = namaBerkas;
    this.induk = induk;
    this.globalTetap = induk ? induk.globalTetap : new Set<string>();
    this.fungsi = new FungsiKompilasi(nama, new Potongan(namaBerkas));
    this.lokal.push({ nama: "", kedalaman: 0, siap: true, tetap: true, tertangkap: false });
  }

  static kompilasiProgram(program: A.Program, namaBerkas: string): FungsiKompilasi {
    const kompiler = new Kompiler("<skrip>", namaBerkas, null);
    kompiler.pratindakHoisting(program.tubuh);
    for (const pernyataan of program.tubuh) {
      kompiler.pernyataan(pernyataan);
    }
    kompiler.emit(Op.Taktentu, akhirGaris(program));
    kompiler.emit(Op.Kembali, akhirGaris(program));
    return kompiler.fungsi;
  }

  static kompilasiModul(program: A.Program, namaBerkas: string): FungsiKompilasi {
    const kompiler = new Kompiler("<modul>", namaBerkas, null);
    kompiler.modeModul = true;
    kompiler.mulaiScope();
    const impor = program.tubuh.filter((p) => p.jenis === "Impor");
    const lain = program.tubuh.filter((p) => p.jenis !== "Impor");
    kompiler.pratindakHoisting(lain);
    for (const p of impor) kompiler.pernyataan(p);
    for (const p of lain) kompiler.pernyataan(p);
    kompiler.emit(Op.ObjekBaru, akhirGaris(program));
    for (const e of kompiler.eksporModul) {
      kompiler.emitOperan(Op.BacaLokal, e.slot, akhirGaris(program));
      const indeks = kompiler.potongan.tambahKonstanta(e.nama);
      kompiler.emitOperan(Op.ObjekProp, indeks, akhirGaris(program));
    }
    if (kompiler.slotDefault !== -1) {
      kompiler.emitOperan(Op.BacaLokal, kompiler.slotDefault, akhirGaris(program));
      const indeks = kompiler.potongan.tambahKonstanta("bawaan");
      kompiler.emitOperan(Op.ObjekProp, indeks, akhirGaris(program));
    }
    kompiler.emit(Op.Kembali, akhirGaris(program));
    return kompiler.fungsi;
  }

  private get potongan(): Potongan {
    return this.fungsi.potongan;
  }

  private emit(nilai: number, garis: number): number {
    return this.potongan.tulis(nilai, garis);
  }

  private emitOperan(op: Op, operan: number, garis: number): void {
    this.emit(op, garis);
    this.emit(operan, garis);
  }

  private emitKonstanta(nilai: Nilai, garis: number): void {
    const indeks = this.potongan.tambahKonstanta(nilai);
    this.emitOperan(Op.Konstanta, indeks, garis);
  }

  private emitLompat(op: Op, garis: number): number {
    this.emit(op, garis);
    return this.emit(0, garis);
  }

  private tambalLompat(slot: number): void {
    this.potongan.kode[slot] = this.potongan.kode.length;
  }

  private galat(simpul: A.Simpul, pesan: string): never {
    throw new GalatKompilasi(pesan, this.namaBerkas, {
      baris: simpul.baris,
      kolom: simpul.kolom,
      panjang: Math.max(1, simpul.akhir - simpul.awal),
    });
  }

  private mulaiScope(): void {
    this.kedalamanScope += 1;
  }

  private akhiriScope(garis: number): void {
    this.kedalamanScope -= 1;
    while (this.lokal.length > 0 && this.lokal[this.lokal.length - 1]!.kedalaman > this.kedalamanScope) {
      const lokal = this.lokal.pop()!;
      this.emit(lokal.tertangkap ? Op.TutupUpvalue : Op.Pop, garis);
    }
  }

  private deklarasiLokal(nama: string, tetap: boolean, simpul: A.Simpul): void {
    for (let i = this.lokal.length - 1; i >= 0; i -= 1) {
      const lokal = this.lokal[i]!;
      if (lokal.kedalaman < this.kedalamanScope) break;
      if (lokal.nama === nama) this.galat(simpul, `Variabel "${nama}" sudah dideklarasikan pada scope ini`);
    }
    this.lokal.push({ nama, kedalaman: this.kedalamanScope, siap: false, tetap, tertangkap: false });
  }

  private tandaiSiap(): void {
    this.lokal[this.lokal.length - 1]!.siap = true;
  }

  private selesaikanLokal(nama: string, simpul: A.Simpul): number {
    for (let i = this.lokal.length - 1; i >= 0; i -= 1) {
      const lokal = this.lokal[i]!;
      if (lokal.nama === nama) {
        if (!lokal.siap) this.galat(simpul, `Variabel "${nama}" dipakai sebelum diinisialisasi`);
        return i;
      }
    }
    return -1;
  }

  private selesaikanUpvalue(nama: string, simpul: A.Simpul): number {
    if (this.induk === null) return -1;
    const indeksLokal = this.induk.selesaikanLokalUntukTangkap(nama);
    if (indeksLokal !== -1) {
      this.induk.lokal[indeksLokal]!.tertangkap = true;
      return this.tambahUpvalue(indeksLokal, true);
    }
    const indeksUpvalue = this.induk.selesaikanUpvalue(nama, simpul);
    if (indeksUpvalue !== -1) {
      return this.tambahUpvalue(indeksUpvalue, false);
    }
    return -1;
  }

  private selesaikanLokalUntukTangkap(nama: string): number {
    for (let i = this.lokal.length - 1; i >= 0; i -= 1) {
      if (this.lokal[i]!.nama === nama) return i;
    }
    return -1;
  }

  private tambahUpvalue(indeks: number, lokal: boolean): number {
    for (let i = 0; i < this.upvalue.length; i += 1) {
      const u = this.upvalue[i]!;
      if (u.indeks === indeks && u.lokal === lokal) return i;
    }
    this.upvalue.push({ indeks, lokal });
    this.fungsi.jumlahUpvalue = this.upvalue.length;
    return this.upvalue.length - 1;
  }

  private pratindakHoisting(daftar: A.Pernyataan[]): void {
    for (const pernyataan of daftar) {
      let d: A.Pernyataan = pernyataan;
      if (d.jenis === "EksporBernama" && d.deklarasi !== null) d = d.deklarasi;
      else if (d.jenis === "EksporBawaan" && (d.nilai as A.Simpul).jenis === "DeklarasiFungsi") d = d.nilai as A.Pernyataan;
      if (d.jenis === "DeklarasiFungsi") {
        const nama = d.fungsi.nama;
        if (nama !== null && this.kedalamanScope > 0) {
          this.deklarasiLokal(nama.nama, false, d);
          this.tandaiSiap();
          this.emit(Op.Taktentu, d.baris);
        }
      }
    }
  }

  private pernyataan(simpul: A.Pernyataan): void {
    switch (simpul.jenis) {
      case "PernyataanEkspresi":
        this.ekspresi(simpul.ekspresi);
        this.emit(Op.Pop, simpul.baris);
        return;
      case "DeklarasiVariabel":
        this.deklarasiVariabel(simpul);
        return;
      case "Blok":
        this.mulaiScope();
        this.pratindakHoisting(simpul.tubuh);
        for (const p of simpul.tubuh) this.pernyataan(p);
        this.akhiriScope(simpul.baris);
        return;
      case "PernyataanKosong":
        return;
      case "Jika":
        this.jika(simpul);
        return;
      case "Selama":
        this.selama(simpul);
        return;
      case "LakukanSelama":
        this.lakukanSelama(simpul);
        return;
      case "UntukKlasik":
        this.untukKlasik(simpul);
        return;
      case "UntukDari":
        this.untukDari(simpul);
        return;
      case "UntukDalam":
        this.untukDalam(simpul);
        return;
      case "Pilih":
        this.pilih(simpul);
        return;
      case "Henti":
        this.henti(simpul);
        return;
      case "Lanjut":
        this.lanjut(simpul);
        return;
      case "Berlabel":
        this.berlabel(simpul);
        return;
      case "Kembalikan":
        this.kembalikan(simpul);
        return;
      case "Lempar":
        this.lempar(simpul);
        return;
      case "Coba":
        this.coba(simpul);
        return;
      case "DeklarasiFungsi":
        this.deklarasiFungsi(simpul);
        return;
      case "DeklarasiKelas":
        this.deklarasiKelas(simpul);
        return;
      case "Impor":
        this.imporModul(simpul);
        return;
      case "EksporBernama":
        this.eksporBernama(simpul);
        return;
      case "EksporBawaan":
        this.eksporBawaan(simpul);
        return;
      case "EksporSemua":
        this.galat(simpul, "'ekspor *' belum didukung pada fase ini");
        return;
      default:
        this.galat(simpul, `Pernyataan "${(simpul as A.Simpul).jenis}" belum didukung pada fase ini`);
    }
  }

  private deklarasiVariabel(simpul: A.DeklarasiVariabel): void {
    const tetap = simpul.ragam === "tetap";
    for (const dek of simpul.deklarasi) {
      if (dek.id.jenis === "Identifier") {
        const nama = dek.id.nama;
        if (this.kedalamanScope === 0) {
          if (dek.awalNilai) this.ekspresi(dek.awalNilai);
          else this.emit(Op.Taktentu, dek.baris);
          if (tetap) this.globalTetap.add(nama);
          const indeks = this.potongan.tambahKonstanta(nama);
          this.emitOperan(Op.DefinisiGlobal, indeks, dek.baris);
        } else {
          this.deklarasiLokal(nama, tetap, dek);
          if (dek.awalNilai) this.ekspresi(dek.awalNilai);
          else this.emit(Op.Taktentu, dek.baris);
          this.tandaiSiap();
        }
      } else {
        if (!dek.awalNilai) this.galat(dek.id, "Destrukturisasi membutuhkan nilai awal");
        this.ekspresi(dek.awalNilai);
        const slot = this.deklarasiTemp(dek);
        this.destrukDariSlot(dek.id, slot, simpul.ragam);
      }
    }
  }

  private deklarasiTemp(simpul: A.Simpul): number {
    const nama = `\u0000t${this.penghitungTemp}`;
    this.penghitungTemp += 1;
    this.deklarasiLokal(nama, false, simpul);
    this.tandaiSiap();
    return this.lokal.length - 1;
  }

  private emitKonstantaAngka(nilai: number, garis: number): void {
    if (nilai === 0) this.emit(Op.Nol, garis);
    else if (nilai === 1) this.emit(Op.Satu, garis);
    else this.emitKonstanta(nilai, garis);
  }

  private terapkanBawaan(bawaan: A.Ekspresi, garis: number): void {
    const lompatTaktentu = this.emitLompat(Op.LompatJikaTaktentu, garis);
    const lompatAkhir = this.emitLompat(Op.Lompat, garis);
    this.tambalLompat(lompatTaktentu);
    this.emit(Op.Pop, garis);
    this.ekspresi(bawaan);
    this.tambalLompat(lompatAkhir);
  }

  private destrukDariSlot(pola: A.Pola, slot: number, ragam: "misal" | "tetap" | "var" | "assign"): void {
    if (pola.jenis === "PolaLarik") {
      for (let i = 0; i < pola.elemen.length; i += 1) {
        const el = pola.elemen[i]!;
        if (el === null) continue;
        if (el.jenis === "PolaSisa") {
          this.emitOperan(Op.BacaLokal, slot, pola.baris);
          this.emitOperan(Op.LarikSisa, i, pola.baris);
          this.bindNilaiDiStack(el.argumen, ragam);
          break;
        }
        this.emitOperan(Op.BacaLokal, slot, pola.baris);
        this.emitKonstantaAngka(i, pola.baris);
        this.emit(Op.BacaIndeks, pola.baris);
        this.bindNilaiDiStack(el, ragam);
      }
      return;
    }
    if (pola.jenis === "PolaObjek") {
      for (const prop of pola.properti) {
        if (prop.jenis === "PolaSisa") {
          this.galat(prop, "Sisa pada pola objek belum didukung pada fase ini");
        }
        this.emitOperan(Op.BacaLokal, slot, prop.baris);
        if (prop.terhitung) {
          this.ekspresi(prop.kunci);
          this.emit(Op.BacaIndeks, prop.baris);
        } else {
          const indeks = this.potongan.tambahKonstanta(this.namaKunci(prop.kunci));
          this.emitOperan(Op.BacaProperti, indeks, prop.baris);
        }
        this.bindNilaiDiStack(prop.nilai, ragam);
      }
      return;
    }
    this.bindNilaiDiStack(pola, ragam);
  }

  private bindNilaiDiStack(pola: A.Pola, ragam: "misal" | "tetap" | "var" | "assign"): void {
    if (pola.jenis === "PolaBawaan") {
      this.terapkanBawaan(pola.bawaan, pola.baris);
      this.bindNilaiDiStack(pola.kiri, ragam);
      return;
    }
    if (pola.jenis === "Identifier") {
      if (ragam === "assign") {
        this.tulisVariabelTanpaPop(pola);
        this.emit(Op.Pop, pola.baris);
        return;
      }
      const tetap = ragam === "tetap";
      if (this.kedalamanScope === 0) {
        if (tetap) this.globalTetap.add(pola.nama);
        const indeks = this.potongan.tambahKonstanta(pola.nama);
        this.emitOperan(Op.DefinisiGlobal, indeks, pola.baris);
      } else {
        this.deklarasiLokal(pola.nama, tetap, pola);
        this.tandaiSiap();
      }
      return;
    }
    if (pola.jenis === "AksesAnggota") {
      if (ragam !== "assign") this.galat(pola, "Target ini tidak valid untuk deklarasi");
      this.galat(pola, "Target properti dalam destrukturisasi belum didukung pada fase ini");
    }
    if (pola.jenis === "PolaLarik" || pola.jenis === "PolaObjek") {
      const slot = this.deklarasiTemp(pola);
      this.destrukDariSlot(pola, slot, ragam);
      return;
    }
    this.galat(pola, "Pola destrukturisasi tidak valid");
  }

  private deklarasiFungsi(simpul: A.DeklarasiFungsi): void {
    const nama = simpul.fungsi.nama!.nama;
    if (this.kedalamanScope === 0) {
      this.fungsiLiteral(simpul.fungsi);
      const indeks = this.potongan.tambahKonstanta(nama);
      this.emitOperan(Op.DefinisiGlobal, indeks, simpul.baris);
    } else {
      const indeksLokal = this.selesaikanLokal(nama, simpul);
      if (indeksLokal === -1) {
        this.deklarasiLokal(nama, false, simpul);
        this.fungsiLiteral(simpul.fungsi, nama);
        this.tandaiSiap();
      } else {
        this.fungsiLiteral(simpul.fungsi, nama);
        this.emitOperan(Op.TulisLokal, indeksLokal, simpul.baris);
        this.emit(Op.Pop, simpul.baris);
      }
    }
  }

  private jika(simpul: A.Jika): void {
    this.ekspresi(simpul.uji);
    const lompatSalah = this.emitLompat(Op.LompatJikaSalah, simpul.baris);
    this.emit(Op.Pop, simpul.baris);
    this.pernyataan(simpul.konsekuen);
    const lompatAkhir = this.emitLompat(Op.Lompat, simpul.baris);
    this.tambalLompat(lompatSalah);
    this.emit(Op.Pop, simpul.baris);
    if (simpul.alternatif) this.pernyataan(simpul.alternatif);
    this.tambalLompat(lompatAkhir);
  }

  private selama(simpul: A.Selama): void {
    const label = this.ambilLabelTertunda();
    const awalLoop = this.potongan.kode.length;
    const ktx: KonteksAlur = {
      jenis: "loop",
      label,
      awalLanjut: awalLoop,
      tambalanLanjut: [],
      tambalanHenti: [],
      kedalamanScope: this.kedalamanScope,
      kedalamanProteksi: this.proteksi.length,
    };
    this.konteks.push(ktx);
    this.ekspresi(simpul.uji);
    const lompatKeluar = this.emitLompat(Op.LompatJikaSalah, simpul.baris);
    this.emit(Op.Pop, simpul.baris);
    this.pernyataan(simpul.tubuh);
    this.emitOperan(Op.LompatBalik, awalLoop, simpul.baris);
    this.tambalLompat(lompatKeluar);
    this.emit(Op.Pop, simpul.baris);
    for (const slot of ktx.tambalanHenti) this.tambalLompat(slot);
    this.konteks.pop();
  }

  private lakukanSelama(simpul: A.LakukanSelama): void {
    const label = this.ambilLabelTertunda();
    const awalLoop = this.potongan.kode.length;
    const ktx: KonteksAlur = {
      jenis: "loop",
      label,
      awalLanjut: -1,
      tambalanLanjut: [],
      tambalanHenti: [],
      kedalamanScope: this.kedalamanScope,
      kedalamanProteksi: this.proteksi.length,
    };
    this.konteks.push(ktx);
    this.pernyataan(simpul.tubuh);
    for (const slot of ktx.tambalanLanjut) this.tambalLompat(slot);
    this.ekspresi(simpul.uji);
    const lompatKeluar = this.emitLompat(Op.LompatJikaSalah, simpul.baris);
    this.emit(Op.Pop, simpul.baris);
    this.emitOperan(Op.LompatBalik, awalLoop, simpul.baris);
    this.tambalLompat(lompatKeluar);
    this.emit(Op.Pop, simpul.baris);
    for (const slot of ktx.tambalanHenti) this.tambalLompat(slot);
    this.konteks.pop();
  }

  private untukKlasik(simpul: A.UntukKlasik): void {
    const label = this.ambilLabelTertunda();
    this.mulaiScope();
    if (simpul.init) {
      if ((simpul.init as A.Simpul).jenis === "DeklarasiVariabel") {
        this.deklarasiVariabel(simpul.init as A.DeklarasiVariabel);
      } else {
        this.ekspresi(simpul.init as A.Ekspresi);
        this.emit(Op.Pop, simpul.baris);
      }
    }
    const awalLoop = this.potongan.kode.length;
    const ktx: KonteksAlur = {
      jenis: "loop",
      label,
      awalLanjut: -1,
      tambalanLanjut: [],
      tambalanHenti: [],
      kedalamanScope: this.kedalamanScope,
      kedalamanProteksi: this.proteksi.length,
    };
    this.konteks.push(ktx);
    let lompatKeluar = -1;
    if (simpul.uji) {
      this.ekspresi(simpul.uji);
      lompatKeluar = this.emitLompat(Op.LompatJikaSalah, simpul.baris);
      this.emit(Op.Pop, simpul.baris);
    }
    this.pernyataan(simpul.tubuh);
    for (const slot of ktx.tambalanLanjut) this.tambalLompat(slot);
    if (simpul.perbarui) {
      this.ekspresi(simpul.perbarui);
      this.emit(Op.Pop, simpul.baris);
    }
    this.emitOperan(Op.LompatBalik, awalLoop, simpul.baris);
    if (lompatKeluar !== -1) {
      this.tambalLompat(lompatKeluar);
      this.emit(Op.Pop, simpul.baris);
    }
    for (const slot of ktx.tambalanHenti) this.tambalLompat(slot);
    this.konteks.pop();
    this.akhiriScope(simpul.baris);
  }

  private untukDari(simpul: A.UntukDari): void {
    const label = this.ambilLabelTertunda();
    this.mulaiScope();
    this.ekspresi(simpul.kanan);
    if (simpul.tunggu) {
      this.emit(Op.IteratorAwalAsync, simpul.baris);
      this.loopIteratorAsync(simpul, simpul.kidal, simpul.tubuh, label);
    } else {
      this.emit(Op.IteratorAwal, simpul.baris);
      this.loopIterator(simpul, simpul.kidal, simpul.tubuh, label);
    }
    this.akhiriScope(simpul.baris);
  }

  private loopIteratorAsync(
    simpul: A.UntukDari,
    kidal: A.DeklarasiVariabel | A.Pola,
    tubuh: A.Pernyataan,
    label: string | null,
  ): void {
    const iterSlot = this.deklarasiTemp(simpul);
    const awalLoop = this.potongan.kode.length;
    const ktx: KonteksAlur = {
      jenis: "loop",
      label,
      awalLanjut: awalLoop,
      tambalanLanjut: [],
      tambalanHenti: [],
      kedalamanScope: this.kedalamanScope,
      kedalamanProteksi: this.proteksi.length,
    };
    this.konteks.push(ktx);

    this.emitOperan(Op.BacaLokal, iterSlot, simpul.baris);
    this.emit(Op.IteratorLanjutAsync, simpul.baris);
    this.emit(Op.Tunggu, simpul.baris);
    this.emit(Op.Gandakan, simpul.baris);
    const iSelesai = this.potongan.tambahKonstanta("selesai");
    this.emitOperan(Op.BacaProperti, iSelesai, simpul.baris);
    const lompatKeluar = this.emitLompat(Op.LompatJikaBenar, simpul.baris);
    this.emit(Op.Pop, simpul.baris);
    const iNilai = this.potongan.tambahKonstanta("nilai");
    this.emitOperan(Op.BacaProperti, iNilai, simpul.baris);

    this.mulaiScope();
    this.bindTargetIterasi(kidal);
    this.pernyataan(tubuh);
    this.akhiriScope(simpul.baris);
    this.emitOperan(Op.LompatBalik, awalLoop, simpul.baris);

    this.tambalLompat(lompatKeluar);
    this.emit(Op.Pop, simpul.baris);
    this.emit(Op.Pop, simpul.baris);
    for (const slot of ktx.tambalanHenti) this.tambalLompat(slot);
    this.konteks.pop();
  }

  private untukDalam(simpul: A.UntukDalam): void {
    const label = this.ambilLabelTertunda();
    this.mulaiScope();
    this.ekspresi(simpul.kanan);
    this.emit(Op.KunciDalam, simpul.baris);
    this.emit(Op.IteratorAwal, simpul.baris);
    this.loopIterator(simpul, simpul.kidal, simpul.tubuh, label);
    this.akhiriScope(simpul.baris);
  }

  private loopIterator(
    simpul: A.UntukDari | A.UntukDalam,
    kidal: A.DeklarasiVariabel | A.Pola,
    tubuh: A.Pernyataan,
    label: string | null,
  ): void {
    const iterSlot = this.deklarasiTemp(simpul);
    const awalLoop = this.potongan.kode.length;
    const ktx: KonteksAlur = {
      jenis: "loop",
      label,
      awalLanjut: awalLoop,
      tambalanLanjut: [],
      tambalanHenti: [],
      kedalamanScope: this.kedalamanScope,
      kedalamanProteksi: this.proteksi.length,
    };
    this.konteks.push(ktx);

    this.emitOperan(Op.BacaLokal, iterSlot, simpul.baris);
    this.emit(Op.IteratorLanjut, simpul.baris);
    const lompatKeluar = this.emitLompat(Op.LompatJikaBenar, simpul.baris);
    this.emit(Op.Pop, simpul.baris);

    this.mulaiScope();
    this.bindTargetIterasi(kidal);
    this.pernyataan(tubuh);
    this.akhiriScope(simpul.baris);
    this.emitOperan(Op.LompatBalik, awalLoop, simpul.baris);

    this.tambalLompat(lompatKeluar);
    this.emit(Op.Pop, simpul.baris);
    this.emit(Op.Pop, simpul.baris);
    for (const slot of ktx.tambalanHenti) this.tambalLompat(slot);
    this.konteks.pop();
  }

  private bindTargetIterasi(kidal: A.DeklarasiVariabel | A.Pola): void {
    if ((kidal as A.Simpul).jenis === "DeklarasiVariabel") {
      const dekl = kidal as A.DeklarasiVariabel;
      this.bindNilaiDiStack(dekl.deklarasi[0]!.id, dekl.ragam);
    } else {
      this.bindNilaiDiStack(kidal as A.Pola, "assign");
    }
  }

  private ambilLabelTertunda(): string | null {
    const label = this.labelTertunda;
    this.labelTertunda = null;
    return label;
  }

  private emitPopKeKedalaman(target: number, garis: number): void {
    for (let i = this.lokal.length - 1; i >= 0; i -= 1) {
      const lokal = this.lokal[i]!;
      if (lokal.kedalaman <= target) break;
      this.emit(lokal.tertangkap ? Op.TutupUpvalue : Op.Pop, garis);
    }
  }

  private emitPembersihanProteksi(sampaiIndeks: number, garis: number): void {
    const simpan = this.proteksi.length;
    for (let i = this.proteksi.length - 1; i >= sampaiIndeks; i -= 1) {
      const p = this.proteksi[i]!;
      this.proteksi.length = i;
      if (p.adaHandler) this.emit(Op.LepasPenangan, garis);
      if (p.finallyNode) this.pernyataan(p.finallyNode);
    }
    this.proteksi.length = simpan;
  }

  private cariKonteks(label: string | null, simpul: A.Simpul, butuhLoop: boolean): KonteksAlur {
    for (let i = this.konteks.length - 1; i >= 0; i -= 1) {
      const ktx = this.konteks[i]!;
      if (label !== null && ktx.label !== label) continue;
      if (butuhLoop && ktx.jenis !== "loop") {
        if (label !== null) this.galat(simpul, `Label "${label}" bukan perulangan`);
        continue;
      }
      return ktx;
    }
    if (label !== null) this.galat(simpul, `Label "${label}" tidak ditemukan`);
    this.galat(simpul, butuhLoop ? "'lanjut' di luar perulangan" : "'henti' di luar perulangan atau 'pilih'");
  }

  private henti(simpul: A.Henti): void {
    const ktx = this.cariKonteks(simpul.label ? simpul.label.nama : null, simpul, false);
    this.emitPembersihanProteksi(ktx.kedalamanProteksi, simpul.baris);
    this.emitPopKeKedalaman(ktx.kedalamanScope, simpul.baris);
    ktx.tambalanHenti.push(this.emitLompat(Op.Lompat, simpul.baris));
  }

  private lanjut(simpul: A.Lanjut): void {
    const ktx = this.cariKonteks(simpul.label ? simpul.label.nama : null, simpul, true);
    this.emitPembersihanProteksi(ktx.kedalamanProteksi, simpul.baris);
    this.emitPopKeKedalaman(ktx.kedalamanScope, simpul.baris);
    if (ktx.awalLanjut >= 0) {
      this.emitOperan(Op.LompatBalik, ktx.awalLanjut, simpul.baris);
    } else {
      ktx.tambalanLanjut.push(this.emitLompat(Op.Lompat, simpul.baris));
    }
  }

  private pilih(simpul: A.Pilih): void {
    this.mulaiScope();
    this.ekspresi(simpul.diskriminan);
    const ktx: KonteksAlur = {
      jenis: "pilih",
      label: this.ambilLabelTertunda(),
      awalLanjut: -1,
      tambalanLanjut: [],
      tambalanHenti: [],
      kedalamanScope: this.kedalamanScope,
      kedalamanProteksi: this.proteksi.length,
    };
    this.konteks.push(ktx);

    const tambalanBody: number[] = [];
    let indeksBawaan = -1;
    for (let i = 0; i < simpul.kasus.length; i += 1) {
      const kasus = simpul.kasus[i]!;
      if (kasus.uji === null) {
        indeksBawaan = i;
        tambalanBody.push(-1);
        continue;
      }
      this.emit(Op.Gandakan, kasus.baris);
      this.ekspresi(kasus.uji);
      this.emit(Op.SamaDengan, kasus.baris);
      const lompatLewat = this.emitLompat(Op.LompatJikaSalah, kasus.baris);
      this.emit(Op.Pop, kasus.baris);
      tambalanBody.push(this.emitLompat(Op.Lompat, kasus.baris));
      this.tambalLompat(lompatLewat);
      this.emit(Op.Pop, kasus.baris);
    }
    const lompatTanpaCocok = this.emitLompat(Op.Lompat, simpul.baris);

    for (let i = 0; i < simpul.kasus.length; i += 1) {
      const kasus = simpul.kasus[i]!;
      const slot = tambalanBody[i]!;
      if (slot !== -1) this.tambalLompat(slot);
      if (i === indeksBawaan) this.tambalLompat(lompatTanpaCocok);
      for (const p of kasus.tubuh) this.pernyataan(p);
    }
    if (indeksBawaan === -1) this.tambalLompat(lompatTanpaCocok);

    for (const slot of ktx.tambalanHenti) this.tambalLompat(slot);
    this.konteks.pop();
    this.emit(Op.Pop, simpul.baris);
    this.akhiriScope(simpul.baris);
  }

  private hasilkan(simpul: A.Hasilkan): void {
    if (simpul.delegasi) {
      this.mulaiScope();
      this.ekspresi(simpul.argumen!);
      this.emit(Op.IteratorAwal, simpul.baris);
      const itSlot = this.deklarasiTemp(simpul);
      const awalLoop = this.potongan.kode.length;
      this.emitOperan(Op.BacaLokal, itSlot, simpul.baris);
      this.emit(Op.IteratorLanjut, simpul.baris);
      const lompatKeluar = this.emitLompat(Op.LompatJikaBenar, simpul.baris);
      this.emit(Op.Pop, simpul.baris);
      this.emit(Op.Hasilkan, simpul.baris);
      this.emit(Op.Pop, simpul.baris);
      this.emitOperan(Op.LompatBalik, awalLoop, simpul.baris);
      this.tambalLompat(lompatKeluar);
      this.emit(Op.Pop, simpul.baris);
      this.emit(Op.Pop, simpul.baris);
      this.akhiriScope(simpul.baris);
      this.emit(Op.Taktentu, simpul.baris);
      return;
    }
    if (simpul.argumen) this.ekspresi(simpul.argumen);
    else this.emit(Op.Taktentu, simpul.baris);
    this.emit(Op.Hasilkan, simpul.baris);
  }

  private lempar(simpul: A.Lempar): void {
    this.ekspresi(simpul.argumen);
    this.emit(Op.Lempar, simpul.baris);
  }

  private coba(simpul: A.Coba): void {
    const punyaTangkap = simpul.penangkap !== null;
    const punyaAkhirnya = simpul.akhirnya !== null;

    const slotH1 = this.emitLompat(Op.PasangPenangan, simpul.baris);
    this.proteksi.push({ finallyNode: simpul.akhirnya, adaHandler: true });
    this.pernyataan(simpul.blok);
    this.proteksi.pop();
    this.emit(Op.LepasPenangan, simpul.baris);
    const slotNormalDariTry = this.emitLompat(Op.Lompat, simpul.baris);

    this.tambalLompat(slotH1);
    const lompatKeNormal: number[] = [];

    if (punyaTangkap) {
      const penangkap = simpul.penangkap!;
      let slotH2 = -1;
      if (punyaAkhirnya) slotH2 = this.emitLompat(Op.PasangPenangan, penangkap.baris);
      this.mulaiScope();
      if (penangkap.param) {
        if (penangkap.param.jenis === "Identifier") {
          this.deklarasiLokal(penangkap.param.nama, false, penangkap.param);
          this.tandaiSiap();
        } else {
          const slot = this.deklarasiTemp(penangkap.param);
          this.destrukDariSlot(penangkap.param, slot, "misal");
        }
      } else {
        this.emit(Op.Pop, penangkap.baris);
      }
      if (punyaAkhirnya) this.proteksi.push({ finallyNode: simpul.akhirnya, adaHandler: true });
      this.pernyataan(penangkap.tubuh);
      if (punyaAkhirnya) this.proteksi.pop();
      this.akhiriScope(penangkap.baris);
      if (punyaAkhirnya) this.emit(Op.LepasPenangan, penangkap.baris);
      lompatKeNormal.push(this.emitLompat(Op.Lompat, penangkap.baris));
      if (punyaAkhirnya) {
        this.tambalLompat(slotH2);
        this.pernyataan(simpul.akhirnya!);
        this.emit(Op.LemparUlang, simpul.baris);
      }
    } else {
      this.pernyataan(simpul.akhirnya!);
      this.emit(Op.LemparUlang, simpul.baris);
    }

    this.tambalLompat(slotNormalDariTry);
    for (const slot of lompatKeNormal) this.tambalLompat(slot);
    if (punyaAkhirnya) this.pernyataan(simpul.akhirnya!);
  }

  private berlabel(simpul: A.Berlabel): void {
    const tubuh = simpul.tubuh;
    if (
      tubuh.jenis === "Selama" ||
      tubuh.jenis === "LakukanSelama" ||
      tubuh.jenis === "UntukKlasik" ||
      tubuh.jenis === "UntukDari" ||
      tubuh.jenis === "UntukDalam" ||
      tubuh.jenis === "Pilih"
    ) {
      this.labelTertunda = simpul.label.nama;
      this.pernyataan(tubuh);
      return;
    }
    const ktx: KonteksAlur = {
      jenis: "pilih",
      label: simpul.label.nama,
      awalLanjut: -1,
      tambalanLanjut: [],
      tambalanHenti: [],
      kedalamanScope: this.kedalamanScope,
      kedalamanProteksi: this.proteksi.length,
    };
    this.konteks.push(ktx);
    this.pernyataan(tubuh);
    for (const slot of ktx.tambalanHenti) this.tambalLompat(slot);
    this.konteks.pop();
  }

  private kembalikan(simpul: A.Kembalikan): void {
    if (this.induk === null) this.galat(simpul, "'kembalikan' hanya boleh di dalam fungsi");
    if (simpul.argumen) this.ekspresi(simpul.argumen);
    else if (this.konstruktorAktif) this.emitOperan(Op.BacaLokal, 0, simpul.baris);
    else this.emit(Op.Taktentu, simpul.baris);
    this.emitPembersihanProteksi(0, simpul.baris);
    this.emit(Op.Kembali, simpul.baris);
  }

  private ekspresi(simpul: A.Ekspresi): void {
    switch (simpul.jenis) {
      case "LiteralAngka":
        if (simpul.nilai === 0) this.emit(Op.Nol, simpul.baris);
        else if (simpul.nilai === 1) this.emit(Op.Satu, simpul.baris);
        else this.emitKonstanta(simpul.nilai, simpul.baris);
        return;
      case "LiteralBilanganBesar":
        this.emitKonstanta(simpul.nilai, simpul.baris);
        return;
      case "LiteralTeks":
        this.emitKonstanta(simpul.nilai, simpul.baris);
        return;
      case "LiteralBoolean":
        this.emit(simpul.nilai ? Op.Benar : Op.Salah, simpul.baris);
        return;
      case "LiteralKosong":
        this.emit(Op.Kosong, simpul.baris);
        return;
      case "LiteralTaktentu":
        this.emit(Op.Taktentu, simpul.baris);
        return;
      case "LiteralRegex": {
        const iPola = this.potongan.tambahKonstanta(simpul.pola);
        const iBendera = this.potongan.tambahKonstanta(simpul.bendera);
        this.emit(Op.Regex, simpul.baris);
        this.emit(iPola, simpul.baris);
        this.emit(iBendera, simpul.baris);
        return;
      }
      case "Identifier":
        this.bacaVariabel(simpul);
        return;
      case "Ini":
        this.bacaNama("ini", simpul);
        return;
      case "Larik":
        this.larik(simpul);
        return;
      case "Objek":
        this.objek(simpul);
        return;
      case "AksesAnggota":
        this.aksesAnggota(simpul);
        return;
      case "RantaiOpsional":
        this.rantaiOpsional(simpul);
        return;
      case "Baru":
        this.baru(simpul);
        return;
      case "TemplateTeks":
        this.templateTeks(simpul);
        return;
      case "Biner":
        this.biner(simpul);
        return;
      case "Logika":
        this.logika(simpul);
        return;
      case "Uner":
        this.uner(simpul);
        return;
      case "Perbarui":
        this.perbarui(simpul);
        return;
      case "Penugasan":
        this.penugasan(simpul);
        return;
      case "Kondisional":
        this.kondisional(simpul);
        return;
      case "Urutan":
        this.urutan(simpul);
        return;
      case "Pemanggilan":
        this.pemanggilan(simpul);
        return;
      case "Fungsi":
        this.fungsiLiteral(simpul);
        return;
      case "KelasEkspresi":
        this.kelasEkspresi(simpul);
        return;
      case "Hasilkan":
        this.hasilkan(simpul);
        return;
      case "Tunggu":
        this.ekspresi(simpul.argumen);
        this.emit(Op.Tunggu, simpul.baris);
        return;
      case "ImporDinamis":
        this.ekspresi(simpul.sumber);
        this.emit(Op.ImporDinamis, simpul.baris);
        return;
      default:
        this.galat(simpul, `Ekspresi "${simpul.jenis}" belum didukung pada fase ini`);
    }
  }

  private templateTeks(simpul: A.TemplateTeks): void {
    this.emitKonstanta(simpul.bagian[0] ?? "", simpul.baris);
    for (let i = 0; i < simpul.ekspresi.length; i += 1) {
      this.ekspresi(simpul.ekspresi[i]!);
      this.emit(Op.Tambah, simpul.baris);
      this.emitKonstanta(simpul.bagian[i + 1] ?? "", simpul.baris);
      this.emit(Op.Tambah, simpul.baris);
    }
  }

  private biner(simpul: A.Biner): void {
    if (this.lipatKonstan(simpul)) return;
    this.ekspresi(simpul.kiri);
    this.ekspresi(simpul.kanan);
    if (simpul.operator === "contohdari") {
      this.emit(Op.ContohDari, simpul.baris);
      return;
    }
    if (simpul.operator === "dalam") {
      this.emit(Op.Dalam, simpul.baris);
      return;
    }
    const op = OP_BINER[simpul.operator];
    if (op === undefined) this.galat(simpul, `Operator "${simpul.operator}" tidak dikenal`);
    this.emit(op, simpul.baris);
  }

  private lipatKonstan(simpul: A.Biner): boolean {
    const kiri = simpul.kiri;
    const kanan = simpul.kanan;
    if (kiri.jenis === "LiteralAngka" && kanan.jenis === "LiteralAngka") {
      const a = kiri.nilai;
      const b = kanan.nilai;
      const op = simpul.operator;
      let hasil: number | boolean | undefined;
      switch (op) {
        case "+": hasil = a + b; break;
        case "-": hasil = a - b; break;
        case "*": hasil = a * b; break;
        case "/": hasil = a / b; break;
        case "%": hasil = a % b; break;
        case "**": hasil = a ** b; break;
        case "&": hasil = a & b; break;
        case "|": hasil = a | b; break;
        case "^": hasil = a ^ b; break;
        case "<<": hasil = a << b; break;
        case ">>": hasil = a >> b; break;
        case ">>>": hasil = a >>> b; break;
        case "<": hasil = a < b; break;
        case ">": hasil = a > b; break;
        case "<=": hasil = a <= b; break;
        case ">=": hasil = a >= b; break;
        case "==":
        case "===": hasil = a === b; break;
        case "!=":
        case "!==": hasil = a !== b; break;
        default: return false;
      }
      if (typeof hasil === "boolean") this.emit(hasil ? Op.Benar : Op.Salah, simpul.baris);
      else this.emitKonstantaAngka(hasil, simpul.baris);
      return true;
    }
    if (kiri.jenis === "LiteralTeks" && kanan.jenis === "LiteralTeks" && simpul.operator === "+") {
      this.emitKonstanta(kiri.nilai + kanan.nilai, simpul.baris);
      return true;
    }
    return false;
  }

  private logika(simpul: A.Logika): void {
    this.ekspresi(simpul.kiri);
    if (simpul.operator === "&&") {
      const lompat = this.emitLompat(Op.LompatJikaSalah, simpul.baris);
      this.emit(Op.Pop, simpul.baris);
      this.ekspresi(simpul.kanan);
      this.tambalLompat(lompat);
    } else if (simpul.operator === "||") {
      const lompat = this.emitLompat(Op.LompatJikaBenar, simpul.baris);
      this.emit(Op.Pop, simpul.baris);
      this.ekspresi(simpul.kanan);
      this.tambalLompat(lompat);
    } else {
      const lompatNullish = this.emitLompat(Op.LompatJikaKosong, simpul.baris);
      const lompatAkhir = this.emitLompat(Op.Lompat, simpul.baris);
      this.tambalLompat(lompatNullish);
      this.emit(Op.Pop, simpul.baris);
      this.ekspresi(simpul.kanan);
      this.tambalLompat(lompatAkhir);
    }
  }

  private uner(simpul: A.Uner): void {
    if (simpul.operator === "hapus" || simpul.operator === "abaikan") {
      this.galat(simpul, `Operator "${simpul.operator}" belum didukung pada fase ini`);
    }
    this.ekspresi(simpul.argumen);
    switch (simpul.operator) {
      case "-":
        this.emit(Op.Negasi, simpul.baris);
        return;
      case "+":
        this.emit(Op.Positif, simpul.baris);
        return;
      case "!":
        this.emit(Op.Bukan, simpul.baris);
        return;
      case "~":
        this.emit(Op.Tilde, simpul.baris);
        return;
      case "jenisdari":
        this.emit(Op.JenisDari, simpul.baris);
        return;
      default:
        this.galat(simpul, `Operator uner "${simpul.operator}" tidak dikenal`);
    }
  }

  private perbarui(simpul: A.Perbarui): void {
    const opAngka = simpul.operator === "++" ? Op.Tambah : Op.Kurang;
    if (simpul.argumen.jenis === "Identifier") {
      const nama = simpul.argumen;
      this.bacaVariabel(nama);
      this.emit(Op.Positif, simpul.baris);
      if (!simpul.prefiks) this.emit(Op.Gandakan, simpul.baris);
      this.emit(Op.Satu, simpul.baris);
      this.emit(opAngka, simpul.baris);
      this.tulisVariabelTanpaPop(nama);
      if (!simpul.prefiks) this.emit(Op.Pop, simpul.baris);
      return;
    }
    if (simpul.argumen.jenis === "AksesAnggota" && !simpul.prefiks) {
      this.galat(simpul, "'++'/'--' postfiks pada properti belum didukung; gunakan '+= 1'");
    }
    if (simpul.argumen.jenis === "AksesAnggota" && !simpul.argumen.terhitung) {
      const anggota = simpul.argumen;
      const namaKonst = this.potongan.tambahKonstanta(this.namaProperti(anggota.properti));
      this.ekspresi(anggota.objek as A.Ekspresi);
      this.emit(Op.Gandakan, simpul.baris);
      this.emitOperan(Op.BacaProperti, namaKonst, simpul.baris);
      this.emit(Op.Satu, simpul.baris);
      this.emit(opAngka, simpul.baris);
      this.emitOperan(Op.TulisProperti, namaKonst, simpul.baris);
      return;
    }
    this.galat(simpul, "Sasaran '++'/'--' belum didukung pada fase ini");
  }

  private urutan(simpul: A.Urutan): void {
    for (let i = 0; i < simpul.ekspresi.length; i += 1) {
      this.ekspresi(simpul.ekspresi[i]!);
      if (i < simpul.ekspresi.length - 1) this.emit(Op.Pop, simpul.baris);
    }
  }

  private kondisional(simpul: A.Kondisional): void {
    this.ekspresi(simpul.uji);
    const lompatSalah = this.emitLompat(Op.LompatJikaSalah, simpul.baris);
    this.emit(Op.Pop, simpul.baris);
    this.ekspresi(simpul.konsekuen);
    const lompatAkhir = this.emitLompat(Op.Lompat, simpul.baris);
    this.tambalLompat(lompatSalah);
    this.emit(Op.Pop, simpul.baris);
    this.ekspresi(simpul.alternatif);
    this.tambalLompat(lompatAkhir);
  }

  private penugasan(simpul: A.Penugasan): void {
    const sasaran = simpul.sasaran as A.Simpul;
    if (sasaran.jenis === "Identifier") {
      this.penugasanIdentifier(simpul, sasaran as A.Identifier);
      return;
    }
    if (sasaran.jenis === "AksesAnggota") {
      this.penugasanAnggota(simpul, sasaran as A.AksesAnggota);
      return;
    }
    if (sasaran.jenis === "PolaLarik" || sasaran.jenis === "PolaObjek") {
      if (simpul.operator !== "=") this.galat(simpul, "Destrukturisasi hanya mendukung '='");
      this.ekspresi(simpul.nilai);
      const slot = this.deklarasiTemp(simpul);
      this.destrukDariSlot(sasaran as A.Pola, slot, "assign");
      this.emitOperan(Op.BacaLokal, slot, simpul.baris);
      return;
    }
    this.galat(simpul, "Sasaran penugasan tidak valid");
  }

  private penugasanIdentifier(simpul: A.Penugasan, sasaran: A.Identifier): void {
    if (simpul.operator === "=") {
      this.ekspresi(simpul.nilai);
      this.tulisVariabelTanpaPop(sasaran);
      return;
    }
    if (simpul.operator === "&&=" || simpul.operator === "||=" || simpul.operator === "??=") {
      this.bacaVariabel(sasaran);
      const op =
        simpul.operator === "&&=" ? Op.LompatJikaSalah : simpul.operator === "||=" ? Op.LompatJikaBenar : Op.LompatJikaKosong;
      if (simpul.operator === "??=") {
        const lompatNullish = this.emitLompat(Op.LompatJikaKosong, simpul.baris);
        const lompatAkhir = this.emitLompat(Op.Lompat, simpul.baris);
        this.tambalLompat(lompatNullish);
        this.emit(Op.Pop, simpul.baris);
        this.ekspresi(simpul.nilai);
        this.tulisVariabelTanpaPop(sasaran);
        this.tambalLompat(lompatAkhir);
      } else {
        const lompat = this.emitLompat(op, simpul.baris);
        this.emit(Op.Pop, simpul.baris);
        this.ekspresi(simpul.nilai);
        this.tulisVariabelTanpaPop(sasaran);
        this.tambalLompat(lompat);
      }
      return;
    }
    this.bacaVariabel(sasaran);
    this.ekspresi(simpul.nilai);
    this.emit(this.opGabungan(simpul), simpul.baris);
    this.tulisVariabelTanpaPop(sasaran);
  }

  private penugasanAnggota(simpul: A.Penugasan, sasaran: A.AksesAnggota): void {
    if (simpul.operator === "&&=" || simpul.operator === "||=" || simpul.operator === "??=") {
      this.galat(simpul, `Operator "${simpul.operator}" pada properti belum didukung pada fase ini`);
    }
    const namaKonst = sasaran.terhitung ? -1 : this.potongan.tambahKonstanta(this.namaProperti(sasaran.properti));

    if (simpul.operator === "=") {
      this.ekspresi(sasaran.objek as A.Ekspresi);
      if (sasaran.terhitung) {
        this.ekspresi(sasaran.properti as A.Ekspresi);
        this.ekspresi(simpul.nilai);
        this.emit(Op.TulisIndeks, simpul.baris);
      } else {
        this.ekspresi(simpul.nilai);
        this.emitOperan(Op.TulisProperti, namaKonst, simpul.baris);
      }
      return;
    }

    if (sasaran.terhitung) {
      this.ekspresi(sasaran.objek as A.Ekspresi);
      this.ekspresi(sasaran.properti as A.Ekspresi);
      this.emit(Op.Gandakan2, simpul.baris);
      this.emit(Op.BacaIndeks, simpul.baris);
      this.ekspresi(simpul.nilai);
      this.emit(this.opGabungan(simpul), simpul.baris);
      this.emit(Op.TulisIndeks, simpul.baris);
    } else {
      this.ekspresi(sasaran.objek as A.Ekspresi);
      this.emit(Op.Gandakan, simpul.baris);
      this.emitOperan(Op.BacaProperti, namaKonst, simpul.baris);
      this.ekspresi(simpul.nilai);
      this.emit(this.opGabungan(simpul), simpul.baris);
      this.emitOperan(Op.TulisProperti, namaKonst, simpul.baris);
    }
  }

  private opGabungan(simpul: A.Penugasan): Op {
    const opDasar = simpul.operator.slice(0, -1);
    const op = OP_BINER[opDasar];
    if (op === undefined) this.galat(simpul, `Operator "${simpul.operator}" belum didukung`);
    return op;
  }

  private pemanggilan(simpul: A.Pemanggilan): void {
    if ((simpul.callee as A.Simpul).jenis === "Induk") {
      this.bacaNama("ini", simpul);
      this.bacaNamaSuper(simpul);
      this.argumenLalu(simpul);
      this.emitOperan(Op.PanggilInduk, simpul.argumen.length, simpul.baris);
      return;
    }
    const callee = simpul.callee as A.Ekspresi;

    if (callee.jenis === "AksesAnggota" && (callee.objek as A.Simpul).jenis === "Induk") {
      this.bacaNama("ini", simpul);
      this.bacaNamaSuper(simpul);
      const indeks = this.potongan.tambahKonstanta(this.namaProperti(callee.properti));
      this.emitOperan(Op.BacaIndukMetode, indeks, simpul.baris);
      this.argumenLalu(simpul);
      this.emitOperan(Op.PanggilDenganIni, simpul.argumen.length, simpul.baris);
      return;
    }

    if (callee.jenis === "AksesAnggota" && !callee.opsional) {
      this.ekspresi(callee.objek as A.Ekspresi);
      this.emit(Op.Gandakan, simpul.baris);
      if (callee.terhitung) {
        this.ekspresi(callee.properti as A.Ekspresi);
        this.emit(Op.BacaIndeks, simpul.baris);
      } else {
        const indeks = this.potongan.tambahKonstanta(this.namaProperti(callee.properti));
        this.emitOperan(Op.BacaProperti, indeks, simpul.baris);
      }
      this.argumenLalu(simpul);
      this.emitOperan(Op.PanggilDenganIni, simpul.argumen.length, simpul.baris);
      return;
    }

    this.ekspresi(callee);
    this.argumenLalu(simpul);
    this.emitOperan(Op.Panggil, simpul.argumen.length, simpul.baris);
  }

  private fungsiLiteral(simpul: A.Fungsi, nama = "", kembalikanIni = false): void {
    const namaFungsi = nama || (simpul.nama ? simpul.nama.nama : simpul.panah ? "panah" : "anonim");
    const anak = new Kompiler(namaFungsi, this.namaBerkas, this);
    if (!simpul.panah) anak.lokal[0]!.nama = "ini";
    anak.konstruktorAktif = kembalikanIni;
    anak.fungsi.generator = simpul.generator;
    anak.fungsi.asinkron = simpul.asinkron;
    anak.mulaiScope();
    anak.siapkanParameter(simpul.parameter);

    if (simpul.tubuh.jenis === "Blok") {
      anak.pratindakHoisting(simpul.tubuh.tubuh);
      for (const p of simpul.tubuh.tubuh) anak.pernyataan(p);
      if (kembalikanIni) anak.emitOperan(Op.BacaLokal, 0, akhirGaris(simpul));
      else anak.emit(Op.Taktentu, akhirGaris(simpul));
      anak.emit(Op.Kembali, akhirGaris(simpul));
    } else {
      anak.ekspresi(simpul.tubuh);
      anak.emit(Op.Kembali, akhirGaris(simpul));
    }

    const indeks = this.potongan.tambahKonstanta(anak.fungsi);
    this.emitOperan(Op.Penutup, indeks, simpul.baris);
    for (const u of anak.upvalue) {
      this.emit(u.lokal ? 1 : 0, simpul.baris);
      this.emit(u.indeks, simpul.baris);
    }
  }

  private bacaNamaSuper(simpul: A.Simpul): void {
    const nama = "\u0000induk";
    const indeksLokal = this.selesaikanLokal(nama, simpul);
    if (indeksLokal !== -1) {
      this.emitOperan(Op.BacaLokal, indeksLokal, simpul.baris);
      return;
    }
    const indeksUpvalue = this.selesaikanUpvalue(nama, simpul);
    if (indeksUpvalue !== -1) {
      this.emitOperan(Op.BacaUpvalue, indeksUpvalue, simpul.baris);
      return;
    }
    this.galat(simpul, "'induk' hanya tersedia di dalam kelas turunan");
  }

  private imporModul(simpul: A.Impor): void {
    const indeksSpec = this.potongan.tambahKonstanta(simpul.sumber);
    this.emitOperan(Op.MuatModul, indeksSpec, simpul.baris);
    if (simpul.penentu.length === 0) {
      this.emit(Op.Pop, simpul.baris);
      return;
    }
    const slotEkspor = this.deklarasiTemp(simpul);
    for (const penentu of simpul.penentu) {
      this.emitOperan(Op.BacaLokal, slotEkspor, simpul.baris);
      if (penentu.ragam === "namespace") {
        this.bindImpor(penentu.lokal.nama, penentu);
      } else if (penentu.ragam === "bawaan") {
        const indeks = this.potongan.tambahKonstanta("bawaan");
        this.emitOperan(Op.BacaProperti, indeks, simpul.baris);
        this.bindImpor(penentu.lokal.nama, penentu);
      } else {
        const indeks = this.potongan.tambahKonstanta(penentu.impor!);
        this.emitOperan(Op.BacaProperti, indeks, simpul.baris);
        this.bindImpor(penentu.lokal.nama, penentu);
      }
    }
  }

  private bindImpor(nama: string, simpul: A.Simpul): void {
    if (this.kedalamanScope === 0) {
      const indeks = this.potongan.tambahKonstanta(nama);
      this.globalTetap.add(nama);
      this.emitOperan(Op.DefinisiGlobal, indeks, simpul.baris);
    } else {
      this.deklarasiLokal(nama, true, simpul);
      this.tandaiSiap();
    }
  }

  private eksporBernama(simpul: A.EksporBernama): void {
    if (simpul.sumber !== null) {
      this.galat(simpul, "'ekspor ... dari' belum didukung pada fase ini");
    }
    if (simpul.deklarasi !== null) {
      this.pernyataan(simpul.deklarasi);
      if (this.modeModul) {
        for (const nama of this.namaDeklarasi(simpul.deklarasi)) {
          const slot = this.selesaikanLokal(nama, simpul);
          if (slot !== -1) this.eksporModul.push({ nama, slot });
        }
      }
      return;
    }
    if (this.modeModul) {
      for (const penentu of simpul.penentu) {
        const slot = this.selesaikanLokal(penentu.lokal, simpul);
        if (slot === -1) this.galat(simpul, `Nama "${penentu.lokal}" tidak ditemukan untuk diekspor`);
        this.eksporModul.push({ nama: penentu.diekspor, slot });
      }
    }
  }

  private eksporBawaan(simpul: A.EksporBawaan): void {
    const nilai = simpul.nilai;
    if ((nilai as A.Simpul).jenis === "DeklarasiFungsi") {
      const dekl = nilai as A.DeklarasiFungsi;
      if (dekl.fungsi.nama) {
        this.pernyataan(dekl);
        if (this.modeModul) this.slotDefault = this.selesaikanLokal(dekl.fungsi.nama.nama, simpul);
      } else {
        this.fungsiLiteral(dekl.fungsi);
        this.simpanDefault(simpul);
      }
      return;
    }
    if ((nilai as A.Simpul).jenis === "DeklarasiKelas") {
      const dekl = nilai as A.DeklarasiKelas;
      if (dekl.kelas.nama) {
        this.pernyataan(dekl);
        if (this.modeModul) this.slotDefault = this.selesaikanLokal(dekl.kelas.nama.nama, simpul);
      } else {
        this.kelasEkspresi(dekl.kelas);
        this.simpanDefault(simpul);
      }
      return;
    }
    this.ekspresi(nilai as A.Ekspresi);
    this.simpanDefault(simpul);
  }

  private simpanDefault(simpul: A.Simpul): void {
    if (this.modeModul) {
      this.slotDefault = this.deklarasiTemp(simpul);
    } else {
      this.emit(Op.Pop, simpul.baris);
    }
  }

  private namaDeklarasi(simpul: A.Pernyataan): string[] {
    if (simpul.jenis === "DeklarasiFungsi") return [simpul.fungsi.nama!.nama];
    if (simpul.jenis === "DeklarasiKelas") return [simpul.kelas.nama!.nama];
    if (simpul.jenis === "DeklarasiVariabel") {
      const nama: string[] = [];
      for (const dek of simpul.deklarasi) {
        if (dek.id.jenis === "Identifier") nama.push(dek.id.nama);
      }
      return nama;
    }
    return [];
  }

  private deklarasiKelas(simpul: A.DeklarasiKelas): void {
    const nama = simpul.kelas.nama!.nama;
    if (this.kedalamanScope === 0) {
      this.kelasEkspresi(simpul.kelas);
      const indeks = this.potongan.tambahKonstanta(nama);
      this.emitOperan(Op.DefinisiGlobal, indeks, simpul.baris);
    } else {
      this.deklarasiLokal(nama, false, simpul);
      this.kelasEkspresi(simpul.kelas);
      this.tandaiSiap();
    }
  }

  private kelasEkspresi(simpul: A.KelasEkspresi): void {
    const punyaInduk = simpul.induk !== null;
    let slotInduk = -1;
    if (punyaInduk) {
      this.ekspresi(simpul.induk!);
      this.mulaiScope();
      this.deklarasiLokal("\u0000induk", true, simpul);
      this.tandaiSiap();
      slotInduk = this.lokal.length - 1;
    }

    const namaKonst = this.potongan.tambahKonstanta(simpul.nama ? simpul.nama.nama : "anonim");
    this.emitOperan(Op.KelasBaru, namaKonst, simpul.baris);
    if (punyaInduk) {
      this.emitOperan(Op.BacaLokal, slotInduk, simpul.baris);
      this.emit(Op.WarisiKelas, simpul.baris);
    }

    for (const anggota of simpul.anggota) {
      this.anggotaKelas(anggota);
    }

    if (punyaInduk) {
      this.emit(Op.SelesaikanKelasInduk, simpul.baris);
      this.kedalamanScope -= 1;
      this.lokal.pop();
    }
  }

  private anggotaKelas(anggota: A.AnggotaKelas): void {
    if (anggota.jenis === "BlokStatis") {
      const fungsi = this.sintesisFungsi({ jenis: "Blok", tubuh: anggota.tubuh } as A.Blok, anggota);
      this.fungsiLiteral(fungsi, "statis");
      this.emit(Op.JalankanStatis, anggota.baris);
      return;
    }

    if (anggota.jenis === "FieldKelas") {
      if (anggota.terhitung) this.galat(anggota, "Nama field terhitung belum didukung pada fase ini");
      const nama = this.namaAnggota(anggota.kunci);
      const namaKonst = this.potongan.tambahKonstanta(nama);
      if (anggota.statis) {
        if (anggota.nilai) this.ekspresi(anggota.nilai);
        else this.emit(Op.Taktentu, anggota.baris);
        this.emitOperan(Op.FieldStatis, namaKonst, anggota.baris);
      } else {
        if (anggota.nilai) {
          const fungsi = this.sintesisFungsi(anggota.nilai, anggota);
          this.fungsiLiteral(fungsi, nama);
        } else {
          this.emit(Op.Taktentu, anggota.baris);
        }
        this.emitOperan(Op.FieldInstance, namaKonst, anggota.baris);
      }
      return;
    }

    if (anggota.terhitung) this.galat(anggota, "Nama metode terhitung belum didukung pada fase ini");
    const nama = this.namaAnggota(anggota.kunci);
    const namaKonst = this.potongan.tambahKonstanta(nama);
    const konstruktor = anggota.ragam === "konstruktor";
    this.fungsiLiteral(anggota.nilai, nama, konstruktor);
    const ragamKode = anggota.ragam === "dapatkan" ? 1 : anggota.ragam === "tetapkan" ? 2 : anggota.ragam === "konstruktor" ? 3 : 0;
    const bendera = (anggota.statis ? 1 : 0) | (ragamKode << 1);
    this.emit(Op.MetodeKelas, anggota.baris);
    this.emit(namaKonst, anggota.baris);
    this.emit(bendera, anggota.baris);
  }

  private namaAnggota(kunci: A.Ekspresi | A.NamaPrivat): string {
    if (kunci.jenis === "NamaPrivat") return "#" + kunci.nama;
    return this.namaKunci(kunci as A.Ekspresi);
  }

  private sintesisFungsi(tubuh: A.Blok | A.Ekspresi, acuan: A.Simpul): A.Fungsi {
    return {
      jenis: "Fungsi",
      nama: null,
      parameter: [],
      tubuh,
      asinkron: false,
      generator: false,
      panah: false,
      baris: acuan.baris,
      kolom: acuan.kolom,
      awal: acuan.awal,
      akhir: acuan.akhir,
    };
  }

  private siapkanParameter(parameter: A.Pola[]): void {
    interface TugasProlog {
      kind: "default" | "pattern" | "default-pattern";
      slot: number;
      bawaan: A.Ekspresi | null;
      pola: A.Pola | null;
    }
    const prolog: TugasProlog[] = [];

    for (const param of parameter) {
      if (param.jenis === "Identifier") {
        this.deklarasiLokal(param.nama, false, param);
        this.tandaiSiap();
      } else if (param.jenis === "PolaSisa") {
        this.fungsi.punyaSisa = true;
        const arg = param.argumen;
        if (arg.jenis === "Identifier") {
          this.deklarasiLokal(arg.nama, false, arg);
          this.tandaiSiap();
        } else {
          const slot = this.deklarasiTemp(param);
          prolog.push({ kind: "pattern", slot, bawaan: null, pola: arg });
        }
      } else if (param.jenis === "PolaBawaan") {
        if (param.kiri.jenis === "Identifier") {
          this.deklarasiLokal(param.kiri.nama, false, param.kiri);
          this.tandaiSiap();
          prolog.push({ kind: "default", slot: this.lokal.length - 1, bawaan: param.bawaan, pola: null });
        } else {
          const slot = this.deklarasiTemp(param);
          prolog.push({ kind: "default-pattern", slot, bawaan: param.bawaan, pola: param.kiri });
        }
      } else {
        const slot = this.deklarasiTemp(param);
        prolog.push({ kind: "pattern", slot, bawaan: null, pola: param });
      }
    }
    this.fungsi.arity = parameter.length;

    for (const tugas of prolog) {
      if (tugas.kind === "default") {
        this.prologDefault(tugas.slot, tugas.bawaan!, 0);
      } else if (tugas.kind === "default-pattern") {
        this.prologDefault(tugas.slot, tugas.bawaan!, 0);
        this.destrukDariSlot(tugas.pola!, tugas.slot, "misal");
      } else {
        this.destrukDariSlot(tugas.pola!, tugas.slot, "misal");
      }
    }
  }

  private prologDefault(slot: number, bawaan: A.Ekspresi, garis: number): void {
    this.emitOperan(Op.BacaLokal, slot, garis);
    const lompatTaktentu = this.emitLompat(Op.LompatJikaTaktentu, garis);
    const lompatAkhir = this.emitLompat(Op.Lompat, garis);
    this.tambalLompat(lompatTaktentu);
    this.emit(Op.Pop, garis);
    this.ekspresi(bawaan);
    this.emitOperan(Op.TulisLokal, slot, garis);
    this.tambalLompat(lompatAkhir);
    this.emit(Op.Pop, garis);
  }

  private bacaVariabel(simpul: A.Identifier): void {
    this.bacaNama(simpul.nama, simpul);
  }

  private bacaNama(nama: string, simpul: A.Simpul): void {
    const indeksLokal = this.selesaikanLokal(nama, simpul);
    if (indeksLokal !== -1) {
      this.emitOperan(Op.BacaLokal, indeksLokal, simpul.baris);
      return;
    }
    const indeksUpvalue = this.selesaikanUpvalue(nama, simpul);
    if (indeksUpvalue !== -1) {
      this.emitOperan(Op.BacaUpvalue, indeksUpvalue, simpul.baris);
      return;
    }
    const indeks = this.potongan.tambahKonstanta(nama);
    this.emitOperan(Op.BacaGlobal, indeks, simpul.baris);
  }

  private tulisVariabelTanpaPop(simpul: A.Identifier): void {
    this.tulisNama(simpul.nama, simpul);
  }

  private tulisNama(nama: string, simpul: A.Simpul): void {
    const indeksLokal = this.selesaikanLokal(nama, simpul);
    if (indeksLokal !== -1) {
      if (this.lokal[indeksLokal]!.tetap) {
        this.galat(simpul, `Tidak dapat menugaskan ulang ke konstanta "${nama}"`);
      }
      this.emitOperan(Op.TulisLokal, indeksLokal, simpul.baris);
      return;
    }
    const indeksUpvalue = this.selesaikanUpvalue(nama, simpul);
    if (indeksUpvalue !== -1) {
      this.emitOperan(Op.TulisUpvalue, indeksUpvalue, simpul.baris);
      return;
    }
    if (this.globalTetap.has(nama)) {
      this.galat(simpul, `Tidak dapat menugaskan ulang ke konstanta "${nama}"`);
    }
    const indeks = this.potongan.tambahKonstanta(nama);
    this.emitOperan(Op.TulisGlobal, indeks, simpul.baris);
  }

  private larik(simpul: A.Larik): void {
    this.emit(Op.LarikBaru, simpul.baris);
    for (const elemen of simpul.elemen) {
      if (elemen.jenis === "Sebar") {
        this.ekspresi(elemen.argumen);
        this.emit(Op.LarikSebar, simpul.baris);
      } else {
        this.ekspresi(elemen);
        this.emit(Op.LarikTambah, simpul.baris);
      }
    }
  }

  private objek(simpul: A.Objek): void {
    this.emit(Op.ObjekBaru, simpul.baris);
    for (const prop of simpul.properti) {
      if (prop.jenis === "Sebar") {
        this.ekspresi(prop.argumen);
        this.emit(Op.ObjekSebar, simpul.baris);
        continue;
      }
      if (prop.ragam !== "init") {
        this.galat(prop, "Getter/setter pada objek literal belum didukung pada fase ini");
      }
      if (prop.terhitung) {
        this.ekspresi(prop.kunci);
        this.ekspresi(prop.nilai);
        this.emit(Op.ObjekPropDinamis, simpul.baris);
      } else {
        this.ekspresi(prop.nilai);
        const indeks = this.potongan.tambahKonstanta(this.namaKunci(prop.kunci));
        this.emitOperan(Op.ObjekProp, indeks, simpul.baris);
      }
    }
  }

  private namaKunci(kunci: A.Ekspresi): string {
    if (kunci.jenis === "Identifier") return kunci.nama;
    if (kunci.jenis === "LiteralTeks") return kunci.nilai;
    if (kunci.jenis === "LiteralAngka") return String(kunci.nilai);
    this.galat(kunci, "Nama properti tidak valid");
  }

  private aksesAnggota(simpul: A.AksesAnggota): void {
    this.ekspresi(simpul.objek as A.Ekspresi);
    if (simpul.terhitung) {
      this.ekspresi(simpul.properti as A.Ekspresi);
      this.emit(Op.BacaIndeks, simpul.baris);
    } else {
      const nama = this.namaProperti(simpul.properti);
      const indeks = this.potongan.tambahKonstanta(nama);
      this.emitOperan(Op.BacaProperti, indeks, simpul.baris);
    }
  }

  private namaProperti(properti: A.Ekspresi | A.NamaPrivat): string {
    if (properti.jenis === "Identifier") return properti.nama;
    if (properti.jenis === "NamaPrivat") return "#" + properti.nama;
    this.galat(properti, "Nama properti tidak valid");
  }

  private baru(simpul: A.Baru): void {
    this.ekspresi(simpul.callee);
    for (const arg of simpul.argumen) {
      if (arg.jenis === "Sebar") this.galat(arg, "Sebar argumen belum didukung pada fase ini");
      this.ekspresi(arg);
    }
    this.emitOperan(Op.Konstruksi, simpul.argumen.length, simpul.baris);
  }

  private rantaiOpsional(simpul: A.RantaiOpsional): void {
    const tambalan: number[] = [];
    this.ekspresiRantai(simpul.ekspresi, tambalan);
    if (tambalan.length === 0) return;
    const lompatAkhir = this.emitLompat(Op.Lompat, simpul.baris);
    for (const slot of tambalan) this.tambalLompat(slot);
    this.emit(Op.Pop, simpul.baris);
    this.emit(Op.Taktentu, simpul.baris);
    this.tambalLompat(lompatAkhir);
  }

  private ekspresiRantai(simpul: A.Ekspresi, tambalan: number[]): void {
    if (simpul.jenis === "AksesAnggota") {
      this.ekspresiRantai(simpul.objek as A.Ekspresi, tambalan);
      if (simpul.opsional) tambalan.push(this.emitLompat(Op.LompatJikaKosong, simpul.baris));
      if (simpul.terhitung) {
        this.ekspresi(simpul.properti as A.Ekspresi);
        this.emit(Op.BacaIndeks, simpul.baris);
      } else {
        const indeks = this.potongan.tambahKonstanta(this.namaProperti(simpul.properti));
        this.emitOperan(Op.BacaProperti, indeks, simpul.baris);
      }
      return;
    }
    if (simpul.jenis === "Pemanggilan") {
      if (simpul.opsional) {
        this.ekspresiRantai(simpul.callee as A.Ekspresi, tambalan);
        tambalan.push(this.emitLompat(Op.LompatJikaKosong, simpul.baris));
        for (const arg of simpul.argumen) {
          if (arg.jenis === "Sebar") this.galat(arg, "Sebar argumen belum didukung pada fase ini");
          this.ekspresi(arg);
        }
        this.emitOperan(Op.Panggil, simpul.argumen.length, simpul.baris);
        return;
      }
      this.pemanggilanDalamRantai(simpul, tambalan);
      return;
    }
    this.ekspresi(simpul);
  }

  private pemanggilanDalamRantai(simpul: A.Pemanggilan, tambalan: number[]): void {
    const callee = simpul.callee as A.Ekspresi;
    if (callee.jenis === "AksesAnggota" && !callee.terhitung) {
      this.ekspresiRantai(callee.objek as A.Ekspresi, tambalan);
      this.emit(Op.Gandakan, simpul.baris);
      const indeks = this.potongan.tambahKonstanta(this.namaProperti(callee.properti));
      this.emitOperan(Op.BacaProperti, indeks, simpul.baris);
      this.argumenLalu(simpul);
      this.emitOperan(Op.PanggilDenganIni, simpul.argumen.length, simpul.baris);
      return;
    }
    this.ekspresiRantai(callee, tambalan);
    this.argumenLalu(simpul);
    this.emitOperan(Op.Panggil, simpul.argumen.length, simpul.baris);
  }

  private argumenLalu(simpul: A.Pemanggilan): void {
    for (const arg of simpul.argumen) {
      if (arg.jenis === "Sebar") this.galat(arg, "Sebar argumen belum didukung pada fase ini");
      this.ekspresi(arg);
    }
  }
}

function akhirGaris(simpul: A.Simpul): number {
  return simpul.baris;
}

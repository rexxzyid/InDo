import { GalatSintaks } from "../galat/kompilasi.js";
import { JenisToken, KATA_KUNCI_LUNAK, namaTampilToken, type Token } from "../lexer/token.js";
import { tokenisasi } from "../lexer/lexer.js";
import * as A from "./ast.js";
import { irisTemplate, masakTemplate, uraiAngka, uraiBilanganBesar, uraiTeks } from "./literal.js";

const T = JenisToken;

const BP_BINER: Partial<Record<JenisToken, number>> = {
  [T.Nullish]: 1,
  [T.AtauAtau]: 2,
  [T.DanDan]: 3,
  [T.Atau]: 4,
  [T.Xor]: 5,
  [T.Dan]: 6,
  [T.SamaSama]: 7,
  [T.TidakSama]: 7,
  [T.SamaSamaSama]: 7,
  [T.TidakSamaSama]: 7,
  [T.KurangDari]: 8,
  [T.LebihDari]: 8,
  [T.KurangSamaDari]: 8,
  [T.LebihSamaDari]: 8,
  [T.KkContohdari]: 8,
  [T.KkDalam]: 8,
  [T.GeserKiri]: 9,
  [T.GeserKanan]: 9,
  [T.GeserKananNol]: 9,
  [T.Tambah]: 10,
  [T.Kurang]: 10,
  [T.Kali]: 11,
  [T.Bagi]: 11,
  [T.Sisa]: 11,
  [T.Pangkat]: 12,
};

const OPERATOR_LOGIKA: ReadonlySet<JenisToken> = new Set([T.DanDan, T.AtauAtau, T.Nullish]);

const OPERATOR_PENUGASAN: ReadonlyMap<JenisToken, string> = new Map([
  [T.SamaDengan, "="],
  [T.TambahSama, "+="],
  [T.KurangSama, "-="],
  [T.KaliSama, "*="],
  [T.BagiSama, "/="],
  [T.SisaSama, "%="],
  [T.PangkatSama, "**="],
  [T.DanDanSama, "&&="],
  [T.AtauAtauSama, "||="],
  [T.NullishSama, "??="],
  [T.DanSama, "&="],
  [T.AtauSama, "|="],
  [T.XorSama, "^="],
  [T.GeserKiriSama, "<<="],
  [T.GeserKananSama, ">>="],
  [T.GeserKananNolSama, ">>>="],
]);

const TEKS_OPERATOR: Partial<Record<JenisToken, string>> = {
  [T.Tambah]: "+",
  [T.Kurang]: "-",
  [T.Kali]: "*",
  [T.Bagi]: "/",
  [T.Sisa]: "%",
  [T.Pangkat]: "**",
  [T.Dan]: "&",
  [T.Atau]: "|",
  [T.Xor]: "^",
  [T.GeserKiri]: "<<",
  [T.GeserKanan]: ">>",
  [T.GeserKananNol]: ">>>",
  [T.SamaSama]: "==",
  [T.TidakSama]: "!=",
  [T.SamaSamaSama]: "===",
  [T.TidakSamaSama]: "!==",
  [T.KurangDari]: "<",
  [T.LebihDari]: ">",
  [T.KurangSamaDari]: "<=",
  [T.LebihSamaDari]: ">=",
  [T.KkContohdari]: "contohdari",
  [T.KkDalam]: "dalam",
  [T.DanDan]: "&&",
  [T.AtauAtau]: "||",
  [T.Nullish]: "??",
  [T.Seru]: "!",
  [T.Tilde]: "~",
  [T.KkJenisdari]: "jenisdari",
  [T.KkAbaikan]: "abaikan",
  [T.KkHapus]: "hapus",
};

export class Parser {
  private readonly token: Token[];
  private readonly sumber: string;
  private readonly namaBerkas: string;
  private i = 0;
  private izinkanDalam = true;

  constructor(sumber: string, namaBerkas = "<masukan>") {
    this.sumber = sumber;
    this.namaBerkas = namaBerkas;
    this.token = tokenisasi(sumber, namaBerkas);
  }

  private puncak(offset = 0): Token {
    const indeks = Math.min(this.i + offset, this.token.length - 1);
    return this.token[indeks]!;
  }

  private jenis(): JenisToken {
    return this.puncak().jenis;
  }

  private maju(): Token {
    const token = this.puncak();
    if (this.i < this.token.length - 1) this.i += 1;
    return token;
  }

  private cocok(jenis: JenisToken): boolean {
    if (this.jenis() === jenis) {
      this.maju();
      return true;
    }
    return false;
  }

  private harap(jenis: JenisToken, pesan?: string): Token {
    if (this.jenis() === jenis) return this.maju();
    const token = this.puncak();
    this.galatDi(
      token,
      pesan ?? `Diharapkan "${namaTampilToken(jenis)}" tetapi menemukan "${this.tampilToken(token)}"`,
    );
  }

  private tampilToken(token: Token): string {
    if (token.jenis === T.AkhirBerkas) return "akhir berkas";
    return token.teks;
  }

  private galatDi(token: Token, pesan: string): never {
    throw new GalatSintaks(pesan, this.namaBerkas, {
      baris: token.baris,
      kolom: token.kolom,
      panjang: Math.max(1, token.akhir - token.awal),
    });
  }

  private buat<T extends A.Simpul>(awal: Token, data: Omit<T, "baris" | "kolom" | "awal" | "akhir">): T {
    const akhirToken = this.token[Math.max(0, this.i - 1)]!;
    return {
      ...(data as object),
      baris: awal.baris,
      kolom: awal.kolom,
      awal: awal.awal,
      akhir: akhirToken.akhir,
    } as T;
  }

  uraiProgram(): A.Program {
    const awal = this.puncak();
    const tubuh: A.Pernyataan[] = [];
    while (this.jenis() !== T.AkhirBerkas) {
      tubuh.push(this.uraiPernyataan());
    }
    return this.buat<A.Program>(awal, { jenis: "Program", tubuh });
  }

  private akhiriPernyataan(): void {
    if (this.cocok(T.TitikKoma)) return;
    const token = this.puncak();
    if (token.jenis === T.AkhirBerkas || token.jenis === T.KurawalTutup) return;
    if (token.didahuluiBarisBaru) return;
    this.galatDi(token, `Diharapkan ";" atau baris baru setelah pernyataan`);
  }

  private uraiPernyataan(): A.Pernyataan {
    const jenis = this.jenis();
    switch (jenis) {
      case T.KkMisal:
      case T.KkTetap:
      case T.KkVar:
        return this.uraiDeklarasiVariabel();
      case T.KurawalBuka:
        return this.uraiBlok();
      case T.TitikKoma: {
        const awal = this.maju();
        return this.buat<A.PernyataanKosong>(awal, { jenis: "PernyataanKosong" });
      }
      case T.KkJika:
        return this.uraiJika();
      case T.KkPilih:
        return this.uraiPilih();
      case T.KkSelama:
        return this.uraiSelama();
      case T.KkLakukan:
        return this.uraiLakukanSelama();
      case T.KkUntuk:
        return this.uraiUntuk();
      case T.KkHenti:
      case T.KkLanjut:
        return this.uraiHentiLanjut();
      case T.KkKembalikan:
        return this.uraiKembalikan();
      case T.KkLempar:
        return this.uraiLempar();
      case T.KkCoba:
        return this.uraiCoba();
      case T.KkFungsi:
        return this.uraiDeklarasiFungsi(false);
      case T.KkKelas:
        return this.uraiDeklarasiKelas();
      case T.KkImpor:
        if (this.puncak(1).jenis === T.KurungBuka || this.puncak(1).jenis === T.Titik) break;
        return this.uraiImpor();
      case T.KkEkspor:
        return this.uraiEkspor();
      case T.KkAsinkron:
        if (this.puncak(1).jenis === T.KkFungsi && !this.puncak(1).didahuluiBarisBaru) {
          return this.uraiDeklarasiFungsi(true);
        }
        break;
      default:
        break;
    }

    if (jenis === T.Identifier && this.puncak(1).jenis === T.TitikDua) {
      return this.uraiBerlabel();
    }

    const awal = this.puncak();
    const ekspresi = this.uraiEkspresi();
    this.akhiriPernyataan();
    return this.buat<A.PernyataanEkspresi>(awal, { jenis: "PernyataanEkspresi", ekspresi });
  }

  private uraiBlok(): A.Blok {
    const awal = this.harap(T.KurawalBuka);
    const tubuh: A.Pernyataan[] = [];
    while (this.jenis() !== T.KurawalTutup && this.jenis() !== T.AkhirBerkas) {
      tubuh.push(this.uraiPernyataan());
    }
    this.harap(T.KurawalTutup);
    return this.buat<A.Blok>(awal, { jenis: "Blok", tubuh });
  }

  private uraiDeklarasiVariabel(bolehAkhiri = true): A.DeklarasiVariabel {
    const awal = this.maju();
    const ragam = awal.teks as "misal" | "tetap" | "var";
    const deklarasi: A.Deklarator[] = [];
    do {
      const awalDek = this.puncak();
      const id = this.uraiPola();
      let awalNilai: A.Ekspresi | null = null;
      if (this.cocok(T.SamaDengan)) {
        awalNilai = this.uraiPenugasan();
      }
      deklarasi.push(this.buat<A.Deklarator>(awalDek, { jenis: "Deklarator", id, awalNilai }));
    } while (this.cocok(T.Koma));
    if (bolehAkhiri) this.akhiriPernyataan();
    return this.buat<A.DeklarasiVariabel>(awal, { jenis: "DeklarasiVariabel", ragam, deklarasi });
  }

  private uraiJika(): A.Jika {
    const awal = this.harap(T.KkJika);
    this.harap(T.KurungBuka);
    const uji = this.uraiEkspresi();
    this.harap(T.KurungTutup);
    const konsekuen = this.uraiPernyataan();
    let alternatif: A.Pernyataan | null = null;
    if (this.cocok(T.KkLainnya)) {
      alternatif = this.uraiPernyataan();
    }
    return this.buat<A.Jika>(awal, { jenis: "Jika", uji, konsekuen, alternatif });
  }

  private uraiPilih(): A.Pilih {
    const awal = this.harap(T.KkPilih);
    this.harap(T.KurungBuka);
    const diskriminan = this.uraiEkspresi();
    this.harap(T.KurungTutup);
    this.harap(T.KurawalBuka);
    const kasus: A.Kasus[] = [];
    while (this.jenis() !== T.KurawalTutup && this.jenis() !== T.AkhirBerkas) {
      const awalKasus = this.puncak();
      let uji: A.Ekspresi | null = null;
      if (this.cocok(T.KkKasus)) {
        uji = this.uraiEkspresi();
      } else {
        this.harap(T.KkBawaan);
      }
      this.harap(T.TitikDua);
      const tubuh: A.Pernyataan[] = [];
      while (
        this.jenis() !== T.KkKasus &&
        this.jenis() !== T.KkBawaan &&
        this.jenis() !== T.KurawalTutup &&
        this.jenis() !== T.AkhirBerkas
      ) {
        tubuh.push(this.uraiPernyataan());
      }
      kasus.push(this.buat<A.Kasus>(awalKasus, { jenis: "Kasus", uji, tubuh }));
    }
    this.harap(T.KurawalTutup);
    return this.buat<A.Pilih>(awal, { jenis: "Pilih", diskriminan, kasus });
  }

  private uraiSelama(): A.Selama {
    const awal = this.harap(T.KkSelama);
    this.harap(T.KurungBuka);
    const uji = this.uraiEkspresi();
    this.harap(T.KurungTutup);
    const tubuh = this.uraiPernyataan();
    return this.buat<A.Selama>(awal, { jenis: "Selama", uji, tubuh });
  }

  private uraiLakukanSelama(): A.LakukanSelama {
    const awal = this.harap(T.KkLakukan);
    const tubuh = this.uraiPernyataan();
    this.harap(T.KkSelama);
    this.harap(T.KurungBuka);
    const uji = this.uraiEkspresi();
    this.harap(T.KurungTutup);
    this.akhiriPernyataan();
    return this.buat<A.LakukanSelama>(awal, { jenis: "LakukanSelama", tubuh, uji });
  }

  private uraiUntuk(): A.Pernyataan {
    const awal = this.harap(T.KkUntuk);
    const tunggu = this.cocok(T.KkTunggu);
    this.harap(T.KurungBuka);

    let kidal: A.DeklarasiVariabel | A.Pola | A.Ekspresi | null = null;
    if (this.jenis() === T.TitikKoma) {
      kidal = null;
    } else if (this.jenis() === T.KkMisal || this.jenis() === T.KkTetap || this.jenis() === T.KkVar) {
      const simpanDalam = this.izinkanDalam;
      this.izinkanDalam = false;
      kidal = this.uraiDeklarasiVariabelUntuk();
      this.izinkanDalam = simpanDalam;
    } else {
      const simpanDalam = this.izinkanDalam;
      this.izinkanDalam = false;
      kidal = this.uraiEkspresi();
      this.izinkanDalam = simpanDalam;
    }

    if (this.jenis() === T.KkDari) {
      this.maju();
      const kanan = this.uraiPenugasan();
      this.harap(T.KurungTutup);
      const tubuh = this.uraiPernyataan();
      const kidalAkhir = this.jadikanTargetIterasi(kidal);
      return this.buat<A.UntukDari>(awal, { jenis: "UntukDari", kidal: kidalAkhir, kanan, tubuh, tunggu });
    }

    if (this.jenis() === T.KkDalam) {
      this.maju();
      const kanan = this.uraiEkspresi();
      this.harap(T.KurungTutup);
      const tubuh = this.uraiPernyataan();
      const kidalAkhir = this.jadikanTargetIterasi(kidal);
      return this.buat<A.UntukDalam>(awal, { jenis: "UntukDalam", kidal: kidalAkhir, kanan, tubuh });
    }

    const init = kidal as A.DeklarasiVariabel | A.Ekspresi | null;
    this.harap(T.TitikKoma);
    const uji = this.jenis() === T.TitikKoma ? null : this.uraiEkspresi();
    this.harap(T.TitikKoma);
    const perbarui = this.jenis() === T.KurungTutup ? null : this.uraiEkspresi();
    this.harap(T.KurungTutup);
    const tubuh = this.uraiPernyataan();
    return this.buat<A.UntukKlasik>(awal, { jenis: "UntukKlasik", init, uji, perbarui, tubuh });
  }

  private uraiDeklarasiVariabelUntuk(): A.DeklarasiVariabel {
    const awal = this.maju();
    const ragam = awal.teks as "misal" | "tetap" | "var";
    const deklarasi: A.Deklarator[] = [];
    const awalDek = this.puncak();
    const id = this.uraiPola();
    let awalNilai: A.Ekspresi | null = null;
    if (this.cocok(T.SamaDengan)) {
      awalNilai = this.uraiPenugasan();
    }
    deklarasi.push(this.buat<A.Deklarator>(awalDek, { jenis: "Deklarator", id, awalNilai }));
    while (this.cocok(T.Koma)) {
      const awalLain = this.puncak();
      const idLain = this.uraiPola();
      let nilaiLain: A.Ekspresi | null = null;
      if (this.cocok(T.SamaDengan)) nilaiLain = this.uraiPenugasan();
      deklarasi.push(this.buat<A.Deklarator>(awalLain, { jenis: "Deklarator", id: idLain, awalNilai: nilaiLain }));
    }
    return this.buat<A.DeklarasiVariabel>(awal, { jenis: "DeklarasiVariabel", ragam, deklarasi });
  }

  private jadikanTargetIterasi(kidal: A.DeklarasiVariabel | A.Pola | A.Ekspresi | null): A.DeklarasiVariabel | A.Pola {
    if (kidal === null) this.galatDi(this.puncak(), "Target iterasi tidak boleh kosong");
    if ((kidal as A.Simpul).jenis === "DeklarasiVariabel") return kidal as A.DeklarasiVariabel;
    return this.kePola(kidal as A.Ekspresi);
  }

  private uraiHentiLanjut(): A.Henti | A.Lanjut {
    const awal = this.maju();
    let label: A.Identifier | null = null;
    if (this.jenis() === T.Identifier && !this.puncak().didahuluiBarisBaru) {
      label = this.uraiIdentifier();
    }
    this.akhiriPernyataan();
    if (awal.jenis === T.KkHenti) return this.buat<A.Henti>(awal, { jenis: "Henti", label });
    return this.buat<A.Lanjut>(awal, { jenis: "Lanjut", label });
  }

  private uraiKembalikan(): A.Kembalikan {
    const awal = this.harap(T.KkKembalikan);
    let argumen: A.Ekspresi | null = null;
    const token = this.puncak();
    if (
      token.jenis !== T.TitikKoma &&
      token.jenis !== T.KurawalTutup &&
      token.jenis !== T.AkhirBerkas &&
      !token.didahuluiBarisBaru
    ) {
      argumen = this.uraiEkspresi();
    }
    this.akhiriPernyataan();
    return this.buat<A.Kembalikan>(awal, { jenis: "Kembalikan", argumen });
  }

  private uraiLempar(): A.Lempar {
    const awal = this.harap(T.KkLempar);
    if (this.puncak().didahuluiBarisBaru) this.galatDi(this.puncak(), "Ekspresi 'lempar' tidak boleh diawali baris baru");
    const argumen = this.uraiEkspresi();
    this.akhiriPernyataan();
    return this.buat<A.Lempar>(awal, { jenis: "Lempar", argumen });
  }

  private uraiCoba(): A.Coba {
    const awal = this.harap(T.KkCoba);
    const blok = this.uraiBlok();
    let penangkap: A.Penangkap | null = null;
    let akhirnya: A.Blok | null = null;
    if (this.jenis() === T.KkTangkap) {
      const awalTangkap = this.maju();
      let param: A.Pola | null = null;
      if (this.cocok(T.KurungBuka)) {
        param = this.uraiPola();
        this.harap(T.KurungTutup);
      }
      const tubuh = this.uraiBlok();
      penangkap = this.buat<A.Penangkap>(awalTangkap, { jenis: "Penangkap", param, tubuh });
    }
    if (this.cocok(T.KkAkhirnya)) {
      akhirnya = this.uraiBlok();
    }
    if (penangkap === null && akhirnya === null) {
      this.galatDi(awal, "'coba' harus punya 'tangkap' atau 'akhirnya'");
    }
    return this.buat<A.Coba>(awal, { jenis: "Coba", blok, penangkap, akhirnya });
  }

  private uraiBerlabel(): A.Berlabel {
    const awal = this.puncak();
    const label = this.uraiIdentifier();
    this.harap(T.TitikDua);
    const tubuh = this.uraiPernyataan();
    return this.buat<A.Berlabel>(awal, { jenis: "Berlabel", label, tubuh });
  }

  private uraiDeklarasiFungsi(asinkron: boolean): A.DeklarasiFungsi {
    const awal = this.puncak();
    const fungsi = this.uraiFungsi(asinkron, true);
    return this.buat<A.DeklarasiFungsi>(awal, { jenis: "DeklarasiFungsi", fungsi });
  }

  private uraiFungsi(asinkron: boolean, wajibNama: boolean): A.Fungsi {
    const awal = this.puncak();
    if (asinkron) this.harap(T.KkAsinkron);
    this.harap(T.KkFungsi);
    const generator = this.cocok(T.Kali);
    let nama: A.Identifier | null = null;
    if (this.jenis() === T.Identifier || this.bisaJadiNama(this.jenis())) {
      nama = this.uraiIdentifier();
    } else if (wajibNama) {
      this.galatDi(this.puncak(), "Deklarasi fungsi harus punya nama");
    }
    const parameter = this.uraiDaftarParameter();
    const tubuh = this.uraiBlok();
    return this.buat<A.Fungsi>(awal, {
      jenis: "Fungsi",
      nama,
      parameter,
      tubuh,
      asinkron,
      generator,
      panah: false,
    });
  }

  private uraiDaftarParameter(): A.Pola[] {
    this.harap(T.KurungBuka);
    const parameter: A.Pola[] = [];
    while (this.jenis() !== T.KurungTutup) {
      if (this.jenis() === T.Elipsis) {
        parameter.push(this.uraiPolaSisa());
        break;
      }
      parameter.push(this.uraiPolaDenganBawaan());
      if (!this.cocok(T.Koma)) break;
    }
    this.harap(T.KurungTutup);
    return parameter;
  }

  private uraiDeklarasiKelas(): A.DeklarasiKelas {
    const awal = this.puncak();
    const kelas = this.uraiKelas(true);
    return this.buat<A.DeklarasiKelas>(awal, { jenis: "DeklarasiKelas", kelas });
  }

  private uraiKelas(wajibNama: boolean): A.KelasEkspresi {
    const awal = this.harap(T.KkKelas);
    let nama: A.Identifier | null = null;
    if (this.jenis() === T.Identifier || this.bisaJadiNama(this.jenis())) {
      nama = this.uraiIdentifier();
    } else if (wajibNama) {
      this.galatDi(this.puncak(), "Deklarasi kelas harus punya nama");
    }
    let induk: A.Ekspresi | null = null;
    if (this.cocok(T.KkMewarisi)) {
      induk = this.uraiPanggilAnggota();
    }
    this.harap(T.KurawalBuka);
    const anggota: A.AnggotaKelas[] = [];
    while (this.jenis() !== T.KurawalTutup && this.jenis() !== T.AkhirBerkas) {
      if (this.cocok(T.TitikKoma)) continue;
      anggota.push(this.uraiAnggotaKelas());
    }
    this.harap(T.KurawalTutup);
    return this.buat<A.KelasEkspresi>(awal, { jenis: "KelasEkspresi", nama, induk, anggota });
  }

  private uraiAnggotaKelas(): A.AnggotaKelas {
    const awal = this.puncak();
    let statis = false;
    if (this.jenis() === T.KkStatis && !this.setelahIniNamaAnggota(1)) {
      this.maju();
      statis = true;
      if (this.jenis() === T.KurawalBuka) {
        const blok = this.uraiBlok();
        return this.buat<A.BlokStatis>(awal, { jenis: "BlokStatis", tubuh: blok.tubuh });
      }
    }

    let asinkron = false;
    let generator = false;
    let ragam: "metode" | "dapatkan" | "tetapkan" | "konstruktor" = "metode";

    if (this.jenis() === T.KkAsinkron && !this.setelahIniNamaAnggota(1) && !this.puncak(1).didahuluiBarisBaru) {
      this.maju();
      asinkron = true;
    }
    if (this.jenis() === T.Kali) {
      this.maju();
      generator = true;
    }
    if ((this.jenis() === T.KkDapatkan || this.jenis() === T.KkTetapkan) && !this.setelahIniNamaAnggota(1)) {
      ragam = this.jenis() === T.KkDapatkan ? "dapatkan" : "tetapkan";
      this.maju();
    }

    const { kunci, terhitung, privat } = this.uraiKunciAnggota();

    if (this.jenis() === T.KurungBuka) {
      const kunciKonstruktor =
        !statis && !terhitung && !privat && ragam === "metode" && this.namaKunciAdalah(kunci, "konstruktor");
      const fungsiAwal = this.puncak();
      const parameter = this.uraiDaftarParameter();
      const tubuh = this.uraiBlok();
      const fungsi = this.buat<A.Fungsi>(fungsiAwal, {
        jenis: "Fungsi",
        nama: null,
        parameter,
        tubuh,
        asinkron,
        generator,
        panah: false,
      });
      const ragamAkhir = kunciKonstruktor ? "konstruktor" : ragam;
      return this.buat<A.MetodeKelas>(awal, {
        jenis: "MetodeKelas",
        kunci: privat ?? kunci,
        nilai: fungsi,
        ragam: ragamAkhir,
        statis,
        terhitung,
      });
    }

    let nilai: A.Ekspresi | null = null;
    if (this.cocok(T.SamaDengan)) {
      nilai = this.uraiPenugasan();
    }
    this.akhiriPernyataan();
    return this.buat<A.FieldKelas>(awal, {
      jenis: "FieldKelas",
      kunci: privat ?? kunci,
      nilai,
      statis,
      terhitung,
    });
  }

  private setelahIniNamaAnggota(offset: number): boolean {
    const j = this.puncak(offset).jenis;
    return j === T.KurungBuka || j === T.SamaDengan || j === T.TitikKoma || j === T.KurawalTutup;
  }

  private namaKunciAdalah(kunci: A.Ekspresi, nama: string): boolean {
    return kunci.jenis === "Identifier" && kunci.nama === nama;
  }

  private uraiKunciAnggota(): { kunci: A.Ekspresi; terhitung: boolean; privat: A.NamaPrivat | null } {
    if (this.jenis() === T.PrivatNama) {
      const token = this.maju();
      const privat = this.buat<A.NamaPrivat>(token, { jenis: "NamaPrivat", nama: token.teks.slice(1) });
      return { kunci: privat as unknown as A.Ekspresi, terhitung: false, privat };
    }
    const { kunci, terhitung } = this.uraiKunciObjek();
    return { kunci, terhitung, privat: null };
  }

  private uraiImpor(): A.Impor {
    const awal = this.harap(T.KkImpor);
    const penentu: A.PenentuImpor[] = [];

    if (this.jenis() === T.Teks) {
      const sumber = uraiTeks(this.maju().teks);
      this.akhiriPernyataan();
      return this.buat<A.Impor>(awal, { jenis: "Impor", penentu, sumber });
    }

    if (this.jenis() === T.Identifier || this.bisaJadiNama(this.jenis())) {
      const awalP = this.puncak();
      const lokal = this.uraiIdentifier();
      penentu.push(this.buat<A.PenentuImpor>(awalP, { jenis: "PenentuImpor", ragam: "bawaan", impor: null, lokal }));
      this.cocok(T.Koma);
    }

    if (this.jenis() === T.Kali) {
      const awalP = this.maju();
      this.harap(T.KkSebagai);
      const lokal = this.uraiIdentifier();
      penentu.push(this.buat<A.PenentuImpor>(awalP, { jenis: "PenentuImpor", ragam: "namespace", impor: null, lokal }));
    } else if (this.jenis() === T.KurawalBuka) {
      this.maju();
      while (this.jenis() !== T.KurawalTutup && this.jenis() !== T.AkhirBerkas) {
        const awalP = this.puncak();
        const impor = this.namaModul();
        let lokal: A.Identifier;
        if (this.cocok(T.KkSebagai)) {
          lokal = this.uraiIdentifier();
        } else {
          lokal = this.buat<A.Identifier>(awalP, { jenis: "Identifier", nama: impor });
        }
        penentu.push(this.buat<A.PenentuImpor>(awalP, { jenis: "PenentuImpor", ragam: "bernama", impor, lokal }));
        if (!this.cocok(T.Koma)) break;
      }
      this.harap(T.KurawalTutup);
    }

    this.harap(T.KkDari);
    const sumber = uraiTeks(this.harap(T.Teks).teks);
    this.akhiriPernyataan();
    return this.buat<A.Impor>(awal, { jenis: "Impor", penentu, sumber });
  }

  private namaModul(): string {
    const token = this.puncak();
    if (token.jenis === T.Identifier || this.bisaJadiNama(token.jenis)) {
      this.maju();
      return token.teks;
    }
    if (token.jenis === T.KkBawaan) {
      this.maju();
      return "bawaan";
    }
    this.galatDi(token, "Diharapkan nama pada daftar impor/ekspor");
  }

  private uraiEkspor(): A.Pernyataan {
    const awal = this.harap(T.KkEkspor);

    if (this.cocok(T.KkBawaan)) {
      if (this.jenis() === T.KkFungsi || (this.jenis() === T.KkAsinkron && this.puncak(1).jenis === T.KkFungsi)) {
        const asinkron = this.cocok(T.KkAsinkron);
        const fungsi = this.uraiFungsi(asinkron, false);
        const dekl = this.buat<A.DeklarasiFungsi>(awal, { jenis: "DeklarasiFungsi", fungsi });
        return this.buat<A.EksporBawaan>(awal, { jenis: "EksporBawaan", nilai: dekl });
      }
      if (this.jenis() === T.KkKelas) {
        const kelas = this.uraiKelas(false);
        const dekl = this.buat<A.DeklarasiKelas>(awal, { jenis: "DeklarasiKelas", kelas });
        return this.buat<A.EksporBawaan>(awal, { jenis: "EksporBawaan", nilai: dekl });
      }
      const nilai = this.uraiPenugasan();
      this.akhiriPernyataan();
      return this.buat<A.EksporBawaan>(awal, { jenis: "EksporBawaan", nilai });
    }

    if (this.jenis() === T.Kali) {
      this.maju();
      let sebagai: string | null = null;
      if (this.cocok(T.KkSebagai)) {
        sebagai = this.namaModul();
      }
      this.harap(T.KkDari);
      const sumber = uraiTeks(this.harap(T.Teks).teks);
      this.akhiriPernyataan();
      return this.buat<A.EksporSemua>(awal, { jenis: "EksporSemua", sumber, sebagai });
    }

    if (this.jenis() === T.KurawalBuka) {
      this.maju();
      const penentu: A.PenentuEkspor[] = [];
      while (this.jenis() !== T.KurawalTutup && this.jenis() !== T.AkhirBerkas) {
        const awalP = this.puncak();
        const lokal = this.namaModul();
        let diekspor = lokal;
        if (this.cocok(T.KkSebagai)) {
          diekspor = this.namaModul();
        }
        penentu.push(this.buat<A.PenentuEkspor>(awalP, { jenis: "PenentuEkspor", lokal, diekspor }));
        if (!this.cocok(T.Koma)) break;
      }
      this.harap(T.KurawalTutup);
      let sumber: string | null = null;
      if (this.cocok(T.KkDari)) {
        sumber = uraiTeks(this.harap(T.Teks).teks);
      }
      this.akhiriPernyataan();
      return this.buat<A.EksporBernama>(awal, { jenis: "EksporBernama", deklarasi: null, penentu, sumber });
    }

    const deklarasi = this.uraiPernyataan();
    return this.buat<A.EksporBernama>(awal, { jenis: "EksporBernama", deklarasi, penentu: [], sumber: null });
  }

  private uraiEkspresi(): A.Ekspresi {
    const awal = this.puncak();
    let ekspresi = this.uraiPenugasan();
    if (this.jenis() === T.Koma) {
      const daftar: A.Ekspresi[] = [ekspresi];
      while (this.cocok(T.Koma)) {
        daftar.push(this.uraiPenugasan());
      }
      ekspresi = this.buat<A.Urutan>(awal, { jenis: "Urutan", ekspresi: daftar });
    }
    return ekspresi;
  }

  private uraiPenugasan(): A.Ekspresi {
    if (this.jenis() === T.KkHasilkan) {
      return this.uraiHasilkan();
    }

    const arrow = this.cobaArrow();
    if (arrow) return arrow;

    const awal = this.puncak();
    const kiri = this.uraiKondisional();
    const operator = OPERATOR_PENUGASAN.get(this.jenis());
    if (operator !== undefined) {
      this.maju();
      const nilai = this.uraiPenugasan();
      const sasaran = operator === "=" ? this.keTargetPenugasan(kiri) : kiri;
      return this.buat<A.Penugasan>(awal, { jenis: "Penugasan", operator, sasaran, nilai });
    }
    return kiri;
  }

  private uraiHasilkan(): A.Hasilkan {
    const awal = this.harap(T.KkHasilkan);
    const delegasi = this.cocok(T.Kali);
    let argumen: A.Ekspresi | null = null;
    const token = this.puncak();
    if (
      delegasi ||
      (token.jenis !== T.TitikKoma &&
        token.jenis !== T.KurungTutup &&
        token.jenis !== T.SikuTutup &&
        token.jenis !== T.KurawalTutup &&
        token.jenis !== T.Koma &&
        token.jenis !== T.TitikDua &&
        token.jenis !== T.AkhirBerkas &&
        !token.didahuluiBarisBaru)
    ) {
      argumen = this.uraiPenugasan();
    }
    return this.buat<A.Hasilkan>(awal, { jenis: "Hasilkan", argumen, delegasi });
  }

  private cobaArrow(): A.Fungsi | null {
    const jenis = this.jenis();
    const asinkron = jenis === T.KkAsinkron;
    let offset = 0;
    if (asinkron) {
      if (this.puncak(1).didahuluiBarisBaru) return null;
      offset = 1;
    }
    const jenisSetelah = this.puncak(offset).jenis;

    if ((jenisSetelah === T.Identifier || this.bisaJadiNama(jenisSetelah)) && this.puncak(offset + 1).jenis === T.Panah) {
      const awal = this.puncak();
      if (asinkron) this.maju();
      const paramAwal = this.puncak();
      const param = this.uraiIdentifier();
      return this.selesaikanArrow(awal, [param], asinkron, paramAwal);
    }

    if (jenisSetelah === T.KurungBuka) {
      const akhirKurung = this.indeksSetelahSeimbang(this.i + offset);
      if (akhirKurung !== -1 && this.token[akhirKurung]?.jenis === T.Panah) {
        const awal = this.puncak();
        if (asinkron) this.maju();
        const param = this.uraiDaftarParameter();
        return this.selesaikanArrow(awal, param, asinkron, awal);
      }
    }

    return null;
  }

  private selesaikanArrow(awal: Token, parameter: A.Pola[], asinkron: boolean, _paramAwal: Token): A.Fungsi {
    this.harap(T.Panah);
    let tubuh: A.Blok | A.Ekspresi;
    if (this.jenis() === T.KurawalBuka) {
      tubuh = this.uraiBlok();
    } else {
      tubuh = this.uraiPenugasan();
    }
    return this.buat<A.Fungsi>(awal, {
      jenis: "Fungsi",
      nama: null,
      parameter,
      tubuh,
      asinkron,
      generator: false,
      panah: true,
    });
  }

  private indeksSetelahSeimbang(indeksBuka: number): number {
    let kedalaman = 0;
    for (let j = indeksBuka; j < this.token.length; j += 1) {
      const jn = this.token[j]!.jenis;
      if (jn === T.KurungBuka || jn === T.SikuBuka || jn === T.KurawalBuka) kedalaman += 1;
      else if (jn === T.KurungTutup || jn === T.SikuTutup || jn === T.KurawalTutup) {
        kedalaman -= 1;
        if (kedalaman === 0) return j + 1;
      } else if (jn === T.AkhirBerkas) return -1;
    }
    return -1;
  }

  private uraiKondisional(): A.Ekspresi {
    const awal = this.puncak();
    const uji = this.uraiBiner(1);
    if (this.cocok(T.Tanya)) {
      const konsekuen = this.uraiPenugasan();
      this.harap(T.TitikDua);
      const alternatif = this.uraiPenugasan();
      return this.buat<A.Kondisional>(awal, { jenis: "Kondisional", uji, konsekuen, alternatif });
    }
    return uji;
  }

  private uraiBiner(minBp: number): A.Ekspresi {
    const awal = this.puncak();
    let kiri = this.uraiUner();
    for (;;) {
      const jenis = this.jenis();
      if (jenis === T.KkDalam && !this.izinkanDalam) break;
      const bp = BP_BINER[jenis];
      if (bp === undefined || bp < minBp) break;
      const operator = TEKS_OPERATOR[jenis]!;
      this.maju();
      const bpKanan = jenis === T.Pangkat ? bp : bp + 1;
      const kanan = this.uraiBiner(bpKanan);
      if (OPERATOR_LOGIKA.has(jenis)) {
        kiri = this.buat<A.Logika>(awal, { jenis: "Logika", operator, kiri, kanan });
      } else {
        kiri = this.buat<A.Biner>(awal, { jenis: "Biner", operator, kiri, kanan });
      }
    }
    return kiri;
  }

  private uraiUner(): A.Ekspresi {
    const jenis = this.jenis();
    const awal = this.puncak();

    if (
      jenis === T.Seru ||
      jenis === T.Tilde ||
      jenis === T.Tambah ||
      jenis === T.Kurang ||
      jenis === T.KkJenisdari ||
      jenis === T.KkAbaikan ||
      jenis === T.KkHapus
    ) {
      this.maju();
      const argumen = this.uraiUner();
      return this.buat<A.Uner>(awal, { jenis: "Uner", operator: TEKS_OPERATOR[jenis]!, argumen });
    }

    if (jenis === T.KkTunggu) {
      this.maju();
      const argumen = this.uraiUner();
      return this.buat<A.Tunggu>(awal, { jenis: "Tunggu", argumen });
    }

    if (jenis === T.TambahTambah || jenis === T.KurangKurang) {
      this.maju();
      const argumen = this.uraiUner();
      return this.buat<A.Perbarui>(awal, {
        jenis: "Perbarui",
        operator: jenis === T.TambahTambah ? "++" : "--",
        argumen,
        prefiks: true,
      });
    }

    return this.uraiPostfix();
  }

  private uraiPostfix(): A.Ekspresi {
    const awal = this.puncak();
    let ekspresi = this.uraiPanggilAnggota();
    const jenis = this.jenis();
    if ((jenis === T.TambahTambah || jenis === T.KurangKurang) && !this.puncak().didahuluiBarisBaru) {
      this.maju();
      ekspresi = this.buat<A.Perbarui>(awal, {
        jenis: "Perbarui",
        operator: jenis === T.TambahTambah ? "++" : "--",
        argumen: ekspresi,
        prefiks: false,
      });
    }
    return ekspresi;
  }

  private uraiPanggilAnggota(): A.Ekspresi {
    const awal = this.puncak();
    let ekspresi: A.Ekspresi = this.uraiPrimerAtauBaru();
    let adaOpsional = false;

    for (;;) {
      const jenis = this.jenis();
      if (jenis === T.Titik) {
        this.maju();
        const properti = this.namaSetelahTitik();
        ekspresi = this.buat<A.AksesAnggota>(awal, {
          jenis: "AksesAnggota",
          objek: ekspresi,
          properti,
          terhitung: false,
          opsional: false,
        });
      } else if (jenis === T.TanyaTitik) {
        this.maju();
        adaOpsional = true;
        if (this.jenis() === T.SikuBuka) {
          this.maju();
          const properti = this.uraiEkspresi();
          this.harap(T.SikuTutup);
          ekspresi = this.buat<A.AksesAnggota>(awal, {
            jenis: "AksesAnggota",
            objek: ekspresi,
            properti,
            terhitung: true,
            opsional: true,
          });
        } else if (this.jenis() === T.KurungBuka) {
          const argumen = this.uraiArgumen();
          ekspresi = this.buat<A.Pemanggilan>(awal, { jenis: "Pemanggilan", callee: ekspresi, argumen, opsional: true });
        } else {
          const properti = this.namaSetelahTitik();
          ekspresi = this.buat<A.AksesAnggota>(awal, {
            jenis: "AksesAnggota",
            objek: ekspresi,
            properti,
            terhitung: false,
            opsional: true,
          });
        }
      } else if (jenis === T.SikuBuka) {
        this.maju();
        const properti = this.uraiEkspresi();
        this.harap(T.SikuTutup);
        ekspresi = this.buat<A.AksesAnggota>(awal, {
          jenis: "AksesAnggota",
          objek: ekspresi,
          properti,
          terhitung: true,
          opsional: false,
        });
      } else if (jenis === T.KurungBuka) {
        const argumen = this.uraiArgumen();
        ekspresi = this.buat<A.Pemanggilan>(awal, { jenis: "Pemanggilan", callee: ekspresi, argumen, opsional: false });
      } else if (jenis === T.TemplateUtuh || jenis === T.TemplateKepala) {
        const quasi = this.uraiTemplate();
        ekspresi = this.buat<A.TemplateTertag>(awal, { jenis: "TemplateTertag", tag: ekspresi, quasi });
      } else {
        break;
      }
    }

    if (adaOpsional) {
      return this.buat<A.RantaiOpsional>(awal, { jenis: "RantaiOpsional", ekspresi });
    }
    return ekspresi;
  }

  private namaSetelahTitik(): A.Identifier | A.NamaPrivat {
    const token = this.puncak();
    if (token.jenis === T.PrivatNama) {
      this.maju();
      return this.buat<A.NamaPrivat>(token, { jenis: "NamaPrivat", nama: token.teks.slice(1) });
    }
    this.maju();
    return this.buat<A.Identifier>(token, { jenis: "Identifier", nama: token.teks });
  }

  private uraiArgumen(): (A.Ekspresi | A.Sebar)[] {
    this.harap(T.KurungBuka);
    const argumen: (A.Ekspresi | A.Sebar)[] = [];
    while (this.jenis() !== T.KurungTutup) {
      if (this.jenis() === T.Elipsis) {
        const awal = this.maju();
        const nilai = this.uraiPenugasan();
        argumen.push(this.buat<A.Sebar>(awal, { jenis: "Sebar", argumen: nilai }));
      } else {
        argumen.push(this.uraiPenugasan());
      }
      if (!this.cocok(T.Koma)) break;
    }
    this.harap(T.KurungTutup);
    return argumen;
  }

  private uraiPrimerAtauBaru(): A.Ekspresi {
    if (this.jenis() === T.KkBaru) {
      return this.uraiBaru();
    }
    return this.uraiPrimer();
  }

  private uraiBaru(): A.Ekspresi {
    const awal = this.harap(T.KkBaru);
    let callee = this.uraiPrimerAtauBaru();
    for (;;) {
      if (this.jenis() === T.Titik) {
        this.maju();
        const properti = this.namaSetelahTitik();
        callee = this.buat<A.AksesAnggota>(awal, {
          jenis: "AksesAnggota",
          objek: callee,
          properti,
          terhitung: false,
          opsional: false,
        });
      } else if (this.jenis() === T.SikuBuka) {
        this.maju();
        const properti = this.uraiEkspresi();
        this.harap(T.SikuTutup);
        callee = this.buat<A.AksesAnggota>(awal, {
          jenis: "AksesAnggota",
          objek: callee,
          properti,
          terhitung: true,
          opsional: false,
        });
      } else {
        break;
      }
    }
    let argumen: (A.Ekspresi | A.Sebar)[] = [];
    if (this.jenis() === T.KurungBuka) {
      argumen = this.uraiArgumen();
    }
    return this.buat<A.Baru>(awal, { jenis: "Baru", callee, argumen });
  }

  private uraiPrimer(): A.Ekspresi {
    const token = this.puncak();
    switch (token.jenis) {
      case T.Angka:
        this.maju();
        return this.buat<A.LiteralAngka>(token, { jenis: "LiteralAngka", nilai: uraiAngka(token.teks) });
      case T.BilanganBesar:
        this.maju();
        return this.buat<A.LiteralBilanganBesar>(token, {
          jenis: "LiteralBilanganBesar",
          nilai: uraiBilanganBesar(token.teks),
        });
      case T.Teks:
        this.maju();
        return this.buat<A.LiteralTeks>(token, { jenis: "LiteralTeks", nilai: uraiTeks(token.teks) });
      case T.KkBenar:
        this.maju();
        return this.buat<A.LiteralBoolean>(token, { jenis: "LiteralBoolean", nilai: true });
      case T.KkSalah:
        this.maju();
        return this.buat<A.LiteralBoolean>(token, { jenis: "LiteralBoolean", nilai: false });
      case T.KkKosong:
        this.maju();
        return this.buat<A.LiteralKosong>(token, { jenis: "LiteralKosong" });
      case T.KkTaktentu:
        this.maju();
        return this.buat<A.LiteralTaktentu>(token, { jenis: "LiteralTaktentu" });
      case T.KkIni:
        this.maju();
        return this.buat<A.Ini>(token, { jenis: "Ini" });
      case T.KkInduk:
        this.maju();
        return this.buat<A.Induk>(token, { jenis: "Induk" }) as unknown as A.Ekspresi;
      case T.Regex:
        return this.uraiRegex();
      case T.TemplateUtuh:
      case T.TemplateKepala:
        return this.uraiTemplate();
      case T.SikuBuka:
        return this.uraiLarik();
      case T.KurawalBuka:
        return this.uraiObjek();
      case T.KurungBuka:
        return this.uraiKurung();
      case T.KkFungsi:
        return this.uraiFungsi(false, false);
      case T.KkAsinkron:
        if (this.puncak(1).jenis === T.KkFungsi) {
          return this.uraiFungsi(true, false);
        }
        break;
      case T.KkKelas:
        return this.uraiKelas(false);
      case T.KkImpor:
        if (this.puncak(1).jenis === T.KurungBuka) {
          this.maju();
          this.harap(T.KurungBuka);
          const sumber = this.uraiPenugasan();
          this.harap(T.KurungTutup);
          return this.buat<A.ImporDinamis>(token, { jenis: "ImporDinamis", sumber });
        }
        break;
      case T.Identifier:
        return this.uraiIdentifier();
      default:
        break;
    }

    if (this.bisaJadiNama(token.jenis)) {
      return this.uraiIdentifier();
    }

    this.galatDi(token, `Ekspresi tidak terduga: "${this.tampilToken(token)}"`);
  }

  private uraiRegex(): A.LiteralRegex {
    const token = this.maju();
    const indeksTerakhir = token.teks.lastIndexOf("/");
    const pola = token.teks.slice(1, indeksTerakhir);
    const bendera = token.teks.slice(indeksTerakhir + 1);
    return this.buat<A.LiteralRegex>(token, { jenis: "LiteralRegex", pola, bendera });
  }

  private uraiTemplate(): A.TemplateTeks {
    const awal = this.puncak();
    const bagian: string[] = [];
    const mentah: string[] = [];
    const ekspresi: A.Ekspresi[] = [];

    const pertama = this.maju();
    if (pertama.jenis === T.TemplateUtuh) {
      const iris = irisTemplate(pertama.teks, "TemplateUtuh");
      mentah.push(iris.mentah);
      bagian.push(masakTemplate(iris.mentah));
      return this.buat<A.TemplateTeks>(awal, { jenis: "TemplateTeks", bagian, mentah, ekspresi });
    }

    let iris = irisTemplate(pertama.teks, "TemplateKepala");
    mentah.push(iris.mentah);
    bagian.push(masakTemplate(iris.mentah));

    for (;;) {
      ekspresi.push(this.uraiEkspresi());
      const token = this.puncak();
      if (token.jenis === T.TemplateEkor) {
        this.maju();
        iris = irisTemplate(token.teks, "TemplateEkor");
        mentah.push(iris.mentah);
        bagian.push(masakTemplate(iris.mentah));
        break;
      }
      if (token.jenis === T.TemplateTengah) {
        this.maju();
        iris = irisTemplate(token.teks, "TemplateTengah");
        mentah.push(iris.mentah);
        bagian.push(masakTemplate(iris.mentah));
        continue;
      }
      this.galatDi(token, "Template teks tidak lengkap");
    }

    return this.buat<A.TemplateTeks>(awal, { jenis: "TemplateTeks", bagian, mentah, ekspresi });
  }

  private uraiLarik(): A.Larik {
    const awal = this.harap(T.SikuBuka);
    const elemen: (A.Ekspresi | A.Sebar)[] = [];
    while (this.jenis() !== T.SikuTutup) {
      if (this.jenis() === T.Koma) {
        this.galatDi(this.puncak(), "Larik dengan lubang tidak didukung");
      }
      if (this.jenis() === T.Elipsis) {
        const awalS = this.maju();
        const nilai = this.uraiPenugasan();
        elemen.push(this.buat<A.Sebar>(awalS, { jenis: "Sebar", argumen: nilai }));
      } else {
        elemen.push(this.uraiPenugasan());
      }
      if (this.jenis() !== T.SikuTutup) {
        this.harap(T.Koma);
        if (this.jenis() === T.SikuTutup) break;
      }
    }
    this.harap(T.SikuTutup);
    return this.buat<A.Larik>(awal, { jenis: "Larik", elemen });
  }

  private uraiObjek(): A.Objek {
    const awal = this.harap(T.KurawalBuka);
    const properti: (A.PropertiObjek | A.Sebar)[] = [];
    while (this.jenis() !== T.KurawalTutup) {
      if (this.jenis() === T.Elipsis) {
        const awalS = this.maju();
        const nilai = this.uraiPenugasan();
        properti.push(this.buat<A.Sebar>(awalS, { jenis: "Sebar", argumen: nilai }));
      } else {
        properti.push(this.uraiPropertiObjek());
      }
      if (!this.cocok(T.Koma)) break;
    }
    this.harap(T.KurawalTutup);
    return this.buat<A.Objek>(awal, { jenis: "Objek", properti });
  }

  private uraiPropertiObjek(): A.PropertiObjek {
    const awal = this.puncak();
    let asinkron = false;
    let generator = false;
    let ragam: "init" | "dapatkan" | "tetapkan" = "init";

    if (this.jenis() === T.KkAsinkron && !this.setelahIniPemisahProperti(1) && !this.puncak(1).didahuluiBarisBaru) {
      this.maju();
      asinkron = true;
    }
    if (this.jenis() === T.Kali) {
      this.maju();
      generator = true;
    }
    if ((this.jenis() === T.KkDapatkan || this.jenis() === T.KkTetapkan) && !this.setelahIniPemisahProperti(1)) {
      ragam = this.jenis() === T.KkDapatkan ? "dapatkan" : "tetapkan";
      this.maju();
    }

    const { kunci, terhitung } = this.uraiKunciObjek();

    if (this.jenis() === T.KurungBuka) {
      const fungsiAwal = this.puncak();
      const parameter = this.uraiDaftarParameter();
      const tubuh = this.uraiBlok();
      const fungsi = this.buat<A.Fungsi>(fungsiAwal, {
        jenis: "Fungsi",
        nama: null,
        parameter,
        tubuh,
        asinkron,
        generator,
        panah: false,
      });
      return this.buat<A.PropertiObjek>(awal, {
        jenis: "PropertiObjek",
        kunci,
        nilai: fungsi,
        terhitung,
        singkat: false,
        ragam,
        metode: true,
      });
    }

    if (ragam !== "init") {
      this.galatDi(this.puncak(), "Getter/setter harus berupa metode");
    }

    if (this.cocok(T.TitikDua)) {
      const nilai = this.uraiPenugasan();
      return this.buat<A.PropertiObjek>(awal, {
        jenis: "PropertiObjek",
        kunci,
        nilai,
        terhitung,
        singkat: false,
        ragam: "init",
        metode: false,
      });
    }

    if (kunci.jenis !== "Identifier") {
      this.galatDi(awal, "Properti singkat harus berupa pengenal");
    }
    let nilai: A.Ekspresi = kunci;
    if (this.cocok(T.SamaDengan)) {
      const bawaan = this.uraiPenugasan();
      nilai = this.buat<A.Penugasan>(awal, { jenis: "Penugasan", operator: "=", sasaran: kunci, nilai: bawaan });
    }
    return this.buat<A.PropertiObjek>(awal, {
      jenis: "PropertiObjek",
      kunci,
      nilai,
      terhitung,
      singkat: true,
      ragam: "init",
      metode: false,
    });
  }

  private setelahIniPemisahProperti(offset: number): boolean {
    const j = this.puncak(offset).jenis;
    return j === T.TitikDua || j === T.Koma || j === T.KurawalTutup || j === T.KurungBuka || j === T.SamaDengan;
  }

  private uraiKunciObjek(): { kunci: A.Ekspresi; terhitung: boolean } {
    const token = this.puncak();
    if (token.jenis === T.SikuBuka) {
      this.maju();
      const kunci = this.uraiPenugasan();
      this.harap(T.SikuTutup);
      return { kunci, terhitung: true };
    }
    if (token.jenis === T.Teks) {
      this.maju();
      return { kunci: this.buat<A.LiteralTeks>(token, { jenis: "LiteralTeks", nilai: uraiTeks(token.teks) }), terhitung: false };
    }
    if (token.jenis === T.Angka) {
      this.maju();
      return { kunci: this.buat<A.LiteralAngka>(token, { jenis: "LiteralAngka", nilai: uraiAngka(token.teks) }), terhitung: false };
    }
    if (token.jenis === T.Identifier || this.adalahKataKunci(token.jenis)) {
      this.maju();
      return { kunci: this.buat<A.Identifier>(token, { jenis: "Identifier", nama: token.teks }), terhitung: false };
    }
    this.galatDi(token, "Nama properti tidak valid");
  }

  private uraiKurung(): A.Ekspresi {
    this.harap(T.KurungBuka);
    const ekspresi = this.uraiEkspresi();
    this.harap(T.KurungTutup);
    return ekspresi;
  }

  private uraiIdentifier(): A.Identifier {
    const token = this.puncak();
    if (token.jenis === T.Identifier || this.bisaJadiNama(token.jenis)) {
      this.maju();
      return this.buat<A.Identifier>(token, { jenis: "Identifier", nama: token.teks });
    }
    this.galatDi(token, `Diharapkan pengenal tetapi menemukan "${this.tampilToken(token)}"`);
  }

  private bisaJadiNama(jenis: JenisToken): boolean {
    return KATA_KUNCI_LUNAK.has(jenis);
  }

  private adalahKataKunci(jenis: JenisToken): boolean {
    return String(jenis).startsWith("Kk");
  }

  private uraiPolaDenganBawaan(): A.Pola {
    const awal = this.puncak();
    const pola = this.uraiPola();
    if (this.cocok(T.SamaDengan)) {
      const bawaan = this.uraiPenugasan();
      return this.buat<A.PolaBawaan>(awal, { jenis: "PolaBawaan", kiri: pola, bawaan });
    }
    return pola;
  }

  private uraiPola(): A.Pola {
    const jenis = this.jenis();
    if (jenis === T.SikuBuka) return this.uraiPolaLarik();
    if (jenis === T.KurawalBuka) return this.uraiPolaObjek();
    if (jenis === T.Elipsis) return this.uraiPolaSisa();
    return this.uraiIdentifier();
  }

  private uraiPolaSisa(): A.PolaSisa {
    const awal = this.harap(T.Elipsis);
    const argumen = this.uraiPola();
    return this.buat<A.PolaSisa>(awal, { jenis: "PolaSisa", argumen });
  }

  private uraiPolaLarik(): A.PolaLarik {
    const awal = this.harap(T.SikuBuka);
    const elemen: (A.Pola | A.PolaSisa | null)[] = [];
    while (this.jenis() !== T.SikuTutup) {
      if (this.jenis() === T.Koma) {
        this.galatDi(this.puncak(), "Pola larik dengan lubang tidak didukung");
      }
      if (this.jenis() === T.Elipsis) {
        elemen.push(this.uraiPolaSisa());
        break;
      }
      elemen.push(this.uraiPolaDenganBawaan());
      if (!this.cocok(T.Koma)) break;
    }
    this.harap(T.SikuTutup);
    return this.buat<A.PolaLarik>(awal, { jenis: "PolaLarik", elemen });
  }

  private uraiPolaObjek(): A.PolaObjek {
    const awal = this.harap(T.KurawalBuka);
    const properti: (A.PropertiPola | A.PolaSisa)[] = [];
    while (this.jenis() !== T.KurawalTutup) {
      if (this.jenis() === T.Elipsis) {
        properti.push(this.uraiPolaSisa());
        break;
      }
      const awalP = this.puncak();
      const { kunci, terhitung } = this.uraiKunciObjek();
      if (this.cocok(T.TitikDua)) {
        const nilai = this.uraiPolaDenganBawaan();
        properti.push(this.buat<A.PropertiPola>(awalP, { jenis: "PropertiPola", kunci, nilai, terhitung, singkat: false }));
      } else {
        if (kunci.jenis !== "Identifier") this.galatDi(awalP, "Pola objek singkat harus berupa pengenal");
        let nilai: A.Pola = kunci;
        if (this.cocok(T.SamaDengan)) {
          const bawaan = this.uraiPenugasan();
          nilai = this.buat<A.PolaBawaan>(awalP, { jenis: "PolaBawaan", kiri: kunci, bawaan });
        }
        properti.push(this.buat<A.PropertiPola>(awalP, { jenis: "PropertiPola", kunci, nilai, terhitung, singkat: true }));
      }
      if (!this.cocok(T.Koma)) break;
    }
    this.harap(T.KurawalTutup);
    return this.buat<A.PolaObjek>(awal, { jenis: "PolaObjek", properti });
  }

  private ulang<T extends A.Simpul>(acuan: A.Simpul, data: Omit<T, "baris" | "kolom" | "awal" | "akhir">): T {
    return {
      ...(data as object),
      baris: acuan.baris,
      kolom: acuan.kolom,
      awal: acuan.awal,
      akhir: acuan.akhir,
    } as T;
  }

  private keTargetPenugasan(ekspresi: A.Ekspresi): A.Ekspresi | A.Pola {
    if (ekspresi.jenis === "Larik" || ekspresi.jenis === "Objek") {
      return this.kePola(ekspresi);
    }
    return ekspresi;
  }

  private kePola(ekspresi: A.Ekspresi): A.Pola {
    switch (ekspresi.jenis) {
      case "Identifier":
      case "AksesAnggota":
        return ekspresi;
      case "Larik": {
        const elemen: (A.Pola | A.PolaSisa | null)[] = ekspresi.elemen.map((e) => {
          if (e.jenis === "Sebar") {
            return this.ulang<A.PolaSisa>(e, { jenis: "PolaSisa", argumen: this.kePola(e.argumen) });
          }
          return this.kePola(e);
        });
        return this.ulang<A.PolaLarik>(ekspresi, { jenis: "PolaLarik", elemen });
      }
      case "Objek": {
        const properti: (A.PropertiPola | A.PolaSisa)[] = ekspresi.properti.map((p) => {
          if (p.jenis === "Sebar") {
            return this.ulang<A.PolaSisa>(p, { jenis: "PolaSisa", argumen: this.kePola(p.argumen) });
          }
          return this.ulang<A.PropertiPola>(p, {
            jenis: "PropertiPola",
            kunci: p.kunci,
            nilai: this.kePola(p.nilai),
            terhitung: p.terhitung,
            singkat: p.singkat,
          });
        });
        return this.ulang<A.PolaObjek>(ekspresi, { jenis: "PolaObjek", properti });
      }
      case "Penugasan":
        if (ekspresi.operator === "=") {
          return this.ulang<A.PolaBawaan>(ekspresi, {
            jenis: "PolaBawaan",
            kiri: this.kePola(ekspresi.sasaran as A.Ekspresi),
            bawaan: ekspresi.nilai,
          });
        }
        break;
      default:
        break;
    }
    this.galatDi(this.tokenDari(ekspresi), "Target penugasan atau pola tidak valid");
  }

  private tokenDari(simpul: A.Simpul): Token {
    return {
      jenis: T.Identifier,
      teks: "",
      baris: simpul.baris,
      kolom: simpul.kolom,
      awal: simpul.awal,
      akhir: simpul.akhir,
      didahuluiBarisBaru: false,
    };
  }
}

export function urai(sumber: string, namaBerkas?: string): A.Program {
  return new Parser(sumber, namaBerkas).uraiProgram();
}

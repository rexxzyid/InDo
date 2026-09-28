import { GalatSintaks } from "../galat/kompilasi.js";
import { JenisToken, KATA_KUNCI, type Token } from "./token.js";

const HURUF_AWAL = /[A-Za-z_$À-￿]/;
const HURUF_LANJUT = /[A-Za-z0-9_$À-￿]/;

type SifatKurawal = "biasa" | "template";

const JENIS_BISA_AKHIRI_EKSPRESI: ReadonlySet<JenisToken> = new Set([
  JenisToken.Angka,
  JenisToken.BilanganBesar,
  JenisToken.Teks,
  JenisToken.TemplateUtuh,
  JenisToken.TemplateEkor,
  JenisToken.Regex,
  JenisToken.Identifier,
  JenisToken.PrivatNama,
  JenisToken.KurungTutup,
  JenisToken.SikuTutup,
  JenisToken.KurawalTutup,
  JenisToken.KkIni,
  JenisToken.KkBenar,
  JenisToken.KkSalah,
  JenisToken.KkKosong,
  JenisToken.KkTaktentu,
  JenisToken.KkInduk,
  JenisToken.TambahTambah,
  JenisToken.KurangKurang,
]);

export class Lexer {
  private readonly sumber: string;
  private readonly namaBerkas: string;
  private posisi = 0;
  private baris = 1;
  private kolom = 1;
  private tumpukanKurawal: SifatKurawal[] = [];
  private tokenTerakhir: Token | null = null;

  constructor(sumber: string, namaBerkas = "<masukan>") {
    this.sumber = sumber;
    this.namaBerkas = namaBerkas;
  }

  private selesai(): boolean {
    return this.posisi >= this.sumber.length;
  }

  private lihat(offset = 0): string {
    return this.sumber[this.posisi + offset] ?? "";
  }

  private maju(): string {
    const karakter = this.sumber[this.posisi] ?? "";
    this.posisi += 1;
    if (karakter === "\n") {
      this.baris += 1;
      this.kolom = 1;
    } else {
      this.kolom += 1;
    }
    return karakter;
  }

  private cocok(harapan: string): boolean {
    if (this.lihat() !== harapan) return false;
    this.maju();
    return true;
  }

  private galat(pesan: string, awal: number, panjang = 1): never {
    const { baris, kolom } = this.posisiDari(awal);
    throw new GalatSintaks(pesan, this.namaBerkas, { baris, kolom, panjang });
  }

  private posisiDari(indeks: number): { baris: number; kolom: number } {
    let baris = 1;
    let kolom = 1;
    for (let i = 0; i < indeks && i < this.sumber.length; i += 1) {
      if (this.sumber[i] === "\n") {
        baris += 1;
        kolom = 1;
      } else {
        kolom += 1;
      }
    }
    return { baris, kolom };
  }

  tokenisasi(): Token[] {
    const daftar: Token[] = [];
    for (;;) {
      const token = this.tokenBerikut();
      daftar.push(token);
      if (token.jenis === JenisToken.AkhirBerkas) break;
    }
    return daftar;
  }

  private buat(jenis: JenisToken, awal: number, baris: number, kolom: number, didahuluiBarisBaru: boolean): Token {
    const token: Token = {
      jenis,
      teks: this.sumber.slice(awal, this.posisi),
      baris,
      kolom,
      awal,
      akhir: this.posisi,
      didahuluiBarisBaru,
    };
    this.tokenTerakhir = token;
    return token;
  }

  private tokenBerikut(): Token {
    const didahuluiBarisBaru = this.lewatiRuangDanKomentar();
    const awal = this.posisi;
    const baris = this.baris;
    const kolom = this.kolom;

    if (this.selesai()) {
      return this.buat(JenisToken.AkhirBerkas, awal, baris, kolom, didahuluiBarisBaru);
    }

    const karakter = this.lihat();

    if (HURUF_AWAL.test(karakter)) {
      return this.bacaIdentifier(awal, baris, kolom, didahuluiBarisBaru);
    }
    if (karakter >= "0" && karakter <= "9") {
      return this.bacaAngka(awal, baris, kolom, didahuluiBarisBaru);
    }
    if (karakter === "." && this.lihat(1) >= "0" && this.lihat(1) <= "9") {
      return this.bacaAngka(awal, baris, kolom, didahuluiBarisBaru);
    }
    if (karakter === '"' || karakter === "'") {
      return this.bacaTeks(awal, baris, kolom, didahuluiBarisBaru);
    }
    if (karakter === "`") {
      return this.bacaTemplateAwal(awal, baris, kolom, didahuluiBarisBaru);
    }
    if (karakter === "#") {
      return this.bacaPrivat(awal, baris, kolom, didahuluiBarisBaru);
    }
    if (karakter === "/" && this.regexBolehDisini()) {
      return this.bacaRegex(awal, baris, kolom, didahuluiBarisBaru);
    }

    return this.bacaOperator(awal, baris, kolom, didahuluiBarisBaru);
  }

  private lewatiRuangDanKomentar(): boolean {
    let adaBarisBaru = false;
    for (;;) {
      const karakter = this.lihat();
      if (karakter === "\n") {
        adaBarisBaru = true;
        this.maju();
      } else if (karakter === " " || karakter === "\t" || karakter === "\r" || karakter === "\f" || karakter === "\v") {
        this.maju();
      } else if (karakter === "/" && this.lihat(1) === "/") {
        while (!this.selesai() && this.lihat() !== "\n") this.maju();
      } else if (karakter === "/" && this.lihat(1) === "*") {
        const awal = this.posisi;
        this.maju();
        this.maju();
        for (;;) {
          if (this.selesai()) this.galat("Komentar blok tidak ditutup", awal, 2);
          if (this.lihat() === "\n") adaBarisBaru = true;
          if (this.lihat() === "*" && this.lihat(1) === "/") {
            this.maju();
            this.maju();
            break;
          }
          this.maju();
        }
      } else {
        break;
      }
    }
    return adaBarisBaru;
  }

  private bacaIdentifier(awal: number, baris: number, kolom: number, bb: boolean): Token {
    while (!this.selesai() && HURUF_LANJUT.test(this.lihat())) this.maju();
    const teks = this.sumber.slice(awal, this.posisi);
    const jenis = KATA_KUNCI.get(teks) ?? JenisToken.Identifier;
    return this.buat(jenis, awal, baris, kolom, bb);
  }

  private bacaPrivat(awal: number, baris: number, kolom: number, bb: boolean): Token {
    this.maju();
    if (!HURUF_AWAL.test(this.lihat())) {
      this.galat("Nama privat harus diikuti pengenal", awal, 1);
    }
    while (!this.selesai() && HURUF_LANJUT.test(this.lihat())) this.maju();
    return this.buat(JenisToken.PrivatNama, awal, baris, kolom, bb);
  }

  private bacaAngka(awal: number, baris: number, kolom: number, bb: boolean): Token {
    let jenis = JenisToken.Angka;
    if (this.lihat() === "0" && (this.lihat(1) === "x" || this.lihat(1) === "X")) {
      this.maju();
      this.maju();
      this.bacaDigit(/[0-9a-fA-F]/, awal);
      jenis = this.mungkinBilanganBesar(awal);
    } else if (this.lihat() === "0" && (this.lihat(1) === "b" || this.lihat(1) === "B")) {
      this.maju();
      this.maju();
      this.bacaDigit(/[01]/, awal);
      jenis = this.mungkinBilanganBesar(awal);
    } else if (this.lihat() === "0" && (this.lihat(1) === "o" || this.lihat(1) === "O")) {
      this.maju();
      this.maju();
      this.bacaDigit(/[0-7]/, awal);
      jenis = this.mungkinBilanganBesar(awal);
    } else {
      if (this.lihat() !== ".") this.bacaDigit(/[0-9]/, awal);
      let desimalAtauEksponen = false;
      if (this.lihat() === "." ) {
        desimalAtauEksponen = true;
        this.maju();
        this.bacaDigit(/[0-9]/, awal, true);
      }
      if (this.lihat() === "e" || this.lihat() === "E") {
        desimalAtauEksponen = true;
        this.maju();
        if (this.lihat() === "+" || this.lihat() === "-") this.maju();
        if (!/[0-9]/.test(this.lihat())) this.galat("Eksponen angka tidak lengkap", awal, this.posisi - awal);
        this.bacaDigit(/[0-9]/, awal);
      }
      if (!desimalAtauEksponen && this.lihat() === "n") {
        this.maju();
        jenis = JenisToken.BilanganBesar;
      }
    }

    if (HURUF_LANJUT.test(this.lihat())) {
      this.galat("Angka diikuti karakter yang tidak valid", awal, this.posisi - awal + 1);
    }
    return this.buat(jenis, awal, baris, kolom, bb);
  }

  private mungkinBilanganBesar(awal: number): JenisToken {
    if (this.lihat() === "n") {
      this.maju();
      return JenisToken.BilanganBesar;
    }
    return JenisToken.Angka;
  }

  private bacaDigit(pola: RegExp, awal: number, bolehKosong = false): void {
    let jumlah = 0;
    let terakhirGarisBawah = false;
    if (this.lihat() === "_") this.galat("Pemisah '_' tidak boleh di awal angka", this.posisi, 1);
    while (!this.selesai()) {
      const karakter = this.lihat();
      if (pola.test(karakter)) {
        jumlah += 1;
        terakhirGarisBawah = false;
        this.maju();
      } else if (karakter === "_") {
        if (terakhirGarisBawah) this.galat("Pemisah '_' ganda pada angka", this.posisi, 1);
        terakhirGarisBawah = true;
        this.maju();
      } else {
        break;
      }
    }
    if (terakhirGarisBawah) this.galat("Pemisah '_' tidak boleh di akhir angka", this.posisi - 1, 1);
    if (jumlah === 0 && !bolehKosong) this.galat("Angka tidak memiliki digit", awal, this.posisi - awal || 1);
  }

  private bacaTeks(awal: number, baris: number, kolom: number, bb: boolean): Token {
    const pembatas = this.maju();
    for (;;) {
      if (this.selesai()) this.galat("Teks tidak ditutup", awal, this.posisi - awal);
      const karakter = this.lihat();
      if (karakter === "\n") this.galat("Teks tidak boleh memuat baris baru literal", awal, this.posisi - awal);
      if (karakter === "\\") {
        this.maju();
        this.maju();
        continue;
      }
      if (karakter === pembatas) {
        this.maju();
        break;
      }
      this.maju();
    }
    return this.buat(JenisToken.Teks, awal, baris, kolom, bb);
  }

  private bacaTemplateAwal(awal: number, baris: number, kolom: number, bb: boolean): Token {
    this.maju();
    return this.lanjutkanTemplate(awal, baris, kolom, bb, true);
  }

  private lanjutkanTemplate(awal: number, baris: number, kolom: number, bb: boolean, kepala: boolean): Token {
    for (;;) {
      if (this.selesai()) this.galat("Template teks tidak ditutup", awal, this.posisi - awal);
      const karakter = this.lihat();
      if (karakter === "\\") {
        this.maju();
        this.maju();
        continue;
      }
      if (karakter === "`") {
        this.maju();
        return this.buat(kepala ? JenisToken.TemplateUtuh : JenisToken.TemplateEkor, awal, baris, kolom, bb);
      }
      if (karakter === "$" && this.lihat(1) === "{") {
        this.maju();
        this.maju();
        this.tumpukanKurawal.push("template");
        return this.buat(kepala ? JenisToken.TemplateKepala : JenisToken.TemplateTengah, awal, baris, kolom, bb);
      }
      this.maju();
    }
  }

  private bacaRegex(awal: number, baris: number, kolom: number, bb: boolean): Token {
    this.maju();
    let dalamKelas = false;
    for (;;) {
      if (this.selesai()) this.galat("Regex tidak ditutup", awal, this.posisi - awal);
      const karakter = this.lihat();
      if (karakter === "\n") this.galat("Regex tidak boleh memuat baris baru", awal, this.posisi - awal);
      if (karakter === "\\") {
        this.maju();
        this.maju();
        continue;
      }
      if (karakter === "[") dalamKelas = true;
      else if (karakter === "]") dalamKelas = false;
      else if (karakter === "/" && !dalamKelas) {
        this.maju();
        break;
      }
      this.maju();
    }
    while (!this.selesai() && HURUF_LANJUT.test(this.lihat())) this.maju();
    return this.buat(JenisToken.Regex, awal, baris, kolom, bb);
  }

  private regexBolehDisini(): boolean {
    const t = this.tokenTerakhir;
    if (t === null) return true;
    return !JENIS_BISA_AKHIRI_EKSPRESI.has(t.jenis);
  }

  private bacaOperator(awal: number, baris: number, kolom: number, bb: boolean): Token {
    const karakter = this.maju();
    const buat = (jenis: JenisToken): Token => this.buat(jenis, awal, baris, kolom, bb);

    switch (karakter) {
      case "(":
        return buat(JenisToken.KurungBuka);
      case ")":
        return buat(JenisToken.KurungTutup);
      case "{":
        this.tumpukanKurawal.push("biasa");
        return buat(JenisToken.KurawalBuka);
      case "}": {
        const sifat = this.tumpukanKurawal.pop();
        if (sifat === "template") {
          return this.lanjutkanTemplate(awal, baris, kolom, bb, false);
        }
        return buat(JenisToken.KurawalTutup);
      }
      case "[":
        return buat(JenisToken.SikuBuka);
      case "]":
        return buat(JenisToken.SikuTutup);
      case ",":
        return buat(JenisToken.Koma);
      case ";":
        return buat(JenisToken.TitikKoma);
      case ":":
        return buat(JenisToken.TitikDua);
      case "~":
        return buat(JenisToken.Tilde);
      case ".":
        if (this.lihat() === "." && this.lihat(1) === ".") {
          this.maju();
          this.maju();
          return buat(JenisToken.Elipsis);
        }
        return buat(JenisToken.Titik);
      case "?":
        if (this.lihat() === "?") {
          this.maju();
          if (this.cocok("=")) return buat(JenisToken.NullishSama);
          return buat(JenisToken.Nullish);
        }
        if (this.lihat() === "." && !(this.lihat(1) >= "0" && this.lihat(1) <= "9")) {
          this.maju();
          return buat(JenisToken.TanyaTitik);
        }
        return buat(JenisToken.Tanya);
      case "+":
        if (this.cocok("+")) return buat(JenisToken.TambahTambah);
        if (this.cocok("=")) return buat(JenisToken.TambahSama);
        return buat(JenisToken.Tambah);
      case "-":
        if (this.cocok("-")) return buat(JenisToken.KurangKurang);
        if (this.cocok("=")) return buat(JenisToken.KurangSama);
        return buat(JenisToken.Kurang);
      case "*":
        if (this.cocok("*")) {
          if (this.cocok("=")) return buat(JenisToken.PangkatSama);
          return buat(JenisToken.Pangkat);
        }
        if (this.cocok("=")) return buat(JenisToken.KaliSama);
        return buat(JenisToken.Kali);
      case "/":
        if (this.cocok("=")) return buat(JenisToken.BagiSama);
        return buat(JenisToken.Bagi);
      case "%":
        if (this.cocok("=")) return buat(JenisToken.SisaSama);
        return buat(JenisToken.Sisa);
      case "=":
        if (this.lihat() === "=") {
          this.maju();
          if (this.cocok("=")) return buat(JenisToken.SamaSamaSama);
          return buat(JenisToken.SamaSama);
        }
        if (this.cocok(">")) return buat(JenisToken.Panah);
        return buat(JenisToken.SamaDengan);
      case "!":
        if (this.lihat() === "=") {
          this.maju();
          if (this.cocok("=")) return buat(JenisToken.TidakSamaSama);
          return buat(JenisToken.TidakSama);
        }
        return buat(JenisToken.Seru);
      case "<":
        if (this.lihat() === "<") {
          this.maju();
          if (this.cocok("=")) return buat(JenisToken.GeserKiriSama);
          return buat(JenisToken.GeserKiri);
        }
        if (this.cocok("=")) return buat(JenisToken.KurangSamaDari);
        return buat(JenisToken.KurangDari);
      case ">":
        if (this.lihat() === ">") {
          this.maju();
          if (this.lihat() === ">") {
            this.maju();
            if (this.cocok("=")) return buat(JenisToken.GeserKananNolSama);
            return buat(JenisToken.GeserKananNol);
          }
          if (this.cocok("=")) return buat(JenisToken.GeserKananSama);
          return buat(JenisToken.GeserKanan);
        }
        if (this.cocok("=")) return buat(JenisToken.LebihSamaDari);
        return buat(JenisToken.LebihDari);
      case "&":
        if (this.lihat() === "&") {
          this.maju();
          if (this.cocok("=")) return buat(JenisToken.DanDanSama);
          return buat(JenisToken.DanDan);
        }
        if (this.cocok("=")) return buat(JenisToken.DanSama);
        return buat(JenisToken.Dan);
      case "|":
        if (this.lihat() === "|") {
          this.maju();
          if (this.cocok("=")) return buat(JenisToken.AtauAtauSama);
          return buat(JenisToken.AtauAtau);
        }
        if (this.cocok("=")) return buat(JenisToken.AtauSama);
        return buat(JenisToken.Atau);
      case "^":
        if (this.cocok("=")) return buat(JenisToken.XorSama);
        return buat(JenisToken.Xor);
      default:
        this.galat(`Karakter tidak dikenal: "${karakter}"`, awal, 1);
    }
  }
}

export function tokenisasi(sumber: string, namaBerkas?: string): Token[] {
  return new Lexer(sumber, namaBerkas).tokenisasi();
}

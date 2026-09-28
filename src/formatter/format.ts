import type * as A from "../parser/ast.js";
import { urai } from "../parser/parser.js";

const BP: Record<string, number> = {
  "??": 3,
  "||": 4,
  "&&": 5,
  "|": 6,
  "^": 7,
  "&": 8,
  "==": 9,
  "!=": 9,
  "===": 9,
  "!==": 9,
  "<": 10,
  ">": 10,
  "<=": 10,
  ">=": 10,
  contohdari: 10,
  dalam: 10,
  "<<": 11,
  ">>": 11,
  ">>>": 11,
  "+": 12,
  "-": 12,
  "*": 13,
  "/": 13,
  "%": 13,
  "**": 14,
};

class Pemformat {
  private lekuk = 0;

  format(program: A.Program): string {
    const baris = program.tubuh.map((p) => this.pernyataan(p));
    return baris.join("\n") + "\n";
  }

  private spasi(): string {
    return "  ".repeat(this.lekuk);
  }

  private pernyataan(simpul: A.Pernyataan): string {
    switch (simpul.jenis) {
      case "PernyataanEkspresi":
        return this.spasi() + this.ekspresi(simpul.ekspresi, 0);
      case "DeklarasiVariabel":
        return this.spasi() + this.deklarasiVariabel(simpul);
      case "Blok":
        return this.spasi() + this.blok(simpul);
      case "PernyataanKosong":
        return this.spasi() + ";";
      case "Jika":
        return this.spasi() + this.jika(simpul);
      case "Selama":
        return this.spasi() + `selama (${this.ekspresi(simpul.uji, 0)}) ${this.tubuhAtauBlok(simpul.tubuh)}`;
      case "LakukanSelama":
        return this.spasi() + `lakukan ${this.tubuhAtauBlok(simpul.tubuh)} selama (${this.ekspresi(simpul.uji, 0)})`;
      case "UntukKlasik":
        return this.spasi() + this.untukKlasik(simpul);
      case "UntukDari":
        return this.spasi() + this.untukDari(simpul);
      case "UntukDalam":
        return (
          this.spasi() +
          `untuk (${this.kidal(simpul.kidal)} dalam ${this.ekspresi(simpul.kanan, 0)}) ${this.tubuhAtauBlok(simpul.tubuh)}`
        );
      case "Pilih":
        return this.spasi() + this.pilih(simpul);
      case "Henti":
        return this.spasi() + (simpul.label ? `henti ${simpul.label.nama}` : "henti");
      case "Lanjut":
        return this.spasi() + (simpul.label ? `lanjut ${simpul.label.nama}` : "lanjut");
      case "Kembalikan":
        return this.spasi() + (simpul.argumen ? `kembalikan ${this.ekspresi(simpul.argumen, 0)}` : "kembalikan");
      case "Lempar":
        return this.spasi() + `lempar ${this.ekspresi(simpul.argumen, 0)}`;
      case "Coba":
        return this.spasi() + this.coba(simpul);
      case "DeklarasiFungsi":
        return this.spasi() + this.fungsi(simpul.fungsi);
      case "DeklarasiKelas":
        return this.spasi() + this.kelas(simpul.kelas);
      case "Berlabel":
        return this.spasi() + `${simpul.label.nama}: ${this.pernyataan(simpul.tubuh).trimStart()}`;
      case "Impor":
        return this.spasi() + this.impor(simpul);
      case "EksporBernama":
        return this.spasi() + this.eksporBernama(simpul);
      case "EksporBawaan":
        return this.spasi() + `ekspor bawaan ${this.ekspresiAtauPernyataan(simpul.nilai)}`;
      case "EksporSemua":
        return this.spasi() + `ekspor * ${simpul.sebagai ? `sebagai ${simpul.sebagai} ` : ""}dari "${simpul.sumber}"`;
      default:
        return this.spasi() + "/* tak dikenal */";
    }
  }

  private ekspresiAtauPernyataan(nilai: A.Pernyataan | A.Ekspresi): string {
    if ((nilai as A.Simpul).jenis === "DeklarasiFungsi") return this.fungsi((nilai as A.DeklarasiFungsi).fungsi);
    if ((nilai as A.Simpul).jenis === "DeklarasiKelas") return this.kelas((nilai as A.DeklarasiKelas).kelas);
    return this.ekspresi(nilai as A.Ekspresi, 0);
  }

  private blok(simpul: A.Blok): string {
    if (simpul.tubuh.length === 0) return "{}";
    this.lekuk += 1;
    const isi = simpul.tubuh.map((p) => this.pernyataan(p)).join("\n");
    this.lekuk -= 1;
    return `{\n${isi}\n${this.spasi()}}`;
  }

  private tubuhAtauBlok(simpul: A.Pernyataan): string {
    if (simpul.jenis === "Blok") return this.blok(simpul);
    this.lekuk += 1;
    const isi = this.pernyataan(simpul);
    this.lekuk -= 1;
    return `\n${isi}`;
  }

  private deklarasiVariabel(simpul: A.DeklarasiVariabel): string {
    const dek = simpul.deklarasi
      .map((d) => (d.awalNilai ? `${this.pola(d.id)} = ${this.ekspresi(d.awalNilai, 2)}` : this.pola(d.id)))
      .join(", ");
    return `${simpul.ragam} ${dek}`;
  }

  private jika(simpul: A.Jika): string {
    let hasil = `jika (${this.ekspresi(simpul.uji, 0)}) ${this.tubuhAtauBlok(simpul.konsekuen)}`;
    if (simpul.alternatif) {
      const pemisah = simpul.konsekuen.jenis === "Blok" ? " " : `\n${this.spasi()}`;
      if (simpul.alternatif.jenis === "Jika") {
        hasil += `${pemisah}lainnya ${this.pernyataan(simpul.alternatif).trimStart()}`;
      } else {
        hasil += `${pemisah}lainnya ${this.tubuhAtauBlok(simpul.alternatif).trimStart()}`;
      }
    }
    return hasil;
  }

  private untukKlasik(simpul: A.UntukKlasik): string {
    const init = simpul.init
      ? (simpul.init as A.Simpul).jenis === "DeklarasiVariabel"
        ? this.deklarasiVariabel(simpul.init as A.DeklarasiVariabel)
        : this.ekspresi(simpul.init as A.Ekspresi, 0)
      : "";
    const uji = simpul.uji ? this.ekspresi(simpul.uji, 0) : "";
    const perbarui = simpul.perbarui ? this.ekspresi(simpul.perbarui, 0) : "";
    return `untuk (${init}; ${uji}; ${perbarui}) ${this.tubuhAtauBlok(simpul.tubuh)}`;
  }

  private untukDari(simpul: A.UntukDari): string {
    const tunggu = simpul.tunggu ? "tunggu " : "";
    return `untuk ${tunggu}(${this.kidal(simpul.kidal)} dari ${this.ekspresi(simpul.kanan, 2)}) ${this.tubuhAtauBlok(simpul.tubuh)}`;
  }

  private kidal(kidal: A.DeklarasiVariabel | A.Pola): string {
    if ((kidal as A.Simpul).jenis === "DeklarasiVariabel") return this.deklarasiVariabel(kidal as A.DeklarasiVariabel);
    return this.pola(kidal as A.Pola);
  }

  private pilih(simpul: A.Pilih): string {
    this.lekuk += 1;
    const kasus = simpul.kasus
      .map((k) => {
        const kepala = k.uji ? `${this.spasi()}kasus ${this.ekspresi(k.uji, 0)}:` : `${this.spasi()}bawaan:`;
        this.lekuk += 1;
        const badan = k.tubuh.map((p) => this.pernyataan(p)).join("\n");
        this.lekuk -= 1;
        return badan ? `${kepala}\n${badan}` : kepala;
      })
      .join("\n");
    this.lekuk -= 1;
    return `pilih (${this.ekspresi(simpul.diskriminan, 0)}) {\n${kasus}\n${this.spasi()}}`;
  }

  private coba(simpul: A.Coba): string {
    let hasil = `coba ${this.blok(simpul.blok)}`;
    if (simpul.penangkap) {
      const param = simpul.penangkap.param ? ` (${this.pola(simpul.penangkap.param)})` : "";
      hasil += ` tangkap${param} ${this.blok(simpul.penangkap.tubuh)}`;
    }
    if (simpul.akhirnya) hasil += ` akhirnya ${this.blok(simpul.akhirnya)}`;
    return hasil;
  }

  private impor(simpul: A.Impor): string {
    if (simpul.penentu.length === 0) return `impor "${simpul.sumber}"`;
    const bagian: string[] = [];
    const bernama: string[] = [];
    for (const p of simpul.penentu) {
      if (p.ragam === "bawaan") bagian.push(p.lokal.nama);
      else if (p.ragam === "namespace") bagian.push(`* sebagai ${p.lokal.nama}`);
      else bernama.push(p.impor === p.lokal.nama ? p.lokal.nama : `${p.impor} sebagai ${p.lokal.nama}`);
    }
    if (bernama.length > 0) bagian.push(`{ ${bernama.join(", ")} }`);
    return `impor ${bagian.join(", ")} dari "${simpul.sumber}"`;
  }

  private eksporBernama(simpul: A.EksporBernama): string {
    if (simpul.deklarasi) return `ekspor ${this.pernyataan(simpul.deklarasi).trimStart()}`;
    const penentu = simpul.penentu
      .map((p) => (p.lokal === p.diekspor ? p.lokal : `${p.lokal} sebagai ${p.diekspor}`))
      .join(", ");
    const dari = simpul.sumber ? ` dari "${simpul.sumber}"` : "";
    return `ekspor { ${penentu} }${dari}`;
  }

  private fungsi(simpul: A.Fungsi): string {
    const asinkron = simpul.asinkron ? "asinkron " : "";
    const bintang = simpul.generator ? "*" : "";
    const nama = simpul.nama ? ` ${simpul.nama.nama}` : "";
    const param = simpul.parameter.map((p) => this.pola(p)).join(", ");
    if (simpul.panah) {
      const badan = simpul.tubuh.jenis === "Blok" ? this.blok(simpul.tubuh) : this.ekspresi(simpul.tubuh, 2);
      return `${asinkron}(${param}) => ${badan}`;
    }
    return `${asinkron}fungsi${bintang}${nama}(${param}) ${this.blok(simpul.tubuh as A.Blok)}`;
  }

  private kelas(simpul: A.KelasEkspresi): string {
    const nama = simpul.nama ? ` ${simpul.nama.nama}` : "";
    const induk = simpul.induk ? ` mewarisi ${this.ekspresi(simpul.induk, 2)}` : "";
    if (simpul.anggota.length === 0) return `kelas${nama}${induk} {}`;
    this.lekuk += 1;
    const anggota = simpul.anggota.map((a) => this.spasi() + this.anggotaKelas(a)).join("\n");
    this.lekuk -= 1;
    return `kelas${nama}${induk} {\n${anggota}\n${this.spasi()}}`;
  }

  private anggotaKelas(simpul: A.AnggotaKelas): string {
    if (simpul.jenis === "BlokStatis") {
      return `statis ${this.blok({ jenis: "Blok", tubuh: simpul.tubuh } as A.Blok)}`;
    }
    if (simpul.jenis === "FieldKelas") {
      const statis = simpul.statis ? "statis " : "";
      const kunci = this.kunciAnggota(simpul.kunci, simpul.terhitung);
      return simpul.nilai ? `${statis}${kunci} = ${this.ekspresi(simpul.nilai, 2)}` : `${statis}${kunci}`;
    }
    const statis = simpul.statis ? "statis " : "";
    const asinkron = simpul.nilai.asinkron ? "asinkron " : "";
    const bintang = simpul.nilai.generator ? "*" : "";
    const awalan = simpul.ragam === "dapatkan" ? "dapatkan " : simpul.ragam === "tetapkan" ? "tetapkan " : "";
    const kunci = simpul.ragam === "konstruktor" ? "konstruktor" : this.kunciAnggota(simpul.kunci, simpul.terhitung);
    const param = simpul.nilai.parameter.map((p) => this.pola(p)).join(", ");
    return `${statis}${asinkron}${bintang}${awalan}${kunci}(${param}) ${this.blok(simpul.nilai.tubuh as A.Blok)}`;
  }

  private kunciAnggota(kunci: A.Ekspresi | A.NamaPrivat, terhitung: boolean): string {
    if (kunci.jenis === "NamaPrivat") return "#" + kunci.nama;
    if (terhitung) return `[${this.ekspresi(kunci, 0)}]`;
    return this.kunciObjek(kunci);
  }

  private kunciObjek(kunci: A.Ekspresi): string {
    if (kunci.jenis === "Identifier") return kunci.nama;
    if (kunci.jenis === "LiteralTeks") return JSON.stringify(kunci.nilai);
    if (kunci.jenis === "LiteralAngka") return String(kunci.nilai);
    return this.ekspresi(kunci, 0);
  }

  private pola(simpul: A.Pola): string {
    switch (simpul.jenis) {
      case "Identifier":
        return simpul.nama;
      case "AksesAnggota":
        return this.ekspresi(simpul, 0);
      case "PolaBawaan":
        return `${this.pola(simpul.kiri)} = ${this.ekspresi(simpul.bawaan, 2)}`;
      case "PolaSisa":
        return `...${this.pola(simpul.argumen)}`;
      case "PolaLarik":
        return `[${simpul.elemen.map((e) => (e === null ? "" : this.pola(e))).join(", ")}]`;
      case "PolaObjek": {
        const bagian = simpul.properti.map((p) => {
          if (p.jenis === "PolaSisa") return `...${this.pola(p.argumen)}`;
          if (p.singkat) return this.pola(p.nilai);
          return `${this.kunciObjek(p.kunci)}: ${this.pola(p.nilai)}`;
        });
        return `{ ${bagian.join(", ")} }`;
      }
      default:
        return "";
    }
  }

  private ekspresi(simpul: A.Ekspresi, bpMin: number): string {
    const teks = this.ekspresiInti(simpul);
    const bp = this.bpDari(simpul);
    if (bp < bpMin) return `(${teks})`;
    return teks;
  }

  private bpDari(simpul: A.Ekspresi): number {
    if (simpul.jenis === "Urutan") return 0;
    if (simpul.jenis === "Penugasan") return 1;
    if (simpul.jenis === "Kondisional") return 2;
    if (simpul.jenis === "Logika" || simpul.jenis === "Biner") return BP[simpul.operator] ?? 2;
    return 20;
  }

  private ekspresiInti(simpul: A.Ekspresi): string {
    switch (simpul.jenis) {
      case "LiteralAngka":
        return String(simpul.nilai);
      case "LiteralBilanganBesar":
        return `${simpul.nilai}n`;
      case "LiteralTeks":
        return JSON.stringify(simpul.nilai);
      case "LiteralBoolean":
        return simpul.nilai ? "benar" : "salah";
      case "LiteralKosong":
        return "kosong";
      case "LiteralTaktentu":
        return "taktentu";
      case "LiteralRegex":
        return `/${simpul.pola}/${simpul.bendera}`;
      case "Identifier":
        return simpul.nama;
      case "Ini":
        return "ini";
      case "TemplateTeks":
        return this.template(simpul);
      case "TemplateTertag":
        return `${this.ekspresi(simpul.tag, 20)}${this.template(simpul.quasi)}`;
      case "Larik":
        return `[${simpul.elemen.map((e) => (e.jenis === "Sebar" ? `...${this.ekspresi(e.argumen, 2)}` : this.ekspresi(e, 2))).join(", ")}]`;
      case "Objek":
        return this.objek(simpul);
      case "Fungsi":
        return this.fungsi(simpul);
      case "KelasEkspresi":
        return this.kelas(simpul);
      case "Pemanggilan":
        return `${this.ekspresi(simpul.callee as A.Ekspresi, 20)}${simpul.opsional ? "?." : ""}(${simpul.argumen.map((a) => (a.jenis === "Sebar" ? `...${this.ekspresi(a.argumen, 2)}` : this.ekspresi(a, 2))).join(", ")})`;
      case "Baru":
        return `baru ${this.ekspresi(simpul.callee, 20)}(${simpul.argumen.map((a) => (a.jenis === "Sebar" ? `...${this.ekspresi(a.argumen, 2)}` : this.ekspresi(a, 2))).join(", ")})`;
      case "AksesAnggota":
        if (simpul.terhitung) return `${this.ekspresi(simpul.objek as A.Ekspresi, 20)}${simpul.opsional ? "?." : ""}[${this.ekspresi(simpul.properti as A.Ekspresi, 0)}]`;
        return `${this.ekspresi(simpul.objek as A.Ekspresi, 20)}${simpul.opsional ? "?." : "."}${simpul.properti.jenis === "NamaPrivat" ? "#" + simpul.properti.nama : (simpul.properti as A.Identifier).nama}`;
      case "RantaiOpsional":
        return this.ekspresiInti(simpul.ekspresi);
      case "Penugasan":
        return `${this.ekspresi(simpul.sasaran as A.Ekspresi, 2)} ${simpul.operator} ${this.ekspresi(simpul.nilai, 1)}`;
      case "Biner":
      case "Logika": {
        const bp = BP[simpul.operator] ?? 2;
        return `${this.ekspresi(simpul.kiri, bp)} ${simpul.operator} ${this.ekspresi(simpul.kanan, bp + 1)}`;
      }
      case "Uner":
        return /^[a-z]/.test(simpul.operator) ? `${simpul.operator} ${this.ekspresi(simpul.argumen, 15)}` : `${simpul.operator}${this.ekspresi(simpul.argumen, 15)}`;
      case "Perbarui":
        return simpul.prefiks ? `${simpul.operator}${this.ekspresi(simpul.argumen, 15)}` : `${this.ekspresi(simpul.argumen, 15)}${simpul.operator}`;
      case "Kondisional":
        return `${this.ekspresi(simpul.uji, 3)} ? ${this.ekspresi(simpul.konsekuen, 2)} : ${this.ekspresi(simpul.alternatif, 2)}`;
      case "Urutan":
        return simpul.ekspresi.map((e) => this.ekspresi(e, 1)).join(", ");
      case "Tunggu":
        return `tunggu ${this.ekspresi(simpul.argumen, 15)}`;
      case "Hasilkan":
        return `hasilkan${simpul.delegasi ? "*" : ""}${simpul.argumen ? " " + this.ekspresi(simpul.argumen, 1) : ""}`;
      case "ImporDinamis":
        return `impor(${this.ekspresi(simpul.sumber, 2)})`;
      default:
        return "";
    }
  }

  private template(simpul: A.TemplateTeks): string {
    let hasil = "`" + simpul.mentah[0];
    for (let i = 0; i < simpul.ekspresi.length; i += 1) {
      hasil += "${" + this.ekspresi(simpul.ekspresi[i]!, 0) + "}" + simpul.mentah[i + 1];
    }
    return hasil + "`";
  }

  private objek(simpul: A.Objek): string {
    if (simpul.properti.length === 0) return "{}";
    const bagian = simpul.properti.map((p) => {
      if (p.jenis === "Sebar") return `...${this.ekspresi(p.argumen, 2)}`;
      if (p.metode) {
        const fn = p.nilai as A.Fungsi;
        const asinkron = fn.asinkron ? "asinkron " : "";
        const bintang = fn.generator ? "*" : "";
        const awalan = p.ragam === "dapatkan" ? "dapatkan " : p.ragam === "tetapkan" ? "tetapkan " : "";
        const param = fn.parameter.map((x) => this.pola(x)).join(", ");
        const kunci = p.terhitung ? `[${this.ekspresi(p.kunci, 0)}]` : this.kunciObjek(p.kunci);
        return `${asinkron}${bintang}${awalan}${kunci}(${param}) ${this.blok(fn.tubuh as A.Blok)}`;
      }
      if (p.singkat) return this.kunciObjek(p.kunci);
      const kunci = p.terhitung ? `[${this.ekspresi(p.kunci, 0)}]` : this.kunciObjek(p.kunci);
      return `${kunci}: ${this.ekspresi(p.nilai, 2)}`;
    });
    return `{ ${bagian.join(", ")} }`;
  }
}

export function rapikanSumber(sumber: string, namaBerkas = "<masukan>"): string {
  const program = urai(sumber, namaBerkas);
  return new Pemformat().format(program);
}

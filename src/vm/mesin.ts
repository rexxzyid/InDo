import * as fs from "node:fs";
import * as jalurNode from "node:path";
import * as kripto from "node:crypto";
import * as http from "node:http";
import { GalatEksekusi, LemparInDo, SinyalHasilkan } from "../galat/eksekusi.js";
import { Op } from "../compiler/opcode.js";
import { Kompiler } from "../compiler/kompiler.js";
import { urai } from "../parser/parser.js";
import { PRELUDE } from "./prelude.js";
import {
  benarKah,
  FungsiKompilasi,
  FungsiNatif,
  jenisNilai,
  keTampilan,
  keTeks,
  type Nilai,
  Penutup,
  samaKetat,
  Upvalue,
} from "../runtime/nilai.js";
import {
  GeneratorInDo,
  HimpunanInDo,
  HimpunanLemahInDo,
  IteratorInDo,
  JanjiInDo,
  type JenisLarikBertipe,
  type KunciProperti,
  KelasInDo,
  LarikBertipeInDo,
  LarikInDo,
  normalisasiKunci,
  ObjekInDo,
  PenyanggaLarikInDo,
  PetaInDo,
  PetaLemahInDo,
  RefLemahInDo,
  RegExInDo,
  SIMBOL_ITERATOR,
  SIMBOL_ITERATOR_ASINKRON,
  TanggalInDo,
  WakilInDo,
} from "../runtime/objek.js";

interface Bingkai {
  penutup: Penutup;
  ip: number;
  basis: number;
  generator: GeneratorInDo | null;
}

interface Penangan {
  addr: number;
  kedalamanTumpukan: number;
  kedalamanBingkai: number;
}

interface Timer {
  id: number;
  waktuJatuh: number;
  fungsi: Nilai;
  argumen: Nilai[];
  interval: number;
  dibatalkan: boolean;
}

export interface OpsiMesin {
  cetak?: (teks: string) => void;
  galat?: (teks: string) => void;
  muatSumberModul?: (spesifikasi: string, dariJalur: string) => { jalur: string; sumber: string };
  masukan?: (pesan: string) => string;
}

export class Mesin {
  private readonly tumpukan: Nilai[] = [];
  private readonly bingkai: Bingkai[] = [];
  private readonly global = new Map<string, Nilai>();
  private readonly upvalueTerbuka = new Map<number, Upvalue>();
  private readonly penangan: Penangan[] = [];
  private readonly cetak: (teks: string) => void;
  private readonly galatKeluar: (teks: string) => void;
  private siapGalat = false;
  private readonly mikrotask: Array<() => void> = [];
  private readonly timer: Timer[] = [];
  private idTimerBerikut = 1;
  private jamMaya = 0;
  private readonly penolakanTakTertangani = new Set<JanjiInDo>();
  private readonly cacheModul = new Map<string, ObjekInDo>();
  private realTertunda = 0;
  private pemicuReal: (() => void) | null = null;
  private readonly serverAktif: { tutup: () => void }[] = [];
  private readonly muatSumberModul: ((spesifikasi: string, dariJalur: string) => { jalur: string; sumber: string }) | null;
  private readonly masukanFn: (pesan: string) => string;
  galatTerjadi = false;

  constructor(opsi: OpsiMesin = {}) {
    this.cetak = opsi.cetak ?? ((teks) => process.stdout.write(teks + "\n"));
    this.galatKeluar = opsi.galat ?? ((teks) => process.stderr.write(teks + "\n"));
    this.muatSumberModul = opsi.muatSumberModul ?? null;
    this.masukanFn = opsi.masukan ?? ((pesan) => bacaBarisStdin(pesan));
    this.pasangBawaan();
    this.pasangJanjiDanTimer();
    this.pasangPustaka();
    this.jalankanPrelude();
  }

  private jalankanPrelude(): void {
    const program = urai(PRELUDE, "<prelude>");
    const fungsi = Kompiler.kompilasiProgram(program, "<prelude>");
    this.jalankan(fungsi);
    this.siapGalat = true;
  }

  definisiGlobal(nama: string, nilai: Nilai): void {
    this.global.set(nama, nilai);
  }

  private pasangBawaan(): void {
    this.definisiGlobal("ini", undefined);
    this.definisiGlobal(
      "cetak",
      new FungsiNatif("cetak", -1, (argumen) => {
        this.cetak(argumen.map((a) => keTampilan(a)).join(" "));
        return undefined;
      }),
    );

    const daftarSimbol = new Map<string, symbol>();
    const simbol = new FungsiNatif("Simbol", -1, (argumen) => {
      const deskripsi = argumen[0];
      return Symbol(typeof deskripsi === "string" ? deskripsi : undefined);
    });
    simbol.taruh("iterator", SIMBOL_ITERATOR);
    simbol.taruh("iteratorAsinkron", SIMBOL_ITERATOR_ASINKRON);
    simbol.taruh(
      "untuk",
      new FungsiNatif("untuk", 1, (argumen) => {
        const kunci = keTeks(argumen[0]);
        let s = daftarSimbol.get(kunci);
        if (s === undefined) {
          s = Symbol.for(kunci);
          daftarSimbol.set(kunci, s);
        }
        return s;
      }),
    );
    this.definisiGlobal("Simbol", simbol);
  }

  private objekNatif(entri: Record<string, Nilai>): ObjekInDo {
    const objek = new ObjekInDo(null);
    for (const [k, v] of Object.entries(entri)) objek.tetapkan(k, v);
    return objek;
  }

  private nf(nama: string, fn: (a: Nilai[]) => Nilai): FungsiNatif {
    return new FungsiNatif(nama, -1, fn);
  }

  private pasangPustaka(): void {
    this.definisiGlobal("Takhingga", Infinity);
    this.definisiGlobal("NaN", NaN);
    this.definisiGlobal("uraiAngka", this.nf("uraiAngka", (a) => parseFloat(keTeks(a[0]))));
    this.definisiGlobal("uraiBulat", this.nf("uraiBulat", (a) => parseInt(keTeks(a[0]), a[1] === undefined ? 10 : this.angka(a[1]))));
    this.definisiGlobal("BilanganBesar", this.nf("BilanganBesar", (a) => (typeof a[0] === "bigint" ? a[0] : BigInt(typeof a[0] === "number" ? Math.trunc(a[0]) : keTeks(a[0])))));
    this.definisiGlobal("adalahNaN", this.nf("adalahNaN", (a) => Number.isNaN(this.angka(a[0]))));
    this.definisiGlobal("adalahTerhingga", this.nf("adalahTerhingga", (a) => Number.isFinite(this.angka(a[0]))));
    this.definisiGlobal("masukan", this.nf("masukan", (a) => this.masukanFn(a[0] === undefined ? "" : keTeks(a[0]))));
    this.definisiGlobal(
      "pastikan",
      this.nf("pastikan", (a) => {
        if (!benarKah(a[0])) {
          throw new LemparInDo(this.buatGalat("Galat", a[1] === undefined ? "Penegasan gagal" : keTeks(a[1])));
        }
        return undefined;
      }),
    );

    this.definisiGlobal(
      "Matematika",
      this.objekNatif({
        PI: Math.PI,
        E: Math.E,
        LN2: Math.LN2,
        LN10: Math.LN10,
        akar: this.nf("akar", (a) => Math.sqrt(this.angka(a[0]))),
        akarKubik: this.nf("akarKubik", (a) => Math.cbrt(this.angka(a[0]))),
        pangkat: this.nf("pangkat", (a) => Math.pow(this.angka(a[0]), this.angka(a[1]))),
        bulatkan: this.nf("bulatkan", (a) => Math.round(this.angka(a[0]))),
        bawah: this.nf("bawah", (a) => Math.floor(this.angka(a[0]))),
        atas: this.nf("atas", (a) => Math.ceil(this.angka(a[0]))),
        potong: this.nf("potong", (a) => Math.trunc(this.angka(a[0]))),
        mutlak: this.nf("mutlak", (a) => Math.abs(this.angka(a[0]))),
        tanda: this.nf("tanda", (a) => Math.sign(this.angka(a[0]))),
        acak: this.nf("acak", () => Math.random()),
        maks: this.nf("maks", (a) => Math.max(...a.map((x) => this.angka(x)))),
        min: this.nf("min", (a) => Math.min(...a.map((x) => this.angka(x)))),
        sin: this.nf("sin", (a) => Math.sin(this.angka(a[0]))),
        cos: this.nf("cos", (a) => Math.cos(this.angka(a[0]))),
        tan: this.nf("tan", (a) => Math.tan(this.angka(a[0]))),
        asin: this.nf("asin", (a) => Math.asin(this.angka(a[0]))),
        acos: this.nf("acos", (a) => Math.acos(this.angka(a[0]))),
        atan: this.nf("atan", (a) => Math.atan(this.angka(a[0]))),
        atan2: this.nf("atan2", (a) => Math.atan2(this.angka(a[0]), this.angka(a[1]))),
        eksp: this.nf("eksp", (a) => Math.exp(this.angka(a[0]))),
        log: this.nf("log", (a) => Math.log(this.angka(a[0]))),
        log2: this.nf("log2", (a) => Math.log2(this.angka(a[0]))),
        log10: this.nf("log10", (a) => Math.log10(this.angka(a[0]))),
        hipotenusa: this.nf("hipotenusa", (a) => Math.hypot(...a.map((x) => this.angka(x)))),
      }),
    );

    const waktuKonsol = new Map<string, number>();
    this.definisiGlobal(
      "Konsol",
      this.objekNatif({
        cetak: this.nf("cetak", (a) => {
          this.cetak(a.map((x) => keTampilan(x)).join(" "));
          return undefined;
        }),
        galat: this.nf("galat", (a) => {
          this.galatKeluar(a.map((x) => keTampilan(x)).join(" "));
          return undefined;
        }),
        peringatan: this.nf("peringatan", (a) => {
          this.galatKeluar(a.map((x) => keTampilan(x)).join(" "));
          return undefined;
        }),
        info: this.nf("info", (a) => {
          this.cetak(a.map((x) => keTampilan(x)).join(" "));
          return undefined;
        }),
        tabel: this.nf("tabel", (a) => {
          this.cetak(keTampilan(a[0]));
          return undefined;
        }),
        waktu: this.nf("waktu", (a) => {
          waktuKonsol.set(a[0] === undefined ? "bawaan" : keTeks(a[0]), Date.now());
          return undefined;
        }),
        akhiriWaktu: this.nf("akhiriWaktu", (a) => {
          const label = a[0] === undefined ? "bawaan" : keTeks(a[0]);
          const mulai = waktuKonsol.get(label);
          if (mulai !== undefined) this.cetak(`${label}: ${Date.now() - mulai}ms`);
          return undefined;
        }),
      }),
    );

    const angka = this.nf("Angka", (a) => this.angka(a[0]));
    angka.taruh("adalahBulat", this.nf("adalahBulat", (a) => typeof a[0] === "number" && Number.isInteger(a[0])));
    angka.taruh("adalahNaN", this.nf("adalahNaN", (a) => typeof a[0] === "number" && Number.isNaN(a[0])));
    angka.taruh("adalahTerhingga", this.nf("adalahTerhingga", (a) => typeof a[0] === "number" && Number.isFinite(a[0])));
    angka.taruh("EPSILON", Number.EPSILON);
    angka.taruh("MAKS_AMAN", Number.MAX_SAFE_INTEGER);
    angka.taruh("MIN_AMAN", Number.MIN_SAFE_INTEGER);
    this.definisiGlobal("Angka", angka);

    const teks = this.nf("Teks", (a) => keTeks(a[0]));
    teks.taruh("dariKode", this.nf("dariKode", (a) => String.fromCodePoint(...a.map((x) => this.angka(x)))));
    this.definisiGlobal("Teks", teks);

    const larik = this.nf("Larik", (a) => new LarikInDo(a.slice()));
    larik.taruh("dari", this.nf("dari", (a) => this.larikDari(a[0], a[1])));
    larik.taruh("dari_", this.nf("dari_", (a) => new LarikInDo(a.slice())));
    larik.taruh("adalahLarik", this.nf("adalahLarik", (a) => a[0] instanceof LarikInDo));
    this.definisiGlobal("Larik", larik);

    this.definisiGlobal("Objek", this.pustakaObjek());
    this.definisiGlobal("JSON", this.pustakaJSON());

    const regex = this.nf("RegEx", (a) => new RegExInDo(new RegExp(keTeks(a[0]), a[1] === undefined ? "" : keTeks(a[1]))));
    this.definisiGlobal("RegEx", regex);

    const tanggal = this.nf("Tanggal", (a) => {
      if (a.length === 0) return new TanggalInDo(new Date());
      if (a.length === 1) return new TanggalInDo(new Date(typeof a[0] === "string" ? a[0] : this.angka(a[0])));
      return new TanggalInDo(
        new Date(
          this.angka(a[0]),
          this.angka(a[1] ?? 0),
          a[2] === undefined ? 1 : this.angka(a[2]),
          this.angka(a[3] ?? 0),
          this.angka(a[4] ?? 0),
          this.angka(a[5] ?? 0),
        ),
      );
    });
    tanggal.taruh("sekarang", this.nf("sekarang", () => Date.now()));
    this.definisiGlobal("Tanggal", tanggal);

    this.pasangRuntime();
    this.pasangKoleksi();
  }

  private konstruktorObjek(nama: string, fn: (a: Nilai[]) => Nilai): void {
    this.definisiGlobal(nama, this.nf(nama, fn));
  }

  private pasangKoleksi(): void {
    this.konstruktorObjek("Peta", (a) => {
      const p = new PetaInDo();
      if (a[0] !== undefined && a[0] !== null) {
        for (const e of this.elemenIterable(a[0])) {
          if (e instanceof LarikInDo) p.m.set(e.elemen[0], e.elemen[1]);
        }
      }
      return p;
    });
    this.konstruktorObjek("Himpunan", (a) => {
      const h = new HimpunanInDo();
      if (a[0] !== undefined && a[0] !== null) for (const e of this.elemenIterable(a[0])) h.s.add(e);
      return h;
    });
    this.konstruktorObjek("PetaLemah", () => new PetaLemahInDo());
    this.konstruktorObjek("HimpunanLemah", () => new HimpunanLemahInDo());
    this.konstruktorObjek("RefLemah", (a) => new RefLemahInDo(a[0] as object));

    this.konstruktorObjek("PenyanggaLarik", (a) => new PenyanggaLarikInDo(new ArrayBuffer(this.angka(a[0] ?? 0))));
    const jenisTa: Record<string, JenisLarikBertipe> = {
      LarikUint8: "Uint8",
      LarikInt8: "Int8",
      LarikUint16: "Uint16",
      LarikInt16: "Int16",
      LarikUint32: "Uint32",
      LarikInt32: "Int32",
      LarikFloat32: "Float32",
      LarikFloat64: "Float64",
    };
    for (const [namaGlobal, jenis] of Object.entries(jenisTa)) {
      this.konstruktorObjek(namaGlobal, (a) => this.buatLarikBertipe(jenis, a[0]));
    }

    this.konstruktorObjek("Wakil", (a) => {
      if (!(a[1] instanceof ObjekInDo)) this.galat("Penangan Wakil harus objek", "GalatTipe");
      return new WakilInDo(a[0], a[1] as ObjekInDo);
    });

    this.definisiGlobal(
      "Refleksi",
      this.objekNatif({
        ambil: this.nf("ambil", (a) => this.bacaProperti(a[0], normalisasiKunci(a[1]))),
        tetapkan: this.nf("tetapkan", (a) => {
          this.tulisProperti(a[0], normalisasiKunci(a[1]), a[2]);
          return true;
        }),
        punya: this.nf("punya", (a) => this.dalam(a[1], a[0])),
        hapus: this.nf("hapus", (a) => {
          if (a[0] instanceof ObjekInDo) return a[0].hapus(normalisasiKunci(a[1]));
          return false;
        }),
        kunci: this.nf("kunci", (a) => new LarikInDo(this.kunciObjek(a[0]))),
      }),
    );
  }

  private buatLarikBertipe(jenis: JenisLarikBertipe, arg: Nilai): LarikBertipeInDo {
    const Konstruktor = {
      Uint8: Uint8Array,
      Int8: Int8Array,
      Uint16: Uint16Array,
      Int16: Int16Array,
      Uint32: Uint32Array,
      Int32: Int32Array,
      Float32: Float32Array,
      Float64: Float64Array,
    }[jenis];
    let ta: { length: number; buffer: ArrayBuffer; [i: number]: number };
    if (arg instanceof PenyanggaLarikInDo) ta = new Konstruktor(arg.buf);
    else if (arg instanceof LarikInDo) ta = new Konstruktor(arg.elemen.map((x) => this.angka(x)));
    else ta = new Konstruktor(this.angka(arg ?? 0));
    return new LarikBertipeInDo(ta, jenis);
  }

  private metodePeta(peta: PetaInDo, nama: string): Nilai {
    const buat = (fn: (a: Nilai[]) => Nilai): FungsiNatif => new FungsiNatif(nama, -1, fn);
    switch (nama) {
      case "ukuran":
        return peta.m.size;
      case "tetapkan":
        return buat((a) => {
          peta.m.set(a[0], a[1]);
          return peta;
        });
      case "ambil":
        return buat((a) => peta.m.get(a[0]));
      case "punya":
        return buat((a) => peta.m.has(a[0]));
      case "hapus":
        return buat((a) => peta.m.delete(a[0]));
      case "bersihkan":
        return buat(() => {
          peta.m.clear();
          return undefined;
        });
      case "kunci":
        return buat(() => new LarikInDo([...peta.m.keys()]));
      case "nilai":
        return buat(() => new LarikInDo([...peta.m.values()]));
      case "entri":
        return buat(() => new LarikInDo([...peta.m.entries()].map(([k, v]) => new LarikInDo([k, v]))));
      case "untukSetiap":
        return buat((a) => {
          for (const [k, v] of peta.m) this.panggilNilai(a[0], undefined, [v, k, peta]);
          return undefined;
        });
      default:
        return undefined;
    }
  }

  private metodePetaLemah(peta: PetaLemahInDo, nama: string): Nilai {
    const buat = (fn: (a: Nilai[]) => Nilai): FungsiNatif => new FungsiNatif(nama, -1, fn);
    switch (nama) {
      case "tetapkan":
        return buat((a) => {
          if (typeof a[0] === "object" && a[0] !== null) peta.m.set(a[0] as object, a[1]);
          return peta;
        });
      case "ambil":
        return buat((a) => (typeof a[0] === "object" && a[0] !== null ? peta.m.get(a[0] as object) : undefined));
      case "punya":
        return buat((a) => typeof a[0] === "object" && a[0] !== null && peta.m.has(a[0] as object));
      case "hapus":
        return buat((a) => typeof a[0] === "object" && a[0] !== null && peta.m.delete(a[0] as object));
      default:
        return undefined;
    }
  }

  private metodeHimpunanLemah(him: HimpunanLemahInDo, nama: string): Nilai {
    const buat = (fn: (a: Nilai[]) => Nilai): FungsiNatif => new FungsiNatif(nama, -1, fn);
    switch (nama) {
      case "tambah":
        return buat((a) => {
          if (typeof a[0] === "object" && a[0] !== null) him.s.add(a[0] as object);
          return him;
        });
      case "punya":
        return buat((a) => typeof a[0] === "object" && a[0] !== null && him.s.has(a[0] as object));
      case "hapus":
        return buat((a) => typeof a[0] === "object" && a[0] !== null && him.s.delete(a[0] as object));
      default:
        return undefined;
    }
  }

  private metodeHimpunan(him: HimpunanInDo, nama: string): Nilai {
    const buat = (fn: (a: Nilai[]) => Nilai): FungsiNatif => new FungsiNatif(nama, -1, fn);
    switch (nama) {
      case "ukuran":
        return him.s.size;
      case "tambah":
        return buat((a) => {
          him.s.add(a[0]);
          return him;
        });
      case "punya":
        return buat((a) => him.s.has(a[0]));
      case "hapus":
        return buat((a) => him.s.delete(a[0]));
      case "bersihkan":
        return buat(() => {
          him.s.clear();
          return undefined;
        });
      case "nilai":
        return buat(() => new LarikInDo([...him.s.values()]));
      case "untukSetiap":
        return buat((a) => {
          for (const v of him.s) this.panggilNilai(a[0], undefined, [v, v, him]);
          return undefined;
        });
      default:
        return undefined;
    }
  }

  private pasangRuntime(): void {
    this.definisiGlobal(
      "Berkas",
      this.objekNatif({
        baca: this.nf("baca", (a) => fs.readFileSync(keTeks(a[0]), "utf8")),
        tulis: this.nf("tulis", (a) => {
          fs.writeFileSync(keTeks(a[0]), keTeks(a[1]));
          return undefined;
        }),
        tambahkan: this.nf("tambahkan", (a) => {
          fs.appendFileSync(keTeks(a[0]), keTeks(a[1]));
          return undefined;
        }),
        hapus: this.nf("hapus", (a) => {
          fs.rmSync(keTeks(a[0]), { force: true, recursive: true });
          return undefined;
        }),
        ada: this.nf("ada", (a) => fs.existsSync(keTeks(a[0]))),
        daftarIsi: this.nf("daftarIsi", (a) => new LarikInDo(fs.readdirSync(keTeks(a[0])) as Nilai[])),
        buatFolder: this.nf("buatFolder", (a) => {
          fs.mkdirSync(keTeks(a[0]), { recursive: true });
          return undefined;
        }),
        info: this.nf("info", (a) => {
          const s = fs.statSync(keTeks(a[0]));
          const o = new ObjekInDo(null);
          o.tetapkan("ukuran", s.size);
          o.tetapkan("adalahBerkas", s.isFile());
          o.tetapkan("adalahFolder", s.isDirectory());
          o.tetapkan("diubah", new TanggalInDo(s.mtime));
          return o;
        }),
      }),
    );

    this.definisiGlobal(
      "Jalur",
      this.objekNatif({
        gabung: this.nf("gabung", (a) => jalurNode.join(...a.map((x) => keTeks(x)))),
        namaBerkas: this.nf("namaBerkas", (a) => jalurNode.basename(keTeks(a[0]))),
        ekstensi: this.nf("ekstensi", (a) => jalurNode.extname(keTeks(a[0]))),
        folder: this.nf("folder", (a) => jalurNode.dirname(keTeks(a[0]))),
        absolut: this.nf("absolut", (a) => jalurNode.resolve(...a.map((x) => keTeks(x)))),
      }),
    );

    const lingkungan = new ObjekInDo(null);
    for (const [k, v] of Object.entries(process.env)) lingkungan.tetapkan(k, v ?? "");
    this.definisiGlobal(
      "Proses",
      this.objekNatif({
        argumen: new LarikInDo(process.argv.slice(2) as Nilai[]),
        lingkungan,
        folderKerja: this.nf("folderKerja", () => process.cwd()),
        keluar: this.nf("keluar", (a) => {
          process.exit(a[0] === undefined ? 0 : this.angka(a[0]));
        }),
      }),
    );

    this.definisiGlobal(
      "Kripto",
      this.objekNatif({
        acakUUID: this.nf("acakUUID", () => kripto.randomUUID()),
        hash: this.nf("hash", (a) => kripto.createHash("sha256").update(keTeks(a[0])).digest("hex")),
        byteAcak: this.nf("byteAcak", (a) => {
          const buf = kripto.randomBytes(this.angka(a[0] ?? 0));
          return new LarikInDo([...buf] as Nilai[]);
        }),
      }),
    );

    this.definisiGlobal(
      "Jaringan",
      this.objekNatif({
        ambil: this.nf("ambil", (a) => this.ambilJaringan(keTeks(a[0]), a[1])),
        buatServer: this.nf("buatServer", (a) => this.buatServer(a[0])),
      }),
    );

    this.definisiGlobal(
      "BerkasAsinkron",
      this.objekNatif({
        baca: this.nf("baca", (a) => this.bungkusReal(fs.promises.readFile(keTeks(a[0]), "utf8"))),
        tulis: this.nf("tulis", (a) => this.bungkusReal(fs.promises.writeFile(keTeks(a[0]), keTeks(a[1])), () => undefined)),
        hapus: this.nf("hapus", (a) => this.bungkusReal(fs.promises.rm(keTeks(a[0]), { force: true, recursive: true }), () => undefined)),
        daftarIsi: this.nf("daftarIsi", (a) => this.bungkusReal(fs.promises.readdir(keTeks(a[0])), (d) => new LarikInDo(d as Nilai[]))),
      }),
    );
  }

  private bungkusReal(p: Promise<unknown>, konversi: (v: unknown) => Nilai = (v) => v as Nilai): JanjiInDo {
    const janji = new JanjiInDo();
    this.mulaiReal();
    p.then(
      (v) => this.selesaikanJanji(janji, konversi(v)),
      (e) => this.tolakJanji(janji, this.buatGalat("Galat", e instanceof Error ? e.message : String(e))),
    ).finally(() => this.selesaiReal());
    return janji;
  }

  private ambilJaringan(url: string, opsi: Nilai): JanjiInDo {
    const init: { method?: string; body?: string; headers?: Record<string, string> } = {};
    if (opsi instanceof ObjekInDo) {
      const metode = opsi.ambil("metode");
      if (typeof metode === "string") init.method = metode;
      const tubuh = opsi.ambil("tubuh");
      if (typeof tubuh === "string") init.body = tubuh;
      const kepala = opsi.ambil("kepala");
      if (kepala instanceof ObjekInDo) {
        init.headers = {};
        for (const [k, v] of kepala.properti) if (typeof k === "string") init.headers[k] = keTeks(v);
      }
    }
    return this.bungkusReal(fetch(url, init), (res) => this.bungkusRespon(res as Response));
  }

  private bungkusRespon(res: Response): ObjekInDo {
    return this.objekNatif({
      status: res.status,
      ok: res.ok,
      teks: this.nf("teks", () => this.bungkusReal(res.text())),
      json: this.nf("json", () => this.bungkusReal(res.text(), (t) => this.jsonDariJS(JSON.parse(t as string)))),
    });
  }

  private buatServer(penangan: Nilai): ObjekInDo {
    const server = http.createServer((req, res) => {
      let tubuh = "";
      req.on("data", (c) => {
        tubuh += c;
      });
      req.on("end", () => {
        const permintaan = this.objekNatif({ metode: req.method ?? "GET", url: req.url ?? "/", tubuh });
        const respon = this.objekNatif({
          kirim: this.nf("kirim", (a) => {
            res.writeHead(this.angka(a[0] ?? 200), { "Content-Type": "text/plain; charset=utf-8" });
            res.end(a[1] === undefined ? "" : keTeks(a[1]));
            return undefined;
          }),
          json: this.nf("json", (a) => {
            res.writeHead(this.angka(a[0] ?? 200), { "Content-Type": "application/json; charset=utf-8" });
            res.end(this.jsonKeTeks(a[1], "", "") ?? "null");
            return undefined;
          }),
        });
        try {
          this.panggilNilai(penangan, undefined, [permintaan, respon]);
        } catch (galat) {
          if (galat instanceof LemparInDo) {
            res.writeHead(500);
            res.end("Galat server");
          } else {
            throw galat;
          }
        }
        this.kurasMikro();
      });
    });
    this.serverAktif.push({ tutup: () => server.close() });
    const objekServer = this.objekNatif({
      dengar: this.nf("dengar", (a) => {
        server.listen(this.angka(a[0] ?? 0));
        if (this.adalahDapatDipanggil(a[1])) this.panggilNilai(a[1], undefined, []);
        return objekServer;
      }),
      tutup: this.nf("tutup", () => {
        server.close();
        return undefined;
      }),
      alamat: this.nf("alamat", () => {
        const a = server.address();
        return a !== null && typeof a === "object" ? a.port : 0;
      }),
    });
    return objekServer;
  }

  private larikDari(sumber: Nilai, pemeta: Nilai): LarikInDo {
    const elemen = this.elemenIterable(sumber);
    if (this.adalahDapatDipanggil(pemeta)) {
      return new LarikInDo(elemen.map((x, i) => this.panggilNilai(pemeta, undefined, [x, i])));
    }
    return new LarikInDo(elemen);
  }

  private pustakaObjek(): ObjekInDo {
    return this.objekNatif({
      kunci: this.nf("kunci", (a) => new LarikInDo(this.kunciObjek(a[0]))),
      nilai: this.nf("nilai", (a) => new LarikInDo(this.nilaiObjek(a[0]))),
      entri: this.nf("entri", (a) => new LarikInDo(this.entriObjek(a[0]))),
      dariEntri: this.nf("dariEntri", (a) => {
        const o = new ObjekInDo(null);
        for (const e of this.elemenIterable(a[0])) {
          if (e instanceof LarikInDo) o.tetapkan(normalisasiKunci(e.elemen[0]), e.elemen[1]);
        }
        return o;
      }),
      tetapkan: this.nf("tetapkan", (a) => {
        const target = a[0];
        if (target instanceof ObjekInDo) {
          for (let i = 1; i < a.length; i += 1) {
            const s = a[i];
            if (s instanceof ObjekInDo) for (const [k, v] of s.properti) target.tetapkan(k, v);
          }
        }
        return target;
      }),
      bekukan: this.nf("bekukan", (a) => {
        if (a[0] instanceof ObjekInDo) a[0].dibekukan = true;
        return a[0];
      }),
      adalahBeku: this.nf("adalahBeku", (a) => a[0] instanceof ObjekInDo && a[0].dibekukan),
      segel: this.nf("segel", (a) => {
        if (a[0] instanceof ObjekInDo) a[0].disegel = true;
        return a[0];
      }),
      buat: this.nf("buat", (a) => new ObjekInDo(a[0] instanceof ObjekInDo ? a[0] : null)),
      ambilPrototipe: this.nf("ambilPrototipe", (a) => (a[0] instanceof ObjekInDo ? a[0].prototipe : null)),
      aturPrototipe: this.nf("aturPrototipe", (a) => {
        if (a[0] instanceof ObjekInDo) a[0].prototipe = a[1] instanceof ObjekInDo ? a[1] : null;
        return a[0];
      }),
      milikSendiri: this.nf("milikSendiri", (a) => a[0] instanceof ObjekInDo && a[0].punyaSendiri(normalisasiKunci(a[1]))),
    });
  }

  private kunciObjek(objek: Nilai): Nilai[] {
    if (objek instanceof ObjekInDo) return [...objek.properti.keys()].filter((k) => typeof k === "string") as Nilai[];
    if (objek instanceof LarikInDo) return objek.elemen.map((_x, i) => String(i));
    return [];
  }

  private nilaiObjek(objek: Nilai): Nilai[] {
    if (objek instanceof ObjekInDo) {
      const hasil: Nilai[] = [];
      for (const [k, v] of objek.properti) if (typeof k === "string") hasil.push(v);
      return hasil;
    }
    if (objek instanceof LarikInDo) return objek.elemen.slice();
    return [];
  }

  private entriObjek(objek: Nilai): Nilai[] {
    if (objek instanceof ObjekInDo) {
      const hasil: Nilai[] = [];
      for (const [k, v] of objek.properti) if (typeof k === "string") hasil.push(new LarikInDo([k, v]));
      return hasil;
    }
    if (objek instanceof LarikInDo) return objek.elemen.map((x, i) => new LarikInDo([String(i), x]));
    return [];
  }

  private pustakaJSON(): ObjekInDo {
    return this.objekNatif({
      teks: this.nf("teks", (a) => {
        const indent = typeof a[2] === "number" ? " ".repeat(a[2]) : typeof a[2] === "string" ? a[2] : "";
        const hasil = this.jsonKeTeks(a[0], indent, "");
        return hasil === undefined ? undefined : hasil;
      }),
      urai: this.nf("urai", (a) => this.jsonDariJS(JSON.parse(keTeks(a[0])))),
    });
  }

  private jsonKeTeks(nilai: Nilai, indent: string, lekuk: string): string | undefined {
    if (nilai === null) return "null";
    if (typeof nilai === "boolean") return nilai ? "true" : "false";
    if (typeof nilai === "number") return Number.isFinite(nilai) ? String(nilai) : "null";
    if (typeof nilai === "string") return JSON.stringify(nilai);
    if (typeof nilai === "bigint") return String(nilai);
    if (nilai === undefined) return undefined;
    if (this.adalahDapatDipanggil(nilai) || typeof nilai === "symbol") return undefined;
    const lekukDalam = lekuk + indent;
    const pemisah = indent === "" ? "," : ",\n" + lekukDalam;
    const buka = indent === "" ? "" : "\n" + lekukDalam;
    const tutup = indent === "" ? "" : "\n" + lekuk;
    if (nilai instanceof LarikInDo) {
      if (nilai.elemen.length === 0) return "[]";
      const isi = nilai.elemen.map((x) => this.jsonKeTeks(x, indent, lekukDalam) ?? "null");
      return "[" + buka + isi.join(pemisah) + tutup + "]";
    }
    if (nilai instanceof ObjekInDo) {
      const bagian: string[] = [];
      for (const [k, v] of nilai.properti) {
        if (typeof k !== "string") continue;
        const teksNilai = this.jsonKeTeks(v, indent, lekukDalam);
        if (teksNilai === undefined) continue;
        bagian.push(JSON.stringify(k) + (indent === "" ? ":" : ": ") + teksNilai);
      }
      if (bagian.length === 0) return "{}";
      return "{" + buka + bagian.join(pemisah) + tutup + "}";
    }
    return undefined;
  }

  private jsonDariJS(nilai: unknown): Nilai {
    if (nilai === null) return null;
    if (Array.isArray(nilai)) return new LarikInDo(nilai.map((x) => this.jsonDariJS(x)));
    if (typeof nilai === "object") {
      const objek = new ObjekInDo(null);
      for (const [k, v] of Object.entries(nilai as Record<string, unknown>)) objek.tetapkan(k, this.jsonDariJS(v));
      return objek;
    }
    return nilai as Nilai;
  }

  private pasangJanjiDanTimer(): void {
    const janjiNatif = new FungsiNatif("Janji", 1, (argumen) => {
      const executor = argumen[0];
      const janji = new JanjiInDo();
      const selesaikan = new FungsiNatif("selesaikan", 1, (a) => {
        this.selesaikanJanji(janji, a[0]);
        return undefined;
      });
      const tolak = new FungsiNatif("tolak", 1, (a) => {
        this.tolakJanji(janji, a[0]);
        return undefined;
      });
      try {
        this.panggilNilai(executor, undefined, [selesaikan, tolak]);
      } catch (galat) {
        if (galat instanceof LemparInDo) this.tolakJanji(janji, galat.nilai as Nilai);
        else throw galat;
      }
      return janji;
    });
    janjiNatif.taruh("selesaikan", new FungsiNatif("selesaikan", 1, (a) => this.keJanji(a[0])));
    janjiNatif.taruh(
      "tolak",
      new FungsiNatif("tolak", 1, (a) => {
        const j = new JanjiInDo();
        this.tolakJanji(j, a[0]);
        return j;
      }),
    );
    janjiNatif.taruh("semua", new FungsiNatif("semua", 1, (a) => this.janjiSemua(a[0])));
    janjiNatif.taruh("semuaSelesai", new FungsiNatif("semuaSelesai", 1, (a) => this.janjiSemuaSelesai(a[0])));
    janjiNatif.taruh("salahSatu", new FungsiNatif("salahSatu", 1, (a) => this.janjiSalahSatu(a[0])));
    janjiNatif.taruh("balapan", new FungsiNatif("balapan", 1, (a) => this.janjiBalapan(a[0])));
    this.definisiGlobal("Janji", janjiNatif);

    this.definisiGlobal(
      "aturWaktu",
      new FungsiNatif("aturWaktu", -1, (a) => this.buatTimer(a[0], typeof a[1] === "number" ? a[1] : 0, a.slice(2), -1)),
    );
    this.definisiGlobal(
      "aturInterval",
      new FungsiNatif("aturInterval", -1, (a) => this.buatTimer(a[0], typeof a[1] === "number" ? a[1] : 0, a.slice(2), typeof a[1] === "number" ? a[1] : 0)),
    );
    this.definisiGlobal("hapusWaktu", new FungsiNatif("hapusWaktu", 1, (a) => this.batalkanTimer(a[0])));
    this.definisiGlobal("hapusInterval", new FungsiNatif("hapusInterval", 1, (a) => this.batalkanTimer(a[0])));
    this.definisiGlobal(
      "antrekanMikro",
      new FungsiNatif("antrekanMikro", 1, (a) => {
        const fn = a[0];
        this.jadwalkanMikro(() => this.panggilNilai(fn, undefined, []));
        return undefined;
      }),
    );
  }

  private buatTimer(fungsi: Nilai, ms: number, argumen: Nilai[], interval: number): number {
    const id = this.idTimerBerikut++;
    this.timer.push({ id, waktuJatuh: this.jamMaya + Math.max(0, ms), fungsi, argumen, interval, dibatalkan: false });
    return id;
  }

  private batalkanTimer(id: Nilai): undefined {
    for (const t of this.timer) {
      if (t.id === id) t.dibatalkan = true;
    }
    return undefined;
  }

  private adalahDapatDipanggil(v: Nilai): boolean {
    return v instanceof Penutup || v instanceof FungsiNatif;
  }

  private janjiLalu(janji: JanjiInDo, onPenuh: Nilai, onTolak: Nilai): JanjiInDo {
    const hasil = new JanjiInDo();
    this.tambahReaksi(
      janji,
      (nilai) => {
        if (this.adalahDapatDipanggil(onPenuh)) {
          try {
            this.selesaikanJanji(hasil, this.panggilNilai(onPenuh, undefined, [nilai]));
          } catch (galat) {
            if (galat instanceof LemparInDo) this.tolakJanji(hasil, galat.nilai as Nilai);
            else throw galat;
          }
        } else {
          this.selesaikanJanji(hasil, nilai);
        }
      },
      (alasan) => {
        if (this.adalahDapatDipanggil(onTolak)) {
          try {
            this.selesaikanJanji(hasil, this.panggilNilai(onTolak, undefined, [alasan]));
          } catch (galat) {
            if (galat instanceof LemparInDo) this.tolakJanji(hasil, galat.nilai as Nilai);
            else throw galat;
          }
        } else {
          this.tolakJanji(hasil, alasan);
        }
      },
    );
    return hasil;
  }

  private elemenIterable(nilai: Nilai): Nilai[] {
    if (nilai instanceof LarikInDo) return nilai.elemen.slice();
    const it = this.buatIterator(nilai);
    const hasil: Nilai[] = [];
    for (;;) {
      const r = this.lanjutIterator(it);
      if (r.selesai) break;
      hasil.push(r.nilai);
    }
    return hasil;
  }

  private janjiSemua(iterable: Nilai): JanjiInDo {
    const hasil = new JanjiInDo();
    const daftar = this.elemenIterable(iterable);
    const nilai: Nilai[] = new Array(daftar.length);
    let sisa = daftar.length;
    if (sisa === 0) this.selesaikanJanji(hasil, new LarikInDo([]));
    daftar.forEach((item, i) => {
      this.tambahReaksi(
        this.keJanji(item),
        (v) => {
          nilai[i] = v;
          sisa -= 1;
          if (sisa === 0) this.selesaikanJanji(hasil, new LarikInDo(nilai));
        },
        (e) => this.tolakJanji(hasil, e),
      );
    });
    return hasil;
  }

  private janjiSemuaSelesai(iterable: Nilai): JanjiInDo {
    const hasil = new JanjiInDo();
    const daftar = this.elemenIterable(iterable);
    const nilai: Nilai[] = new Array(daftar.length);
    let sisa = daftar.length;
    if (sisa === 0) this.selesaikanJanji(hasil, new LarikInDo([]));
    daftar.forEach((item, i) => {
      this.tambahReaksi(
        this.keJanji(item),
        (v) => {
          const o = new ObjekInDo(null);
          o.tetapkan("keadaan", "terpenuhi");
          o.tetapkan("nilai", v);
          nilai[i] = o;
          sisa -= 1;
          if (sisa === 0) this.selesaikanJanji(hasil, new LarikInDo(nilai));
        },
        (e) => {
          const o = new ObjekInDo(null);
          o.tetapkan("keadaan", "tertolak");
          o.tetapkan("alasan", e);
          nilai[i] = o;
          sisa -= 1;
          if (sisa === 0) this.selesaikanJanji(hasil, new LarikInDo(nilai));
        },
      );
    });
    return hasil;
  }

  private janjiSalahSatu(iterable: Nilai): JanjiInDo {
    const hasil = new JanjiInDo();
    const daftar = this.elemenIterable(iterable);
    const alasan: Nilai[] = new Array(daftar.length);
    let sisa = daftar.length;
    if (sisa === 0) this.tolakJanji(hasil, this.buatGalat("GalatAgregat", "Semua janji ditolak"));
    daftar.forEach((item, i) => {
      this.tambahReaksi(
        this.keJanji(item),
        (v) => this.selesaikanJanji(hasil, v),
        (e) => {
          alasan[i] = e;
          sisa -= 1;
          if (sisa === 0) this.tolakJanji(hasil, this.buatGalat("GalatAgregat", "Semua janji ditolak"));
        },
      );
    });
    return hasil;
  }

  private janjiBalapan(iterable: Nilai): JanjiInDo {
    const hasil = new JanjiInDo();
    for (const item of this.elemenIterable(iterable)) {
      this.tambahReaksi(
        this.keJanji(item),
        (v) => this.selesaikanJanji(hasil, v),
        (e) => this.tolakJanji(hasil, e),
      );
    }
    return hasil;
  }

  async jalankanEventLoop(): Promise<void> {
    this.kurasMikro();
    for (;;) {
      while (this.timer.some((t) => !t.dibatalkan)) {
        let terpilih = -1;
        for (let i = 0; i < this.timer.length; i += 1) {
          const t = this.timer[i]!;
          if (t.dibatalkan) continue;
          if (
            terpilih === -1 ||
            t.waktuJatuh < this.timer[terpilih]!.waktuJatuh ||
            (t.waktuJatuh === this.timer[terpilih]!.waktuJatuh && t.id < this.timer[terpilih]!.id)
          ) {
            terpilih = i;
          }
        }
        if (terpilih === -1) break;
        const t = this.timer[terpilih]!;
        this.timer.splice(terpilih, 1);
        this.jamMaya = Math.max(this.jamMaya, t.waktuJatuh);
        try {
          this.panggilNilai(t.fungsi, undefined, t.argumen);
        } catch (galat) {
          if (galat instanceof LemparInDo) this.laporGalatTakTertangani(galat.nilai as Nilai);
          else throw galat;
        }
        if (t.interval >= 0 && !t.dibatalkan) {
          this.timer.push({ ...t, waktuJatuh: this.jamMaya + Math.max(1, t.interval) });
        }
        this.kurasMikro();
      }
      if (this.realTertunda === 0) break;
      await new Promise<void>((res) => {
        this.pemicuReal = res;
      });
      this.pemicuReal = null;
      this.kurasMikro();
    }
    this.laporPenolakanTakTertangani();
  }

  private mulaiReal(): void {
    this.realTertunda += 1;
  }

  private selesaiReal(): void {
    this.realTertunda -= 1;
    if (this.pemicuReal) this.pemicuReal();
  }

  tutupServer(): void {
    for (const s of this.serverAktif) s.tutup();
    this.serverAktif.length = 0;
  }

  private kurasMikro(): void {
    while (this.mikrotask.length > 0) {
      const tugas = this.mikrotask.shift()!;
      try {
        tugas();
      } catch (galat) {
        if (galat instanceof LemparInDo) this.laporGalatTakTertangani(galat.nilai as Nilai);
        else throw galat;
      }
    }
  }

  private laporPenolakanTakTertangani(): void {
    for (const janji of this.penolakanTakTertangani) {
      if (!janji.ditangani) this.laporGalatTakTertangani(janji.nilai, "Janji ditolak tanpa penanganan");
    }
    this.penolakanTakTertangani.clear();
  }

  private laporGalatTakTertangani(nilai: Nilai, awalan = "Galat tak tertangani"): void {
    this.galatTerjadi = true;
    if (nilai instanceof ObjekInDo) {
      const nama = nilai.ambil("nama");
      const pesan = nilai.ambil("pesan");
      if (typeof nama === "string") {
        this.galatKeluar(`${awalan}: ${nama}${pesan !== undefined && pesan !== "" ? ": " + keTeks(pesan) : ""}`);
        return;
      }
    }
    this.galatKeluar(`${awalan}: ${keTeks(nilai)}`);
  }

  private panggilNilai(fungsi: Nilai, ini: Nilai, argumen: Nilai[]): Nilai {
    if (fungsi instanceof Penutup) return this.panggilTertutup(fungsi, ini, argumen);
    if (fungsi instanceof FungsiNatif) return fungsi.fungsi(argumen);
    this.galat(`Nilai bertipe "${jenisNilai(fungsi)}" tidak dapat dipanggil`, "GalatTipe");
  }

  private buatIterator(iterable: Nilai): IteratorInDo {
    if (iterable instanceof GeneratorInDo) {
      const it = new IteratorInDo("generator");
      it.generator = iterable;
      return it;
    }
    if (iterable instanceof PetaInDo) {
      const it = new IteratorInDo("larik");
      it.sumber = new LarikInDo([...iterable.m.entries()].map(([k, v]) => new LarikInDo([k, v])));
      return it;
    }
    if (iterable instanceof HimpunanInDo) {
      const it = new IteratorInDo("larik");
      it.sumber = new LarikInDo([...iterable.s.values()]);
      return it;
    }
    if (iterable instanceof LarikBertipeInDo) {
      const it = new IteratorInDo("larik");
      const nilai: Nilai[] = [];
      for (let i = 0; i < iterable.ta.length; i += 1) nilai.push(iterable.ta[i]!);
      it.sumber = new LarikInDo(nilai);
      return it;
    }
    if (iterable instanceof LarikInDo) {
      const it = new IteratorInDo("larik");
      it.sumber = iterable;
      return it;
    }
    if (typeof iterable === "string") {
      const it = new IteratorInDo("teks");
      it.teks = iterable;
      return it;
    }
    if (iterable instanceof ObjekInDo) {
      const metode = iterable.ambil(SIMBOL_ITERATOR);
      if (metode !== undefined && metode !== null) {
        const objekIter = this.panggilNilai(metode, iterable, []);
        if (!(objekIter instanceof ObjekInDo)) {
          this.galat("Metode Simbol.iterator harus mengembalikan objek iterator", "GalatTipe");
        }
        const it = new IteratorInDo("objek");
        it.objekIter = objekIter as ObjekInDo;
        return it;
      }
    }
    this.galat(`Nilai bertipe "${jenisNilai(iterable)}" tidak dapat diiterasi`, "GalatTipe");
  }

  private lanjutIterator(it: IteratorInDo): { nilai: Nilai; selesai: boolean } {
    if (it.jenis === "larik") {
      const larik = it.sumber!;
      if (it.indeks >= larik.elemen.length) return { nilai: undefined, selesai: true };
      return { nilai: larik.elemen[it.indeks++], selesai: false };
    }
    if (it.jenis === "teks") {
      const karakter = [...it.teks];
      if (it.indeks >= karakter.length) return { nilai: undefined, selesai: true };
      return { nilai: karakter[it.indeks++]!, selesai: false };
    }
    if (it.jenis === "generator") {
      return this.jalankanGenerator(it.generator!, undefined);
    }
    const objek = it.objekIter!;
    const metodeLanjut = objek.ambil("lanjut");
    const hasil = this.panggilNilai(metodeLanjut, objek, []);
    if (!(hasil instanceof ObjekInDo)) this.galat("Metode 'lanjut' harus mengembalikan objek", "GalatTipe");
    return { nilai: hasil.ambil("nilai"), selesai: !!hasil.ambil("selesai") };
  }

  private buatIteratorAsync(iterable: Nilai): IteratorInDo {
    if (iterable instanceof ObjekInDo) {
      const metode = iterable.ambil(SIMBOL_ITERATOR_ASINKRON);
      if (metode !== undefined && metode !== null) {
        const objekIter = this.panggilNilai(metode, iterable, []);
        if (!(objekIter instanceof ObjekInDo)) {
          this.galat("Metode Simbol.iteratorAsinkron harus mengembalikan objek iterator", "GalatTipe");
        }
        const it = new IteratorInDo("objek-async");
        it.objekIter = objekIter as ObjekInDo;
        return it;
      }
    }
    return this.buatIterator(iterable);
  }

  private buatHasilIter(nilai: Nilai, selesai: boolean): ObjekInDo {
    const o = new ObjekInDo(null);
    o.tetapkan("nilai", nilai);
    o.tetapkan("selesai", selesai);
    return o;
  }

  private lanjutIteratorAsync(it: IteratorInDo): JanjiInDo {
    const keluaran = new JanjiInDo();
    const selesaikanDenganNilai = (nilai: Nilai): void => {
      const janjiNilai = this.keJanji(nilai);
      this.tambahReaksi(
        janjiNilai,
        (v) => this.selesaikanJanji(keluaran, this.buatHasilIter(v, false)),
        (e) => this.tolakJanji(keluaran, e),
      );
    };
    if (it.jenis === "objek-async") {
      const objek = it.objekIter!;
      const metodeLanjut = objek.ambil("lanjut");
      let janjiLanjut: JanjiInDo;
      try {
        janjiLanjut = this.keJanji(this.panggilNilai(metodeLanjut, objek, []));
      } catch (galat) {
        if (galat instanceof LemparInDo) {
          this.tolakJanji(keluaran, galat.nilai as Nilai);
          return keluaran;
        }
        throw galat;
      }
      this.tambahReaksi(
        janjiLanjut,
        (hasil) => {
          if (!(hasil instanceof ObjekInDo)) {
            this.tolakJanji(keluaran, this.buatGalat("GalatTipe", "Metode 'lanjut' asinkron harus mengembalikan objek"));
            return;
          }
          if (hasil.ambil("selesai")) this.selesaikanJanji(keluaran, this.buatHasilIter(undefined, true));
          else selesaikanDenganNilai(hasil.ambil("nilai"));
        },
        (e) => this.tolakJanji(keluaran, e),
      );
      return keluaran;
    }
    let r: { nilai: Nilai; selesai: boolean };
    try {
      r = this.lanjutIterator(it);
    } catch (galat) {
      if (galat instanceof LemparInDo) {
        this.tolakJanji(keluaran, galat.nilai as Nilai);
        return keluaran;
      }
      throw galat;
    }
    if (r.selesai) this.selesaikanJanji(keluaran, this.buatHasilIter(undefined, true));
    else selesaikanDenganNilai(r.nilai);
    return keluaran;
  }

  private kunciDalam(objek: Nilai): LarikInDo {
    if (objek instanceof LarikInDo) {
      const kunci: Nilai[] = [];
      for (let i = 0; i < objek.elemen.length; i += 1) kunci.push(String(i));
      return new LarikInDo(kunci);
    }
    if (objek instanceof ObjekInDo) {
      const kunci: Nilai[] = [];
      for (const k of objek.properti.keys()) {
        if (typeof k === "string") kunci.push(k);
      }
      return new LarikInDo(kunci);
    }
    return new LarikInDo([]);
  }

  jalankan(fungsi: FungsiKompilasi): Nilai {
    const penutup = new Penutup(fungsi);
    this.tumpukan.push(penutup);
    this.bingkai.push({ penutup, ip: 0, basis: 0, generator: null });
    return this.loop(0);
  }

  panggilTertutup(penutup: Penutup, ini: Nilai, argumen: Nilai[]): Nilai {
    const basis = this.tumpukan.length;
    this.tumpukan.push(ini);
    for (const arg of argumen) this.tumpukan.push(arg);
    const batas = this.bingkai.length;
    this.siapkanBingkaiPenutup(penutup, basis, argumen.length);
    return this.loop(batas);
  }

  private puncakBingkai(): Bingkai {
    return this.bingkai[this.bingkai.length - 1]!;
  }

  private galat(pesan: string, namaKelas = "Galat"): never {
    if (this.siapGalat && this.global.has(namaKelas)) {
      throw new LemparInDo(this.buatGalat(namaKelas, pesan));
    }
    const b = this.puncakBingkai();
    const potongan = b.penutup.fungsi.potongan;
    const garis = potongan.garis[Math.max(0, b.ip - 1)] ?? 0;
    throw new GalatEksekusi(pesan, potongan.namaBerkas, garis, this.jejakTumpukan());
  }

  buatGalat(namaKelas: string, pesan: string): ObjekInDo {
    const kelas = this.global.get(namaKelas);
    let objek: ObjekInDo;
    if (kelas instanceof KelasInDo) {
      objek = new ObjekInDo(kelas.prototipeInstance);
      objek.kelasNama = kelas.namaKelas;
    } else {
      objek = new ObjekInDo(null);
      objek.kelasNama = namaKelas;
    }
    objek.tetapkan("nama", namaKelas);
    objek.tetapkan("pesan", pesan);
    objek.tetapkan("tumpukan", this.jejakTumpukan());
    objek.tetapkan("sebab", undefined);
    return objek;
  }

  jejakTumpukan(): string {
    const baris: string[] = [];
    for (let i = this.bingkai.length - 1; i >= 0; i -= 1) {
      const b = this.bingkai[i]!;
      const fungsi = b.penutup.fungsi;
      const garis = fungsi.potongan.garis[Math.max(0, b.ip - 1)] ?? 0;
      baris.push(`  di ${fungsi.nama || "anonim"} (${fungsi.potongan.namaBerkas}:${garis})`);
    }
    return baris.join("\n");
  }

  private tanganiLempar(nilai: Nilai, batas: number): boolean {
    while (this.penangan.length > 0) {
      const h = this.penangan[this.penangan.length - 1]!;
      if (h.kedalamanBingkai <= batas) return false;
      this.penangan.pop();
      while (this.bingkai.length > h.kedalamanBingkai) {
        const b = this.bingkai[this.bingkai.length - 1]!;
        this.tutupUpvalueSampai(b.basis);
        this.bingkai.pop();
      }
      this.tumpukan.length = h.kedalamanTumpukan;
      this.tumpukan.push(nilai);
      this.puncakBingkai().ip = h.addr;
      return true;
    }
    return false;
  }

  private loop(batas: number): Nilai {
    for (;;) {
      try {
        return this.eksekusi(batas);
      } catch (galat) {
        if (galat instanceof LemparInDo && this.tanganiLempar(galat.nilai as Nilai, batas)) {
          continue;
        }
        throw galat;
      }
    }
  }

  private eksekusi(batas: number): Nilai {
    let bingkai = this.puncakBingkai();
    let kode = bingkai.penutup.fungsi.potongan.kode;
    let konstanta = bingkai.penutup.fungsi.potongan.konstanta;

    for (;;) {
      const instruksi = kode[bingkai.ip++] as Op;
      switch (instruksi) {
        case Op.Konstanta:
          this.tumpukan.push(konstanta[kode[bingkai.ip++]!]!);
          break;
        case Op.Kosong:
          this.tumpukan.push(null);
          break;
        case Op.Taktentu:
          this.tumpukan.push(undefined);
          break;
        case Op.Benar:
          this.tumpukan.push(true);
          break;
        case Op.Salah:
          this.tumpukan.push(false);
          break;
        case Op.Nol:
          this.tumpukan.push(0);
          break;
        case Op.Satu:
          this.tumpukan.push(1);
          break;
        case Op.Pop:
          this.tumpukan.pop();
          break;
        case Op.Gandakan:
          this.tumpukan.push(this.tumpukan[this.tumpukan.length - 1]!);
          break;
        case Op.Gandakan2: {
          const n = this.tumpukan.length;
          this.tumpukan.push(this.tumpukan[n - 2]!);
          this.tumpukan.push(this.tumpukan[n - 1]!);
          break;
        }
        case Op.Tukar: {
          const n = this.tumpukan.length;
          const a = this.tumpukan[n - 1]!;
          this.tumpukan[n - 1] = this.tumpukan[n - 2]!;
          this.tumpukan[n - 2] = a;
          break;
        }
        case Op.BacaLokal:
          this.tumpukan.push(this.tumpukan[bingkai.basis + kode[bingkai.ip++]!]!);
          break;
        case Op.TulisLokal:
          this.tumpukan[bingkai.basis + kode[bingkai.ip++]!] = this.tumpukan[this.tumpukan.length - 1]!;
          break;
        case Op.BacaGlobal: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          if (!this.global.has(nama)) this.galat(`Variabel "${nama}" belum didefinisikan`, "GalatReferensi");
          this.tumpukan.push(this.global.get(nama)!);
          break;
        }
        case Op.DefinisiGlobal: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          this.global.set(nama, this.tumpukan.pop()!);
          break;
        }
        case Op.TulisGlobal: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          if (!this.global.has(nama)) this.galat(`Variabel "${nama}" belum didefinisikan`, "GalatReferensi");
          this.global.set(nama, this.tumpukan[this.tumpukan.length - 1]!);
          break;
        }
        case Op.BacaUpvalue: {
          const upvalue = bingkai.penutup.upvalue[kode[bingkai.ip++]!]!;
          this.tumpukan.push(upvalue.tertutup ? upvalue.nilai : this.tumpukan[upvalue.slot]!);
          break;
        }
        case Op.TulisUpvalue: {
          const upvalue = bingkai.penutup.upvalue[kode[bingkai.ip++]!]!;
          const nilai = this.tumpukan[this.tumpukan.length - 1]!;
          if (upvalue.tertutup) upvalue.nilai = nilai;
          else this.tumpukan[upvalue.slot] = nilai;
          break;
        }
        case Op.TutupUpvalue:
          this.tutupUpvalueSampai(this.tumpukan.length - 1);
          this.tumpukan.pop();
          break;
        case Op.Tambah:
          this.binerTambah();
          break;
        case Op.Kurang:
          this.binerAngka(instruksi);
          break;
        case Op.Kali:
          this.binerAngka(instruksi);
          break;
        case Op.Bagi:
          this.binerAngka(instruksi);
          break;
        case Op.Sisa:
          this.binerAngka(instruksi);
          break;
        case Op.Pangkat:
          this.binerAngka(instruksi);
          break;
        case Op.Dan:
        case Op.Atau:
        case Op.Xor:
        case Op.GeserKiri:
        case Op.GeserKanan:
        case Op.GeserKananNol:
          this.binerBitwise(instruksi);
          break;
        case Op.SamaDengan: {
          const b = this.tumpukan.pop()!;
          const a = this.tumpukan.pop()!;
          this.tumpukan.push(samaKetat(a, b));
          break;
        }
        case Op.TidakSama: {
          const b = this.tumpukan.pop()!;
          const a = this.tumpukan.pop()!;
          this.tumpukan.push(!samaKetat(a, b));
          break;
        }
        case Op.KurangDari:
        case Op.LebihDari:
        case Op.KurangSamaDari:
        case Op.LebihSamaDari:
          this.binerBanding(instruksi);
          break;
        case Op.Negasi: {
          const a = this.tumpukan.pop()!;
          if (typeof a === "bigint") this.tumpukan.push(-a);
          else this.tumpukan.push(-this.keAngka(a));
          break;
        }
        case Op.Positif:
          this.tumpukan.push(this.keAngka(this.tumpukan.pop()!));
          break;
        case Op.Bukan:
          this.tumpukan.push(!benarKah(this.tumpukan.pop()!));
          break;
        case Op.Tilde: {
          const a = this.tumpukan.pop()!;
          if (typeof a === "bigint") this.tumpukan.push(~a);
          else this.tumpukan.push(~this.keAngka(a));
          break;
        }
        case Op.JenisDari:
          this.tumpukan.push(jenisNilai(this.tumpukan.pop()!));
          break;
        case Op.ContohDari: {
          const kelas = this.tumpukan.pop()!;
          const nilai = this.tumpukan.pop()!;
          this.tumpukan.push(this.contohDari(nilai, kelas));
          break;
        }
        case Op.Dalam: {
          const objek = this.tumpukan.pop()!;
          const kunci = this.tumpukan.pop()!;
          this.tumpukan.push(this.dalam(kunci, objek));
          break;
        }
        case Op.Lompat:
          bingkai.ip = kode[bingkai.ip]!;
          break;
        case Op.LompatJikaSalah:
          if (!benarKah(this.tumpukan[this.tumpukan.length - 1]!)) bingkai.ip = kode[bingkai.ip]!;
          else bingkai.ip += 1;
          break;
        case Op.LompatJikaBenar:
          if (benarKah(this.tumpukan[this.tumpukan.length - 1]!)) bingkai.ip = kode[bingkai.ip]!;
          else bingkai.ip += 1;
          break;
        case Op.LompatJikaKosong: {
          const atas = this.tumpukan[this.tumpukan.length - 1]!;
          if (atas === null || atas === undefined) bingkai.ip = kode[bingkai.ip]!;
          else bingkai.ip += 1;
          break;
        }
        case Op.LompatJikaTaktentu: {
          if (this.tumpukan[this.tumpukan.length - 1] === undefined) bingkai.ip = kode[bingkai.ip]!;
          else bingkai.ip += 1;
          break;
        }
        case Op.LarikSisa: {
          const mulai = kode[bingkai.ip++]!;
          const sumber = this.tumpukan.pop()!;
          this.tumpukan.push(this.irisSisa(sumber, mulai));
          break;
        }
        case Op.LompatBalik:
          bingkai.ip = kode[bingkai.ip]!;
          break;
        case Op.Panggil: {
          const jumlah = kode[bingkai.ip++]!;
          this.panggil(jumlah, false);
          bingkai = this.puncakBingkai();
          kode = bingkai.penutup.fungsi.potongan.kode;
          konstanta = bingkai.penutup.fungsi.potongan.konstanta;
          break;
        }
        case Op.PanggilDenganIni: {
          const jumlah = kode[bingkai.ip++]!;
          this.panggil(jumlah, true);
          bingkai = this.puncakBingkai();
          kode = bingkai.penutup.fungsi.potongan.kode;
          konstanta = bingkai.penutup.fungsi.potongan.konstanta;
          break;
        }
        case Op.LarikBaru:
          this.tumpukan.push(new LarikInDo([]));
          break;
        case Op.LarikTambah: {
          const nilai = this.tumpukan.pop()!;
          (this.tumpukan[this.tumpukan.length - 1] as LarikInDo).elemen.push(nilai);
          break;
        }
        case Op.LarikSebar: {
          const sumber = this.tumpukan.pop()!;
          const larik = this.tumpukan[this.tumpukan.length - 1] as LarikInDo;
          this.sebarKeLarik(sumber, larik);
          break;
        }
        case Op.ObjekBaru:
          this.tumpukan.push(new ObjekInDo());
          break;
        case Op.ObjekProp: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          const nilai = this.tumpukan.pop()!;
          (this.tumpukan[this.tumpukan.length - 1] as ObjekInDo).tetapkan(nama, nilai);
          break;
        }
        case Op.ObjekPropDinamis: {
          const nilai = this.tumpukan.pop()!;
          const kunci = this.tumpukan.pop()!;
          (this.tumpukan[this.tumpukan.length - 1] as ObjekInDo).tetapkan(normalisasiKunci(kunci), nilai);
          break;
        }
        case Op.ObjekSebar: {
          const sumber = this.tumpukan.pop()!;
          this.sebarKeObjek(sumber, this.tumpukan[this.tumpukan.length - 1] as ObjekInDo);
          break;
        }
        case Op.BacaProperti: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          const objek = this.tumpukan.pop()!;
          this.tumpukan.push(this.bacaProperti(objek, nama));
          break;
        }
        case Op.KelasBaru: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          this.tumpukan.push(new KelasInDo(nama, null));
          break;
        }
        case Op.WarisiKelas: {
          const induk = this.tumpukan.pop()!;
          const kelas = this.tumpukan[this.tumpukan.length - 1] as KelasInDo;
          if (!(induk instanceof KelasInDo)) this.galat(`Hanya kelas yang bisa diwarisi, bukan ${jenisNilai(induk)}`);
          kelas.indukKelas = induk;
          kelas.prototipe = induk;
          kelas.prototipeInstance.prototipe = induk.prototipeInstance;
          break;
        }
        case Op.MetodeKelas: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          const bendera = kode[bingkai.ip++]!;
          const fungsi = this.tumpukan.pop()!;
          const kelas = this.tumpukan[this.tumpukan.length - 1] as KelasInDo;
          this.pasangMetodeKelas(kelas, nama, fungsi, bendera);
          break;
        }
        case Op.FieldInstance: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          const inisiator = this.tumpukan.pop()!;
          (this.tumpukan[this.tumpukan.length - 1] as KelasInDo).fieldInstance.push({ kunci: nama, inisiator });
          break;
        }
        case Op.FieldStatis: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          const nilai = this.tumpukan.pop()!;
          (this.tumpukan[this.tumpukan.length - 1] as KelasInDo).tetapkan(nama, nilai);
          break;
        }
        case Op.JalankanStatis: {
          const fungsi = this.tumpukan.pop()!;
          const kelas = this.tumpukan[this.tumpukan.length - 1] as KelasInDo;
          if (fungsi instanceof Penutup) this.panggilTertutup(fungsi, kelas, []);
          break;
        }
        case Op.Konstruksi: {
          const argc = kode[bingkai.ip++]!;
          this.konstruksi(argc);
          bingkai = this.puncakBingkai();
          kode = bingkai.penutup.fungsi.potongan.kode;
          konstanta = bingkai.penutup.fungsi.potongan.konstanta;
          break;
        }
        case Op.PanggilInduk: {
          const argc = kode[bingkai.ip++]!;
          this.panggilInduk(argc);
          bingkai = this.puncakBingkai();
          kode = bingkai.penutup.fungsi.potongan.kode;
          konstanta = bingkai.penutup.fungsi.potongan.konstanta;
          break;
        }
        case Op.BacaIndukMetode: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          const induk = this.tumpukan.pop() as KelasInDo;
          this.tumpukan.push(induk.prototipeInstance.ambil(nama));
          break;
        }
        case Op.SelesaikanKelasInduk: {
          const slotSuper = this.tumpukan.length - 2;
          const upvalue = this.upvalueTerbuka.get(slotSuper);
          if (upvalue !== undefined) {
            upvalue.nilai = this.tumpukan[slotSuper]!;
            upvalue.tertutup = true;
            this.upvalueTerbuka.delete(slotSuper);
          }
          this.tumpukan.splice(slotSuper, 1);
          break;
        }
        case Op.PasangPenangan: {
          const addr = kode[bingkai.ip++]!;
          this.penangan.push({
            addr,
            kedalamanTumpukan: this.tumpukan.length,
            kedalamanBingkai: this.bingkai.length,
          });
          break;
        }
        case Op.LepasPenangan:
          this.penangan.pop();
          break;
        case Op.Lempar: {
          const nilai = this.tumpukan.pop()!;
          if (nilai instanceof ObjekInDo) nilai.tetapkan("tumpukan", this.jejakTumpukan());
          throw new LemparInDo(nilai);
        }
        case Op.LemparUlang:
          throw new LemparInDo(this.tumpukan.pop()!);
        case Op.IteratorAwal:
          this.tumpukan.push(this.buatIterator(this.tumpukan.pop()!));
          break;
        case Op.IteratorLanjut: {
          const it = this.tumpukan.pop() as IteratorInDo;
          const hasil = this.lanjutIterator(it);
          this.tumpukan.push(hasil.nilai);
          this.tumpukan.push(hasil.selesai);
          break;
        }
        case Op.IteratorAwalAsync:
          this.tumpukan.push(this.buatIteratorAsync(this.tumpukan.pop()!));
          break;
        case Op.IteratorLanjutAsync: {
          const it = this.tumpukan.pop() as IteratorInDo;
          this.tumpukan.push(this.lanjutIteratorAsync(it));
          break;
        }
        case Op.KunciDalam:
          this.tumpukan.push(this.kunciDalam(this.tumpukan.pop()!));
          break;
        case Op.MuatModul: {
          const spec = konstanta[kode[bingkai.ip++]!] as string;
          const dariJalur = bingkai.penutup.fungsi.potongan.namaBerkas;
          this.tumpukan.push(this.muatModul(spec, dariJalur));
          bingkai = this.puncakBingkai();
          kode = bingkai.penutup.fungsi.potongan.kode;
          konstanta = bingkai.penutup.fungsi.potongan.konstanta;
          break;
        }
        case Op.Regex: {
          const pola = konstanta[kode[bingkai.ip++]!] as string;
          const bendera = konstanta[kode[bingkai.ip++]!] as string;
          this.tumpukan.push(new RegExInDo(new RegExp(pola, bendera)));
          break;
        }
        case Op.ImporDinamis: {
          const spec = this.tumpukan.pop()!;
          const dariJalur = bingkai.penutup.fungsi.potongan.namaBerkas;
          const janji = new JanjiInDo();
          try {
            this.selesaikanJanji(janji, this.muatModul(keTeks(spec), dariJalur));
          } catch (galat) {
            if (galat instanceof LemparInDo) this.tolakJanji(janji, galat.nilai as Nilai);
            else throw galat;
          }
          this.tumpukan.push(janji);
          bingkai = this.puncakBingkai();
          kode = bingkai.penutup.fungsi.potongan.kode;
          konstanta = bingkai.penutup.fungsi.potongan.konstanta;
          break;
        }
        case Op.Hasilkan:
        case Op.Tunggu: {
          const nilai = this.tumpukan.pop()!;
          const gen = bingkai.generator;
          if (gen === null) this.galat("'hasilkan'/'tunggu' hanya boleh di dalam generator atau fungsi asinkron", "GalatTipe");
          gen.ip = bingkai.ip;
          gen.savedStack = this.tumpukan.slice(bingkai.basis);
          const indeksKoro = this.bingkai.length - 1;
          const disimpan: { addr: number; offsetTumpukan: number }[] = [];
          while (this.penangan.length > 0 && this.penangan[this.penangan.length - 1]!.kedalamanBingkai > indeksKoro) {
            const h = this.penangan.pop()!;
            disimpan.push({ addr: h.addr, offsetTumpukan: h.kedalamanTumpukan - bingkai.basis });
          }
          disimpan.reverse();
          gen.savedPenangan = disimpan;
          this.tumpukan.length = bingkai.basis;
          this.bingkai.pop();
          throw new SinyalHasilkan(nilai);
        }
        case Op.TulisProperti: {
          const nama = konstanta[kode[bingkai.ip++]!] as string;
          const nilai = this.tumpukan.pop()!;
          const objek = this.tumpukan.pop()!;
          this.tulisProperti(objek, nama, nilai);
          this.tumpukan.push(nilai);
          break;
        }
        case Op.BacaIndeks: {
          const kunci = this.tumpukan.pop()!;
          const objek = this.tumpukan.pop()!;
          this.tumpukan.push(this.bacaProperti(objek, normalisasiKunci(kunci)));
          break;
        }
        case Op.TulisIndeks: {
          const nilai = this.tumpukan.pop()!;
          const kunci = this.tumpukan.pop()!;
          const objek = this.tumpukan.pop()!;
          this.tulisProperti(objek, normalisasiKunci(kunci), nilai);
          this.tumpukan.push(nilai);
          break;
        }
        case Op.Penutup: {
          const fungsi = konstanta[kode[bingkai.ip++]!] as FungsiKompilasi;
          const penutup = new Penutup(fungsi);
          for (let i = 0; i < fungsi.jumlahUpvalue; i += 1) {
            const lokal = kode[bingkai.ip++]! === 1;
            const indeks = kode[bingkai.ip++]!;
            if (lokal) {
              penutup.upvalue.push(this.tangkapUpvalue(bingkai.basis + indeks));
            } else {
              penutup.upvalue.push(bingkai.penutup.upvalue[indeks]!);
            }
          }
          this.tumpukan.push(penutup);
          break;
        }
        case Op.Kembali: {
          const hasil = this.tumpukan.pop()!;
          this.tutupUpvalueSampai(bingkai.basis);
          this.tumpukan.length = bingkai.basis;
          this.bingkai.pop();
          if (this.bingkai.length === batas) {
            return hasil;
          }
          this.tumpukan.push(hasil);
          bingkai = this.puncakBingkai();
          kode = bingkai.penutup.fungsi.potongan.kode;
          konstanta = bingkai.penutup.fungsi.potongan.konstanta;
          break;
        }
        default:
          this.galat(`Instruksi tidak dikenal: ${instruksi}`);
      }
    }
  }

  private panggil(jumlah: number, denganIni: boolean): void {
    const indeksCallee = this.tumpukan.length - jumlah - 1;
    const callee = this.tumpukan[indeksCallee]!;
    let basis: number;
    if (denganIni) {
      this.tumpukan.splice(indeksCallee, 1);
      basis = indeksCallee - 1;
    } else {
      this.tumpukan[indeksCallee] = undefined;
      basis = indeksCallee;
    }

    if (callee instanceof Penutup) {
      this.sesuaikanArgumen(callee, basis, jumlah);
      if (callee.fungsi.asinkron) {
        const savedStack = this.tumpukan.slice(basis);
        this.tumpukan.length = basis;
        const gen = new GeneratorInDo(callee, savedStack);
        const janji = new JanjiInDo();
        this.tumpukan.push(janji);
        this.gerakkanAsync(gen, janji, undefined, null);
      } else if (callee.fungsi.generator) {
        const savedStack = this.tumpukan.slice(basis);
        this.tumpukan.length = basis;
        this.tumpukan.push(new GeneratorInDo(callee, savedStack));
      } else {
        this.bingkai.push({ penutup: callee, ip: 0, basis, generator: null });
      }
      return;
    }

    if (callee instanceof FungsiNatif) {
      const argumen = this.tumpukan.slice(basis + 1);
      this.tumpukan.length = basis;
      const hasil = callee.fungsi(argumen);
      this.tumpukan.push(hasil);
      return;
    }

    this.galat(`Nilai bertipe "${jenisNilai(callee)}" tidak dapat dipanggil`, "GalatTipe");
  }

  private sesuaikanArgumen(penutup: Penutup, basis: number, jumlah: number): void {
    const arity = penutup.fungsi.arity;
    if (penutup.fungsi.punyaSisa) {
      const tetap = arity - 1;
      if (jumlah > tetap) {
        const sisa = this.tumpukan.splice(basis + 1 + tetap);
        this.tumpukan.push(new LarikInDo(sisa));
      } else {
        for (let i = jumlah; i < tetap; i += 1) this.tumpukan.push(undefined);
        this.tumpukan.push(new LarikInDo([]));
      }
    } else if (jumlah < arity) {
      for (let i = jumlah; i < arity; i += 1) this.tumpukan.push(undefined);
    } else if (jumlah > arity) {
      this.tumpukan.length -= jumlah - arity;
    }
  }

  private siapkanBingkaiPenutup(penutup: Penutup, basis: number, jumlah: number): void {
    this.sesuaikanArgumen(penutup, basis, jumlah);
    this.bingkai.push({ penutup, ip: 0, basis, generator: null });
  }

  jalankanGenerator(gen: GeneratorInDo, kirim: Nilai): { nilai: Nilai; selesai: boolean } {
    if (gen.selesai) return { nilai: undefined, selesai: true };
    const dasar = this.tumpukan.length;
    for (const v of gen.savedStack) this.tumpukan.push(v);
    if (gen.dimulai) this.tumpukan.push(kirim);
    const batas = this.bingkai.length;
    this.bingkai.push({ penutup: gen.penutup, ip: gen.ip, basis: dasar, generator: gen });
    this.pulihkanPenangan(gen, dasar);
    gen.dimulai = true;
    try {
      const nilaiKembali = this.loop(batas);
      gen.selesai = true;
      return { nilai: nilaiKembali, selesai: true };
    } catch (galat) {
      if (galat instanceof SinyalHasilkan) return { nilai: galat.nilai as Nilai, selesai: false };
      throw galat;
    }
  }

  private pulihkanPenangan(gen: GeneratorInDo, dasar: number): void {
    if (gen.savedPenangan.length === 0) return;
    const kedalamanBingkai = this.bingkai.length;
    for (const h of gen.savedPenangan) {
      this.penangan.push({ addr: h.addr, kedalamanTumpukan: dasar + h.offsetTumpukan, kedalamanBingkai });
    }
    gen.savedPenangan = [];
  }

  private hasilObjek(hasil: { nilai: Nilai; selesai: boolean }): ObjekInDo {
    const objek = new ObjekInDo(null);
    objek.tetapkan("nilai", hasil.nilai);
    objek.tetapkan("selesai", hasil.selesai);
    return objek;
  }

  jalankanGeneratorLempar(gen: GeneratorInDo, errVal: Nilai): { nilai: Nilai; selesai: boolean } {
    if (gen.selesai) return { nilai: undefined, selesai: true };
    const dasar = this.tumpukan.length;
    for (const v of gen.savedStack) this.tumpukan.push(v);
    const batas = this.bingkai.length;
    this.bingkai.push({ penutup: gen.penutup, ip: gen.ip, basis: dasar, generator: gen });
    this.pulihkanPenangan(gen, dasar);
    gen.dimulai = true;
    if (!this.tanganiLempar(errVal, batas)) {
      while (this.bingkai.length > batas) {
        const b = this.bingkai[this.bingkai.length - 1]!;
        this.tutupUpvalueSampai(b.basis);
        this.bingkai.pop();
      }
      this.tumpukan.length = dasar;
      gen.selesai = true;
      throw new LemparInDo(errVal);
    }
    try {
      const nilaiKembali = this.loop(batas);
      gen.selesai = true;
      return { nilai: nilaiKembali, selesai: true };
    } catch (galat) {
      if (galat instanceof SinyalHasilkan) return { nilai: galat.nilai as Nilai, selesai: false };
      throw galat;
    }
  }

  private gerakkanAsync(gen: GeneratorInDo, janji: JanjiInDo, kirim: Nilai, errVal: { nilai: Nilai } | null): void {
    let hasil: { nilai: Nilai; selesai: boolean };
    try {
      hasil = errVal !== null ? this.jalankanGeneratorLempar(gen, errVal.nilai) : this.jalankanGenerator(gen, kirim);
    } catch (galat) {
      if (galat instanceof LemparInDo) {
        this.tolakJanji(janji, galat.nilai as Nilai);
        return;
      }
      throw galat;
    }
    if (hasil.selesai) {
      this.selesaikanJanji(janji, hasil.nilai);
      return;
    }
    const menunggu = this.keJanji(hasil.nilai);
    this.tambahReaksi(
      menunggu,
      (nilai) => this.gerakkanAsync(gen, janji, nilai, null),
      (galat) => this.gerakkanAsync(gen, janji, undefined, { nilai: galat }),
    );
  }

  private muatModul(spesifikasi: string, dariJalur: string): ObjekInDo {
    if (this.muatSumberModul === null) {
      this.galat("Impor modul tidak didukung di lingkungan ini");
    }
    let berkas: { jalur: string; sumber: string };
    try {
      berkas = this.muatSumberModul(spesifikasi, dariJalur);
    } catch {
      this.galat(`Tidak dapat memuat modul "${spesifikasi}"`, "Galat");
    }
    const adaCache = this.cacheModul.get(berkas.jalur);
    if (adaCache !== undefined) return adaCache;
    const ekspor = new ObjekInDo(null);
    this.cacheModul.set(berkas.jalur, ekspor);
    const fungsi = Kompiler.kompilasiModul(urai(berkas.sumber, berkas.jalur), berkas.jalur);
    const hasil = this.panggilModul(fungsi);
    if (hasil instanceof ObjekInDo) {
      for (const [k, v] of hasil.properti) ekspor.tetapkan(k, v);
    }
    return ekspor;
  }

  private panggilModul(fungsi: FungsiKompilasi): Nilai {
    const penutup = new Penutup(fungsi);
    const basis = this.tumpukan.length;
    this.tumpukan.push(penutup);
    const batas = this.bingkai.length;
    this.bingkai.push({ penutup, ip: 0, basis, generator: null });
    return this.loop(batas);
  }

  jadwalkanMikro(tugas: () => void): void {
    this.mikrotask.push(tugas);
  }

  keJanji(nilai: Nilai): JanjiInDo {
    if (nilai instanceof JanjiInDo) return nilai;
    const janji = new JanjiInDo();
    janji.keadaan = "terpenuhi";
    janji.nilai = nilai;
    return janji;
  }

  selesaikanJanji(janji: JanjiInDo, nilai: Nilai): void {
    if (janji.keadaan !== "menunggu") return;
    if (nilai instanceof JanjiInDo) {
      this.tambahReaksi(
        nilai,
        (n) => this.selesaikanJanji(janji, n),
        (e) => this.tolakJanji(janji, e),
      );
      return;
    }
    janji.keadaan = "terpenuhi";
    janji.nilai = nilai;
    const reaksi = janji.reaksiPenuh;
    janji.reaksiPenuh = [];
    janji.reaksiTolak = [];
    for (const r of reaksi) this.jadwalkanMikro(() => r(nilai));
  }

  tolakJanji(janji: JanjiInDo, alasan: Nilai): void {
    if (janji.keadaan !== "menunggu") return;
    janji.keadaan = "tertolak";
    janji.nilai = alasan;
    const reaksi = janji.reaksiTolak;
    janji.reaksiPenuh = [];
    janji.reaksiTolak = [];
    if (reaksi.length === 0) this.penolakanTakTertangani.add(janji);
    for (const r of reaksi) this.jadwalkanMikro(() => r(alasan));
  }

  tambahReaksi(janji: JanjiInDo, onPenuh: (n: Nilai) => void, onTolak: (e: Nilai) => void): void {
    janji.ditangani = true;
    this.penolakanTakTertangani.delete(janji);
    if (janji.keadaan === "terpenuhi") {
      this.jadwalkanMikro(() => onPenuh(janji.nilai));
    } else if (janji.keadaan === "tertolak") {
      this.jadwalkanMikro(() => onTolak(janji.nilai));
    } else {
      janji.reaksiPenuh.push(onPenuh);
      janji.reaksiTolak.push(onTolak);
    }
  }

  private pasangMetodeKelas(kelas: KelasInDo, nama: KunciProperti, fungsi: Nilai, bendera: number): void {
    const statis = (bendera & 1) !== 0;
    const ragam = bendera >> 1;
    if (ragam === 3) {
      kelas.konstruktor = fungsi;
      return;
    }
    const target = statis ? kelas : kelas.prototipeInstance;
    if (ragam === 1) {
      target.tetapkanAksesor(nama, fungsi, undefined);
    } else if (ragam === 2) {
      target.tetapkanAksesor(nama, undefined, fungsi);
    } else {
      target.tetapkan(nama, fungsi);
    }
  }

  private konstruksi(argc: number): void {
    const indeksKelas = this.tumpukan.length - argc - 1;
    const kelas = this.tumpukan[indeksKelas]!;
    if (kelas instanceof FungsiNatif) {
      const argumen = this.tumpukan.slice(indeksKelas + 1);
      this.tumpukan.length = indeksKelas;
      this.tumpukan.push(kelas.fungsi(argumen));
      return;
    }
    if (!(kelas instanceof KelasInDo)) {
      this.galat(`Hanya kelas yang dapat dibuat dengan 'baru', bukan ${jenisNilai(kelas)}`, "GalatTipe");
    }
    const instance = new ObjekInDo(kelas.prototipeInstance);
    instance.kelasNama = kelas.namaKelas;
    for (const f of kelas.semuaField()) {
      const nilai = f.inisiator instanceof Penutup ? this.panggilTertutup(f.inisiator, instance, []) : f.inisiator;
      instance.tetapkan(f.kunci, nilai);
    }
    const konst = kelas.konstruktor !== null && kelas.konstruktor !== undefined ? kelas.konstruktor : kelas.konstruktorTerdekat();
    if (konst instanceof Penutup) {
      this.tumpukan[indeksKelas] = instance;
      this.siapkanBingkaiPenutup(konst, indeksKelas, argc);
    } else {
      this.tumpukan.length = indeksKelas;
      this.tumpukan.push(instance);
    }
  }

  private panggilInduk(argc: number): void {
    const indeksInduk = this.tumpukan.length - argc - 1;
    const induk = this.tumpukan[indeksInduk]!;
    if (!(induk instanceof KelasInDo)) this.galat("'induk' hanya tersedia di kelas turunan");
    const konst = induk.konstruktorTerdekat();
    this.tumpukan.splice(indeksInduk, 1);
    const basis = indeksInduk - 1;
    if (konst instanceof Penutup) {
      this.siapkanBingkaiPenutup(konst, basis, argc);
    } else {
      this.tumpukan.length = basis;
      this.tumpukan.push(undefined);
    }
  }

  private bacaProperti(objek: Nilai, kunci: KunciProperti): Nilai {
    if (objek === null || objek === undefined) {
      this.galat(`Tidak dapat membaca properti "${String(kunci)}" dari ${jenisNilai(objek)}`, "GalatTipe");
    }
    if (objek instanceof WakilInDo) {
      const trap = objek.penangan.ambil("ambil");
      if (this.adalahDapatDipanggil(trap)) return this.panggilNilai(trap, objek.penangan, [objek.sasaran, kunci, objek]);
      return this.bacaProperti(objek.sasaran, kunci);
    }
    if (objek instanceof PetaInDo && typeof kunci === "string") return this.metodePeta(objek, kunci);
    if (objek instanceof HimpunanInDo && typeof kunci === "string") return this.metodeHimpunan(objek, kunci);
    if (objek instanceof PetaLemahInDo && typeof kunci === "string") return this.metodePetaLemah(objek, kunci);
    if (objek instanceof HimpunanLemahInDo && typeof kunci === "string") return this.metodeHimpunanLemah(objek, kunci);
    if (objek instanceof RefLemahInDo && kunci === "deref") {
      return new FungsiNatif("deref", 0, () => (objek.ref.deref() as Nilai) ?? undefined);
    }
    if (objek instanceof PenyanggaLarikInDo && kunci === "ukuranByte") return objek.buf.byteLength;
    if (objek instanceof LarikBertipeInDo) {
      if (kunci === "panjang") return objek.ta.length;
      if (kunci === "penyangga") return new PenyanggaLarikInDo(objek.ta.buffer);
      if (typeof kunci === "string") {
        const i = Number(kunci);
        if (Number.isInteger(i) && i >= 0 && i < objek.ta.length) return objek.ta[i];
      }
      return undefined;
    }
    if (objek instanceof LarikInDo) {
      if (kunci === "panjang") return objek.elemen.length;
      if (typeof kunci === "string") {
        const indeks = Number(kunci);
        if (Number.isInteger(indeks) && indeks >= 0) return objek.elemen[indeks];
      }
      if (typeof kunci === "string") return this.metodeLarik(objek, kunci);
      return undefined;
    }
    if (typeof objek === "string") {
      if (kunci === "panjang") return objek.length;
      if (typeof kunci === "string") {
        const indeks = Number(kunci);
        if (Number.isInteger(indeks) && indeks >= 0 && indeks < objek.length) return objek[indeks]!;
        return this.metodeTeks(objek, kunci);
      }
      return undefined;
    }
    if (typeof objek === "number" && typeof kunci === "string") {
      return this.metodeAngka(objek, kunci);
    }
    if (objek instanceof RegExInDo && typeof kunci === "string") {
      return this.metodeRegex(objek, kunci);
    }
    if (objek instanceof TanggalInDo && typeof kunci === "string") {
      return this.metodeTanggal(objek, kunci);
    }
    if (objek instanceof ObjekInDo) {
      const aks = objek.cariAksesor(kunci);
      if (aks !== null && aks.dapatkan !== undefined && aks.dapatkan !== null) {
        if (aks.dapatkan instanceof Penutup) return this.panggilTertutup(aks.dapatkan, objek, []);
        if (aks.dapatkan instanceof FungsiNatif) return aks.dapatkan.fungsi([]);
      }
      return objek.ambil(kunci);
    }
    if (objek instanceof FungsiNatif && objek.properti !== null && objek.properti.has(kunci)) {
      return objek.properti.get(kunci);
    }
    if (objek instanceof JanjiInDo) {
      if (kunci === "lalu") {
        return new FungsiNatif("lalu", -1, (a) => this.janjiLalu(objek, a[0], a[1]));
      }
      if (kunci === "tangkap") {
        return new FungsiNatif("tangkap", 1, (a) => this.janjiLalu(objek, undefined, a[0]));
      }
      if (kunci === "akhirnya") {
        return new FungsiNatif("akhirnya", 1, (a) => {
          const cb = a[0];
          const onPenuh = new FungsiNatif("", 1, (b) => {
            this.panggilNilai(cb, undefined, []);
            return b[0];
          });
          const onTolak = new FungsiNatif("", 1, (b) => {
            this.panggilNilai(cb, undefined, []);
            throw new LemparInDo(b[0]);
          });
          return this.janjiLalu(objek, onPenuh, onTolak);
        });
      }
      return undefined;
    }
    if (objek instanceof GeneratorInDo) {
      if (kunci === "lanjut") {
        return new FungsiNatif("lanjut", -1, (argumen) => this.hasilObjek(this.jalankanGenerator(objek, argumen[0])));
      }
      if (kunci === SIMBOL_ITERATOR) {
        return new FungsiNatif("[Simbol.iterator]", 0, () => objek);
      }
      if (kunci === "selesai") return objek.selesai;
    }
    return undefined;
  }

  private tulisProperti(objek: Nilai, kunci: KunciProperti, nilai: Nilai): void {
    if (objek === null || objek === undefined) {
      this.galat(`Tidak dapat menetapkan properti "${String(kunci)}" pada ${jenisNilai(objek)}`, "GalatTipe");
    }
    if (objek instanceof WakilInDo) {
      const trap = objek.penangan.ambil("tetapkan");
      if (this.adalahDapatDipanggil(trap)) {
        this.panggilNilai(trap, objek.penangan, [objek.sasaran, kunci, nilai, objek]);
        return;
      }
      this.tulisProperti(objek.sasaran, kunci, nilai);
      return;
    }
    if (objek instanceof LarikBertipeInDo) {
      if (typeof kunci === "string") {
        const i = Number(kunci);
        if (Number.isInteger(i) && i >= 0 && i < objek.ta.length) objek.ta[i] = this.angka(nilai);
      }
      return;
    }
    if (objek instanceof LarikInDo) {
      if (kunci === "panjang") {
        if (typeof nilai === "number") objek.elemen.length = nilai;
        return;
      }
      if (typeof kunci === "string") {
        const indeks = Number(kunci);
        if (Number.isInteger(indeks) && indeks >= 0) {
          objek.elemen[indeks] = nilai;
          return;
        }
      }
      return;
    }
    if (objek instanceof ObjekInDo) {
      const aks = objek.cariAksesor(kunci);
      if (aks !== null && aks.tetapkan !== undefined && aks.tetapkan !== null) {
        if (aks.tetapkan instanceof Penutup) {
          this.panggilTertutup(aks.tetapkan, objek, [nilai]);
          return;
        }
        if (aks.tetapkan instanceof FungsiNatif) {
          aks.tetapkan.fungsi([nilai]);
          return;
        }
      }
      objek.tetapkan(kunci, nilai);
      return;
    }
  }

  private contohDari(nilai: Nilai, kelas: Nilai): boolean {
    if (!(kelas instanceof KelasInDo)) this.galat("Sisi kanan 'contohdari' harus berupa kelas");
    if (!(nilai instanceof ObjekInDo)) return false;
    let proto = nilai.prototipe;
    while (proto !== null) {
      if (proto === kelas.prototipeInstance) return true;
      proto = proto.prototipe;
    }
    return false;
  }

  private dalam(kunci: Nilai, objek: Nilai): boolean {
    const k = normalisasiKunci(kunci);
    if (objek instanceof WakilInDo) {
      const trap = objek.penangan.ambil("punya");
      if (this.adalahDapatDipanggil(trap)) return benarKah(this.panggilNilai(trap, objek.penangan, [objek.sasaran, kunci]));
      return this.dalam(kunci, objek.sasaran);
    }
    if (objek instanceof PetaInDo) return objek.m.has(kunci);
    if (objek instanceof HimpunanInDo) return objek.s.has(kunci);
    if (objek instanceof LarikInDo) {
      if (k === "panjang") return true;
      const indeks = Number(k);
      return Number.isInteger(indeks) && indeks >= 0 && indeks < objek.elemen.length;
    }
    if (objek instanceof ObjekInDo) return objek.punya(k);
    this.galat(`Operator 'dalam' butuh objek di sisi kanan, bukan ${jenisNilai(objek)}`);
  }

  private angka(nilai: Nilai): number {
    if (typeof nilai === "number") return nilai;
    if (typeof nilai === "string") return Number(nilai);
    if (typeof nilai === "boolean") return nilai ? 1 : 0;
    if (nilai === undefined) return NaN;
    if (nilai === null) return 0;
    return NaN;
  }

  private metodeTeks(teks: string, nama: string): Nilai {
    const buat = (fn: (a: Nilai[]) => Nilai): FungsiNatif => new FungsiNatif(nama, -1, fn);
    switch (nama) {
      case "besar":
        return buat(() => teks.toUpperCase());
      case "kecil":
        return buat(() => teks.toLowerCase());
      case "iris":
        return buat((a) => teks.slice(this.angka(a[0] ?? 0), a[1] === undefined ? undefined : this.angka(a[1])));
      case "potong":
        return buat((a) => teks.substring(this.angka(a[0] ?? 0), a[1] === undefined ? undefined : this.angka(a[1])));
      case "pisah":
        return buat((a) => new LarikInDo((a[0] === undefined ? [teks] : teks.split(keTeks(a[0]))) as Nilai[]));
      case "ganti":
        return buat((a) => teks.replace(keTeks(a[0]), keTeks(a[1])));
      case "gantiSemua":
        return buat((a) => teks.replaceAll(keTeks(a[0]), keTeks(a[1])));
      case "berisi":
        return buat((a) => teks.includes(keTeks(a[0])));
      case "diawali":
        return buat((a) => teks.startsWith(keTeks(a[0])));
      case "diakhiri":
        return buat((a) => teks.endsWith(keTeks(a[0])));
      case "ulangi":
        return buat((a) => teks.repeat(this.angka(a[0] ?? 0)));
      case "rapikan":
        return buat(() => teks.trim());
      case "rapikanAwal":
        return buat(() => teks.trimStart());
      case "rapikanAkhir":
        return buat(() => teks.trimEnd());
      case "isiAwal":
        return buat((a) => teks.padStart(this.angka(a[0] ?? 0), a[1] === undefined ? " " : keTeks(a[1])));
      case "isiAkhir":
        return buat((a) => teks.padEnd(this.angka(a[0] ?? 0), a[1] === undefined ? " " : keTeks(a[1])));
      case "indeksDari":
        return buat((a) => teks.indexOf(keTeks(a[0]), a[1] === undefined ? 0 : this.angka(a[1])));
      case "karakterDi":
        return buat((a) => teks.at(this.angka(a[0] ?? 0)) ?? undefined);
      case "kodeDi":
        return buat((a) => {
          const k = teks.charCodeAt(this.angka(a[0] ?? 0));
          return Number.isNaN(k) ? undefined : k;
        });
      case "normalisasi":
        return buat((a) => teks.normalize(a[0] === undefined ? undefined : keTeks(a[0])));
      case "cocok":
        return buat((a) => {
          const re = a[0] instanceof RegExInDo ? a[0].re : new RegExp(keTeks(a[0]));
          const m = teks.match(re);
          return m === null ? null : new LarikInDo([...m] as Nilai[]);
        });
      case "cocokSemua":
        return buat((a) => {
          const re = a[0] instanceof RegExInDo ? a[0].re : new RegExp(keTeks(a[0]), "g");
          const hasil: Nilai[] = [];
          for (const m of teks.matchAll(re)) hasil.push(new LarikInDo([...m] as Nilai[]));
          return new LarikInDo(hasil);
        });
      case "cari":
        return buat((a) => teks.search(a[0] instanceof RegExInDo ? a[0].re : new RegExp(keTeks(a[0]))));
      case "keTeks":
        return buat(() => teks);
      default:
        return undefined;
    }
  }

  private metodeRegex(regex: RegExInDo, nama: string): Nilai {
    const buat = (fn: (a: Nilai[]) => Nilai): FungsiNatif => new FungsiNatif(nama, -1, fn);
    switch (nama) {
      case "uji":
        return buat((a) => regex.re.test(keTeks(a[0])));
      case "jalankan":
        return buat((a) => {
          const m = regex.re.exec(keTeks(a[0]));
          return m === null ? null : new LarikInDo([...m] as Nilai[]);
        });
      case "sumber":
        return regex.re.source;
      case "bendera":
        return regex.re.flags;
      case "indeksTerakhir":
        return regex.re.lastIndex;
      default:
        return undefined;
    }
  }

  private metodeTanggal(tanggal: TanggalInDo, nama: string): Nilai {
    const d = tanggal.d;
    const buat = (fn: (a: Nilai[]) => Nilai): FungsiNatif => new FungsiNatif(nama, -1, fn);
    switch (nama) {
      case "ambilTahun":
        return buat(() => d.getFullYear());
      case "ambilBulan":
        return buat(() => d.getMonth());
      case "ambilTanggal":
        return buat(() => d.getDate());
      case "ambilHari":
        return buat(() => d.getDay());
      case "ambilJam":
        return buat(() => d.getHours());
      case "ambilMenit":
        return buat(() => d.getMinutes());
      case "ambilDetik":
        return buat(() => d.getSeconds());
      case "aturTahun":
        return buat((a) => d.setFullYear(this.angka(a[0])));
      case "aturBulan":
        return buat((a) => d.setMonth(this.angka(a[0])));
      case "aturTanggal":
        return buat((a) => d.setDate(this.angka(a[0])));
      case "keWaktu":
        return buat(() => d.getTime());
      case "keISO":
        return buat(() => d.toISOString());
      case "keTeksIndonesia":
        return buat(() => this.formatTanggalIndonesia(d));
      default:
        return undefined;
    }
  }

  private formatTanggalIndonesia(d: Date): string {
    const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const bulan = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
  }

  private metodeAngka(n: number, nama: string): Nilai {
    const buat = (fn: (a: Nilai[]) => Nilai): FungsiNatif => new FungsiNatif(nama, -1, fn);
    switch (nama) {
      case "keTetap":
        return buat((a) => n.toFixed(a[0] === undefined ? 0 : this.angka(a[0])));
      case "kePresisi":
        return buat((a) => (a[0] === undefined ? String(n) : n.toPrecision(this.angka(a[0]))));
      case "keTeks":
        return buat((a) => n.toString(a[0] === undefined ? 10 : this.angka(a[0])));
      default:
        return undefined;
    }
  }

  private metodeLarik(larik: LarikInDo, nama: string): Nilai {
    const el = larik.elemen;
    const buat = (fn: (a: Nilai[]) => Nilai): FungsiNatif => new FungsiNatif(nama, -1, fn);
    const banding = (a: Nilai, b: Nilai): boolean => samaKetat(a, b);
    switch (nama) {
      case "tambah":
        return buat((a) => {
          for (const x of a) el.push(x);
          return el.length;
        });
      case "hapusAkhir":
        return buat(() => (el.length === 0 ? undefined : el.pop()));
      case "hapusAwal":
        return buat(() => (el.length === 0 ? undefined : el.shift()));
      case "tambahAwal":
        return buat((a) => {
          el.unshift(...a);
          return el.length;
        });
      case "sambung":
        return buat((a) => {
          const hasil = el.slice();
          for (const x of a) {
            if (x instanceof LarikInDo) hasil.push(...x.elemen);
            else hasil.push(x);
          }
          return new LarikInDo(hasil);
        });
      case "iris":
        return buat((a) => new LarikInDo(el.slice(a[0] === undefined ? 0 : this.angka(a[0]), a[1] === undefined ? undefined : this.angka(a[1]))));
      case "sambat":
        return buat((a) => {
          const mulai = this.angka(a[0] ?? 0);
          const jumlah = a[1] === undefined ? el.length - mulai : this.angka(a[1]);
          const dibuang = el.splice(mulai, jumlah, ...a.slice(2));
          return new LarikInDo(dibuang);
        });
      case "petakan":
        return buat((a) => new LarikInDo(el.map((x, i) => this.panggilNilai(a[0], undefined, [x, i, larik]))));
      case "saring":
        return buat((a) => new LarikInDo(el.filter((x, i) => benarKah(this.panggilNilai(a[0], undefined, [x, i, larik])))));
      case "untukSetiap":
        return buat((a) => {
          el.forEach((x, i) => this.panggilNilai(a[0], undefined, [x, i, larik]));
          return undefined;
        });
      case "kurangi":
        return buat((a) => {
          if (a.length >= 2) return el.reduce((acc, x, i) => this.panggilNilai(a[0], undefined, [acc, x, i, larik]), a[1]);
          return el.reduce((acc, x, i) => this.panggilNilai(a[0], undefined, [acc, x, i, larik]));
        });
      case "kurangiKanan":
        return buat((a) => {
          if (a.length >= 2) return el.reduceRight((acc, x, i) => this.panggilNilai(a[0], undefined, [acc, x, i, larik]), a[1]);
          return el.reduceRight((acc, x, i) => this.panggilNilai(a[0], undefined, [acc, x, i, larik]));
        });
      case "cari":
        return buat((a) => el.find((x, i) => benarKah(this.panggilNilai(a[0], undefined, [x, i, larik]))));
      case "cariIndeks":
        return buat((a) => el.findIndex((x, i) => benarKah(this.panggilNilai(a[0], undefined, [x, i, larik]))));
      case "cariTerakhir":
        return buat((a) => el.findLast((x, i) => benarKah(this.panggilNilai(a[0], undefined, [x, i, larik]))));
      case "setiap":
        return buat((a) => el.every((x, i) => benarKah(this.panggilNilai(a[0], undefined, [x, i, larik]))));
      case "beberapa":
        return buat((a) => el.some((x, i) => benarKah(this.panggilNilai(a[0], undefined, [x, i, larik]))));
      case "berisi":
        return buat((a) => el.some((x) => banding(x, a[0])));
      case "indeksDari":
        return buat((a) => el.findIndex((x) => banding(x, a[0])));
      case "gabung":
        return buat((a) => el.map((x) => (x === null || x === undefined ? "" : keTeks(x))).join(a[0] === undefined ? "," : keTeks(a[0])));
      case "balik":
        return buat(() => {
          el.reverse();
          return larik;
        });
      case "urutkan":
        return buat((a) => {
          el.sort((x, y) => {
            if (a[0] !== undefined) return this.angka(this.panggilNilai(a[0], undefined, [x, y]));
            return keTeks(x) < keTeks(y) ? -1 : keTeks(x) > keTeks(y) ? 1 : 0;
          });
          return larik;
        });
      case "ratakan":
        return buat((a) => new LarikInDo(this.ratakan(el, a[0] === undefined ? 1 : this.angka(a[0]))));
      case "ratakanPeta":
        return buat((a) => new LarikInDo(this.ratakan(el.map((x, i) => this.panggilNilai(a[0], undefined, [x, i, larik])), 1)));
      case "isi":
        return buat((a) => {
          const mulai = a[1] === undefined ? 0 : this.angka(a[1]);
          const akhir = a[2] === undefined ? el.length : this.angka(a[2]);
          for (let i = mulai; i < akhir; i += 1) el[i] = a[0];
          return larik;
        });
      case "di":
        return buat((a) => el.at(this.angka(a[0] ?? 0)));
      case "kunci":
        return buat(() => new LarikInDo(el.map((_x, i) => i)));
      case "nilai":
        return buat(() => new LarikInDo(el.slice()));
      case "entri":
        return buat(() => new LarikInDo(el.map((x, i) => new LarikInDo([i, x]))));
      case "diurutkan":
        return buat((a) => {
          const salinan = el.slice();
          salinan.sort((x, y) => {
            if (a[0] !== undefined) return this.angka(this.panggilNilai(a[0], undefined, [x, y]));
            return keTeks(x) < keTeks(y) ? -1 : keTeks(x) > keTeks(y) ? 1 : 0;
          });
          return new LarikInDo(salinan);
        });
      case "dibalik":
        return buat(() => new LarikInDo(el.slice().reverse()));
      case "dengan":
        return buat((a) => {
          const salinan = el.slice();
          const i = this.angka(a[0] ?? 0);
          salinan[i < 0 ? salinan.length + i : i] = a[1];
          return new LarikInDo(salinan);
        });
      default:
        return undefined;
    }
  }

  private ratakan(arr: Nilai[], kedalaman: number): Nilai[] {
    const hasil: Nilai[] = [];
    for (const x of arr) {
      if (x instanceof LarikInDo && kedalaman > 0) hasil.push(...this.ratakan(x.elemen, kedalaman - 1));
      else hasil.push(x);
    }
    return hasil;
  }

  private irisSisa(sumber: Nilai, mulai: number): LarikInDo {
    if (sumber instanceof LarikInDo) return new LarikInDo(sumber.elemen.slice(mulai));
    if (typeof sumber === "string") return new LarikInDo([...sumber].slice(mulai));
    this.galat(`Nilai bertipe "${jenisNilai(sumber)}" tidak dapat didestrukturisasi`);
  }

  private sebarKeLarik(sumber: Nilai, larik: LarikInDo): void {
    if (sumber instanceof LarikInDo) {
      for (const e of sumber.elemen) larik.elemen.push(e);
      return;
    }
    if (typeof sumber === "string") {
      for (const c of sumber) larik.elemen.push(c);
      return;
    }
    const it = this.buatIterator(sumber);
    for (;;) {
      const r = this.lanjutIterator(it);
      if (r.selesai) break;
      larik.elemen.push(r.nilai);
    }
  }

  private sebarKeObjek(sumber: Nilai, objek: ObjekInDo): void {
    if (sumber instanceof ObjekInDo) {
      for (const [k, v] of sumber.properti) objek.tetapkan(k, v);
      return;
    }
    if (sumber instanceof LarikInDo) {
      for (let i = 0; i < sumber.elemen.length; i += 1) objek.tetapkan(String(i), sumber.elemen[i]);
      return;
    }
    if (sumber === null || sumber === undefined) return;
  }

  private tangkapUpvalue(slot: number): Upvalue {
    const ada = this.upvalueTerbuka.get(slot);
    if (ada) return ada;
    const upvalue = new Upvalue(slot);
    this.upvalueTerbuka.set(slot, upvalue);
    return upvalue;
  }

  private tutupUpvalueSampai(batas: number): void {
    for (const [slot, upvalue] of this.upvalueTerbuka) {
      if (slot >= batas) {
        upvalue.nilai = this.tumpukan[slot]!;
        upvalue.tertutup = true;
        this.upvalueTerbuka.delete(slot);
      }
    }
  }

  private keAngka(nilai: Nilai): number {
    if (typeof nilai === "number") return nilai;
    this.galat(`Nilai bertipe "${jenisNilai(nilai)}" bukan angka`, "GalatTipe");
  }

  private binerTambah(): void {
    const b = this.tumpukan.pop()!;
    const a = this.tumpukan.pop()!;
    if (typeof a === "string" || typeof b === "string") {
      this.tumpukan.push(keTeks(a) + keTeks(b));
      return;
    }
    if (typeof a === "bigint" && typeof b === "bigint") {
      this.tumpukan.push(a + b);
      return;
    }
    if (typeof a === "number" && typeof b === "number") {
      this.tumpukan.push(a + b);
      return;
    }
    this.galat(`Tipe tidak cocok untuk operator "+": ${jenisNilai(a)} dan ${jenisNilai(b)}`, "GalatTipe");
  }

  private binerAngka(op: Op): void {
    const b = this.tumpukan.pop()!;
    const a = this.tumpukan.pop()!;
    if (typeof a === "bigint" && typeof b === "bigint") {
      this.tumpukan.push(this.hitungBigint(op, a, b));
      return;
    }
    if (typeof a !== "number" || typeof b !== "number") {
      this.galat(`Operasi aritmatika butuh angka, bukan ${jenisNilai(a)} dan ${jenisNilai(b)}`, "GalatTipe");
    }
    switch (op) {
      case Op.Kurang:
        this.tumpukan.push(a - b);
        return;
      case Op.Kali:
        this.tumpukan.push(a * b);
        return;
      case Op.Bagi:
        this.tumpukan.push(a / b);
        return;
      case Op.Sisa:
        this.tumpukan.push(a % b);
        return;
      case Op.Pangkat:
        this.tumpukan.push(a ** b);
        return;
      default:
        this.galat("Operasi aritmatika tidak dikenal");
    }
  }

  private hitungBigint(op: Op, a: bigint, b: bigint): bigint {
    switch (op) {
      case Op.Kurang:
        return a - b;
      case Op.Kali:
        return a * b;
      case Op.Bagi:
        if (b === 0n) this.galat("Pembagian bilangan besar dengan nol", "GalatRentang");
        return a / b;
      case Op.Sisa:
        if (b === 0n) this.galat("Sisa bagi bilangan besar dengan nol", "GalatRentang");
        return a % b;
      case Op.Pangkat:
        return a ** b;
      default:
        this.galat("Operasi bilangan besar tidak dikenal");
    }
  }

  private binerBitwise(op: Op): void {
    const b = this.tumpukan.pop()!;
    const a = this.tumpukan.pop()!;
    if (typeof a === "bigint" && typeof b === "bigint") {
      switch (op) {
        case Op.Dan:
          this.tumpukan.push(a & b);
          return;
        case Op.Atau:
          this.tumpukan.push(a | b);
          return;
        case Op.Xor:
          this.tumpukan.push(a ^ b);
          return;
        case Op.GeserKiri:
          this.tumpukan.push(a << b);
          return;
        case Op.GeserKanan:
          this.tumpukan.push(a >> b);
          return;
        default:
          this.galat("Operasi bit bilangan besar tidak dikenal");
      }
    }
    const ka = this.keAngka(a);
    const kb = this.keAngka(b);
    switch (op) {
      case Op.Dan:
        this.tumpukan.push(ka & kb);
        return;
      case Op.Atau:
        this.tumpukan.push(ka | kb);
        return;
      case Op.Xor:
        this.tumpukan.push(ka ^ kb);
        return;
      case Op.GeserKiri:
        this.tumpukan.push(ka << kb);
        return;
      case Op.GeserKanan:
        this.tumpukan.push(ka >> kb);
        return;
      case Op.GeserKananNol:
        this.tumpukan.push(ka >>> kb);
        return;
      default:
        this.galat("Operasi bit tidak dikenal");
    }
  }

  private binerBanding(op: Op): void {
    const b = this.tumpukan.pop()!;
    const a = this.tumpukan.pop()!;
    const bolehBanding =
      (typeof a === "number" && typeof b === "number") ||
      (typeof a === "string" && typeof b === "string") ||
      (typeof a === "bigint" && typeof b === "bigint");
    if (!bolehBanding) {
      this.galat(`Tidak dapat membandingkan ${jenisNilai(a)} dengan ${jenisNilai(b)}`);
    }
    switch (op) {
      case Op.KurangDari:
        this.tumpukan.push((a as number) < (b as number));
        return;
      case Op.LebihDari:
        this.tumpukan.push((a as number) > (b as number));
        return;
      case Op.KurangSamaDari:
        this.tumpukan.push((a as number) <= (b as number));
        return;
      case Op.LebihSamaDari:
        this.tumpukan.push((a as number) >= (b as number));
        return;
      default:
        this.galat("Operasi banding tidak dikenal");
    }
  }
}

function bacaBarisStdin(pesan: string): string {
  if (pesan !== "") process.stdout.write(pesan);
  const penyangga = Buffer.alloc(1);
  let hasil = "";
  try {
    for (;;) {
      const n = fs.readSync(0, penyangga, 0, 1, null);
      if (n === 0) break;
      const karakter = penyangga.toString("utf8");
      if (karakter === "\n") break;
      if (karakter === "\r") continue;
      hasil += karakter;
    }
  } catch {
    return hasil;
  }
  return hasil;
}

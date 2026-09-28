import { test } from "node:test";
import assert from "node:assert/strict";
import { urai } from "../parser/parser.js";
import { Kompiler } from "../compiler/kompiler.js";
import { Mesin } from "./mesin.js";
import { GalatKompilasi } from "../galat/kompilasi.js";
import { LemparInDo } from "../galat/eksekusi.js";

function jalankan(sumber: string): string[] {
  const baris: string[] = [];
  const program = urai(sumber, "uji.wni");
  const fungsi = Kompiler.kompilasiProgram(program, "uji.wni");
  const mesin = new Mesin({ cetak: (t) => baris.push(t), galat: (t) => baris.push(t) });
  mesin.jalankan(fungsi);
  mesin.jalankanEventLoop();
  return baris;
}

function satu(sumber: string): string {
  return jalankan(sumber).join("\n");
}

test("aritmatika dan presedensi", () => {
  assert.equal(satu("cetak(1 + 2 * 3)"), "7");
  assert.equal(satu("cetak((1 + 2) * 3)"), "9");
  assert.equal(satu("cetak(2 ** 3 ** 2)"), "512");
  assert.equal(satu("cetak(10 % 3)"), "1");
  assert.equal(satu("cetak(-5 + 3)"), "-2");
});

test("penggabungan teks", () => {
  assert.equal(satu('cetak("a" + "b" + 1)'), "ab1");
  assert.equal(satu("cetak(`x=${1 + 1}`)"), "x=2");
});

test("perbandingan ketat tanpa konversi", () => {
  assert.equal(satu('cetak(1 == 1, 1 != 2, "a" == "a")'), "benar benar benar");
  assert.equal(satu('cetak(1 == "1")'), "salah");
  assert.equal(satu("cetak(1 < 2, 2 <= 2, 3 > 4)"), "benar benar salah");
});

test("logika short-circuit", () => {
  assert.equal(satu("cetak(benar dan 5)"), "5");
  assert.equal(satu("cetak(salah dan 5)"), "salah");
  assert.equal(satu("cetak(salah atau 7)"), "7");
  assert.equal(satu("cetak(bukan benar)"), "salah");
});

test("bitwise", () => {
  assert.equal(satu("cetak(6 & 3, 6 | 1, 5 ^ 1, ~0, 1 << 4, 256 >> 2)"), "2 7 4 -1 16 64");
});

test("variabel global dan lokal blok", () => {
  assert.equal(satu("misal x = 10\n{ misal x = 20\n cetak(x) }\ncetak(x)"), "20\n10");
});

test("penugasan gabungan", () => {
  assert.equal(satu("misal x = 5\nx += 3\nx *= 2\ncetak(x)"), "16");
});

test("increment prefiks dan postfiks", () => {
  assert.equal(satu("misal x = 1\ncetak(x++)\ncetak(x)\ncetak(++x)"), "1\n2\n3");
});

test("if else dan ternary", () => {
  assert.equal(satu("jika (3 > 2) cetak(`ya`); lainnya cetak(`tidak`)"), "ya");
  assert.equal(satu('cetak(5 > 3 ? "besar" : "kecil")'), "besar");
});

test("while dan do-while", () => {
  assert.equal(satu("misal i = 0\nselama (i < 3) { cetak(i); i++ }"), "0\n1\n2");
  assert.equal(satu("misal i = 5\nlakukan { cetak(i) } selama (i > 5)"), "5");
});

test("for klasik dengan scope", () => {
  assert.equal(satu("misal s = 0\nuntuk (misal i = 1; i <= 4; i++) s += i\ncetak(s)"), "10");
});

test("fungsi, rekursi, closure", () => {
  assert.equal(satu("fungsi f(n){ jika(n<2){kembalikan n} kembalikan f(n-1)+f(n-2) }\ncetak(f(10))"), "55");
  assert.equal(
    satu("fungsi buat(){ misal n=0\n kembalikan ()=>{ n=n+1\n kembalikan n } }\nmisal c=buat()\ncetak(c(),c(),c())"),
    "1 2 3",
  );
});

test("hoisting fungsi lokal dan mutual", () => {
  assert.equal(
    satu("fungsi bungkus() { kembalikan pertama() }\nfungsi pertama() { kembalikan kedua() }\nfungsi kedua() { kembalikan 42 }\ncetak(bungkus())"),
    "42",
  );
  assert.equal(
    satu("fungsi luar() { fungsi a() { kembalikan 3 }\n fungsi b() { kembalikan a() * 2 }\n kembalikan b() }\ncetak(luar())"),
    "6",
  );
});

test("fungsi panah nilai balik ekspresi", () => {
  assert.equal(satu("misal kuadrat = x => x * x\ncetak(kuadrat(6))"), "36");
});

test("jenisdari", () => {
  assert.equal(satu('cetak(jenisdari 1, jenisdari "a", jenisdari benar, jenisdari kosong, jenisdari taktentu)'),
    "angka teks boolean kosong taktentu");
  assert.equal(satu("cetak(jenisdari 10n, jenisdari (()=>1))"), "bilanganbesar fungsi");
});

test("bilangan besar", () => {
  assert.equal(satu("cetak(10n + 20n, 2n ** 10n)"), "30 1024");
});

test("henti dan lanjut", () => {
  assert.equal(satu("untuk (misal i=0;i<5;i++){ jika(i==2) lanjut\n jika(i==4) henti\n cetak(i) }"), "0\n1\n3");
  assert.equal(satu("misal x=0\nselama(benar){ x++\n jika(x>=3) henti }\ncetak(x)"), "3");
});

test("henti dan lanjut berlabel", () => {
  const sumber = "luar: untuk(misal a=0;a<3;a++){ untuk(misal b=0;b<3;b++){ jika(b==1) lanjut luar\n cetak(a,b) } }";
  assert.equal(satu(sumber), "0 0\n1 0\n2 0");
});

test("pilih dengan fall-through dan bawaan", () => {
  assert.equal(
    satu('fungsi h(n){ pilih(n){ kasus 1: kembalikan "a"\n kasus 2: kembalikan "b"\n bawaan: kembalikan "z" } }\ncetak(h(1),h(2),h(9))'),
    "a b z",
  );
  assert.equal(
    satu("misal r=0\npilih(2){ kasus 1: r+=1\n kasus 2: r+=2\n kasus 3: r+=3 }\ncetak(r)"),
    "5",
  );
});

test("objek literal, akses, metode dengan ini", () => {
  assert.equal(satu('misal o = { a: 1, b: 2 }\ncetak(o.a, o["b"])'), "1 2");
  assert.equal(satu('misal o = { nama: "Sari", sapa() { kembalikan "Hai " + ini.nama } }\ncetak(o.sapa())'), "Hai Sari");
  assert.equal(satu("misal o = { x: 1 }\no.x += 5\no.y = 9\ncetak(o.x, o.y)"), "6 9");
  assert.equal(satu("misal k = `dinamis`\nmisal o = { [k]: 42 }\ncetak(o.dinamis)"), "42");
});

test("larik literal, indeks, panjang", () => {
  assert.equal(satu("misal a = [10, 20, 30]\ncetak(a[0], a[2], a.panjang)"), "10 30 3");
  assert.equal(satu("misal a = [1]\na[1] = 2\na[2] = 3\ncetak(a, a.panjang)"), "[1, 2, 3] 3");
});

test("spread larik dan objek", () => {
  assert.equal(satu("misal a = [1, 2]\ncetak([...a, 3, ...a])"), "[1, 2, 3, 1, 2]");
  assert.equal(satu('misal o = { a: 1 }\nmisal p = { ...o, b: 2 }\ncetak(p.a, p.b)'), "1 2");
});

test("optional chaining dan nullish", () => {
  assert.equal(satu("misal o = kosong\ncetak(o?.a?.b)"), "taktentu");
  assert.equal(satu("cetak(kosong ?? 5, 0 ?? 9, taktentu ?? 7)"), "5 0 7");
  assert.equal(satu("misal o = { f() { kembalikan 3 } }\ncetak(o?.f())"), "3");
});

test("nullish assign, and-assign, or-assign", () => {
  assert.equal(satu("misal x = kosong\nx ??= 5\ncetak(x)\nx ??= 9\ncetak(x)"), "5\n5");
  assert.equal(satu("misal a = 1\na &&= 2\ncetak(a)\nmisal b = 0\nb ||= 7\ncetak(b)"), "2\n7");
});

test("destrukturisasi larik dengan default dan sisa", () => {
  assert.equal(satu("misal [a, b, ...s] = [1, 2, 3, 4]\ncetak(a, b, s)"), "1 2 [3, 4]");
  assert.equal(satu("misal [x = 5, y = 6] = [10]\ncetak(x, y)"), "10 6");
  assert.equal(satu("misal [[p, q], r] = [[1, 2], 3]\ncetak(p, q, r)"), "1 2 3");
});

test("destrukturisasi objek dengan rename dan default", () => {
  assert.equal(satu("misal { a, b: c, d = 9 } = { a: 1, b: 2 }\ncetak(a, c, d)"), "1 2 9");
});

test("destrukturisasi penugasan", () => {
  assert.equal(satu("misal a = 0\nmisal b = 0\n;[a, b] = [3, 4]\ncetak(a, b)"), "3 4");
});

test("parameter default, sisa, dan pola", () => {
  assert.equal(satu("fungsi f(a, b = 2, ...r) { kembalikan a + b + r.panjang }\ncetak(f(1), f(1, 5, 9, 9))"), "3 8");
  assert.equal(satu("fungsi t({ x, y }) { kembalikan x * y }\ncetak(t({ x: 3, y: 4 }))"), "12");
  assert.equal(satu("misal f = ([a, b]) => a - b\ncetak(f([10, 3]))"), "7");
});

test("kelas: konstruktor, metode, ini", () => {
  const sumber = "kelas P { konstruktor(n) { ini.n = n }\n sapa() { kembalikan `Hai ${ini.n}` } }\nmisal p = baru P(`Sari`)\ncetak(p.sapa())";
  assert.equal(satu(sumber), "Hai Sari");
});

test("kelas: warisan, super konstruktor & metode", () => {
  const sumber =
    "kelas A { konstruktor(x){ ini.x = x }\n f(){ kembalikan `A${ini.x}` } }\n" +
    "kelas B mewarisi A { konstruktor(x){ induk(x) }\n f(){ kembalikan induk.f() + `B` } }\n" +
    "cetak(baru B(1).f())";
  assert.equal(satu(sumber), "A1B");
});

test("kelas: field, statis, getter/setter, privat", () => {
  const sumber =
    "kelas Hitung { statis total = 0\n #n = 0\n konstruktor(n){ ini.#n = n\n Hitung.total += 1 }\n" +
    " dapatkan nilai(){ kembalikan ini.#n }\n tetapkan nilai(v){ ini.#n = v } }\n" +
    "misal h = baru Hitung(5)\ncetak(h.nilai)\nh.nilai = 9\ncetak(h.nilai, Hitung.total)";
  assert.equal(satu(sumber), "5\n9 1");
});

test("kelas: contohdari", () => {
  assert.equal(satu("kelas A {}\nkelas B mewarisi A {}\nmisal b = baru B()\ncetak(b contohdari B, b contohdari A)"), "benar benar");
});

test("operator dalam", () => {
  assert.equal(satu('misal o = { a: 1 }\ncetak("a" dalam o, "b" dalam o)'), "benar salah");
});

test("coba/tangkap menangkap lemparan", () => {
  assert.equal(satu('coba { lempar "aduh" } tangkap (e) { cetak("dapat:", e) }'), "dapat: aduh");
  assert.equal(
    satu('coba { lempar baru GalatTipe("x") } tangkap (e) { cetak(e.nama, e.pesan) }'),
    "GalatTipe x",
  );
});

test("akhirnya selalu berjalan", () => {
  assert.equal(satu('coba { cetak("a") } akhirnya { cetak("b") }'), "a\nb");
  assert.equal(
    satu('coba { lempar "x" } tangkap (e) { cetak("c") } akhirnya { cetak("d") }'),
    "c\nd",
  );
});

test("galat runtime dapat ditangkap sebagai objek InDo", () => {
  assert.equal(
    satu('coba { misal o = kosong\n cetak(o.x) } tangkap (e) { cetak(e.nama) }'),
    "GalatTipe",
  );
  assert.equal(
    satu('coba { cetak(takAda) } tangkap (e) { cetak(e.nama) }'),
    "GalatReferensi",
  );
});

test("hierarki galat dan contohdari", () => {
  assert.equal(satu("cetak(baru GalatTipe(`x`) contohdari Galat)"), "benar");
  assert.equal(satu('misal g = baru GalatRentang("r")\ncetak(g.nama, g contohdari GalatRentang, g contohdari Galat)'), "GalatRentang benar benar");
});

test("tangkap tanpa variabel", () => {
  assert.equal(satu('coba { lempar 1 } tangkap { cetak("tertangkap") }'), "tertangkap");
});

test("untuk...dari atas larik dan teks", () => {
  assert.equal(satu("misal s = 0\nuntuk (misal x dari [1, 2, 3]) s += x\ncetak(s)"), "6");
  assert.equal(satu('misal r = ""\nuntuk (misal c dari "abc") r = c + r\ncetak(r)'), "cba");
});

test("untuk...dalam atas objek", () => {
  assert.equal(satu('misal o = { a: 1, b: 2 }\nmisal k = ""\nuntuk (misal x dalam o) k += x\ncetak(k)'), "ab");
});

test("simbol dan protokol iterator kustom", () => {
  assert.equal(satu('cetak(jenisdari Simbol("x"))'), "simbol");
  assert.equal(
    satu("misal it = { [Simbol.iterator]() { misal i = 0\n kembalikan { lanjut() { i += 1\n kembalikan { nilai: i, selesai: i > 3 } } } } }\nmisal j = 0\nuntuk (misal v dari it) j += v\ncetak(j)"),
    "6",
  );
});

test("henti dan lanjut di untuk...dari", () => {
  assert.equal(satu("misal s = 0\nuntuk (misal x dari [1, 2, 3, 4, 5]) { jika (x == 4) henti\n jika (x == 2) lanjut\n s += x }\ncetak(s)"), "4");
});

test("generator dasar dan lanjut", () => {
  assert.equal(
    satu("fungsi* g() { hasilkan 1\n hasilkan 2\n hasilkan 3 }\nmisal it = g()\ncetak(it.lanjut().nilai, it.lanjut().nilai, it.lanjut().nilai, it.lanjut().selesai)"),
    "1 2 3 benar",
  );
});

test("generator dengan untuk...dari", () => {
  assert.equal(satu("fungsi* r(n) { untuk (misal i = 0; i < n; i++) hasilkan i }\nmisal s = 0\nuntuk (misal x dari r(5)) s += x\ncetak(s)"), "10");
});

test("hasilkan* mendelegasikan", () => {
  assert.equal(
    satu('fungsi* a() { hasilkan 1\n hasilkan 2 }\nfungsi* b() { hasilkan 0\n hasilkan* a()\n hasilkan 3 }\nmisal h = []\nuntuk (misal v dari b()) h = [...h, v]\ncetak(h)'),
    "[0, 1, 2, 3]",
  );
});

test("generator komunikasi dua arah", () => {
  assert.equal(
    satu('fungsi* g() { misal x = hasilkan "minta"\n hasilkan x + 1 }\nmisal it = g()\ncetak(it.lanjut().nilai)\ncetak(it.lanjut(10).nilai)'),
    "minta\n11",
  );
});

test("janji lalu dan tangkap", () => {
  assert.equal(satu('Janji.selesaikan(5).lalu((n) => cetak("nilai:", n))'), "nilai: 5");
  assert.equal(satu('Janji.tolak(baru Galat("x")).tangkap((e) => cetak("galat:", e.pesan))'), "galat: x");
});

test("asinkron/tunggu", () => {
  assert.equal(
    satu("asinkron fungsi f() { misal a = tunggu Janji.selesaikan(3)\n misal b = tunggu Janji.selesaikan(4)\n kembalikan a + b }\nf().lalu((r) => cetak(r))"),
    "7",
  );
});

test("tunggu menangkap penolakan via coba", () => {
  assert.equal(
    satu('asinkron fungsi f() { coba { tunggu Janji.tolak(baru GalatTipe("gagal")) } tangkap (e) { kembalikan e.pesan } }\nf().lalu((r) => cetak(r))'),
    "gagal",
  );
});

test("urutan mikrotask sebelum makrotask", () => {
  const keluaran = jalankan('cetak("A")\naturWaktu(() => cetak("timer"), 0)\nJanji.selesaikan().lalu(() => cetak("mikro"))\ncetak("B")');
  assert.deepEqual(keluaran, ["A", "B", "mikro", "timer"]);
});

test("Janji.semua dan balapan", () => {
  assert.equal(satu("Janji.semua([Janji.selesaikan(1), Janji.selesaikan(2)]).lalu((r) => cetak(r))"), "[1, 2]");
});

test("timer dengan aturWaktu berurutan", () => {
  const keluaran = jalankan('aturWaktu(() => cetak("lambat"), 20)\naturWaktu(() => cetak("cepat"), 5)');
  assert.deepEqual(keluaran, ["cepat", "lambat"]);
});

test("galat: baca properti dari kosong", () => {
  assert.throws(() => jalankan("misal o = kosong\ncetak(o.x)"), LemparInDo);
});

test("galat: menugaskan ulang konstanta", () => {
  assert.throws(() => jalankan("{ tetap x = 1\n x = 2 }"), GalatKompilasi);
});

test("galat: variabel belum didefinisikan", () => {
  assert.throws(() => jalankan("cetak(entah)"), LemparInDo);
});

test("galat: memanggil yang bukan fungsi", () => {
  assert.throws(() => jalankan("misal x = 5\nx()"), LemparInDo);
});

test("galat: tipe tidak cocok aritmatika", () => {
  assert.throws(() => jalankan("cetak(benar - 1)"), LemparInDo);
});

test("galat: kembalikan di luar fungsi", () => {
  assert.throws(() => jalankan("kembalikan 1"), GalatKompilasi);
});

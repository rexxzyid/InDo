# InDo

**Bahasa pemrograman modern dengan kata kunci berbahasa Indonesia.**

InDo setara dengan JavaScript modern (ECMAScript) ditambah runtime mirip Node
(berkas, proses, jaringan), tetapi seluruh kata kuncinya berbahasa Indonesia.
Berkas sumber memakai ekstensi `.wni`.

```wni
fungsi salam(nama) {
  kembalikan `Halo, ${nama}!`
}

untuk (tetap orang dari ["Dunia", "InDo"]) {
  cetak(salam(orang))
}
```

## Instalasi

```bash
npm install -g @rexxhayanasi/b-indo
```

Perintah CLI-nya tetap `indo`.

Atau jalankan langsung dari repositori:

```bash
npm install
npm run build
```

## Penggunaan

```bash
indo jalankan program.wni     # menjalankan program
indo periksa program.wni      # cek galat sintaks tanpa menjalankan
indo rapikan program.wni      # memformat kode otomatis
indo tes                      # menjalankan berkas *.tes.wni
indo mandiri program.wni      # menjalankan lewat compiler InDo (self-hosting)
indo lsp                      # server bahasa untuk editor
indo                          # REPL interaktif
```

## Kata Kunci

| Indonesia | Padanan | Indonesia | Padanan |
| --- | --- | --- | --- |
| `misal` / `tetap` / `var` | let / const / var | `fungsi` | function |
| `jika` / `lainnya` | if / else | `kembalikan` | return |
| `selama` | while | `lakukan` | do |
| `untuk` / `dari` / `dalam` | for / of / in | `henti` / `lanjut` | break / continue |
| `pilih` / `kasus` / `bawaan` | switch / case / default | `hasilkan` | yield |
| `kelas` / `mewarisi` | class / extends | `baru` | new |
| `ini` / `induk` | this / super | `konstruktor` | constructor |
| `statis` / `dapatkan` / `tetapkan` | static / get / set | `coba` / `tangkap` / `akhirnya` | try / catch / finally |
| `lempar` | throw | `asinkron` / `tunggu` | async / await |
| `impor` / `ekspor` / `sebagai` | import / export / as | `benar` / `salah` | true / false |
| `kosong` / `taktentu` | null / undefined | `dan` / `atau` / `bukan` | && / \|\| / ! |
| `jenisdari` / `contohdari` | typeof / instanceof | `hapus` | delete |

## Fitur

- Variabel, semua operator (aritmatika, bitwise, logika, nullish, opsional).
- Fungsi, closure, fungsi panah, parameter bawaan & sisa, destrukturisasi.
- Kelas: pewarisan, `induk`, getter/setter, field & blok statis, field privat (`#`).
- `coba/tangkap/akhirnya`, hierarki galat (`Galat`, `GalatTipe`, dll).
- Generator (`fungsi*`, `hasilkan`, `hasilkan*`), iterator, `untuk...dari`.
- `asinkron`/`tunggu`, `Janji`, timer — event loop dengan urutan mikro/makro seperti Node.
- Modul: `impor`/`ekspor` (default, bernama, namespace, dinamis).
- Pustaka standar: `Matematika`, `JSON`, `Objek`, `Larik`, `Teks`, `Peta`, `Himpunan`,
  `Tanggal`, `RegEx`, dan runtime `Berkas`, `Jalur`, `Proses`, `Jaringan`, `Kripto`.

Lihat [`DOKUMENTASI.md`](DOKUMENTASI.md) untuk referensi lengkap dan [`contoh/`](contoh/)
untuk contoh program.

## Self-Hosting

Tujuan akhir InDo tercapai: **compiler-nya ditulis dalam InDo sendiri.**
Folder [`mandiri/`](mandiri/) berisi lexer, parser, dan compiler berbahasa `.wni`.
Mesin benih (TypeScript) hanya menjalankan compiler tersebut.

Setiap tahap dibuktikan **identik** dengan implementasi benih lewat tes diferensial:
lexer (token), parser (AST), dan compiler (bytecode) menghasilkan keluaran yang
sama persis — termasuk saat memproses sumbernya sendiri.

```bash
npm run verifikasi:bootstrap
```

## Pengembangan

```bash
npm test          # seluruh tes (unit, golden, diferensial, bootstrap)
npm run benchmark # tolok ukur performa
```

InDo diimplementasikan sebagai lexer → parser (Pratt) → compiler bytecode → mesin
virtual berbasis stack, dengan closure gaya clox (upvalue) dan event loop asinkron.

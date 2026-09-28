# InDo Mandiri (Self-Hosting)

Folder ini berisi **compiler InDo yang ditulis dalam bahasa InDo sendiri** (`.wni`).
Inilah inti dari tujuan akhir proyek: bahasa yang meng-compile dirinya sendiri.

## Berkas

| Berkas | Isi |
| --- | --- |
| `lexer.wni` | Tokenizer: mengubah teks sumber menjadi daftar token. |
| `literal.wni` | Pengurai literal: angka, bilangan besar, teks, escape, template. |
| `parser.wni` | Parser Pratt: mengubah token menjadi pohon sintaks (AST). |
| `kompiler.wni` | Compiler: mengubah AST menjadi bytecode untuk mesin virtual. |
| `bootstrap.wni` | Harness: meng-compile sebuah program lalu memancarkan bytecode sebagai JSON. |
| `uji-*.wni` | Harness pembanding untuk tes diferensial. |

## Rantai Bootstrap

Mesin benih (implementasi TypeScript) hanya dipakai untuk **menjalankan** compiler
berbahasa InDo. Program pengguna di-compile oleh compiler `.wni`, bukan oleh TypeScript.

```
sumber pengguna (.wni)
      │
      ▼
  lexer.wni  →  parser.wni  →  kompiler.wni      (semuanya berbahasa InDo)
      │                              │
      │                              ▼
      │                          bytecode
      │                              │
      ▼                              ▼
  dijalankan di atas mesin virtual (benih), menghasilkan keluaran
```

## Bukti Kesetaraan (diuji otomatis)

Setiap tahap dibuktikan **identik** dengan implementasi benih lewat tes diferensial
(lihat `src/mandiri/*.test.ts`):

- **Lexer** — token yang dihasilkan `lexer.wni` sama persis dengan lexer benih,
  termasuk saat me-lex sumbernya sendiri.
- **Parser** — AST yang dihasilkan `parser.wni` sama persis, termasuk
  mem-parse sumbernya sendiri.
- **Compiler** — bytecode (opcode, operan, konstanta, nomor baris) sama persis,
  termasuk meng-compile sumbernya sendiri.
- **Bootstrap** — bytecode yang dihasilkan compiler InDo dieksekusi mesin virtual
  dan keluarannya sama dengan pipeline benih.

## Mencoba Sendiri

```bash
npm run build
node dist/cli/index.js mandiri contoh/kalkulator.wni
```

Perintah `indo mandiri <berkas>` meng-compile berkas memakai compiler berbahasa InDo
di folder ini, lalu menjalankan bytecode hasilnya. Keluarannya identik dengan
`indo jalankan <berkas>` yang memakai pipeline benih.

# PERFORMA — Bahasa Pemrograman InDo

Dokumen ini mencatat hasil pengukuran performa InDo secara jujur, apa adanya.

## Ringkasan

InDo dijalankan oleh Virtual Machine berbasis stack yang **ditulis dengan TypeScript
dan berjalan di atas Node.js (V8)**. Artinya setiap instruksi bytecode InDo dijalankan
oleh beberapa operasi JavaScript, lalu JavaScript itu sendiri dijalankan oleh V8. Ada dua
lapisan interpretasi.

Karena itu, **target awal "lebih cepat daripada CPython" tidak tercapai** dengan pilihan
implementasi TypeScript. Ini konsekuensi yang sudah diperkirakan sejak awal ketika memilih
TypeScript (bukan Go) sebagai bahasa "benih". Angka di bawah menunjukkan InDo saat ini
sekitar **3–8x lebih lambat daripada CPython** untuk beban kerja hitung murni.

Untuk benar-benar melampaui CPython dibutuhkan mesin dalam bahasa yang dikompilasi ke kode
mesin (mis. Go/Rust) atau tahap self-hosting dengan optimasi agresif (lihat Fase 12).

## Cara mengukur

```
npm run build
node benchmark/jalankan.mjs
```

Setiap angka mencakup waktu start Node (~80 ms) dan kompilasi + eksekusi prelude.

## Hasil (mesin pengembangan, Node.js 22)

| Benchmark   | InDo     | CPython 3 | Keterangan |
|-------------|----------|-----------|------------|
| `fib(30)`   | ~0.88 s  | ~0.12 s   | rekursi berat |
| loop 10 juta| ~2.87 s  | ~0.72 s   | penambahan dalam loop |
| larik besar | ~0.29 s  | —         | petakan/saring/kurangi 100rb elemen |
| akses properti | ~0.66 s | —       | 1 juta akses `o.a` |
| teks        | ~0.16 s  | —         | 100rb penggabungan |
| banyak Janji| ~1.05 s  | —         | 100rb `tunggu` |

Perbandingan langsung untuk `fib(30)` dan loop 10 juta: InDo lebih lambat dari CPython
(sekitar 7x pada fib, 4x pada loop). Disampaikan apa adanya sesuai prioritas kejujuran.

## Optimasi yang sudah diterapkan

- Resolusi variabel lokal ke slot saat kompilasi (bukan lookup map saat runtime).
- Closure dengan upvalue bergaya clox (Crafting Interpreters).
- Constant folding untuk ekspresi biner atas literal angka/teks (mis. `60 * 60 * 24`).
- Deduplikasi konstanta (interning nama properti & literal) pada tabel konstanta.
- `kode` dan `konstanta` frame di-cache sebagai variabel lokal di loop VM.
- Angka direpresentasikan sebagai nilai JavaScript primitif (tanpa alokasi heap tambahan).

## Optimasi lanjutan (belum, untuk pekerjaan berikutnya)

- Caching `ip` sebagai variabel lokal murni di loop VM (butuh sinkronisasi hati-hati agar
  stack trace tetap akurat).
- Inline caching untuk akses properti dengan shape / hidden class.
- Instruksi khusus gabungan (mis. `BacaLokal`+`Tambah` untuk pola `i + k`).
- Eliminasi kode mati yang lebih menyeluruh.
- Profiling: jalankan `node --prof dist/cli/index.js jalankan benchmark/loop.wni` lalu
  `node --prof-process isolate-*.log` untuk menemukan titik panas.

## Catatan

Prioritas proyek: (1) benar & terbukti oleh tes, (2) efisien, (3) pesan galat jelas.
Kebenaran diutamakan; optimasi dilakukan selama tidak mengorbankan kebenaran yang sudah
dibuktikan 150+ tes.

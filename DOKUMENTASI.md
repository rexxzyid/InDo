# Dokumentasi Bahasa InDo

Referensi lengkap bahasa InDo. Berkas sumber berekstensi `.wni`.

## Daftar Isi

1. [Sintaks Dasar](#sintaks-dasar)
2. [Tipe & Literal](#tipe--literal)
3. [Operator](#operator)
4. [Alur Kontrol](#alur-kontrol)
5. [Fungsi](#fungsi)
6. [Destrukturisasi](#destrukturisasi)
7. [Kelas](#kelas)
8. [Galat](#galat)
9. [Generator & Iterator](#generator--iterator)
10. [Asinkron](#asinkron)
11. [Modul](#modul)
12. [Pustaka Standar](#pustaka-standar)

## Sintaks Dasar

Pernyataan diakhiri baris baru atau `;`. Komentar memakai `//` (baris) dan `/* */` (blok).

```wni
misal a = 1        // dapat diubah
tetap b = 2        // konstanta
var c = 3          // gaya lama, lingkup fungsi
cetak(a + b + c)
```

## Tipe & Literal

- **Angka**: `42`, `3.14`, `1e10`, `0xFF`, `0b1010`, `0o17`, `1_000_000`.
- **Bilangan besar**: `123n`, `0xFFn`.
- **Teks**: `"halo"`, `'halo'`, dan template `` `nilai ${x}` ``.
- **Boolean**: `benar`, `salah`.
- **Kosong**: `kosong` (null), `taktentu` (undefined).
- **Larik**: `[1, 2, 3]`.
- **Objek**: `{ nama: "InDo", versi: 1 }`.
- **RegEx**: `/pola/bendera`.

## Operator

- Aritmatika: `+`, `-`, `*`, `/`, `%`, `**`.
- Perbandingan: `==`, `!=`, `===`, `!==`, `<`, `>`, `<=`, `>=` (`==` bersifat ketat).
- Logika: `dan`, `atau`, `bukan` (juga `&&`, `||`, `!`).
- Nullish: `??`, akses opsional `?.`.
- Bitwise: `&`, `|`, `^`, `~`, `<<`, `>>`, `>>>`.
- Penugasan: `=`, `+=`, `-=`, `*=`, `/=`, `%=`, `**=`, `&&=`, `||=`, `??=`, dll.
- Lain: `jenisdari`, `contohdari`, `dalam`, `hapus`, sebar `...`.

## Alur Kontrol

```wni
jika (nilai > 0) {
  cetak("positif")
} lainnya jika (nilai < 0) {
  cetak("negatif")
} lainnya {
  cetak("nol")
}

pilih (warna) {
  kasus "merah":
    cetak("berhenti")
    henti
  bawaan:
    cetak("jalan")
}

selama (i < 10) { i++ }
lakukan { i-- } selama (i > 0)

untuk (misal i = 0; i < 5; i++) cetak(i)
untuk (tetap x dari [1, 2, 3]) cetak(x)
untuk (tetap kunci dalam objek) cetak(kunci)
```

`henti` dan `lanjut` mendukung label:

```wni
luar: untuk (tetap baris dari matriks) {
  untuk (tetap sel dari baris) {
    jika (sel == 0) lanjut luar
  }
}
```

## Fungsi

```wni
fungsi tambah(a, b = 0, ...sisa) {
  kembalikan a + b + sisa.kurangi((s, x) => s + x, 0)
}

tetap kali = (a, b) => a * b
tetap kuadrat = x => x * x
```

Closure menangkap variabel dari lingkup luar:

```wni
fungsi pencacah() {
  misal n = 0
  kembalikan () => { n = n + 1; kembalikan n }
}
```

## Destrukturisasi

```wni
tetap [pertama, kedua, ...selebihnya] = daftar
tetap { nama, umur = 0, alamat: kota } = orang
fungsi proses({ id, data }) { kembalikan id }
```

## Kelas

```wni
kelas Hewan {
  konstruktor(nama) {
    ini.nama = nama
  }
  suara() {
    kembalikan "..."
  }
  statis buat(nama) {
    kembalikan baru Hewan(nama)
  }
}

kelas Kucing mewarisi Hewan {
  #nyawa = 9
  konstruktor(nama) {
    induk(nama)
  }
  suara() {
    kembalikan induk.suara() + " meong"
  }
  dapatkan nyawa() {
    kembalikan ini.#nyawa
  }
  tetapkan nyawa(n) {
    ini.#nyawa = n
  }
}
```

Mendukung: `mewarisi`, `induk`, `statis`, blok `statis { }`, getter (`dapatkan`),
setter (`tetapkan`), dan field privat (`#nama`).

## Galat

```wni
coba {
  lempar baru GalatTipe("tipe salah")
} tangkap (galat) {
  cetak(galat.nama + ": " + galat.pesan)
} akhirnya {
  cetak("selalu jalan")
}
```

Hierarki galat bawaan: `Galat`, `GalatTipe`, `GalatReferensi`, `GalatSintaks`,
`GalatRentang`, `GalatAgregat`.

## Generator & Iterator

```wni
fungsi* angka() {
  hasilkan 1
  hasilkan 2
  hasilkan* [3, 4]      // delegasi
}

untuk (tetap n dari angka()) cetak(n)
```

## Asinkron

```wni
asinkron fungsi ambilData() {
  tetap a = tunggu janjiSatu()
  tetap b = tunggu janjiDua()
  kembalikan a + b
}

Janji.semua([p1, p2, p3]).lalu((hasil) => cetak(hasil))
```

`Janji` menyediakan `selesaikan`, `tolak`, `semua`, `semuaSelesai`, `salahSatu`,
`balapan`, serta metode instance `lalu`, `tangkap`, `akhirnya`.
Timer: `aturWaktu(fn, ms)`, `aturInterval(fn, ms)`.

## Modul

```wni
// pustaka.wni
ekspor fungsi sapa(nama) { kembalikan "Halo " + nama }
ekspor tetap VERSI = 1
ekspor bawaan kelas Aplikasi {}

// utama.wni
impor Aplikasi, { sapa, VERSI } dari "./pustaka.wni"
impor * sebagai pustaka dari "./pustaka.wni"
tetap modul = tunggu impor("./dinamis.wni")   // impor dinamis
```

## Pustaka Standar

### Global

`cetak`, `uraiAngka`, `uraiBulat`, `BilanganBesar`, `adalahNaN`, `adalahTerhingga`,
`masukan`, `pastikan`, `Takhingga`, `NaN`.

### Teks

`besar`, `kecil`, `iris`, `potong`, `pisah`, `ganti`, `gantiSemua`, `berisi`,
`diawali`, `diakhiri`, `ulangi`, `rapikan`, `rapikanAwal`, `rapikanAkhir`,
`isiAwal`, `isiAkhir`, `indeksDari`, `karakterDi`, `kodeDi`, `normalisasi`,
`cocok`, `cocokSemua`, `cari`. Properti `panjang`. Statik: `Teks.dariKode`.

### Larik

`tambah`, `hapusAkhir`, `hapusAwal`, `tambahAwal`, `sambung`, `iris`, `sambat`,
`petakan`, `saring`, `untukSetiap`, `kurangi`, `kurangiKanan`, `cari`, `cariIndeks`,
`cariTerakhir`, `setiap`, `beberapa`, `berisi`, `indeksDari`, `gabung`, `balik`,
`urutkan`, `diurutkan`, `dibalik`, `ratakan`, `ratakanPeta`, `isi`, `di`, `kunci`,
`nilai`, `entri`, `dengan`. Statik: `Larik.dari`, `Larik.adalahLarik`.

### Angka & Matematika

Angka: `keTetap`, `kePresisi`, `keTeks`. Statik: `Angka.adalahBulat`, `adalahNaN`,
`adalahTerhingga`, `EPSILON`, `MAKS_AMAN`, `MIN_AMAN`.

Matematika: `PI`, `E`, `akar`, `akarKubik`, `pangkat`, `bulatkan`, `bawah`, `atas`,
`potong`, `mutlak`, `tanda`, `acak`, `maks`, `min`, `sin`, `cos`, `tan`, `asin`,
`acos`, `atan`, `eksp`, `log`, `hipotenusa`.

### Objek & JSON

Objek: `kunci`, `nilai`, `entri`, `dariEntri`, `tetapkan`, `bekukan`, `adalahBeku`,
`segel`, `buat`, `ambilPrototipe`, `aturPrototipe`, `milikSendiri`.

JSON: `JSON.teks(nilai)`, `JSON.urai(teks)`.

### Koleksi

`Peta`: `tetapkan`, `ambil`, `punya`, `hapus`, `bersihkan`, `kunci`, `nilai`,
`entri`, `untukSetiap`, properti `ukuran`.
`Himpunan`: `tambah`, `punya`, `hapus`, `bersihkan`, `nilai`, `untukSetiap`,
properti `ukuran`. Tersedia juga `PetaLemah`, `HimpunanLemah`, `RefLemah`.

### Tanggal & RegEx

Tanggal: `ambilTahun`, `ambilBulan`, `ambilTanggal`, `ambilHari`, `ambilJam`,
`ambilMenit`, `ambilDetik`, `aturTahun`, `aturBulan`, `aturTanggal`, `keWaktu`,
`keISO`, `keTeksIndonesia`. Statik: `Tanggal.sekarang`.

RegEx: `uji`, `jalankan`, `sumber`, `bendera`, `indeksTerakhir`.

### Runtime

`Berkas`: `baca`, `tulis`, `tambahkan`, `hapus`, `ada`, `daftarIsi`, `buatFolder`, `info`.
`Jalur`: `gabung`, `namaBerkas`, `ekstensi`, `folder`, `absolut`.
`Proses`: `argumen`, `lingkungan`, `folderKerja`, `keluar`.
`Jaringan`: pengambilan HTTP dan server dasar (asinkron).
`Kripto`: `acakUUID`, `hash`, `byteAcak`.

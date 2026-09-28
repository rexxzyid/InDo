export const PRELUDE = `
kelas Galat {
  konstruktor(pesan, opsi) {
    ini.pesan = pesan ?? ""
    ini.nama = "Galat"
    ini.tumpukan = ""
    ini.sebab = opsi?.sebab
  }
  keTeks() {
    kembalikan ini.pesan == "" ? ini.nama : ini.nama + ": " + ini.pesan
  }
}
kelas GalatTipe mewarisi Galat {
  konstruktor(pesan, opsi) { induk(pesan, opsi); ini.nama = "GalatTipe" }
}
kelas GalatReferensi mewarisi Galat {
  konstruktor(pesan, opsi) { induk(pesan, opsi); ini.nama = "GalatReferensi" }
}
kelas GalatSintaks mewarisi Galat {
  konstruktor(pesan, opsi) { induk(pesan, opsi); ini.nama = "GalatSintaks" }
}
kelas GalatRentang mewarisi Galat {
  konstruktor(pesan, opsi) { induk(pesan, opsi); ini.nama = "GalatRentang" }
}
kelas GalatAgregat mewarisi Galat {
  konstruktor(galatGalat, pesan, opsi) {
    induk(pesan, opsi)
    ini.nama = "GalatAgregat"
    ini.galat = galatGalat
  }
}
`;

import { NAMA_BAHASA, VERSI } from "../versi.js";
import { periksaBerkas } from "./periksa.js";
import { jalankanBerkas } from "./jalankan.js";
import { rapikanBerkas } from "./rapikan.js";
import { jalankanTes } from "./tes.js";
import { jalankanRepl } from "./repl.js";
import { jalankanLsp } from "../lsp/server.js";
import { jalankanBerkasMandiri } from "./mandiri.js";

export interface Keluaran {
  tulis(pesan: string): void;
  galat(pesan: string): void;
}

export const keluaranKonsol: Keluaran = {
  tulis(pesan) {
    process.stdout.write(pesan + "\n");
  },
  galat(pesan) {
    process.stderr.write(pesan + "\n");
  },
};

const BANTUAN = `${NAMA_BAHASA} v${VERSI}

Penggunaan:
  indo jalankan <berkas.wni>    Menjalankan program
  indo periksa <berkas.wni>     Mengecek galat sintaks tanpa menjalankan
  indo rapikan <berkas.wni>     Memformat kode secara otomatis
  indo tes                      Menjalankan berkas *.tes.wni
  indo mandiri <berkas.wni>     Menjalankan lewat compiler InDo (self-hosting)
  indo lsp                      Menjalankan server bahasa (LSP) lewat stdio
  indo versi                    Menampilkan versi
  indo                          Membuka REPL`;

export function jalankanCli(argumen: string[], keluaran: Keluaran = keluaranKonsol): number | Promise<number> {
  const [perintah, ...sisa] = argumen;

  switch (perintah) {
    case undefined:
      return jalankanRepl();

    case "versi":
    case "--versi":
    case "-v":
      keluaran.tulis(`${NAMA_BAHASA} v${VERSI}`);
      return 0;

    case "bantuan":
    case "--bantuan":
    case "-b":
      keluaran.tulis(BANTUAN);
      return 0;

    case "periksa": {
      const berkas = sisa[0];
      if (berkas === undefined) {
        keluaran.galat(`Penggunaan: indo periksa <berkas.wni>`);
        return 1;
      }
      return periksaBerkas(berkas, keluaran);
    }

    case "jalankan": {
      const berkas = sisa[0];
      if (berkas === undefined) {
        keluaran.galat(`Penggunaan: indo jalankan <berkas.wni>`);
        return 1;
      }
      return jalankanBerkas(berkas, keluaran);
    }

    case "rapikan": {
      const berkas = sisa[0];
      if (berkas === undefined) {
        keluaran.galat(`Penggunaan: indo rapikan <berkas.wni>`);
        return 1;
      }
      return rapikanBerkas(berkas, keluaran);
    }

    case "tes":
      return jalankanTes(sisa[0], keluaran);

    case "mandiri": {
      const berkas = sisa[0];
      if (berkas === undefined) {
        keluaran.galat(`Penggunaan: indo mandiri <berkas.wni>`);
        return 1;
      }
      return jalankanBerkasMandiri(berkas, keluaran);
    }

    case "lsp":
      jalankanLsp();
      return new Promise<number>(() => {});

    default:
      keluaran.galat(`Perintah tidak dikenal: "${perintah}".`);
      keluaran.galat(`Jalankan "indo bantuan" untuk daftar perintah.`);
      return 1;
  }
}

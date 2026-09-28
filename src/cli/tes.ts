import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { jalankanSumber } from "./jalankan.js";
import type { Keluaran } from "./cli.js";

function cariBerkasTes(akar: string): string[] {
  const hasil: string[] = [];
  const jelajah = (dir: string): void => {
    for (const nama of readdirSync(dir)) {
      const penuh = join(dir, nama);
      if (nama === "node_modules" || nama === ".git" || nama === "dist") continue;
      const s = statSync(penuh);
      if (s.isDirectory()) jelajah(penuh);
      else if (nama.endsWith(".tes.wni")) hasil.push(penuh);
    }
  };
  jelajah(akar);
  return hasil.sort();
}

export async function jalankanTes(argJalur: string | undefined, keluaran: Keluaran): Promise<number> {
  const akar = resolve(argJalur ?? ".");
  if (!existsSync(akar)) {
    keluaran.galat(`Jalur tidak ditemukan: ${akar}`);
    return 1;
  }
  const berkas = statSync(akar).isDirectory() ? cariBerkasTes(akar) : [akar];
  if (berkas.length === 0) {
    keluaran.tulis("Tidak ada berkas *.tes.wni ditemukan.");
    return 0;
  }
  let lulus = 0;
  let gagal = 0;
  for (const b of berkas) {
    const galatBaris: string[] = [];
    const tangkap: Keluaran = { tulis: () => {}, galat: (t) => galatBaris.push(t) };
    const sumber = readFileSync(b, "utf8");
    const kode = await jalankanSumber(sumber, b, tangkap);
    if (kode === 0) {
      keluaran.tulis(`  LULUS  ${b}`);
      lulus += 1;
    } else {
      keluaran.tulis(`  GAGAL  ${b}`);
      for (const g of galatBaris) keluaran.tulis(`         ${g}`);
      gagal += 1;
    }
  }
  keluaran.tulis(`\n${lulus} lulus, ${gagal} gagal, dari ${berkas.length} berkas tes.`);
  return gagal > 0 ? 1 : 0;
}

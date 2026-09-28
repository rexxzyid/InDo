export function uraiAngka(teks: string): number {
  return Number(teks.replace(/_/g, ""));
}

export function uraiBilanganBesar(teks: string): bigint {
  const tanpaAkhiran = teks.slice(0, -1).replace(/_/g, "");
  return BigInt(tanpaAkhiran);
}

export function uraiTeks(teks: string): string {
  return bacaEscape(teks.slice(1, -1));
}

export interface BagianTemplate {
  bagian: string[];
  mentah: string[];
}

export function irisTemplate(teksToken: string, ragam: string): { mentah: string } {
  let isi: string;
  switch (ragam) {
    case "TemplateUtuh":
      isi = teksToken.slice(1, -1);
      break;
    case "TemplateKepala":
      isi = teksToken.slice(1, -2);
      break;
    case "TemplateTengah":
      isi = teksToken.slice(1, -2);
      break;
    default:
      isi = teksToken.slice(1, -1);
      break;
  }
  return { mentah: isi };
}

export function masakTemplate(mentah: string): string {
  return bacaEscape(mentah);
}

function bacaEscape(teks: string): string {
  let hasil = "";
  let i = 0;
  while (i < teks.length) {
    const karakter = teks[i];
    if (karakter !== "\\") {
      hasil += karakter;
      i += 1;
      continue;
    }
    i += 1;
    const lepas = teks[i] ?? "";
    switch (lepas) {
      case "n":
        hasil += "\n";
        i += 1;
        break;
      case "t":
        hasil += "\t";
        i += 1;
        break;
      case "r":
        hasil += "\r";
        i += 1;
        break;
      case "b":
        hasil += "\b";
        i += 1;
        break;
      case "f":
        hasil += "\f";
        i += 1;
        break;
      case "v":
        hasil += "\v";
        i += 1;
        break;
      case "0":
        if (!/[0-9]/.test(teks[i + 1] ?? "")) {
          hasil += "\0";
          i += 1;
          break;
        }
        hasil += "0";
        i += 1;
        break;
      case "x": {
        const heks = teks.slice(i + 1, i + 3);
        hasil += String.fromCharCode(parseInt(heks, 16));
        i += 3;
        break;
      }
      case "u": {
        if (teks[i + 1] === "{") {
          const tutup = teks.indexOf("}", i + 2);
          const heks = teks.slice(i + 2, tutup);
          hasil += String.fromCodePoint(parseInt(heks, 16));
          i = tutup + 1;
        } else {
          const heks = teks.slice(i + 1, i + 5);
          hasil += String.fromCharCode(parseInt(heks, 16));
          i += 5;
        }
        break;
      }
      case "\n":
        i += 1;
        break;
      case "\r":
        i += 1;
        if (teks[i] === "\n") i += 1;
        break;
      default:
        hasil += lepas;
        i += 1;
        break;
    }
  }
  return hasil;
}

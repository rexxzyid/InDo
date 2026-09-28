import type { Readable, Writable } from "node:stream";
import { urai } from "../parser/parser.js";
import { GalatSintaks } from "../galat/kompilasi.js";
import { KATA_KUNCI } from "../lexer/token.js";

interface Pesan {
  jsonrpc: "2.0";
  id?: number | string | undefined;
  method?: string | undefined;
  params?: unknown;
  result?: unknown;
}

const KATA_LENGKAP: string[] = [
  ...KATA_KUNCI.keys(),
  "cetak",
  "Matematika",
  "Konsol",
  "JSON",
  "Objek",
  "Larik",
  "Teks",
  "Angka",
  "Janji",
  "Peta",
  "Himpunan",
  "Tanggal",
  "RegEx",
  "Berkas",
  "Jalur",
  "Proses",
  "Jaringan",
  "Kripto",
  "aturWaktu",
  "aturInterval",
  "pastikan",
];

export function jalankanLsp(masuk: Readable = process.stdin, keluar: Writable = process.stdout): void {
  let penyangga = Buffer.alloc(0);
  const dokumen = new Map<string, string>();

  const kirim = (pesan: Pesan): void => {
    const isi = Buffer.from(JSON.stringify(pesan), "utf8");
    keluar.write(`Content-Length: ${isi.length}\r\n\r\n`);
    keluar.write(isi);
  };

  const diagnostik = (uri: string, teks: string): void => {
    const daftar: unknown[] = [];
    try {
      urai(teks, uri);
    } catch (galat) {
      if (galat instanceof GalatSintaks) {
        const baris = galat.baris - 1;
        const kolom = galat.kolom - 1;
        daftar.push({
          range: {
            start: { line: baris, character: kolom },
            end: { line: baris, character: kolom + galat.panjang },
          },
          severity: 1,
          source: "indo",
          message: galat.message,
        });
      }
    }
    kirim({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: daftar } });
  };

  const tangani = (pesan: Pesan): void => {
    switch (pesan.method) {
      case "initialize":
        kirim({
          jsonrpc: "2.0",
          id: pesan.id,
          result: {
            capabilities: {
              textDocumentSync: 1,
              completionProvider: { triggerCharacters: ["."] },
            },
          },
        });
        break;
      case "textDocument/didOpen": {
        const p = pesan.params as { textDocument: { uri: string; text: string } };
        dokumen.set(p.textDocument.uri, p.textDocument.text);
        diagnostik(p.textDocument.uri, p.textDocument.text);
        break;
      }
      case "textDocument/didChange": {
        const p = pesan.params as { textDocument: { uri: string }; contentChanges: { text: string }[] };
        const teks = p.contentChanges[p.contentChanges.length - 1]?.text ?? "";
        dokumen.set(p.textDocument.uri, teks);
        diagnostik(p.textDocument.uri, teks);
        break;
      }
      case "textDocument/completion":
        kirim({
          jsonrpc: "2.0",
          id: pesan.id,
          result: KATA_LENGKAP.map((k) => ({ label: k, kind: 14 })),
        });
        break;
      case "shutdown":
        kirim({ jsonrpc: "2.0", id: pesan.id, result: null });
        break;
      case "exit":
        process.exit(0);
        break;
      default:
        if (pesan.id !== undefined) kirim({ jsonrpc: "2.0", id: pesan.id, result: null });
        break;
    }
  };

  masuk.on("data", (data: Buffer) => {
    penyangga = Buffer.concat([penyangga, data]);
    for (;;) {
      const pemisah = penyangga.indexOf("\r\n\r\n");
      if (pemisah === -1) break;
      const kepala = penyangga.subarray(0, pemisah).toString("utf8");
      const cocok = /Content-Length: (\d+)/i.exec(kepala);
      if (cocok === null) break;
      const panjang = parseInt(cocok[1]!, 10);
      const awalIsi = pemisah + 4;
      if (penyangga.length < awalIsi + panjang) break;
      const isi = penyangga.subarray(awalIsi, awalIsi + panjang).toString("utf8");
      penyangga = penyangga.subarray(awalIsi + panjang);
      try {
        tangani(JSON.parse(isi) as Pesan);
      } catch {
        continue;
      }
    }
  });
}

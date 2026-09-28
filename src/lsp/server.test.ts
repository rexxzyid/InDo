import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { jalankanLsp } from "./server.js";

function bingkai(obj: unknown): string {
  const isi = Buffer.from(JSON.stringify(obj), "utf8");
  return `Content-Length: ${isi.length}\r\n\r\n` + isi.toString("utf8");
}

function uraiPesan(teks: string): Record<string, unknown>[] {
  const hasil: Record<string, unknown>[] = [];
  let sisa = teks;
  for (;;) {
    const pemisah = sisa.indexOf("\r\n\r\n");
    if (pemisah === -1) break;
    const cocok = /Content-Length: (\d+)/i.exec(sisa.slice(0, pemisah));
    if (cocok === null) break;
    const panjang = parseInt(cocok[1]!, 10);
    const awal = pemisah + 4;
    hasil.push(JSON.parse(sisa.slice(awal, awal + panjang)) as Record<string, unknown>);
    sisa = sisa.slice(awal + panjang);
  }
  return hasil;
}

function jalankan(kirim: string[]): Promise<Record<string, unknown>[]> {
  const masuk = new PassThrough();
  const keluar = new PassThrough();
  let terkumpul = "";
  keluar.on("data", (d: Buffer) => {
    terkumpul += d.toString("utf8");
  });
  jalankanLsp(masuk, keluar);
  for (const pesan of kirim) masuk.write(pesan);
  return new Promise((selesai) => {
    setTimeout(() => selesai(uraiPesan(terkumpul)), 50);
  });
}

test("initialize mengembalikan kapabilitas", async () => {
  const pesan = await jalankan([bingkai({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })]);
  const balasan = pesan.find((p) => p.id === 1);
  assert.ok(balasan);
  const hasil = balasan.result as { capabilities: { completionProvider: unknown; textDocumentSync: number } };
  assert.equal(hasil.capabilities.textDocumentSync, 1);
  assert.ok(hasil.capabilities.completionProvider);
});

test("didOpen dengan galat sintaks menerbitkan diagnostik", async () => {
  const pesan = await jalankan([
    bingkai({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: { textDocument: { uri: "file:///a.wni", text: "misal x = ;" } },
    }),
  ]);
  const terbit = pesan.find((p) => p.method === "textDocument/publishDiagnostics");
  assert.ok(terbit);
  const params = terbit.params as { uri: string; diagnostics: { message: string; severity: number }[] };
  assert.equal(params.uri, "file:///a.wni");
  assert.equal(params.diagnostics.length, 1);
  assert.equal(params.diagnostics[0]!.severity, 1);
});

test("didOpen kode benar tidak menerbitkan diagnostik", async () => {
  const pesan = await jalankan([
    bingkai({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: { textDocument: { uri: "file:///b.wni", text: "misal x = 1\ncetak(x)" } },
    }),
  ]);
  const terbit = pesan.find((p) => p.method === "textDocument/publishDiagnostics");
  assert.ok(terbit);
  const params = terbit.params as { diagnostics: unknown[] };
  assert.equal(params.diagnostics.length, 0);
});

test("completion mengembalikan kata kunci dan global", async () => {
  const pesan = await jalankan([bingkai({ jsonrpc: "2.0", id: 2, method: "textDocument/completion", params: {} })]);
  const balasan = pesan.find((p) => p.id === 2);
  assert.ok(balasan);
  const daftar = balasan.result as { label: string }[];
  const label = daftar.map((d) => d.label);
  assert.ok(label.includes("jika"));
  assert.ok(label.includes("cetak"));
  assert.ok(label.includes("Matematika"));
});

test("didChange memperbarui diagnostik", async () => {
  const pesan = await jalankan([
    bingkai({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: { textDocument: { uri: "file:///c.wni", text: "misal x = 1" } },
    }),
    bingkai({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: { textDocument: { uri: "file:///c.wni" }, contentChanges: [{ text: "misal x = ;" }] },
    }),
  ]);
  const terbit = pesan.filter((p) => p.method === "textDocument/publishDiagnostics");
  assert.equal(terbit.length, 2);
  const akhir = terbit[1]!.params as { diagnostics: unknown[] };
  assert.equal(akhir.diagnostics.length, 1);
});

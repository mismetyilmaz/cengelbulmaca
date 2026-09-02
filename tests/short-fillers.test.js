"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const fillerPath = path.join(__dirname, "..", "data", "word-banks", "short-fillers.json");
const payload = JSON.parse(fs.readFileSync(fillerPath, "utf8"));
const entries = payload.entries;
const answers = new Set();

assert.strictEqual(entries.length, 1020, "Kısa dolgu toplamı beklenenden farklı");
assert.strictEqual(entries.filter(entry => entry.length === 1).length, 32, "Tek harfli dolgu sayısı yanlış");
assert.strictEqual(entries.filter(entry => entry.length === 2).length, 988, "İki harfli dolgu sayısı yanlış");
assert.strictEqual(payload.metadata.totalEntries, entries.length, "Metadata toplamı uyuşmuyor");

for (const entry of entries) {
  assert.ok(/^[A-ZÇĞİÖŞÜ]{1,2}$/.test(entry.answer), `Geçersiz kısa cevap: ${entry.answer}`);
  assert.strictEqual(entry.answer.length, entry.length, `${entry.answer}: uzunluk uyuşmuyor`);
  assert.ok(!answers.has(entry.answer), `Tekrarlanan kısa cevap: ${entry.answer}`);
  assert.ok(entry.clues.tr && entry.clues.en, `${entry.answer}: çift yönlü ipucu eksik`);
  assert.strictEqual(entry.status, "approved", `${entry.answer}: insan onayı eksik`);
  answers.add(entry.answer);
}

assert.strictEqual(entries.find(entry => entry.answer === "P").clues.tr, "İngiliz alfabesinde O harfinden sonra");
assert.strictEqual(entries.find(entry => entry.answer === "FE").atomicNumber, 26);
assert.strictEqual(entries.find(entry => entry.answer === "OG").atomicNumber, 118);
assert.strictEqual(entries.find(entry => entry.answer === "ZX").category, "alphabet-pair");
assert.strictEqual(entries.find(entry => entry.answer === "ÇĞ").category, "alphabet-pair");

console.log("short-fillers: 32 tek harfli ve 988 iki harfli kayıt doğrulandı");

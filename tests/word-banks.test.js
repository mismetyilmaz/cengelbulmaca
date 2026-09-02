"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const bankDir = path.join(projectRoot, "data", "word-banks");
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const manifest = JSON.parse(fs.readFileSync(path.join(bankDir, "manifest.json"), "utf8"));
const expectedHumanCorrections = {
  "A1:MENTION": "Bahsetmek",
  "B2:THEREBY": "Dolayısıyla",
  "B2:FOUNDER": "Kurucu",
  "B2:CONVENTION": "Konferans",
  "B2:DEPARTURE": "Çıkış",
  "B2:MANUFACTURE": "Üretmek",
  "B2:PROMPT": "Çabuk",
  "C2:PRO": "Uzman",
  "C2:FRINGE": "Püskül",
  "C2:PERFECTION": "Mükemmeliyet",
  "C2:TERRIFIC": "Müthiş"
};

let totalEntries = 0;
let totalApproved = 0;
let totalAiApproved = 0;
let totalCandidates = 0;
let totalNeedsReview = 0;
let totalAiRejected = 0;

for (const level of levels) {
  const file = path.join(bankDir, `${level.toLowerCase()}.json`);
  const bank = JSON.parse(fs.readFileSync(file, "utf8"));
  const answers = new Set();

  assert.strictEqual(bank.metadata.level, level, `${level}: metadata seviyesi yanlış`);
  assert.strictEqual(bank.entries.length, bank.metadata.totalEntries, `${level}: toplam uyuşmuyor`);
  assert.strictEqual(
    bank.entries.filter(entry => entry.status === "approved").length,
    bank.metadata.approvedEntries,
    `${level}: onaylı sayısı uyuşmuyor`
  );
  assert.strictEqual(
    bank.entries.filter(entry => entry.status === "ai_approved").length,
    bank.metadata.aiApprovedEntries,
    `${level}: AI onaylı sayısı uyuşmuyor`
  );
  assert.strictEqual(
    bank.entries.filter(entry => entry.status === "candidate").length,
    bank.metadata.candidateEntries,
    `${level}: aday sayısı uyuşmuyor`
  );
  assert.strictEqual(
    bank.entries.filter(entry => entry.status === "needs_review").length,
    bank.metadata.needsReviewEntries,
    `${level}: insan incelemesi sayısı uyuşmuyor`
  );
  assert.strictEqual(
    bank.entries.filter(entry => entry.status === "ai_rejected").length,
    bank.metadata.aiRejectedEntries,
    `${level}: AI reddi sayısı uyuşmuyor`
  );

  for (const entry of bank.entries) {
    assert.ok(entry.clue && /^[A-Z]+$/.test(entry.answer), `${level}: geçersiz kayıt`);
    assert.ok(!answers.has(entry.answer), `${level}: tekrarlanan cevap ${entry.answer}`);
    assert.ok(
      ["approved", "ai_approved", "candidate", "needs_review", "ai_rejected"].includes(entry.status),
      `${level}: geçersiz durum`
    );
    answers.add(entry.answer);
  }

  for (const [key, expectedClue] of Object.entries(expectedHumanCorrections)) {
    const [expectedLevel, answer] = key.split(":");
    if (expectedLevel !== level) continue;
    const entry = bank.entries.find(item => item.answer === answer);
    assert.ok(entry, `${key}: insan düzeltmesi bulunamadı`);
    assert.strictEqual(entry.clue, expectedClue, `${key}: insan düzeltmesi uygulanmadı`);
    assert.strictEqual(entry.status, "approved", `${key}: insan onayı korunmadı`);
    if (key === "B2:PROMPT") {
      assert.strictEqual(entry.partOfSpeech, "Adjective", `${key}: kelime türü düzeltilmedi`);
    }
  }

  totalEntries += bank.metadata.totalEntries;
  totalApproved += bank.metadata.approvedEntries;
  totalAiApproved += bank.metadata.aiApprovedEntries;
  totalCandidates += bank.metadata.candidateEntries;
  totalNeedsReview += bank.metadata.needsReviewEntries;
  totalAiRejected += bank.metadata.aiRejectedEntries;
}

assert.strictEqual(manifest.totals.entries, totalEntries, "Manifest toplamı uyuşmuyor");
assert.strictEqual(manifest.totals.approved, totalApproved, "Manifest onaylı toplamı uyuşmuyor");
assert.strictEqual(manifest.totals.aiApproved, totalAiApproved, "Manifest AI onaylı toplamı uyuşmuyor");
assert.strictEqual(manifest.totals.candidates, totalCandidates, "Manifest aday toplamı uyuşmuyor");
assert.strictEqual(manifest.totals.needsReview, totalNeedsReview, "Manifest inceleme toplamı uyuşmuyor");
assert.strictEqual(manifest.totals.aiRejected, totalAiRejected, "Manifest AI reddi toplamı uyuşmuyor");
assert.ok(totalEntries >= 3500, "Kelime hazinesi beklenenden küçük");

console.log(
  `word-banks: ${totalEntries} kayıt doğrulandı ` +
  `(${totalApproved} insan onaylı, ${totalAiApproved} AI onaylı, ${totalCandidates} aday)`
);

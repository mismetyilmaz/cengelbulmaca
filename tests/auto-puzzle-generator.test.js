"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

require(path.join(__dirname, "..", "js", "auto-puzzle-generator.js"));

const bankPath = path.join(__dirname, "..", "data", "a1-word-bank.json");
const bank = JSON.parse(fs.readFileSync(bankPath, "utf8"));
const b2Bank = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "data", "word-banks", "b2.json"),
  "utf8"
)).entries;
const a2ApprovedBank = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "data", "word-banks", "a2.json"),
  "utf8"
)).entries.filter(entry => ["approved", "ai_approved"].includes(entry.status));

function buildAndCheck(name, wordList, targetLang, expectations = {}) {
  // Hedef bir tercih; sahte komşu dizilerini önlemek için birkaç kelime eksik
  // kalması, yanlış bir bulmacayı zorlamaktan daha güvenlidir.
  const minWords = expectations.minWords || 16;
  const minFill = expectations.minFill || 55;
  const puzzle = global.AutoPuzzleGenerator.generate({
    wordList,
    rows: 10,
    cols: 12,
    targetWords: 18,
    targetLang,
    seed: `test-${name}`,
    attempts: 36,
    candidatePoolSize: 180
  });

  const validation = global.AutoPuzzleGenerator.validatePuzzle(puzzle);
  assert.deepStrictEqual(validation.errors, [], `${name}: ${validation.errors.join("; ")}`);
  assert.ok(
    puzzle.stats.wordCount >= minWords,
    `${name}: hedef kelime sayısına ulaşılamadı (${puzzle.stats.wordCount}/${minWords})`
  );
  assert.ok(puzzle.stats.fillPercent >= minFill, `${name}: doluluk çok düşük (%${puzzle.stats.fillPercent})`);
  assert.ok(puzzle.stats.fillPercent <= 80, `${name}: kontrollü boşluk üst sınırı aşıldı`);
  assert.ok(
    puzzle.stats.crossings >= puzzle.stats.wordCount - 1,
    `${name}: kelimeler tek bir kesişimli ağ oluşturmuyor`
  );
  assert.strictEqual(puzzle.stats.uncluedRuns, 0, `${name}: ipucusuz sahte kelime dizisi oluştu`);
  assert.ok(
    puzzle.stats.largestEmptyRegion <= Math.ceil(puzzle.rows * puzzle.cols * 0.3),
    `${name}: çok büyük boş bölge var`
  );
  assert.ok(
    Object.values(puzzle.cells).every(cell =>
      cell.type === "clue" || (cell.type === "letter" && cell.wordIds.length > 0)
    ),
    `${name}: oynanamayan hücre var`
  );
  const arrows = new Set(
    Object.values(puzzle.cells)
      .filter(cell => cell.type === "clue")
      .flatMap(cell => cell.clues.map(clue => clue.arrow))
  );
  assert.ok(arrows.size >= 2, `${name}: yön çeşitliliği yetersiz`);
  assert.ok([...arrows].every(arrow =>
    ["right", "down", "down-right", "right-down"].includes(arrow)
  ), `${name}: geçersiz yön oku var`);
  for (const [cellId, cell] of Object.entries(puzzle.cells)) {
    if (cell.type !== "clue") continue;
    const edge = arrow => ["right", "right-down"].includes(arrow) ? "right" : "bottom";
    const edges = cell.clues.map(clue => edge(clue.arrow));
    assert.strictEqual(new Set(edges).size, edges.length, `${name}/${cellId}: aynı kenarda iki ok var`);
  }

  const parseCell = id => {
    const match = id.match(/^r(\d+)c(\d+)$/);
    return match ? { row: Number(match[1]), col: Number(match[2]) } : null;
  };
  for (const [wordId, word] of Object.entries(puzzle.words)) {
    const clueCell = puzzle.cells[word.clueCell];
    const clue = clueCell.clues.find(item => item.wordId === wordId);
    const origin = parseCell(word.clueCell);
    const first = parseCell(word.cells[0]);
    const second = parseCell(word.cells[1]);
    const expectedFirst = ["right", "right-down"].includes(clue.arrow)
      ? { row: origin.row, col: origin.col + 1 }
      : { row: origin.row + 1, col: origin.col };
    assert.deepStrictEqual(first, expectedFirst, `${name}/${wordId}: ok yanlış başlangıcı gösteriyor`);
    if (["right", "down-right"].includes(clue.arrow)) {
      assert.strictEqual(second.row, first.row, `${name}/${wordId}: yatay ok dikey cevaba bağlı`);
    } else {
      assert.strictEqual(second.col, first.col, `${name}/${wordId}: dikey ok yatay cevaba bağlı`);
    }
  }
  assert.ok(Object.keys(puzzle.cells).every(id => {
    const match = id.match(/^r(\d+)c(\d+)$/);
    return match && Number(match[1]) < puzzle.rows && Number(match[2]) < puzzle.cols;
  }), `${name}: sınır dışında hücre var`);
}

buildAndCheck("tr_en", bank, "en");
buildAndCheck(
  "en_tr",
  bank.map(item => ({ clue: item.answer, answer: item.clue })),
  "tr"
);
buildAndCheck("b2_tr_en", b2Bank, "en");
assert.ok(a2ApprovedBank.length >= 18, "A2 onaylı havuz henüz örnek üretim için yetersiz");
// Şu anda A2'de yalnızca ilk AI partisi onaylı; Ollama taraması tamamlandıkça
// bu düşük geçici eşik ana kontrollü doluluk bandına yaklaşacaktır.
buildAndCheck("a2_approved_tr_en", a2ApprovedBank, "en", { minWords: 10, minFill: 40 });

const sparsePuzzle = global.AutoPuzzleGenerator.generate({
  wordList: bank,
  rows: 10,
  cols: 12,
  targetWords: 18,
  targetLang: "en",
  dense: false,
  compact: false,
  seed: "legacy-crossword",
  attempts: 8
});
assert.ok(sparsePuzzle.stats.crossings >= sparsePuzzle.stats.wordCount - 1, "Eski kesişimli mod bozuldu");

assert.throws(() => global.AutoPuzzleGenerator.generate({
  wordList: bank,
  rows: 4,
  cols: 12,
  targetWords: 10,
  targetLang: "en"
}), /5 ile 30/);

console.log("auto-puzzle-generator: tüm testler geçti");

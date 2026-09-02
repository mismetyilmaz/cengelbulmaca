"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

require(path.join(__dirname, "..", "js", "auto-puzzle-generator.js"));
const FullGridGenerator = require(path.join(__dirname, "..", "js", "full-grid-generator.js"));
const bankDir = path.join(__dirname, "..", "data", "word-banks");
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const usable = entry => ["approved", "ai_approved"].includes(entry.status);
const banks = Object.fromEntries(levels.map(level => [
  level,
  JSON.parse(fs.readFileSync(path.join(bankDir, `${level.toLowerCase()}.json`), "utf8")).entries
]));
const shortPayload = JSON.parse(fs.readFileSync(path.join(bankDir, "short-fillers.json"), "utf8"));

const mapEntry = (entry, category) => ({
  clue: entry.clue,
  answer: entry.answer,
  bankEntryKey: `${entry.level}:${entry.answer}`,
  reviewStatus: entry.status,
  category
});
const coreWords = ["A1", "A2"].flatMap(level => banks[level])
  .filter(usable)
  .map(entry => mapEntry(entry, "main-word"));
const bankFillers = levels.flatMap(level => banks[level])
  .filter(usable)
  .map(entry => mapEntry(entry, "short-word"));
const shortFillers = shortPayload.entries.map(entry => ({
  clue: entry.clues.tr,
  answer: entry.answer,
  reviewStatus: entry.status,
  category: entry.category
}));

const puzzle = FullGridGenerator.generate({
  coreWords,
  fillerWords: [...bankFillers, ...shortFillers],
  rows: 10,
  cols: 12,
  targetLang: "en",
  seed: "hybrid-gap-test",
  maxNodes: 180000,
  timeLimitMs: 1800,
  allowGaps: true
});

assert.ok(Array.isArray(puzzle.gaps), "Hibrit çıktı gaps listesi taşımıyor");
assert.strictEqual(puzzle.stats.gapCount, puzzle.gaps.length);
assert.ok(puzzle.stats.gapCount <= Math.max(4, Math.min(12, Math.ceil(puzzle.stats.slotCount * 0.2))));
assert.ok(puzzle.stats.longHorizontalWords >= 1);
assert.ok(puzzle.stats.longVerticalWords >= 1);
assert.ok(Object.values(puzzle.words).every(word =>
  !["element-symbol", "alphabet-pair"].includes(word.fillerCategory)
), "Düşük kaliteli teknik dolgu otomatik yerleştirildi");

const draftValidation = global.AutoPuzzleGenerator.validatePuzzle(puzzle, { allowGaps: true });
assert.deepStrictEqual(draftValidation.errors, [], draftValidation.errors.join("; "));
const publishValidation = global.AutoPuzzleGenerator.validatePuzzle(puzzle);
if (puzzle.gaps.length > 0) {
  assert.ok(!publishValidation.valid, "Gap içeren taslak yayın doğrulamasını geçti");
  assert.ok(puzzle.gaps.every(gap =>
    gap.length <= 4 &&
    gap.cells.length === gap.length &&
    gap.suggestions.length <= 8 &&
    Array.from(gap.pattern).length === gap.length &&
    gap.cells.every(cellId =>
      puzzle.cells[cellId].type === "letter" && puzzle.cells[cellId].gapIds.includes(gap.id)
    ) &&
    gap.suggestions.every((suggestion, index, suggestions) =>
      index === 0 || suggestions[index - 1].quality <= suggestion.quality
    )
  ));
} else {
  assert.ok(publishValidation.valid, publishValidation.errors.join("; "));
}

console.log(
  `hybrid-gap-generator: ${puzzle.stats.wordCount} çözülmüş cevap, ` +
  `${puzzle.stats.gapCount} gap, ${puzzle.stats.unresolvedCellCount} çözülmemiş hücre`
);

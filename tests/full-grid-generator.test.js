"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

require(path.join(__dirname, "..", "js", "auto-puzzle-generator.js"));
const FullGridGenerator = require(path.join(__dirname, "..", "js", "full-grid-generator.js"));
const bankDir = path.join(__dirname, "..", "data", "word-banks");
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const banks = Object.fromEntries(levels.map(level => [
  level,
  JSON.parse(fs.readFileSync(path.join(bankDir, `${level.toLowerCase()}.json`), "utf8")).entries
]));
const usable = entry => ["approved", "ai_approved"].includes(entry.status);

const shortPayload = JSON.parse(fs.readFileSync(path.join(bankDir, "short-fillers.json"), "utf8"));
const difficulties = {
  easy: ["A1", "A2"],
  medium: ["B1", "B2"],
  hard: ["C1", "C2"]
};

{
  const editorialStats = FullGridGenerator.deriveEditorialStats({
    cells: {
      r0c0: { type: "letter" },
      r0c1: { type: "letter" },
      r0c2: { type: "letter" },
      r0c3: { type: "letter" },
      r0c4: { type: "letter" },
      r1c0: { type: "letter" },
      r2c0: { type: "letter" }
    },
    words: {
      w0: {
        answer: "APPLE",
        cells: ["r0c0", "r0c1", "r0c2", "r0c3", "r0c4"],
        sourceKind: "core"
      },
      w1: {
        answer: "HE",
        cells: ["r0c0", "r1c0"],
        sourceKind: "filler",
        fillerCategory: "element-symbol"
      },
      w2: {
        answer: "A",
        cells: ["r2c0"],
        sourceKind: "filler",
        fillerCategory: "alphabet"
      }
    }
  });
  assert.strictEqual(editorialStats.wordCount, 3);
  assert.strictEqual(editorialStats.mainWordCount, 1);
  assert.strictEqual(editorialStats.shortFillerCount, 2);
  assert.strictEqual(editorialStats.oneLetterCount, 1);
  assert.strictEqual(editorialStats.twoLetterCount, 1);
  assert.strictEqual(editorialStats.shortAnswerCount, 2);
  assert.strictEqual(editorialStats.shortAnswerRatio, 2 / 3);
  assert.strictEqual(editorialStats.elementFillerCount, 1);
  assert.strictEqual(editorialStats.longAnswerCount, 1);
  assert.strictEqual(editorialStats.longHorizontalWords, 1);
  assert.strictEqual(editorialStats.longVerticalWords, 0);
  assert.strictEqual(editorialStats.mainLetterCoverage, 71);
}

for (const [difficulty, coreLevels] of Object.entries(difficulties)) {
  for (const direction of ["tr_en", "en_tr"]) {
    const targetLang = direction === "tr_en" ? "en" : "tr";
    const mapEntry = (entry, category) => ({
      clue: direction === "tr_en" ? entry.clue : entry.answer,
      answer: direction === "tr_en" ? entry.answer : entry.clue,
      bankEntryKey: `${entry.level}:${entry.answer}`,
      reviewStatus: entry.status,
      category
    });
    const coreWords = coreLevels.flatMap(level => banks[level])
      .filter(usable)
      .map(entry => mapEntry(entry, "main-word"));
    const bankFillers = levels.flatMap(level => banks[level])
      .filter(usable)
      .map(entry => mapEntry(entry, "short-word"));
    const shortFillers = shortPayload.entries.map(entry => ({
      clue: direction === "tr_en" ? entry.clues.tr : entry.clues.en,
      answer: entry.answer,
      reviewStatus: entry.status,
      category: entry.category
    }));

    const puzzle = FullGridGenerator.generate({
      coreWords,
      fillerWords: [...bankFillers, ...shortFillers],
      rows: 10,
      cols: 12,
      targetLang,
      seed: `full-grid-${difficulty}-${direction}-test`,
      attempts: 80,
      maxNodes: 160000,
      timeLimitMs: 1200
    });

    assert.strictEqual(puzzle.stats.fillPercent, 100);
    assert.strictEqual(puzzle.stats.emptyCells, 0);
    assert.ok(puzzle.stats.mainLetterCoverage >= 30, "Ana kelime harf kapsamı yetersiz");
    assert.ok(
      ["layered-random", "segmented-natural"].includes(puzzle.stats.patternMode),
      `Doğal şablon üretilemedi: ${puzzle.stats.patternMode || "tanımsız"}`
    );
    assert.strictEqual(Object.keys(puzzle.cells).length, puzzle.rows * puzzle.cols);
    assert.ok(puzzle.stats.mainWordCount >= 3, "Ana kelime sayısı yetersiz");
    assert.ok(puzzle.stats.longHorizontalWords >= 1, "Uzun yatay kelime yerleşmedi");
    assert.ok(puzzle.stats.longVerticalWords >= 1, "Uzun dikey kelime yerleşmedi");
    assert.ok(new Set(puzzle.stats.bandWidths || []).size > 1, "Bölüm genişlikleri yine tekdüze kaldı");
    assert.ok(puzzle.stats.shortFillerCount >= 1, "Kısa dolgu havuzu kullanılmadı");
    const derivedStats = FullGridGenerator.deriveEditorialStats(puzzle);
    for (const [name, value] of Object.entries(derivedStats)) {
      assert.strictEqual(puzzle.stats[name], value, `Editoryal istatistik tutarsız: ${name}`);
    }
    assert.strictEqual(
      puzzle.stats.shortAnswerCount,
      puzzle.stats.oneLetterCount + puzzle.stats.twoLetterCount,
      "Gerçek kısa cevap sayımı tutarsız"
    );
    assert.ok(Object.values(puzzle.words).every(word => ["core", "filler"].includes(word.sourceKind)));
    assert.ok(Object.values(puzzle.cells).every(cell =>
      cell.type === "letter" || (cell.type === "clue" && cell.clues.length >= 1 && cell.clues.length <= 2)
    ));

    const validation = global.AutoPuzzleGenerator.validatePuzzle(puzzle);
    assert.deepStrictEqual(validation.errors, [], `${difficulty}/${direction}: ${validation.errors.join("; ")}`);
    if (difficulty === "easy" && direction === "tr_en") {
      const bridge = Object.keys(puzzle.cells).find(id => {
        const match = id.match(/^r(\d+)c(\d+)$/);
        if (!match || puzzle.cells[id].type !== "clue") return false;
        const row = Number(match[1]);
        const col = Number(match[2]);
        return col > 0 && col < puzzle.cols - 1 &&
          puzzle.cells[`r${row}c${col - 1}`]?.type === "letter" &&
          puzzle.cells[`r${row}c${col + 1}`]?.type === "letter";
      });
      assert.ok(bridge, "Sahte birleşim testi için köprü hücresi bulunamadı");
      const broken = JSON.parse(JSON.stringify(puzzle));
      broken.cells[bridge] = { type: "letter", wordIds: [] };
      const brokenValidation = global.AutoPuzzleGenerator.validatePuzzle(broken);
      assert.ok(
        brokenValidation.errors.some(error => error.includes("anlamsız birleşik harf dizisi")),
        "M+AMONG benzeri birleşim yakalanmadı"
      );
    }
    console.log(
      `${difficulty}/${direction}: %100 dolu, ${puzzle.stats.wordCount} cevap, ` +
      `${puzzle.stats.mainWordCount} ana, ${puzzle.stats.shortFillerCount} kısa dolgu, ` +
      `${puzzle.stats.oneLetterCount}/${puzzle.stats.twoLetterCount} adet 1/2 harfli, ` +
      `${puzzle.stats.lastResortFillerCount} son çare, ` +
      `%${puzzle.stats.mainLetterCoverage} ana harf kapsamı, ` +
      `${puzzle.stats.patternMutations || 0} doğal kaydırma, ` +
      `uzun Y/D ${puzzle.stats.longHorizontalWords}/${puzzle.stats.longVerticalWords}, ` +
      `bantlar ${(puzzle.stats.bandWidths || []).join("+")}`
    );
  }
}

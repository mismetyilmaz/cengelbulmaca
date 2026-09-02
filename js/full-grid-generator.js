/**
 * FULL-GRID-GENERATOR.js
 * ------------------------------------------------------------------
 * Her hücresi ipucu veya harf olan bir çengel bulmaca üretir. Önce tam
 * grid şablonu kurulur, sonra slotlar MRV (en az aday) + geri izleme ile
 * doldurulur. 1-4 harfli cevaplar ayrı dolgu havuzundan gelebilir.
 */
(function exposeFullGridGenerator(root) {
  "use strict";

  function hashSeed(value) {
    const text = String(value == null ? Date.now() : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function makeRandom(seed) {
    let state = hashSeed(seed) || 0x6d2b79f5;
    return function random() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, random) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function key(row, col) {
    return `${row},${col}`;
  }

  function parseKey(value) {
    const [row, col] = String(value).split(",").map(Number);
    return { row, col };
  }

  function cellId(row, col) {
    return `r${row}c${col}`;
  }

  function normalizeAnswer(value, targetLang) {
    const locale = targetLang === "tr" ? "tr-TR" : "en-US";
    return String(value || "").trim().toLocaleUpperCase(locale);
  }

  function validAnswer(answer, targetLang, maxLength) {
    const pattern = targetLang === "tr" ? /^[A-ZÇĞİIÖŞÜ]+$/ : /^[A-Z]+$/;
    return answer.length >= 1 && answer.length <= maxLength && pattern.test(answer);
  }

  function cleanWords(items, targetLang, maxLength, kind) {
    const seen = new Set();
    const words = [];
    for (const item of Array.isArray(items) ? items : []) {
      const clue = String(item && item.clue || "").trim();
      const answer = normalizeAnswer(item && item.answer, targetLang);
      if (!clue || !validAnswer(answer, targetLang, maxLength) || seen.has(answer)) continue;
      seen.add(answer);
      words.push({
        clue,
        answer,
        letters: Array.from(answer),
        kind,
        bankEntryKey: String(item.bankEntryKey || "").trim() || null,
        reviewStatus: String(item.reviewStatus || "").trim() || null,
        category: String(item.category || "").trim() || null
      });
    }
    return words;
  }

  function buildWordIndex(coreWords, fillerWords, maxLength) {
    const byLength = new Map();
    for (let length = 1; length <= maxLength; length++) byLength.set(length, []);
    const seen = new Set();
    for (const word of [...coreWords, ...fillerWords]) {
      if (seen.has(word.answer)) continue;
      seen.add(word.answer);
      byLength.get(word.letters.length)?.push(word);
    }
    return byLength;
  }

  function fillerQuality(word) {
    if (!word || !word.category || word.category === "short-word" || word.category === "main-word") return 0;
    if (word.category === "alphabet") return 1;
    if (word.category === "element-symbol") return 2;
    if (word.category === "alphabet-pair") return 3;
    return 0;
  }

  function wordOrientation(word) {
    if (!word || !Array.isArray(word.cells) || word.cells.length < 2) return null;
    const first = String(word.cells[0] || "").match(/^r(\d+)c(\d+)$/);
    const second = String(word.cells[1] || "").match(/^r(\d+)c(\d+)$/);
    if (!first || !second) return null;
    if (first[1] === second[1] && Number(second[2]) === Number(first[2]) + 1) return "horizontal";
    if (first[2] === second[2] && Number(second[1]) === Number(first[1]) + 1) return "vertical";
    return null;
  }

  function deriveEditorialStats(puzzle) {
    const words = Object.values(puzzle && puzzle.words || {});
    const wordLengths = words.map(word => Array.from(String(word && word.answer || "")).length);
    const oneLetterCount = wordLengths.filter(length => length === 1).length;
    const twoLetterCount = wordLengths.filter(length => length === 2).length;
    const shortAnswerCount = oneLetterCount + twoLetterCount;
    const mainWords = words.filter(word =>
      word.sourceKind === "core" ||
      (!word.sourceKind && (!word.fillerCategory || word.fillerCategory === "main-word"))
    );
    const mainLetterCells = new Set(mainWords.flatMap(word => Array.isArray(word.cells) ? word.cells : []));
    const letterCellCount = Object.values(puzzle && puzzle.cells || {})
      .filter(cell => cell && cell.type === "letter").length;
    const longWords = words.filter((word, index) => wordLengths[index] >= 5);

    return {
      wordCount: words.length,
      mainWordCount: mainWords.length,
      shortFillerCount: words.filter(word => word.sourceKind === "filler" ||
        (!word.sourceKind && Boolean(word.fillerCategory) && word.fillerCategory !== "main-word")).length,
      lastResortFillerCount: words.filter(word => word.fillerCategory === "alphabet-pair").length,
      elementFillerCount: words.filter(word => word.fillerCategory === "element-symbol").length,
      oneLetterCount,
      twoLetterCount,
      shortAnswerCount,
      shortAnswerRatio: words.length > 0 ? shortAnswerCount / words.length : 0,
      longAnswerCount: longWords.length,
      longHorizontalWords: longWords.filter(word => wordOrientation(word) === "horizontal").length,
      longVerticalWords: longWords.filter(word => wordOrientation(word) === "vertical").length,
      mainLetterCoverage: Math.round(mainLetterCells.size / Math.max(1, letterCellCount) * 100)
    };
  }

  function applyEditorialStats(puzzle) {
    puzzle.stats = { ...(puzzle.stats || {}), ...deriveEditorialStats(puzzle) };
    return puzzle;
  }

  function randomTemplate(rows, cols, random, clueRate) {
    // Üst ve sol sınırda ipucu/harf dönüşümü kullanılır. Böylece sınırda
    // başlayan her yatay/dikey slotun kıvrımlı veya düz bir ipucu kutusu olur.
    const clues = new Set();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (row === 0) {
          if (col % 2 === 0) clues.add(key(row, col));
          continue;
        }
        if (col === 0) {
          if (row % 2 === 0) clues.add(key(row, col));
          continue;
        }
        if (random() < clueRate) clues.add(key(row, col));
      }
    }
    return clues;
  }

  function extractRuns(rows, cols, clueKeys) {
    const slots = [];
    let slotCounter = 0;

    function addRun(orientation, cells) {
      // Tek hücrelik yatay ve dikey diziyi iki ayrı cevap sayma. Önce 2+
      // slotlar alınır; tamamen açıkta kalan hücreler aşağıda bir kez eklenir.
      if (cells.length < 2) return;
      const first = cells[0];
      const clueOptions = [];
      if (orientation === "horizontal") {
        if (first.col > 0 && clueKeys.has(key(first.row, first.col - 1))) {
          clueOptions.push({ row: first.row, col: first.col - 1, arrow: "right", edge: "right" });
        }
        if (first.row > 0 && clueKeys.has(key(first.row - 1, first.col))) {
          clueOptions.push({ row: first.row - 1, col: first.col, arrow: "down-right", edge: "bottom" });
        }
      } else {
        if (first.row > 0 && clueKeys.has(key(first.row - 1, first.col))) {
          clueOptions.push({ row: first.row - 1, col: first.col, arrow: "down", edge: "bottom" });
        }
        if (first.col > 0 && clueKeys.has(key(first.row, first.col - 1))) {
          clueOptions.push({ row: first.row, col: first.col - 1, arrow: "right-down", edge: "right" });
        }
      }
      slots.push({
        id: `s${slotCounter++}`,
        orientation,
        cells,
        length: cells.length,
        clueOptions
      });
    }

    for (let row = 0; row < rows; row++) {
      let run = [];
      for (let col = 0; col <= cols; col++) {
        if (col < cols && !clueKeys.has(key(row, col))) run.push({ row, col });
        else { addRun("horizontal", run); run = []; }
      }
    }
    for (let col = 0; col < cols; col++) {
      let run = [];
      for (let row = 0; row <= rows; row++) {
        if (row < rows && !clueKeys.has(key(row, col))) run.push({ row, col });
        else { addRun("vertical", run); run = []; }
      }
    }

    const covered = new Set(slots.flatMap(slot =>
      slot.cells.map(cell => key(cell.row, cell.col))
    ));

    // Başka yöndeki uzun bir cevaba ait olsa bile, iki ipucu/kenar arasında
    // tek başına kalan harf o yönde gerçek bir tek-harfli cevap olabilir.
    // 2 hücrelik düzensiz bantların doğal biçimde kullanılmasını bu sağlar.
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellKey = key(row, col);
        if (clueKeys.has(cellKey) || !covered.has(cellKey)) continue;
        const horizontalIsolated =
          (col === 0 || clueKeys.has(key(row, col - 1))) &&
          (col === cols - 1 || clueKeys.has(key(row, col + 1)));
        const verticalIsolated =
          (row === 0 || clueKeys.has(key(row - 1, col))) &&
          (row === rows - 1 || clueKeys.has(key(row + 1, col)));

        if (horizontalIsolated && row > 0) {
          const clueOptions = [];
          if (col > 0 && clueKeys.has(key(row, col - 1))) {
            clueOptions.push({ row, col: col - 1, arrow: "right", edge: "right" });
          }
          if (row > 0 && clueKeys.has(key(row - 1, col))) {
            clueOptions.push({ row: row - 1, col, arrow: "down-right", edge: "bottom" });
          }
          if (clueOptions.length > 0) {
            slots.push({
              id: `s${slotCounter++}`,
              orientation: "horizontal",
              cells: [{ row, col }],
              length: 1,
              clueOptions
            });
          }
        }
        if (verticalIsolated && col > 0) {
          const clueOptions = [];
          if (row > 0 && clueKeys.has(key(row - 1, col))) {
            clueOptions.push({ row: row - 1, col, arrow: "down", edge: "bottom" });
          }
          if (col > 0 && clueKeys.has(key(row, col - 1))) {
            clueOptions.push({ row, col: col - 1, arrow: "right-down", edge: "right" });
          }
          if (clueOptions.length > 0) {
            slots.push({
              id: `s${slotCounter++}`,
              orientation: "vertical",
              cells: [{ row, col }],
              length: 1,
              clueOptions
            });
          }
        }
      }
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellKey = key(row, col);
        if (clueKeys.has(cellKey) || covered.has(cellKey)) continue;
        const clueOptions = [];
        if (col > 0 && clueKeys.has(key(row, col - 1))) {
          clueOptions.push({ row, col: col - 1, arrow: "right", edge: "right" });
        }
        if (row > 0 && clueKeys.has(key(row - 1, col))) {
          clueOptions.push({ row: row - 1, col, arrow: "down", edge: "bottom" });
        }
        slots.push({
          id: `s${slotCounter++}`,
          orientation: "single",
          cells: [{ row, col }],
          length: 1,
          clueOptions
        });
      }
    }
    return slots;
  }

  function assignClueCells(slots, clueKeys, random) {
    if (slots.some(slot => slot.clueOptions.length === 0)) return false;
    const ordered = slots.slice().sort((a, b) =>
      a.clueOptions.length - b.clueOptions.length || b.length - a.length
    );
    const occupiedEdges = new Set();

    function visit(index) {
      if (index === ordered.length) return true;
      const slot = ordered[index];
      for (const option of shuffle(slot.clueOptions, random)) {
        const edgeKey = `${key(option.row, option.col)}:${option.edge}`;
        if (occupiedEdges.has(edgeKey)) continue;
        occupiedEdges.add(edgeKey);
        slot.clue = option;
        if (visit(index + 1)) return true;
        delete slot.clue;
        occupiedEdges.delete(edgeKey);
      }
      return false;
    }

    return visit(0);
  }

  function normalizeTemplate(rows, cols, clueKeys, random) {
    for (let pass = 0; pass < 8; pass++) {
      const slots = extractRuns(rows, cols, clueKeys);
      if (slots.length === 0 || !assignClueCells(slots, clueKeys, random)) return null;
      const usedClues = new Set(slots.map(slot => key(slot.clue.row, slot.clue.col)));
      if (usedClues.size === clueKeys.size) return slots;
      for (const clueKey of [...clueKeys]) {
        if (!usedClues.has(clueKey)) clueKeys.delete(clueKey);
      }
    }
    return null;
  }

  function candidateMatches(word, slot, letters) {
    for (let index = 0; index < slot.cells.length; index++) {
      const existing = letters.get(key(slot.cells[index].row, slot.cells[index].col));
      if (existing && existing !== word.letters[index]) return false;
    }
    return true;
  }

  function solveSlots(slots, byLength, random, options) {
    const assignments = new Map();
    const letters = new Map();
    const usedAnswerCounts = new Map();
    const placementOrder = [];
    const gaps = [];
    const gappedSlotIds = new Set();
    const allowGaps = options.allowGaps === true;
    const defaultMaxGaps = Math.max(4, Math.min(12, Math.ceil(slots.length * 0.2)));
    const maxGapCount = allowGaps
      ? Math.max(0, Math.min(slots.length, Number.isFinite(Number(options.maxGapCount))
        ? Number(options.maxGapCount)
        : defaultMaxGaps))
      : 0;
    const maxNodes = Math.max(1000, Number(options.maxNodes) || 120000);
    const deadline = Date.now() + Math.max(250, Number(options.timeLimitMs) || 1800);
    let nodes = 0;

    function candidatesFor(slot) {
      const candidates = byLength.get(slot.length) || [];
      return candidates.filter(word =>
        (usedAnswerCounts.get(word.answer) || 0) < (word.letters.length === 1 ? 2 : 1) &&
        candidateMatches(word, slot, letters)
      );
    }

    function selectNext() {
      let best = null;
      let bestCandidates = null;
      let preferredLength = 0;
      const longFirstSlots = Math.max(1, Number(options.longFirstSlots) || 2);
      if (options.preferLong && assignments.size + gaps.length < longFirstSlots) {
        for (const slot of slots) {
          if (!assignments.has(slot.id) && !gappedSlotIds.has(slot.id)) {
            preferredLength = Math.max(preferredLength, slot.length);
          }
        }
      }
      for (const slot of slots) {
        if (assignments.has(slot.id) || gappedSlotIds.has(slot.id)) continue;
        if (preferredLength && slot.length !== preferredLength) continue;
        const candidates = candidatesFor(slot);
        if (!best || candidates.length < bestCandidates.length ||
            (candidates.length === bestCandidates.length && slot.length > best.length)) {
          best = slot;
          bestCandidates = candidates;
        }
      }
      return best ? { slot: best, candidates: bestCandidates } : null;
    }

    function visit() {
      nodes++;
      if (nodes > maxNodes || Date.now() > deadline) return false;
      const next = selectNext();
      if (!next) return true;

      const longFirstSlots = Math.max(1, Number(options.longFirstSlots) || 2);
      const scoreFutureChoices = word => {
        if (!options.preferLong || assignments.size + gaps.length >= longFirstSlots) return 0;
        const proposed = new Map(next.slot.cells.map((cell, index) => [key(cell.row, cell.col), word.letters[index]]));
        let score = 0;
        for (const otherSlot of slots) {
          if (otherSlot.id === next.slot.id || assignments.has(otherSlot.id) || gappedSlotIds.has(otherSlot.id)) continue;
          if (!otherSlot.cells.some(cell => proposed.has(key(cell.row, cell.col)))) continue;
          const possible = (byLength.get(otherSlot.length) || []).filter(otherWord => {
            if ((usedAnswerCounts.get(otherWord.answer) || 0) >= (otherWord.letters.length === 1 ? 2 : 1)) return false;
            return otherSlot.cells.every((cell, index) => {
              const cellKey = key(cell.row, cell.col);
              const expected = letters.get(cellKey) || proposed.get(cellKey);
              return !expected || expected === otherWord.letters[index];
            });
          }).length;
          if (possible === 0) return -1000000;
          score += Math.min(possible, 80);
        }
        return score;
      };
      const futureScores = new Map(next.candidates.map(word => [word.answer, scoreFutureChoices(word)]));
      const orderedCandidates = shuffle(next.candidates, random).sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "core" ? -1 : 1;
        const futureScoreDifference = (futureScores.get(b.answer) || 0) - (futureScores.get(a.answer) || 0);
        if (futureScoreDifference !== 0) return futureScoreDifference;
        return fillerQuality(a) - fillerQuality(b);
      });
      for (const word of orderedCandidates) {
        const addedKeys = [];
        let valid = true;
        for (let index = 0; index < next.slot.cells.length; index++) {
          const cell = next.slot.cells[index];
          const cellKey = key(cell.row, cell.col);
          const existing = letters.get(cellKey);
          if (existing && existing !== word.letters[index]) { valid = false; break; }
          if (!existing) {
            letters.set(cellKey, word.letters[index]);
            addedKeys.push(cellKey);
          }
        }
        if (!valid) {
          addedKeys.forEach(cellKey => letters.delete(cellKey));
          continue;
        }
        assignments.set(next.slot.id, word);
        placementOrder.push(next.slot.length);
        usedAnswerCounts.set(word.answer, (usedAnswerCounts.get(word.answer) || 0) + 1);
        if (visit()) return true;
        assignments.delete(next.slot.id);
        placementOrder.pop();
        const remainingUses = (usedAnswerCounts.get(word.answer) || 1) - 1;
        if (remainingUses > 0) usedAnswerCounts.set(word.answer, remainingUses);
        else usedAnswerCounts.delete(word.answer);
        addedKeys.forEach(cellKey => letters.delete(cellKey));
      }

      if (allowGaps && next.slot.length <= 4 && gaps.length < maxGapCount) {
        gaps.push(next.slot);
        gappedSlotIds.add(next.slot.id);
        placementOrder.push(0);
        if (visit()) return true;
        placementOrder.pop();
        gappedSlotIds.delete(next.slot.id);
        gaps.pop();
      }
      return false;
    }

    return visit()
      ? { assignments, letters, gaps: gaps.slice(), nodes, placementOrder: placementOrder.slice() }
      : null;
  }

  function gapSuggestions(slot, solved, suggestionByLength, limit) {
    const usedAnswers = new Set([...solved.assignments.values()].map(word => word.answer));
    return (suggestionByLength && suggestionByLength.get(slot.length) || [])
      .filter(word => !usedAnswers.has(word.answer) && candidateMatches(word, slot, solved.letters))
      .slice()
      .sort((a, b) =>
        fillerQuality(a) - fillerQuality(b) ||
        (a.kind === b.kind ? 0 : a.kind === "core" ? -1 : 1) ||
        a.answer.localeCompare(b.answer)
      )
      .slice(0, limit)
      .map(word => ({
        answer: word.answer,
        clue: word.clue,
        category: word.category || "natural-word",
        quality: fillerQuality(word),
        ...(word.bankEntryKey ? { bankEntryKey: word.bankEntryKey } : {}),
        ...(word.reviewStatus ? { reviewStatus: word.reviewStatus } : {})
      }));
  }

  function toPuzzle(rows, cols, clueKeys, slots, solved, title, targetLang, options) {
    const puzzleOptions = options || {};
    const cells = {};
    const words = {};
    const gaps = [];
    const unresolvedCellIds = new Set();
    for (const clueKey of clueKeys) {
      const [row, col] = clueKey.split(",").map(Number);
      cells[cellId(row, col)] = { type: "clue", clues: [] };
    }

    let mainWordCount = 0;
    let shortFillerCount = 0;
    let lastResortFillerCount = 0;
    let elementFillerCount = 0;
    let wordCounter = 0;
    let gapCounter = 0;
    slots.forEach(slot => {
      const candidate = solved.assignments.get(slot.id);
      if (!candidate) {
        const gapId = `g${gapCounter++}`;
        const clueCellId = cellId(slot.clue.row, slot.clue.col);
        const answerCells = slot.cells.map(cell => {
          const id = cellId(cell.row, cell.col);
          if (!cells[id]) cells[id] = { type: "letter", wordIds: [], gapIds: [] };
          if (!Array.isArray(cells[id].gapIds)) cells[id].gapIds = [];
          cells[id].gapIds.push(gapId);
          if (!solved.letters.has(key(cell.row, cell.col))) unresolvedCellIds.add(id);
          return id;
        });
        const suggestions = gapSuggestions(
          slot,
          solved,
          puzzleOptions.suggestionByLength,
          Math.max(1, Math.min(12, Number(puzzleOptions.gapSuggestionLimit) || 8))
        );
        if (!Array.isArray(cells[clueCellId].pendingGaps)) cells[clueCellId].pendingGaps = [];
        cells[clueCellId].pendingGaps.push({ gapId, arrow: slot.clue.arrow });
        gaps.push({
          id: gapId,
          slotId: slot.id,
          clueCell: clueCellId,
          arrow: slot.clue.arrow,
          cells: answerCells,
          orientation: slot.orientation,
          length: slot.length,
          pattern: slot.cells.map(cell => solved.letters.get(key(cell.row, cell.col)) || "?").join(""),
          clueOptions: suggestions.map(item => item.clue),
          suggestions
        });
        return;
      }

      const wordId = `w${wordCounter++}`;
      if (candidate.kind === "core") mainWordCount++;
      else {
        shortFillerCount++;
        if (candidate.category === "alphabet-pair") lastResortFillerCount++;
        if (candidate.category === "element-symbol") elementFillerCount++;
      }
      const clueCellId = cellId(slot.clue.row, slot.clue.col);
      cells[clueCellId].clues.push({ text: candidate.clue, arrow: slot.clue.arrow, wordId });
      cells[clueCellId].clues.sort((a, b) =>
        (["right", "right-down"].includes(a.arrow) ? 0 : 1) -
        (["right", "right-down"].includes(b.arrow) ? 0 : 1)
      );

      const wordCells = slot.cells.map((cell, letterIndex) => {
        const id = cellId(cell.row, cell.col);
        if (!cells[id]) cells[id] = { type: "letter", wordIds: [] };
        cells[id].wordIds.push(wordId);
        return id;
      });
      words[wordId] = {
        answer: candidate.answer,
        cells: wordCells,
        clueCell: clueCellId,
        sourceKind: candidate.kind,
        ...(candidate.bankEntryKey ? { bankEntryKey: candidate.bankEntryKey } : {}),
        ...(candidate.reviewStatus ? { reviewStatus: candidate.reviewStatus } : {}),
        ...(candidate.category ? { fillerCategory: candidate.category } : {})
      };
    });

    const letterCells = Object.values(cells).filter(cell => cell.type === "letter");
    const crossings = letterCells.reduce((sum, cell) => sum + Math.max(0, cell.wordIds.length - 1), 0);
    return applyEditorialStats({
      title,
      rows,
      cols,
      cells,
      words,
      gaps,
      targetLang,
      stats: {
        layoutMode: "full-grid",
        slotCount: slots.length,
        wordCount: Object.keys(words).length,
        mainWordCount,
        shortFillerCount,
        lastResortFillerCount,
        elementFillerCount,
        clueCells: clueKeys.size,
        letterCells: letterCells.length,
        usedCells: rows * cols,
        emptyCells: 0,
        fillPercent: 100,
        gapCount: gaps.length,
        unresolvedCellCount: unresolvedCellIds.size,
        crossings,
        sharedClueCells: Object.values(cells)
          .filter(cell => cell.type === "clue" &&
            cell.clues.length + (cell.pendingGaps || []).length === 2).length,
        searchNodes: solved.nodes,
        placementOrder: solved.placementOrder || []
      }
    });
  }

  function selectBandPair(primaryWords, secondaryWords, fillerByAnswer, usedAnswers, random) {
    const primaryCandidates = shuffle(primaryWords, random).slice(0, 180);
    const secondaryCandidates = shuffle(secondaryWords, random).slice(0, 180);
    let best = null;
    let bestScore = -1;
    for (const primary of primaryCandidates) {
      if (usedAnswers.has(primary.answer)) continue;
      for (const secondary of secondaryCandidates) {
        if (usedAnswers.has(secondary.answer) || secondary.answer === primary.answer) continue;
        const fillers = [];
        const localAnswers = new Set();
        let valid = true;
        for (let index = 1; index < primary.letters.length; index++) {
          const fillerAnswer = `${primary.letters[index]}${secondary.letters[index - 1]}`;
          const filler = fillerByAnswer.get(fillerAnswer);
          if (!filler || usedAnswers.has(fillerAnswer) || localAnswers.has(fillerAnswer)) {
            valid = false;
            break;
          }
          fillers.push(filler);
          localAnswers.add(fillerAnswer);
        }
        if (valid) {
          const score = fillers.reduce((sum, filler) => {
            if (filler.category === "alphabet-pair") return sum;
            if (filler.category === "element-symbol") return sum + 4;
            return sum + 6;
          }, 0);
          if (score > bestScore) {
            best = { primary, secondary, fillers };
            bestScore = score;
            if (fillers.every(filler => filler.category !== "alphabet-pair")) return best;
          }
        }
      }
    }
    return best;
  }

  function tryBandGrid(rows, cols, coreWords, fillerWords, random, title, targetLang) {
    const fillerByAnswer = new Map(
      fillerWords.filter(word => word.letters.length === 2).map(word => [word.answer, word])
    );
    const coreByLength = new Map();
    for (const word of coreWords) {
      const items = coreByLength.get(word.letters.length) || [];
      items.push(word);
      coreByLength.set(word.letters.length, items);
    }

    const orientations = [];
    if (cols % 3 === 0) {
      orientations.push({
        type: "vertical",
        bands: cols / 3,
        primaryLength: rows,
        secondaryLength: rows - 1
      });
    }
    if (rows % 3 === 0) {
      orientations.push({
        type: "horizontal",
        bands: rows / 3,
        primaryLength: cols,
        secondaryLength: cols - 1
      });
    }
    orientations.sort((a, b) => {
      const capacityA = Math.min(
        (coreByLength.get(a.primaryLength) || []).length,
        (coreByLength.get(a.secondaryLength) || []).length
      );
      const capacityB = Math.min(
        (coreByLength.get(b.primaryLength) || []).length,
        (coreByLength.get(b.secondaryLength) || []).length
      );
      return capacityB - capacityA;
    });

    for (const layout of orientations) {
      const primaryWords = coreByLength.get(layout.primaryLength) || [];
      const secondaryWords = coreByLength.get(layout.secondaryLength) || [];
      if (primaryWords.length < layout.bands || secondaryWords.length < layout.bands) continue;

      const clueKeys = new Set();
      const slots = [];
      const assignments = new Map();
      const usedAnswers = new Set();
      let failed = false;
      let slotCounter = 0;

      for (let band = 0; band < layout.bands; band++) {
        const selected = selectBandPair(
          primaryWords,
          secondaryWords,
          fillerByAnswer,
          usedAnswers,
          random
        );
        if (!selected) { failed = true; break; }
        usedAnswers.add(selected.primary.answer);
        usedAnswers.add(selected.secondary.answer);
        selected.fillers.forEach(word => usedAnswers.add(word.answer));

        if (layout.type === "vertical") {
          const baseCol = band * 3;
          for (let row = 0; row < rows; row++) clueKeys.add(key(row, baseCol));
          clueKeys.add(key(0, baseCol + 2));

          const primarySlot = {
            id: `s${slotCounter++}`,
            orientation: "vertical",
            length: rows,
            cells: Array.from({ length: rows }, (_, row) => ({ row, col: baseCol + 1 })),
            clue: { row: 0, col: baseCol, arrow: "right-down", edge: "right" }
          };
          const secondarySlot = {
            id: `s${slotCounter++}`,
            orientation: "vertical",
            length: rows - 1,
            cells: Array.from({ length: rows - 1 }, (_, index) => ({ row: index + 1, col: baseCol + 2 })),
            clue: { row: 0, col: baseCol + 2, arrow: "down", edge: "bottom" }
          };
          slots.push(primarySlot, secondarySlot);
          assignments.set(primarySlot.id, selected.primary);
          assignments.set(secondarySlot.id, selected.secondary);

          selected.fillers.forEach((filler, index) => {
            const row = index + 1;
            const slot = {
              id: `s${slotCounter++}`,
              orientation: "horizontal",
              length: 2,
              cells: [{ row, col: baseCol + 1 }, { row, col: baseCol + 2 }],
              clue: { row, col: baseCol, arrow: "right", edge: "right" }
            };
            slots.push(slot);
            assignments.set(slot.id, filler);
          });
        } else {
          const baseRow = band * 3;
          for (let col = 0; col < cols; col++) clueKeys.add(key(baseRow, col));
          clueKeys.add(key(baseRow + 2, 0));

          const primarySlot = {
            id: `s${slotCounter++}`,
            orientation: "horizontal",
            length: cols,
            cells: Array.from({ length: cols }, (_, col) => ({ row: baseRow + 1, col })),
            clue: { row: baseRow, col: 0, arrow: "down-right", edge: "bottom" }
          };
          const secondarySlot = {
            id: `s${slotCounter++}`,
            orientation: "horizontal",
            length: cols - 1,
            cells: Array.from({ length: cols - 1 }, (_, index) => ({ row: baseRow + 2, col: index + 1 })),
            clue: { row: baseRow + 2, col: 0, arrow: "right", edge: "right" }
          };
          slots.push(primarySlot, secondarySlot);
          assignments.set(primarySlot.id, selected.primary);
          assignments.set(secondarySlot.id, selected.secondary);

          selected.fillers.forEach((filler, index) => {
            const col = index + 1;
            const slot = {
              id: `s${slotCounter++}`,
              orientation: "vertical",
              length: 2,
              cells: [{ row: baseRow + 1, col }, { row: baseRow + 2, col }],
              clue: { row: baseRow, col, arrow: "down", edge: "bottom" }
            };
            slots.push(slot);
            assignments.set(slot.id, filler);
          });
        }
      }
      if (!failed) {
        return toPuzzle(
          rows,
          cols,
          clueKeys,
          slots,
          { assignments, nodes: 0 },
          title,
          targetLang
        );
      }
    }
    return null;
  }

  function staggeredTemplate(rows, cols, random) {
    const clueKeys = new Set();
    for (let row = 0; row < rows; row++) {
      clueKeys.add(key(row, 0));
      let col = 3 + Math.floor(random() * 4);
      while (col < cols - 1) {
        clueKeys.add(key(row, col));
        col += 3 + Math.floor(random() * 5);
      }
    }

    // Dikey cevapları en fazla iki harfte tut. Böylece yataydaki uzun, gerçek
    // kelimeler seçildikten sonra her dikey kesişim kısa havuzda kesin bulunur.
    for (let col = 1; col < cols; col++) {
      for (let row = 1; row < rows; row++) {
        const previousIsLetter = !clueKeys.has(key(row - 1, col));
        const beforePreviousIsLetter = row > 1 && !clueKeys.has(key(row - 2, col));
        if ((row === 1 && previousIsLetter) || (previousIsLetter && beforePreviousIsLetter)) {
          clueKeys.add(key(row, col));
        }
      }
    }
    return clueKeys;
  }

  function separatorChain(axisLength, bandCount, random) {
    const possible = [];
    for (let position = 3; position <= axisLength - 4; position++) possible.push(position);
    if (possible.length === 0) return Array.from({ length: bandCount }, () => []);
    const selected = [possible[Math.floor(random() * possible.length)]];
    const distant = possible.filter(position => Math.abs(position - selected[0]) >= 3);
    if (distant.length > 0 && random() < 0.7) {
      selected.push(distant[Math.floor(random() * distant.length)]);
      selected.sort((a, b) => a - b);
    }
    const chain = [];
    let active = selected.slice();
    for (let band = 0; band < bandCount; band++) {
      chain.push(active.slice());
      if (band > 0 && active.length > 0 && random() < 0.55) {
        active.splice(Math.floor(random() * active.length), 1);
      }
    }
    return chain;
  }

  function bandWidthCompositions(total, maxTwoBands) {
    const results = [];
    function visit(remaining, widths, twoCount) {
      if (remaining === 0) {
        results.push(widths.slice());
        return;
      }
      for (const width of [2, 3]) {
        if (width > remaining || (width === 2 && twoCount >= maxTwoBands)) continue;
        widths.push(width);
        visit(remaining - width, widths, twoCount + (width === 2 ? 1 : 0));
        widths.pop();
      }
    }
    visit(total, [], 0);
    return results;
  }

  function segmentedBandTemplate(rows, cols, random, orientation, bandWidths) {
    const clueKeys = new Set();
    if (orientation === "vertical") {
      const bands = bandWidths.length;
      const chains = separatorChain(rows, bands, random);
      let baseCol = 0;
      for (let band = 0; band < bands; band++) {
        const width = bandWidths[band];
        const separators = new Set(chains[band]);
        for (let row = 0; row < rows; row++) {
          if (row === 0 || !separators.has(row)) clueKeys.add(key(row, baseCol));
          if (separators.has(row)) {
            for (let offset = 1; offset < width; offset++) clueKeys.add(key(row, baseCol + offset));
          }
        }
        for (let offset = 2; offset < width; offset++) clueKeys.add(key(0, baseCol + offset));
        baseCol += width;
      }
    } else {
      const bands = bandWidths.length;
      const chains = separatorChain(cols, bands, random);
      let baseRow = 0;
      for (let band = 0; band < bands; band++) {
        const width = bandWidths[band];
        const separators = new Set(chains[band]);
        for (let col = 0; col < cols; col++) {
          if (col === 0 || !separators.has(col)) clueKeys.add(key(baseRow, col));
          if (separators.has(col)) {
            for (let offset = 1; offset < width; offset++) clueKeys.add(key(baseRow + offset, col));
          }
        }
        for (let offset = 2; offset < width; offset++) clueKeys.add(key(baseRow + offset, 0));
        baseRow += width;
      }
    }
    return clueKeys;
  }

  function solveClueTemplate(rows, cols, clueKeys, byLength, random, title, targetLang, options, timeLimitMs) {
    const slots = extractRuns(rows, cols, clueKeys);
    if (slots.length < 10 || slots.length > 64) return null;
    if (slots.some(slot =>
      !(byLength.get(slot.length) || []).length &&
      !(options.allowGaps === true && slot.length <= 4)
    )) return null;
    if (!assignClueCells(slots, clueKeys, random)) return null;
    const usedClues = new Set(slots.map(slot => key(slot.clue.row, slot.clue.col)));
    if (usedClues.size !== clueKeys.size) return null;
    const solved = solveSlots(slots, byLength, random, {
      maxNodes: options.maxNodes,
      timeLimitMs,
      allowGaps: options.allowGaps === true,
      maxGapCount: options.maxGapCount
    });
    if (!solved) return null;
    const puzzle = toPuzzle(rows, cols, clueKeys, slots, solved, title, targetLang, options);
    if (puzzle.stats.mainWordCount < 6) return null;
    return { puzzle, slots };
  }

  function naturalPatternScore(rows, cols, clueKeys, slots) {
    const rowPatterns = new Set();
    const colPatterns = new Set();
    for (let row = 0; row < rows; row++) {
      rowPatterns.add(Array.from({ length: cols }, (_, col) => clueKeys.has(key(row, col)) ? "1" : "0").join(""));
    }
    for (let col = 0; col < cols; col++) {
      colPatterns.add(Array.from({ length: rows }, (_, row) => clueKeys.has(key(row, col)) ? "1" : "0").join(""));
    }
    const longHorizontal = slots.filter(slot => slot.orientation === "horizontal" && slot.length >= 5).length;
    const longVertical = slots.filter(slot => slot.orientation === "vertical" && slot.length >= 5).length;
    const lengths = new Set(slots.map(slot => slot.length));
    return Math.min(longHorizontal, longVertical) * 80 +
      (longHorizontal + longVertical) * 8 +
      rowPatterns.size * 5 + colPatterns.size * 5 + lengths.size * 4;
  }

  function hasLongWordsInBothDirections(slots) {
    return slots.some(slot => slot.orientation === "horizontal" && slot.length >= 5) &&
      slots.some(slot => slot.orientation === "vertical" && slot.length >= 5);
  }

  function carvePerpendicularLong(rows, cols, initialClues, initialSolved, byLength, random, title, targetLang, options, dominantOrientation) {
    const wantedOrientation = dominantOrientation === "horizontal" ? "vertical" : "horizontal";
    if (initialSolved.slots.some(slot => slot.orientation === wantedOrientation && slot.length >= 5)) {
      return { clueKeys: new Set(initialClues), solved: initialSolved };
    }

    for (let attempt = 0; attempt < 64; attempt++) {
      const vertical = wantedOrientation === "vertical";
      const outerLimit = vertical ? cols : rows;
      const innerLimit = vertical ? rows : cols;
      const fixed = 1 + Math.floor(random() * Math.max(1, outerLimit - 2));
      const length = 5 + Math.floor(random() * Math.max(1, Math.min(8, innerLimit - 2) - 4));
      if (length >= innerLimit - 1) continue;
      const start = 1 + Math.floor(random() * Math.max(1, innerLimit - length - 1));
      const before = vertical ? key(start - 1, fixed) : key(fixed, start - 1);
      const after = vertical ? key(start + length, fixed) : key(fixed, start + length);
      if (!initialClues.has(before) || !initialClues.has(after)) continue;

      const candidateClues = new Set(initialClues);
      let valid = true;
      for (let offset = 0; offset < length; offset++) {
        const row = vertical ? start + offset : fixed;
        const col = vertical ? fixed : start + offset;
        const currentKey = key(row, col);
        if (!candidateClues.has(currentKey)) continue;
        const replacementOptions = vertical
          ? [{ row, col: col - 1 }, { row, col: col + 1 }]
          : [{ row: row - 1, col }, { row: row + 1, col }];
        const replacement = shuffle(replacementOptions, random).find(cell =>
          cell.row > 0 && cell.col > 0 && cell.row < rows - 1 && cell.col < cols - 1 &&
          !candidateClues.has(key(cell.row, cell.col))
        );
        if (!replacement) { valid = false; break; }
        candidateClues.delete(currentKey);
        candidateClues.add(key(replacement.row, replacement.col));
      }
      if (!valid) continue;

      const solved = solveClueTemplate(
        rows,
        cols,
        candidateClues,
        byLength,
        random,
        title,
        targetLang,
        options,
        Math.max(900, Math.min(Number(options.crossTimeLimitMs) || 1600, 2600))
      );
      if (!solved) continue;
      if (!solved.slots.some(slot => slot.orientation === wantedOrientation && slot.length >= 5)) continue;
      return { clueKeys: candidateClues, solved };
    }
    return null;
  }

  function randomizeSolvedTemplate(rows, cols, initialClues, initialSolved, byLength, random, title, targetLang, options) {
    if (!hasLongWordsInBothDirections(initialSolved.slots)) return null;
    const templateScore = (clues, solved) => naturalPatternScore(rows, cols, clues, solved.slots) -
      (solved.puzzle.stats.gapCount || 0) * 160 -
      (solved.puzzle.stats.unresolvedCellCount || 0) * 12;
    let currentClues = new Set(initialClues);
    let currentSolved = initialSolved;
    let currentScore = templateScore(currentClues, currentSolved);
    let bestClues = new Set(currentClues);
    let bestSolved = currentSolved;
    let bestScore = currentScore;
    let acceptedMutations = 0;
    const mutationAttempts = Math.max(4, Math.min(Number(options.mutationAttempts) || 12, 60));

    for (let attempt = 0; attempt < mutationAttempts; attempt++) {
      const clueCells = shuffle([...currentClues], random);
      const sourceKey = clueCells.find(cellKey => {
        const { row, col } = parseKey(cellKey);
        return row > 0 && col > 0 && row < rows - 1 && col < cols - 1;
      });
      if (!sourceKey) break;
      const source = parseKey(sourceKey);
      const nearby = shuffle([
        { row: source.row - 1, col: source.col },
        { row: source.row + 1, col: source.col },
        { row: source.row, col: source.col - 1 },
        { row: source.row, col: source.col + 1 }
      ], random).filter(cell => !currentClues.has(key(cell.row, cell.col)));
      if (nearby.length === 0) continue;
      const target = nearby[0];
      const candidateClues = new Set(currentClues);
      candidateClues.delete(sourceKey);
      candidateClues.add(key(target.row, target.col));
      const candidateSolved = solveClueTemplate(
        rows,
        cols,
        candidateClues,
        byLength,
        random,
        title,
        targetLang,
        options,
        Math.max(70, Math.min(Number(options.mutationTimeLimitMs) || 100, 300))
      );
      if (!candidateSolved) continue;
      if (!hasLongWordsInBothDirections(candidateSolved.slots)) continue;
      const candidateScore = templateScore(candidateClues, candidateSolved);
      if (candidateScore >= currentScore || random() < 0.12) {
        currentClues = candidateClues;
        currentSolved = candidateSolved;
        currentScore = candidateScore;
        acceptedMutations++;
      }
      if (candidateScore > bestScore) {
        bestClues = candidateClues;
        bestSolved = candidateSolved;
        bestScore = candidateScore;
      }
    }

    bestSolved.puzzle.stats.patternMode = acceptedMutations > 0 ? "layered-random" : "segmented-natural";
    bestSolved.puzzle.stats.patternMutations = acceptedMutations;
    bestSolved.puzzle.stats.patternScore = bestScore;
    return bestSolved.puzzle;
  }

  function trySegmentedBandGrid(rows, cols, byLength, random, title, targetLang, options) {
    const orientations = [];
    const oneLetterCount = (byLength.get(1) || []).length;
    const verticalTwoBandLimit = options.allowGaps === true
      ? cols
      : Math.floor(oneLetterCount / Math.max(1, rows - 1));
    const horizontalTwoBandLimit = options.allowGaps === true
      ? rows
      : Math.floor(oneLetterCount / Math.max(1, cols - 1));
    const verticalCompositions = bandWidthCompositions(cols, verticalTwoBandLimit);
    const horizontalCompositions = bandWidthCompositions(rows, horizontalTwoBandLimit);
    if (verticalCompositions.length > 0) orientations.push({ type: "vertical", compositions: verticalCompositions });
    if (horizontalCompositions.length > 0) orientations.push({ type: "horizontal", compositions: horizontalCompositions });
    orientations.sort((a, b) => {
      const variedA = a.compositions.some(widths => new Set(widths).size > 1) ? 1 : 0;
      const variedB = b.compositions.some(widths => new Set(widths).size > 1) ? 1 : 0;
      return variedB - variedA || random() - 0.5;
    });
    for (const orientation of orientations) {
      const compositions = shuffle(orientation.compositions, random).sort((a, b) =>
        (new Set(b).size - new Set(a).size) || random() - 0.5
      );
      const orientationAttempts = Math.max(24, Math.min(60, compositions.length * 12));
      for (let attempt = 0; attempt < orientationAttempts; attempt++) {
        const bandWidths = compositions[attempt % compositions.length];
        const clueKeys = segmentedBandTemplate(rows, cols, random, orientation.type, bandWidths);
        const initialSolved = solveClueTemplate(
          rows,
          cols,
          clueKeys,
          byLength,
          random,
          title,
          targetLang,
          options,
          Math.max(3200, Number(options.timeLimitMs) || 3200)
        );
        if (!initialSolved) continue;
        const crossed = carvePerpendicularLong(
          rows,
          cols,
          clueKeys,
          initialSolved,
          byLength,
          random,
          title,
          targetLang,
          options,
          orientation.type
        );
        if (!crossed) continue;
        const puzzle = randomizeSolvedTemplate(
          rows,
          cols,
          crossed.clueKeys,
          crossed.solved,
          byLength,
          random,
          title,
          targetLang,
          options
        );
        if (!puzzle) continue;
        puzzle.stats.patternMode = "layered-random";
        puzzle.stats.bandWidths = bandWidths;
        puzzle.stats.longWordOrder = "descending";
        return puzzle;
      }
    }
    return null;
  }

  function tryStaggeredGrid(rows, cols, byLength, random, title, targetLang, options) {
    const templateAttempts = Math.max(60, Math.min(Number(options.templateAttempts) || 220, 500));
    for (let attempt = 0; attempt < templateAttempts; attempt++) {
      const clueKeys = staggeredTemplate(rows, cols, random);
      const slots = extractRuns(rows, cols, clueKeys);
      if (slots.length < 12 || slots.length > 60) continue;
      if (slots.some(slot => slot.length > Math.max(rows, cols) || !(byLength.get(slot.length) || []).length)) continue;
      if (slots.some(slot => slot.orientation === "vertical" && slot.length > 2)) continue;
      const longHorizontal = slots.filter(slot => slot.orientation === "horizontal" && slot.length >= 5).length;
      if (longHorizontal < Math.max(5, Math.floor(rows / 2))) continue;
      if (!assignClueCells(slots, clueKeys, random)) continue;
      const usedClues = new Set(slots.map(slot => key(slot.clue.row, slot.clue.col)));
      if (usedClues.size !== clueKeys.size) continue;

      const solved = solveSlots(slots, byLength, random, {
        maxNodes: options.maxNodes,
        timeLimitMs: Math.max(500, Number(options.timeLimitMs) || 1800)
      });
      if (!solved) continue;
      const puzzle = toPuzzle(rows, cols, clueKeys, slots, solved, title, targetLang);
      puzzle.stats.patternMode = "staggered-natural";
      return puzzle;
    }
    return null;
  }

  function reconstructPuzzleLetters(puzzle) {
    const letters = new Map();
    for (const word of Object.values(puzzle.words || {})) {
      Array.from(word.answer || "").forEach((letter, index) => {
        letters.set(word.cells[index], letter);
      });
    }
    return letters;
  }

  function buildGapPlacements(rows, cols, emptyKeys, baseLetters) {
    const placements = [];
    const directions = [
      { arrow: "right", offsets: length => Array.from({ length }, (_, index) => [0, index + 1]) },
      { arrow: "down", offsets: length => Array.from({ length }, (_, index) => [index + 1, 0]) },
      { arrow: "down-right", offsets: length => Array.from({ length }, (_, index) => [1, index]) },
      { arrow: "right-down", offsets: length => Array.from({ length }, (_, index) => [index, 1]) }
    ];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const clueKey = key(row, col);
        if (!emptyKeys.has(clueKey)) continue;
        for (const direction of directions) {
          for (const length of [2, 1]) {
            const answerCells = direction.offsets(length).map(([rowOffset, colOffset]) => ({
              row: row + rowOffset,
              col: col + colOffset
            }));
            if (answerCells.some(cell =>
              cell.row < 0 || cell.col < 0 || cell.row >= rows || cell.col >= cols ||
              !emptyKeys.has(key(cell.row, cell.col))
            )) continue;
            placements.push({
              clue: { row, col },
              arrow: direction.arrow,
              answerCells,
              length,
              covered: [clueKey, ...answerCells.map(cell => key(cell.row, cell.col))]
            });
          }
        }

        // Tek başına kalmış bir boş hücre, yanındaki mevcut harfe tek harfli
        // bir ipucu kutusu olarak bağlanabilir. Böylece küçük oyuklar da kapanır.
        for (const external of [
          { arrow: "right", row, col: col + 1 },
          { arrow: "down", row: row + 1, col }
        ]) {
          if (external.row >= rows || external.col >= cols) continue;
          const answerId = cellId(external.row, external.col);
          const answer = baseLetters.get(answerId);
          if (!answer) continue;
          placements.push({
            clue: { row, col },
            arrow: external.arrow,
            answerCells: [{ row: external.row, col: external.col }],
            length: 1,
            fixedAnswer: answer,
            covered: [clueKey]
          });
        }
      }
    }
    return placements;
  }

  function tileEmptyCells(rows, cols, emptyKeys, baseLetters, usedAnswers, random, options) {
    const placements = buildGapPlacements(rows, cols, emptyKeys, baseLetters);
    const byCell = new Map();
    for (const placement of placements) {
      for (const cellKey of placement.covered) {
        const items = byCell.get(cellKey) || [];
        items.push(placement);
        byCell.set(cellKey, items);
      }
    }
    const remaining = new Set(emptyKeys);
    const selected = [];
    const fixedAnswers = new Set();
    const deadline = Date.now() + Math.max(200, Number(options.tileTimeLimitMs) || 900);
    const maxNodes = Math.max(2000, Number(options.tileMaxNodes) || 90000);
    let nodes = 0;

    function available(placement) {
      return placement.covered.every(cellKey => remaining.has(cellKey)) &&
        (!placement.fixedAnswer ||
          (!usedAnswers.has(placement.fixedAnswer) && !fixedAnswers.has(placement.fixedAnswer)));
    }

    function visit() {
      nodes++;
      if (nodes > maxNodes || Date.now() > deadline) return false;
      if (remaining.size === 0) return true;
      let chosenKey = null;
      let candidates = null;
      for (const cellKey of remaining) {
        const viable = (byCell.get(cellKey) || []).filter(available);
        if (viable.length === 0) return false;
        if (!candidates || viable.length < candidates.length) {
          chosenKey = cellKey;
          candidates = viable;
          if (viable.length === 1) break;
        }
      }
      const ordered = shuffle(candidates, random).sort((a, b) =>
        b.covered.length - a.covered.length ||
        Number(Boolean(a.fixedAnswer)) - Number(Boolean(b.fixedAnswer))
      );
      for (const placement of ordered) {
        if (!available(placement) || !placement.covered.includes(chosenKey)) continue;
        placement.covered.forEach(cellKey => remaining.delete(cellKey));
        if (placement.fixedAnswer) fixedAnswers.add(placement.fixedAnswer);
        selected.push(placement);
        if (visit()) return true;
        selected.pop();
        if (placement.fixedAnswer) fixedAnswers.delete(placement.fixedAnswer);
        placement.covered.forEach(cellKey => remaining.add(cellKey));
      }
      return false;
    }

    return visit() ? { placements: selected.slice(), nodes } : null;
  }

  function completeOrganicPuzzle(base, fillerWords, random, options) {
    const rows = base.rows;
    const cols = base.cols;
    const emptyKeys = new Set();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!base.cells[cellId(row, col)]) emptyKeys.add(key(row, col));
      }
    }
    if (emptyKeys.size === 0) return null;

    const baseLetters = reconstructPuzzleLetters(base);
    const usedAnswers = new Set(Object.values(base.words || {}).map(word => word.answer));
    const tiled = tileEmptyCells(rows, cols, emptyKeys, baseLetters, usedAnswers, random, options);
    if (!tiled) return null;

    const pools = new Map([1, 2].map(length => [
      length,
      shuffle(fillerWords.filter(word => word.letters.length === length), random)
        .sort((a, b) => fillerQuality(a) - fillerQuality(b))
    ]));
    const cells = JSON.parse(JSON.stringify(base.cells));
    const words = JSON.parse(JSON.stringify(base.words));
    Object.values(words).forEach(word => { word.sourceKind = "core"; });
    let wordCounter = Object.keys(words).length;
    let lastResortFillerCount = 0;
    let elementFillerCount = 0;

    for (const placement of tiled.placements) {
      let filler;
      if (placement.fixedAnswer) {
        filler = fillerWords.find(word =>
          word.answer === placement.fixedAnswer && !usedAnswers.has(word.answer)
        );
      } else {
        filler = (pools.get(placement.length) || []).find(word => !usedAnswers.has(word.answer));
      }
      if (!filler) return null;
      usedAnswers.add(filler.answer);
      if (filler.category === "alphabet-pair") lastResortFillerCount++;
      if (filler.category === "element-symbol") elementFillerCount++;

      const wordId = `w${wordCounter++}`;
      const clueCellId = cellId(placement.clue.row, placement.clue.col);
      cells[clueCellId] = {
        type: "clue",
        clues: [{ text: filler.clue, arrow: placement.arrow, wordId }]
      };
      const wordCells = placement.answerCells.map((cell, index) => {
        const id = cellId(cell.row, cell.col);
        if (!cells[id]) cells[id] = { type: "letter", wordIds: [] };
        if (!cells[id].wordIds.includes(wordId)) cells[id].wordIds.push(wordId);
        return id;
      });
      words[wordId] = {
        answer: filler.answer,
        cells: wordCells,
        clueCell: clueCellId,
        sourceKind: "filler",
        ...(filler.reviewStatus ? { reviewStatus: filler.reviewStatus } : {}),
        ...(filler.category ? { fillerCategory: filler.category } : {})
      };
    }

    const letterCells = Object.values(cells).filter(cell => cell.type === "letter");
    const crossings = letterCells.reduce((sum, cell) => sum + Math.max(0, cell.wordIds.length - 1), 0);
    return applyEditorialStats({
      ...base,
      cells,
      words,
      stats: {
        layoutMode: "full-grid",
        patternMode: "organic-completion",
        wordCount: Object.keys(words).length,
        mainWordCount: Object.keys(base.words).length,
        shortFillerCount: tiled.placements.length,
        lastResortFillerCount,
        elementFillerCount,
        clueCells: Object.values(cells).filter(cell => cell.type === "clue").length,
        letterCells: letterCells.length,
        usedCells: rows * cols,
        emptyCells: 0,
        fillPercent: 100,
        crossings,
        sharedClueCells: Object.values(cells)
          .filter(cell => cell.type === "clue" && cell.clues.length === 2).length,
        searchNodes: tiled.nodes
      }
    });
  }

  function tryOrganicGrid(rows, cols, coreWords, fillerWords, random, title, targetLang, options) {
    const baseGenerator = root.AutoPuzzleGenerator;
    const longWords = coreWords.filter(word => word.letters.length >= 5);
    if (!baseGenerator || typeof baseGenerator.generate !== "function" || longWords.length < 20) return null;
    const targetWords = Math.max(9, Math.min(20, Math.round(rows * cols / 7)));
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const base = baseGenerator.generate({
          wordList: longWords,
          rows,
          cols,
          targetWords,
          targetLang,
          compact: true,
          targetFillPercent: 68,
          title,
          seed: `${options.seed || Date.now()}-organic-${attempt}`,
          attempts: 18
        });
        const completed = completeOrganicPuzzle(base, fillerWords, random, options);
        if (completed) return completed;
      } catch (error) {
        // Farklı temel yerleşimle yeniden dene; bant şablonu son güvenli yedektir.
      }
    }
    return null;
  }

  function generate(options) {
    const rows = Number(options && options.rows);
    const cols = Number(options && options.cols);
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 5 || cols < 5 || rows > 16 || cols > 16) {
      throw new Error("Boşluksuz üretim için satır ve sütun 5 ile 16 arasında olmalı.");
    }
    const targetLang = options.targetLang === "tr" ? "tr" : "en";
    const maxLength = Math.max(rows, cols);
    const coreWords = cleanWords(options.coreWords, targetLang, maxLength, "core");
    const fillerWords = cleanWords(options.fillerWords, targetLang, Math.min(4, maxLength), "filler");
    if (coreWords.length < 20 || fillerWords.length < 20) {
      throw new Error("Boşluksuz üretim için ana ve kısa dolgu havuzları yetersiz.");
    }
    const byLength = buildWordIndex(coreWords, fillerWords, maxLength);
    const strictFillerWords = fillerWords.filter(word => word.category !== "alphabet-pair");
    const strictByLength = buildWordIndex(coreWords, strictFillerWords, maxLength);
    const preferredFillerWords = fillerWords.filter(word => fillerQuality(word) < 2);
    const preferredByLength = buildWordIndex(coreWords, preferredFillerWords, maxLength);
    const allowGaps = options.allowGaps === true;
    const segmentedByLength = allowGaps ? preferredByLength : strictByLength;
    const segmentedOptions = allowGaps ? { ...options, suggestionByLength: byLength } : options;
    const random = makeRandom(options.seed);
    const attempts = Math.max(1, Math.min(Number(options.attempts) || 40, 120));
    const title = options.title || "Boşluksuz Bulmaca";
    let bestGapPuzzle = null;
    for (let layoutAttempt = 0; layoutAttempt < 6; layoutAttempt++) {
      const layoutRandom = makeRandom(`${options.seed || Date.now()}-layered-${layoutAttempt}`);
      const segmentedPuzzle = trySegmentedBandGrid(
        rows,
        cols,
        segmentedByLength,
        layoutRandom,
        title,
        targetLang,
        segmentedOptions
      );
      if (!segmentedPuzzle) continue;
      if (!allowGaps || segmentedPuzzle.stats.gapCount === 0) return segmentedPuzzle;
      if (!bestGapPuzzle ||
          segmentedPuzzle.stats.gapCount < bestGapPuzzle.stats.gapCount ||
          (segmentedPuzzle.stats.gapCount === bestGapPuzzle.stats.gapCount &&
            segmentedPuzzle.stats.unresolvedCellCount < bestGapPuzzle.stats.unresolvedCellCount)) {
        bestGapPuzzle = segmentedPuzzle;
      }
    }

    if (allowGaps) {
      if (bestGapPuzzle) return bestGapPuzzle;
      throw new Error("Kaliteli iskelet için izin verilen gap sınırında bir şablon bulunamadı.");
    }

    const staggeredPuzzle = tryStaggeredGrid(rows, cols, strictByLength, random, title, targetLang, options);
    if (staggeredPuzzle) return staggeredPuzzle;
    if (options.allowUniformFallback === true) {
      const bandPuzzle = tryBandGrid(rows, cols, coreWords, fillerWords, random, title, targetLang);
      if (bandPuzzle) return bandPuzzle;
    }
    let lastReason = "uygun şablon bulunamadı";

    for (let attempt = 0; attempt < attempts; attempt++) {
      const clueRate = 0.12 + random() * 0.12;
      const clueKeys = randomTemplate(rows, cols, random, clueRate);
      const slots = normalizeTemplate(rows, cols, clueKeys, random);
      if (!slots) {
        lastReason = "ipucu kutuları ok kenarlarıyla eşleştirilemedi";
        continue;
      }
      if (slots.length < 8 || slots.length > 48) continue;
      if (slots.some(slot => slot.length > maxLength || !(strictByLength.get(slot.length) || []).length)) {
        lastReason = "şablonda havuzda karşılığı olmayan slot uzunluğu var";
        continue;
      }
      const longSlots = slots.filter(slot => slot.length >= 5).length;
      if (longSlots < Math.max(3, Math.floor(slots.length * 0.2))) {
        lastReason = "ana kelime slotu oranı yetersiz";
        continue;
      }
      const solved = solveSlots(slots, strictByLength, random, {
        maxNodes: options.maxNodes,
        timeLimitMs: options.timeLimitMs
      });
      if (!solved) {
        lastReason = "kelime kesişimleri çözülemedi";
        continue;
      }
      return toPuzzle(
        rows,
        cols,
        clueKeys,
        slots,
        solved,
        title,
        targetLang
      );
    }
    throw new Error(`Boşluksuz bulmaca üretilemedi: ${lastReason}. Yeniden deneyebilirsin.`);
  }

  root.FullGridGenerator = { generate, deriveEditorialStats };
  if (typeof module !== "undefined" && module.exports) module.exports = { generate, deriveEditorialStats };
})(typeof globalThis !== "undefined" ? globalThis : window);

/**
 * AUTO-PUZZLE-GENERATOR.js
 * ------------------------------------------------------------------
 * Kelime havuzundan, verilen satir/sutun sinirlarini asmayan baglantili
 * bir cengel bulmaca uretir. Yapay zeka kullanmaz; onaylanmis kelime
 * havuzunu deterministik bir yerlesim algoritmasiyla gride yerlestirir.
 *
 * Cikti, Bulmaca Studyosu ve oyun ekraninin kullandigi guncel veri
 * sozlesmesiyle uyumludur:
 *   cells/{cellId} -> { type: "clue", clues: [...] }
 *                  -> { type: "letter", wordIds: [...] }
 *   words/{wordId} -> { answer, cells, clueCell }
 */

(function exposeAutoPuzzleGenerator(root) {
  "use strict";

  const ORIENTATIONS = ["horizontal", "vertical"];

  function hashSeed(value) {
    const text = String(value == null ? Date.now() : value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
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
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function cellKey(row, col) {
    return `${row},${col}`;
  }

  function parseKey(key) {
    const [row, col] = key.split(",").map(Number);
    return { row, col };
  }

  function cellId(row, col) {
    return `r${row}c${col}`;
  }

  function inBounds(row, col, rows, cols) {
    return row >= 0 && row < rows && col >= 0 && col < cols;
  }

  function normalizeAnswer(value, targetLang) {
    const locale = targetLang === "tr" ? "tr-TR" : "en-US";
    return String(value || "").trim().toLocaleUpperCase(locale);
  }

  function validAnswer(answer, targetLang) {
    const pattern = targetLang === "tr"
      ? /^[A-ZÇĞİIÖŞÜ]+$/
      : /^[A-Z]+$/;
    return answer.length >= 3 && pattern.test(answer);
  }

  function cleanWordList(wordList, targetLang, rows, cols) {
    const seen = new Set();
    // Bükümlü oklarda ipucu komşu satır/sütunda olduğundan cevap bütün
    // satır veya sütun uzunluğunu kaplayabilir.
    const maxLength = Math.max(rows, cols);
    const cleaned = [];

    for (const item of Array.isArray(wordList) ? wordList : []) {
      const clue = String(item && item.clue || "").trim();
      const answer = normalizeAnswer(item && item.answer, targetLang);
      if (!clue || !validAnswer(answer, targetLang) || answer.length > maxLength || seen.has(answer)) {
        continue;
      }
      seen.add(answer);
      cleaned.push({
        clue,
        answer,
        bankEntryKey: String(item && item.bankEntryKey || "").trim() || null,
        reviewStatus: String(item && item.reviewStatus || "").trim() || null
      });
    }
    return cleaned;
  }

  function createModel(rows, cols) {
    return {
      rows,
      cols,
      letters: new Map(),
      clues: new Map(),
      placed: [],
      usedAnswers: new Set(),
      crossings: 0,
      sharedClues: 0,
      arrowCounts: new Map()
    };
  }

  function pathFor(answer, startRow, startCol, orientation) {
    const dr = orientation === "vertical" ? 1 : 0;
    const dc = orientation === "horizontal" ? 1 : 0;
    return Array.from(answer, (_, index) => ({
      row: startRow + dr * index,
      col: startCol + dc * index
    }));
  }

  function clueOptions(startRow, startCol, orientation) {
    if (orientation === "horizontal") {
      return [
        { row: startRow, col: startCol - 1, arrow: "right" },
        { row: startRow - 1, col: startCol, arrow: "down-right" }
      ];
    }
    return [
      { row: startRow - 1, col: startCol, arrow: "down" },
      { row: startRow, col: startCol - 1, arrow: "right-down" }
    ];
  }

  function arrowExitEdge(direction) {
    if (direction === "right" || direction === "right-down") return "right";
    if (direction === "down" || direction === "down-right") return "bottom";
    return null;
  }

  function occupiedBounds(model, extraCells) {
    const coords = [];
    for (const key of model.letters.keys()) coords.push(parseKey(key));
    for (const key of model.clues.keys()) coords.push(parseKey(key));
    if (extraCells) coords.push(...extraCells);
    if (coords.length === 0) return { area: 0 };

    let minRow = Infinity;
    let minCol = Infinity;
    let maxRow = -Infinity;
    let maxCol = -Infinity;
    for (const coord of coords) {
      minRow = Math.min(minRow, coord.row);
      minCol = Math.min(minCol, coord.col);
      maxRow = Math.max(maxRow, coord.row);
      maxCol = Math.max(maxCol, coord.col);
    }
    return {
      minRow,
      minCol,
      maxRow,
      maxCol,
      area: (maxRow - minRow + 1) * (maxCol - minCol + 1)
    };
  }

  function inspectPlacement(model, word, startRow, startCol, orientation, clue, requireCrossing, options) {
    const placementOptions = options || {};
    const { rows, cols } = model;
    const path = pathFor(word.answer, startRow, startCol, orientation);
    if (!inBounds(clue.row, clue.col, rows, cols)) return null;

    const clueKey = cellKey(clue.row, clue.col);
    if (model.letters.has(clueKey)) return null;
    const existingClues = model.clues.get(clueKey) || [];
    if (existingClues.length >= 2 || existingClues.some(item =>
      item.arrow === clue.arrow || arrowExitEdge(item.arrow) === arrowExitEdge(clue.arrow)
    )) return null;

    const dr = orientation === "vertical" ? 1 : 0;
    const dc = orientation === "horizontal" ? 1 : 0;
    const before = { row: startRow - dr, col: startCol - dc };
    const after = {
      row: startRow + dr * word.answer.length,
      col: startCol + dc * word.answer.length
    };
    if (inBounds(before.row, before.col, rows, cols) && model.letters.has(cellKey(before.row, before.col))) {
      return null;
    }
    if (inBounds(after.row, after.col, rows, cols) && model.letters.has(cellKey(after.row, after.col))) {
      return null;
    }

    let crossings = 0;
    let newLetters = 0;
    let adjacentLetters = 0;
    const orientationCode = orientation === "horizontal" ? "H" : "V";

    for (let index = 0; index < path.length; index++) {
      const coord = path[index];
      if (!inBounds(coord.row, coord.col, rows, cols)) return null;
      const key = cellKey(coord.row, coord.col);
      if (model.clues.has(key)) return null;

      const existing = model.letters.get(key);
      if (existing) {
        if (existing.char !== word.answer[index] || existing.directions.has(orientationCode)) return null;
        crossings++;
        continue;
      }

      newLetters++;
      const sideNeighbors = orientation === "horizontal"
        ? [{ row: coord.row - 1, col: coord.col }, { row: coord.row + 1, col: coord.col }]
        : [{ row: coord.row, col: coord.col - 1 }, { row: coord.row, col: coord.col + 1 }];
      const occupiedSideCount = sideNeighbors.filter(side =>
        inBounds(side.row, side.col, rows, cols) && model.letters.has(cellKey(side.row, side.col))
      ).length;
      if (!placementOptions.allowAdjacent && occupiedSideCount > 0) {
        return null;
      }
      adjacentLetters += occupiedSideCount;
    }

    if (requireCrossing && crossings === 0) return null;

    const oldArea = occupiedBounds(model).area;
    const newArea = occupiedBounds(model, [...path, { row: clue.row, col: clue.col }]).area;
    const centerRow = (rows - 1) / 2;
    const centerCol = (cols - 1) / 2;
    const midpoint = path[Math.floor(path.length / 2)];
    const centerDistance = Math.abs(midpoint.row - centerRow) + Math.abs(midpoint.col - centerCol);
    const sharesClue = existingClues.length > 0;
    const arrowCount = model.arrowCounts.get(clue.arrow) || 0;

    return {
      word,
      path,
      orientation,
      clue,
      crossings,
      newLetters,
      sharesClue,
      score: crossings * 120
        + (sharesClue ? 28 : 0)
        + (arrowCount === 0 ? 18 : 0)
        + newLetters * 3
        + (placementOptions.allowAdjacent ? adjacentLetters * 2 : 0)
        - (newArea - oldArea) * 1.6
        - centerDistance * 0.35
    };
  }

  function placementCandidates(model, word, options) {
    const candidates = [];
    const signatures = new Set();

    for (const [key, existing] of model.letters.entries()) {
      const cross = parseKey(key);
      for (let answerIndex = 0; answerIndex < word.answer.length; answerIndex++) {
        if (word.answer[answerIndex] !== existing.char) continue;

        for (const orientation of ORIENTATIONS) {
          const orientationCode = orientation === "horizontal" ? "H" : "V";
          if (existing.directions.has(orientationCode)) continue;
          const startRow = cross.row - (orientation === "vertical" ? answerIndex : 0);
          const startCol = cross.col - (orientation === "horizontal" ? answerIndex : 0);

          for (const clue of clueOptions(startRow, startCol, orientation)) {
            const signature = `${startRow}:${startCol}:${orientation}:${clue.row}:${clue.col}`;
            if (signatures.has(signature)) continue;
            signatures.add(signature);
            const candidate = inspectPlacement(model, word, startRow, startCol, orientation, clue, true, options);
            if (candidate) candidates.push(candidate);
          }
        }
      }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 4);
  }

  function place(model, candidate) {
    const wordId = `w${model.placed.length}`;
    const orientationCode = candidate.orientation === "horizontal" ? "H" : "V";
    const clueKey = cellKey(candidate.clue.row, candidate.clue.col);
    const clueItems = model.clues.get(clueKey) || [];
    if (clueItems.length > 0) model.sharedClues++;
    clueItems.push({ text: candidate.word.clue, arrow: candidate.clue.arrow, wordId });
    clueItems.sort((a, b) =>
      (arrowExitEdge(a.arrow) === "right" ? 0 : 1) -
      (arrowExitEdge(b.arrow) === "right" ? 0 : 1)
    );
    model.clues.set(clueKey, clueItems);
    model.arrowCounts.set(candidate.clue.arrow, (model.arrowCounts.get(candidate.clue.arrow) || 0) + 1);

    candidate.path.forEach((coord, index) => {
      const key = cellKey(coord.row, coord.col);
      let entry = model.letters.get(key);
      if (!entry) {
        entry = { char: candidate.word.answer[index], directions: new Set(), wordIds: [] };
        model.letters.set(key, entry);
      }
      entry.directions.add(orientationCode);
      entry.wordIds.push(wordId);
    });

    model.crossings += candidate.crossings;
    model.usedAnswers.add(candidate.word.answer);
    model.placed.push({
      wordId,
      answer: candidate.word.answer,
      clue: candidate.word.clue,
      bankEntryKey: candidate.word.bankEntryKey,
      reviewStatus: candidate.word.reviewStatus,
      clueCell: { row: candidate.clue.row, col: candidate.clue.col },
      arrow: candidate.clue.arrow,
      path: candidate.path
    });
  }

  function placeFirstWord(model, words, random, options) {
    const candidates = words.filter(word =>
      word.answer.length <= Math.max(model.rows, model.cols) - 1 && word.answer.length <= 10
    );
    if (candidates.length === 0) return false;

    for (const word of shuffle(candidates, random).slice(0, 40)) {
      const orientations = shuffle(ORIENTATIONS, random);
      for (const orientation of orientations) {
        const fits = orientation === "horizontal"
          ? word.answer.length + 1 <= model.cols
          : word.answer.length + 1 <= model.rows;
        if (!fits) continue;

        const startRow = orientation === "horizontal"
          ? Math.floor(model.rows / 2)
          : Math.max(1, Math.floor((model.rows - word.answer.length) / 2));
        const startCol = orientation === "horizontal"
          ? Math.max(1, Math.floor((model.cols - word.answer.length) / 2))
          : Math.floor(model.cols / 2);

        for (const clue of shuffle(clueOptions(startRow, startCol, orientation), random)) {
          const candidate = inspectPlacement(model, word, startRow, startCol, orientation, clue, false, options);
          if (candidate) {
            place(model, candidate);
            return true;
          }
        }
      }
    }
    return false;
  }

  function grow(model, words, targetWords, random, candidatePoolSize, options) {
    const growOptions = options || {};
    const targetFillPercent = Number(growOptions.targetFillPercent) || 80;
    const maxWords = Math.max(targetWords, Number(growOptions.maxWords) || targetWords);
    model.layoutMode = growOptions.compact ? "compact-crossword" : "crossword";
    model.targetFillPercent = targetFillPercent;
    model.minimumWords = targetWords;
    if (!placeFirstWord(model, words, random, growOptions)) return;

    while (model.placed.length < maxWords) {
      const usedCells = model.letters.size + model.clues.size;
      const fillPercent = (usedCells / (model.rows * model.cols)) * 100;
      if (model.placed.length >= targetWords && fillPercent >= targetFillPercent) break;
      const unused = shuffle(words.filter(word => !model.usedAnswers.has(word.answer)), random)
        .slice(0, candidatePoolSize);
      const candidates = [];
      for (const word of unused) {
        candidates.push(...placementCandidates(model, word, growOptions));
      }
      if (candidates.length === 0) break;

      const currentUsed = model.letters.size + model.clues.size;
      for (const candidate of candidates) {
        const clueKey = cellKey(candidate.clue.row, candidate.clue.col);
        const addedClue = model.clues.has(clueKey) ? 0 : 1;
        const projectedFill = ((currentUsed + candidate.newLetters + addedClue) /
          (model.rows * model.cols)) * 100;
        if (projectedFill > targetFillPercent + 7) {
          candidate.score -= (projectedFill - targetFillPercent - 7) * 30;
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      const choiceWindow = Math.min(8, candidates.length);
      const choiceIndex = Math.floor(Math.pow(random(), 2) * choiceWindow);
      place(model, candidates[choiceIndex]);
    }
  }

  /**
   * Bir satır/sütunu [ipucu hücresi + cevap] parçalarıyla tam kapatır.
   * Örn. 12 hücre; 5 ve 5 harfli iki cevap için (1+5) + (1+5).
   */
  function findLineTiling(totalCells, words, usedAnswers, desiredCount, random) {
    const availableByLength = new Map();
    for (const word of words) {
      if (usedAnswers.has(word.answer)) continue;
      const length = Array.from(word.answer).length;
      if (length + 1 > totalCells) continue;
      const items = availableByLength.get(length) || [];
      items.push(word);
      availableByLength.set(length, items);
    }
    for (const [length, items] of availableByLength.entries()) {
      availableByLength.set(length, shuffle(items, random));
    }

    const maxCount = Math.floor(totalCells / 4);
    const counts = Array.from({ length: maxCount }, (_, index) => index + 1)
      .sort((a, b) => Math.abs(a - desiredCount) - Math.abs(b - desiredCount));

    function findSizes(remaining, slots, chosen, chosenCounts) {
      if (slots === 0) return remaining === 0 ? chosen.slice() : null;
      if (remaining < slots * 4) return null;

      const minRest = (slots - 1) * 4;
      const sizes = [];
      for (let size = 4; size <= remaining - minRest; size++) {
        const answerLength = size - 1;
        const available = availableByLength.get(answerLength) || [];
        const alreadyChosen = chosenCounts.get(answerLength) || 0;
        if (available.length > alreadyChosen) sizes.push(size);
      }

      for (const size of shuffle(sizes, random)) {
        const answerLength = size - 1;
        chosen.push(size);
        chosenCounts.set(answerLength, (chosenCounts.get(answerLength) || 0) + 1);
        const result = findSizes(remaining - size, slots - 1, chosen, chosenCounts);
        if (result) return result;
        chosen.pop();
        const nextCount = chosenCounts.get(answerLength) - 1;
        if (nextCount === 0) chosenCounts.delete(answerLength);
        else chosenCounts.set(answerLength, nextCount);
      }
      return null;
    }

    for (const count of counts) {
      const sizes = findSizes(totalCells, count, [], new Map());
      if (!sizes) continue;
      const selected = [];
      const localUsed = new Set();
      let valid = true;
      for (const size of sizes) {
        const candidates = availableByLength.get(size - 1) || [];
        const word = candidates.find(item => !localUsed.has(item.answer));
        if (!word) { valid = false; break; }
        localUsed.add(word.answer);
        selected.push(word);
      }
      if (valid) return selected;
    }
    return null;
  }

  /**
   * İki komşu satır/sütunu ortak ipucu kutularıyla kapatır. Her parçada
   * üst/sol cevap için N-1, alt/sağdaki bükümlü cevap için N harf gerekir.
   */
  function findPairedLineTiling(totalCells, words, usedAnswers, desiredCount, random) {
    const availableByLength = new Map();
    for (const word of words) {
      if (usedAnswers.has(word.answer)) continue;
      const length = Array.from(word.answer).length;
      if (length > totalCells) continue;
      const items = availableByLength.get(length) || [];
      items.push(word);
      availableByLength.set(length, items);
    }
    for (const [length, items] of availableByLength.entries()) {
      availableByLength.set(length, shuffle(items, random));
    }

    const maxCount = Math.floor(totalCells / 4);
    const counts = Array.from({ length: maxCount }, (_, index) => index + 1)
      .sort((a, b) => Math.abs(a - desiredCount) - Math.abs(b - desiredCount));

    function adjustCount(map, length, delta) {
      const next = (map.get(length) || 0) + delta;
      if (next === 0) map.delete(length);
      else map.set(length, next);
    }

    function findSizes(remaining, slots, chosen, requirements) {
      if (slots === 0) return remaining === 0 ? chosen.slice() : null;
      if (remaining < slots * 4) return null;

      const sizes = [];
      const minRest = (slots - 1) * 4;
      for (let size = 4; size <= remaining - minRest; size++) {
        const shortLength = size - 1;
        const longLength = size;
        const shortAvailable = (availableByLength.get(shortLength) || []).length;
        const longAvailable = (availableByLength.get(longLength) || []).length;
        if (shortAvailable > (requirements.get(shortLength) || 0) &&
            longAvailable > (requirements.get(longLength) || 0)) {
          sizes.push(size);
        }
      }

      for (const size of shuffle(sizes, random)) {
        chosen.push(size);
        adjustCount(requirements, size - 1, 1);
        adjustCount(requirements, size, 1);
        const result = findSizes(remaining - size, slots - 1, chosen, requirements);
        if (result) return result;
        adjustCount(requirements, size - 1, -1);
        adjustCount(requirements, size, -1);
        chosen.pop();
      }
      return null;
    }

    for (const count of counts) {
      const sizes = findSizes(totalCells, count, [], new Map());
      if (!sizes) continue;
      const localUsed = new Set();
      const result = [];
      let valid = true;
      for (const size of sizes) {
        const primary = (availableByLength.get(size - 1) || [])
          .find(item => !localUsed.has(item.answer));
        if (!primary) { valid = false; break; }
        localUsed.add(primary.answer);
        const bent = (availableByLength.get(size) || [])
          .find(item => !localUsed.has(item.answer));
        if (!bent) { valid = false; break; }
        localUsed.add(bent.answer);
        result.push({ primary, bent });
      }
      if (valid) return result;
    }
    return null;
  }

  function placeDenseLine(model, tiling, orientation, fixedIndex, offset) {
    let cursor = offset;
    for (const word of tiling) {
      const answerLength = Array.from(word.answer).length;
      const clue = orientation === "horizontal"
        ? { row: fixedIndex, col: cursor, arrow: "right" }
        : { row: cursor, col: fixedIndex, arrow: "down" };
      const startRow = orientation === "horizontal" ? fixedIndex : cursor + 1;
      const startCol = orientation === "horizontal" ? cursor + 1 : fixedIndex;
      place(model, {
        word,
        path: pathFor(word.answer, startRow, startCol, orientation),
        orientation,
        clue,
        crossings: 0,
        newLetters: answerLength,
        sharesClue: false,
        score: 0
      });
      cursor += answerLength + 1;
    }
  }

  function placeDenseLinePair(model, tiling, orientation, fixedIndex, offset) {
    let cursor = offset;
    for (const pair of tiling) {
      const primaryLength = Array.from(pair.primary.answer).length;
      const bentLength = Array.from(pair.bent.answer).length;
      const primaryClue = orientation === "horizontal"
        ? { row: fixedIndex, col: cursor, arrow: "right" }
        : { row: cursor, col: fixedIndex, arrow: "down" };
      const bentClue = {
        row: primaryClue.row,
        col: primaryClue.col,
        arrow: orientation === "horizontal" ? "down-right" : "right-down"
      };

      place(model, {
        word: pair.primary,
        path: pathFor(
          pair.primary.answer,
          orientation === "horizontal" ? fixedIndex : cursor + 1,
          orientation === "horizontal" ? cursor + 1 : fixedIndex,
          orientation
        ),
        orientation,
        clue: primaryClue,
        crossings: 0,
        newLetters: primaryLength,
        sharesClue: false,
        score: 0
      });
      place(model, {
        word: pair.bent,
        path: pathFor(
          pair.bent.answer,
          orientation === "horizontal" ? fixedIndex + 1 : cursor,
          orientation === "horizontal" ? cursor : fixedIndex + 1,
          orientation
        ),
        orientation,
        clue: bentClue,
        crossings: 0,
        newLetters: bentLength,
        sharesClue: true,
        score: 0
      });
      cursor += primaryLength + 1;
    }
  }

  /**
   * Gridi iki bölgeye ayırır: soldaki bölge satır satır sağa, sağdaki
   * bölge sütun sütun aşağı cevaplarla tam kaplanır. Böylece hiçbir hücre
   * blok/ölü hücre kalmaz ve hem sağ hem aşağı yön okları kullanılır.
   */
  function buildDenseModel(words, rows, cols, targetWords, random, attempts) {
    const splits = [];
    const largestHorizontalWidth = cols >= 6 ? cols - 2 : cols - 1;
    for (let horizontalWidth = 4; horizontalWidth <= largestHorizontalWidth; horizontalWidth++) {
      const verticalWidth = cols - horizontalWidth;
      const lineCount = rows + verticalWidth;
      const maxWords = rows * Math.floor(horizontalWidth / 4)
        + verticalWidth * Math.floor(rows / 4);
      const distance = targetWords < lineCount
        ? lineCount - targetWords
        : Math.max(0, targetWords - maxWords);
      splits.push({ horizontalWidth, verticalWidth, distance });
    }
    splits.sort((a, b) => a.distance - b.distance);

    let bestModel = null;
    let bestDistance = Infinity;
    const tryCount = Math.max(attempts, splits.length * 3);

    for (let attempt = 0; attempt < tryCount; attempt++) {
      const preferred = splits.filter(item => item.distance === splits[0].distance);
      const split = attempt < preferred.length
        ? preferred[attempt]
        : splits[Math.floor(random() * Math.min(splits.length, 5))];
      const model = createModel(rows, cols);
      model.layoutMode = "dense-partition";

      const tasks = [];
      for (let row = 0; row < rows; row += 2) {
        tasks.push({
          orientation: "horizontal",
          fixedIndex: row,
          length: split.horizontalWidth,
          offset: 0,
          paired: row + 1 < rows,
          wordUnit: row + 1 < rows ? 2 : 1
        });
      }
      for (let col = split.horizontalWidth; col < cols; col += 2) {
        tasks.push({
          orientation: "vertical",
          fixedIndex: col,
          length: rows,
          offset: 0,
          paired: col + 1 < cols,
          wordUnit: col + 1 < cols ? 2 : 1
        });
      }

      let failed = false;
      for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        const minWordsAfter = tasks.slice(index + 1)
          .reduce((sum, item) => sum + item.wordUnit, 0);
        const desiredWords = Math.max(
          task.wordUnit,
          targetWords - model.placed.length - minWordsAfter
        );
        const desiredCount = Math.max(1, Math.round(desiredWords / task.wordUnit));
        const tiling = task.paired
          ? findPairedLineTiling(task.length, words, model.usedAnswers, desiredCount, random)
          : findLineTiling(task.length, words, model.usedAnswers, desiredCount, random);
        if (!tiling) { failed = true; break; }
        if (task.paired) {
          placeDenseLinePair(model, tiling, task.orientation, task.fixedIndex, task.offset);
        } else {
          placeDenseLine(model, tiling, task.orientation, task.fixedIndex, task.offset);
        }
      }
      if (failed || model.letters.size + model.clues.size !== rows * cols) continue;

      const distance = Math.abs(model.placed.length - targetWords);
      if (!bestModel || distance < bestDistance) {
        bestModel = model;
        bestDistance = distance;
      }
      if (distance === 0) break;
    }

    return bestModel;
  }

  function modelQuality(model) {
    const usedCells = model.letters.size + model.clues.size;
    const fillPercent = (usedCells / (model.rows * model.cols)) * 100;
    const bounds = occupiedBounds(model);
    if (model.layoutMode === "compact-crossword") {
      const gaps = analyzeEmptyCells(model);
      const target = model.targetFillPercent || 80;
      const wordShortfall = Math.max(0, (model.minimumWords || 0) - model.placed.length);
      // Kelime hedefini tercih et; fakat tek bir ek kelime uğruna doluluk ve
      // dağılım kalitesini feda etme. Hedef, güvenlik kuralı değil beklentidir.
      return -wordShortfall * 50000
        - Math.abs(fillPercent - target) * 12000
        + model.crossings * 1400
        + model.placed.length * 180
        + model.sharedClues * 220
        - gaps.largestEmptyRegion * 18
        - gaps.isolatedEmptyCells * 80;
    }
    return model.placed.length * 100000
      + model.crossings * 1000
      + model.sharedClues * 200
      - bounds.area * 2
      - usedCells;
  }

  function analyzeEmptyCells(model) {
    const occupied = new Set([...model.letters.keys(), ...model.clues.keys()]);
    const visited = new Set();
    let emptyCells = 0;
    let largestEmptyRegion = 0;
    let isolatedEmptyCells = 0;

    for (let row = 0; row < model.rows; row++) {
      for (let col = 0; col < model.cols; col++) {
        const startKey = cellKey(row, col);
        if (occupied.has(startKey) || visited.has(startKey)) continue;
        emptyCells++;
        visited.add(startKey);
        const queue = [{ row, col }];
        let head = 0;
        let regionSize = 0;
        while (head < queue.length) {
          const current = queue[head++];
          regionSize++;
          const neighbors = [
            { row: current.row - 1, col: current.col },
            { row: current.row + 1, col: current.col },
            { row: current.row, col: current.col - 1 },
            { row: current.row, col: current.col + 1 }
          ];
          for (const neighbor of neighbors) {
            const key = cellKey(neighbor.row, neighbor.col);
            if (!inBounds(neighbor.row, neighbor.col, model.rows, model.cols) ||
                occupied.has(key) || visited.has(key)) continue;
            visited.add(key);
            emptyCells++;
            queue.push(neighbor);
          }
        }
        largestEmptyRegion = Math.max(largestEmptyRegion, regionSize);
        if (regionSize === 1) isolatedEmptyCells++;
      }
    }
    return { emptyCells, largestEmptyRegion, isolatedEmptyCells };
  }

  function countUncluedRuns(model) {
    const wordPaths = new Set(model.placed.map(placed =>
      placed.path.map(coord => cellKey(coord.row, coord.col)).join("|")
    ));
    let count = 0;
    for (const orientation of ORIENTATIONS) {
      const outerLimit = orientation === "horizontal" ? model.rows : model.cols;
      const innerLimit = orientation === "horizontal" ? model.cols : model.rows;
      for (let outer = 0; outer < outerLimit; outer++) {
        let run = [];
        for (let inner = 0; inner <= innerLimit; inner++) {
          const row = orientation === "horizontal" ? outer : inner;
          const col = orientation === "horizontal" ? inner : outer;
          const key = inner < innerLimit ? cellKey(row, col) : null;
          if (key && model.letters.has(key)) {
            run.push(key);
          } else {
            if (run.length >= 2 && !wordPaths.has(run.join("|"))) count++;
            run = [];
          }
        }
      }
    }
    return count;
  }

  function toPuzzle(model, title, targetLang) {
    const cells = {};
    const words = {};

    for (const [key, clues] of model.clues.entries()) {
      const { row, col } = parseKey(key);
      cells[cellId(row, col)] = {
        type: "clue",
        clues: clues.map(clue => ({ ...clue }))
      };
    }

    for (const [key, letter] of model.letters.entries()) {
      const { row, col } = parseKey(key);
      cells[cellId(row, col)] = {
        type: "letter",
        wordIds: letter.wordIds.slice()
      };
    }

    for (const placed of model.placed) {
      words[placed.wordId] = {
        answer: placed.answer,
        cells: placed.path.map(coord => cellId(coord.row, coord.col)),
        clueCell: cellId(placed.clueCell.row, placed.clueCell.col),
        ...(placed.bankEntryKey ? { bankEntryKey: placed.bankEntryKey } : {}),
        ...(placed.reviewStatus ? { reviewStatus: placed.reviewStatus } : {})
      };
    }

    const usedCells = model.letters.size + model.clues.size;
    const gaps = analyzeEmptyCells(model);
    return {
      title,
      rows: model.rows,
      cols: model.cols,
      cells,
      words,
      targetLang,
      stats: {
        wordCount: model.placed.length,
        crossings: model.crossings,
        sharedClueCells: model.sharedClues,
        letterCells: model.letters.size,
        clueCells: model.clues.size,
        usedCells,
        fillPercent: Math.round((usedCells / (model.rows * model.cols)) * 100),
        layoutMode: model.layoutMode || "crossword",
        emptyCells: gaps.emptyCells,
        largestEmptyRegion: gaps.largestEmptyRegion,
        isolatedEmptyCells: gaps.isolatedEmptyCells,
        uncluedRuns: countUncluedRuns(model)
      }
    };
  }

  function validateOptions(options) {
    const rows = Number(options.rows);
    const cols = Number(options.cols);
    const targetWords = Number(options.targetWords || 18);
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 5 || cols < 5 || rows > 30 || cols > 30) {
      throw new Error("Otomatik üretim için grid boyutu 5 ile 30 arasında olmalı.");
    }
    if (!Number.isInteger(targetWords) || targetWords < 3 || targetWords > 80) {
      throw new Error("Hedef kelime sayısı 3 ile 80 arasında olmalı.");
    }
    return { rows, cols, targetWords };
  }

  function validatePuzzle(puzzle, options) {
    const errors = [];
    const reconstructedLetters = new Map();
    const seenAnswers = new Set();
    const wordIds = Object.keys(puzzle && puzzle.words || {});
    const allowGaps = Boolean(options && options.allowGaps);
    const gaps = Array.isArray(puzzle && puzzle.gaps) ? puzzle.gaps : [];
    const gapIds = new Set();

    function parseCellId(value) {
      const match = String(value || "").match(/^r(\d+)c(\d+)$/);
      return match ? { row: Number(match[1]), col: Number(match[2]) } : null;
    }

    if (!puzzle || !Number.isInteger(puzzle.rows) || !Number.isInteger(puzzle.cols)) {
      return { valid: false, errors: ["Bulmaca boyutu geçersiz."] };
    }
    if (wordIds.length === 0) errors.push("Bulmacada hiç kelime yok.");
    if (!allowGaps && gaps.length > 0) errors.push("Yayınlanabilir bulmacada çözülmemiş gap bulunamaz.");
    if (puzzle.stats && Number(puzzle.stats.gapCount || 0) !== gaps.length) {
      errors.push("Gap istatistiği puzzle.gaps ile uyuşmuyor.");
    }

    for (const [id, cell] of Object.entries(puzzle.cells || {})) {
      const coord = parseCellId(id);
      if (!coord || !inBounds(coord.row, coord.col, puzzle.rows, puzzle.cols)) {
        errors.push(`Sınır dışında veya geçersiz hücre: ${id}`);
      }
      const pendingGaps = allowGaps && cell && cell.type === "clue" && Array.isArray(cell.pendingGaps)
        ? cell.pendingGaps
        : [];
      const clueCount = cell && cell.type === "clue" && Array.isArray(cell.clues) ? cell.clues.length : 0;
      if (cell && cell.type === "clue" &&
          (!Array.isArray(cell.clues) || clueCount + pendingGaps.length < 1 || clueCount + pendingGaps.length > 2)) {
        errors.push(`İpucu hücresinin satır sayısı geçersiz: ${id}`);
      }
      if (cell && cell.type === "clue" && Array.isArray(cell.clues)) {
        const exitEdges = [
          ...cell.clues.map(clue => arrowExitEdge(clue.arrow)),
          ...pendingGaps.map(gap => arrowExitEdge(gap.arrow))
        ];
        if (exitEdges.some(edge => !edge) || new Set(exitEdges).size !== exitEdges.length) {
          errors.push(`İpucu okları aynı kenarda çakışıyor veya geçersiz: ${id}`);
        }
      }
    }

    for (const gap of gaps) {
      const gapId = String(gap && gap.id || "");
      if (!gapId || gapIds.has(gapId)) {
        errors.push(`Gap kimliği geçersiz veya tekrarlı: ${gapId || "boş"}`);
        continue;
      }
      gapIds.add(gapId);
      const gapCells = Array.isArray(gap.cells) ? gap.cells : [];
      if (!Number.isInteger(gap.length) || gap.length < 1 || gap.length > 4 || gapCells.length !== gap.length) {
        errors.push(`Gap uzunluğu geçersiz: ${gapId}`);
        continue;
      }
      const clueCell = puzzle.cells && puzzle.cells[gap.clueCell];
      const pending = clueCell && clueCell.type === "clue" && Array.isArray(clueCell.pendingGaps)
        ? clueCell.pendingGaps.find(item => item.gapId === gapId && item.arrow === gap.arrow)
        : null;
      if (!pending) errors.push(`Gap ipucu bağlantısı eksik: ${gapId}`);
      for (const id of gapCells) {
        const cell = puzzle.cells && puzzle.cells[id];
        if (!cell || cell.type !== "letter" || !Array.isArray(cell.gapIds) || !cell.gapIds.includes(gapId)) {
          errors.push(`Gap hücre bağlantısı eksik: ${gapId}/${id}`);
        }
      }
      if (Array.from(String(gap.pattern || "")).length !== gap.length) {
        errors.push(`Gap pattern uzunluğu geçersiz: ${gapId}`);
      }
      const origin = parseCellId(gap.clueCell);
      const coords = gapCells.map(parseCellId);
      const expectedFirst = ["right", "right-down"].includes(gap.arrow)
        ? { row: origin && origin.row, col: origin && origin.col + 1 }
        : { row: origin && origin.row + 1, col: origin && origin.col };
      if (!origin || coords.some(coord => !coord) ||
          coords[0].row !== expectedFirst.row || coords[0].col !== expectedFirst.col) {
        errors.push(`Gap oku başlangıç hücresiyle uyuşmuyor: ${gapId}`);
      } else if (coords.length > 1) {
        const rowStep = coords[1].row - coords[0].row;
        const colStep = coords[1].col - coords[0].col;
        const horizontal = ["right", "down-right"].includes(gap.arrow);
        const vertical = ["down", "right-down"].includes(gap.arrow);
        if ((horizontal && (rowStep !== 0 || colStep !== 1)) ||
            (vertical && (rowStep !== 1 || colStep !== 0)) ||
            coords.some((coord, index) =>
              coord.row !== coords[0].row + rowStep * index ||
              coord.col !== coords[0].col + colStep * index
            )) {
          errors.push(`Gap yolu ok yönüyle uyuşmuyor: ${gapId}`);
        }
      }
      for (const suggestion of Array.isArray(gap.suggestions) ? gap.suggestions : []) {
        const letters = Array.from(String(suggestion && suggestion.answer || ""));
        const pattern = Array.from(String(gap.pattern || ""));
        if (letters.length !== gap.length || pattern.some((letter, index) =>
          letter !== "?" && letter !== letters[index]
        )) {
          errors.push(`Gap önerisi pattern ile uyuşmuyor: ${gapId}/${suggestion.answer || "boş"}`);
        }
      }
    }

    if (allowGaps) {
      for (const [id, cell] of Object.entries(puzzle.cells || {})) {
        for (const pending of cell && cell.type === "clue" && Array.isArray(cell.pendingGaps) ? cell.pendingGaps : []) {
          if (!gapIds.has(pending.gapId)) errors.push(`Sahipsiz pending gap bağlantısı: ${id}/${pending.gapId}`);
        }
        for (const gapId of cell && cell.type === "letter" && Array.isArray(cell.gapIds) ? cell.gapIds : []) {
          if (!gapIds.has(gapId)) errors.push(`Sahipsiz gap hücre bağlantısı: ${id}/${gapId}`);
        }
      }
    }

    if (puzzle.stats && ["dense-partition", "full-grid"].includes(puzzle.stats.layoutMode)) {
      const expectedCellCount = puzzle.rows * puzzle.cols;
      if (Object.keys(puzzle.cells || {}).length !== expectedCellCount) {
        errors.push(`Boşluksuz grid eksik: ${Object.keys(puzzle.cells || {}).length}/${expectedCellCount} hücre.`);
      }
    }
    if (puzzle.stats && puzzle.stats.layoutMode === "full-grid") {
      const wordPaths = new Set(wordIds.map(wordId => (puzzle.words[wordId].cells || []).join(">")));
      if (allowGaps) gaps.forEach(gap => wordPaths.add((gap.cells || []).join(">")));
      const fakeRuns = [];
      for (let row = 0; row < puzzle.rows; row++) {
        let run = [];
        for (let col = 0; col <= puzzle.cols; col++) {
          const id = col < puzzle.cols ? `r${row}c${col}` : null;
          if (id && puzzle.cells[id]?.type === "letter") run.push(id);
          else {
            if (run.length >= 2 && !wordPaths.has(run.join(">"))) fakeRuns.push(run.join(","));
            run = [];
          }
        }
      }
      for (let col = 0; col < puzzle.cols; col++) {
        let run = [];
        for (let row = 0; row <= puzzle.rows; row++) {
          const id = row < puzzle.rows ? `r${row}c${col}` : null;
          if (id && puzzle.cells[id]?.type === "letter") run.push(id);
          else {
            if (run.length >= 2 && !wordPaths.has(run.join(">"))) fakeRuns.push(run.join(","));
            run = [];
          }
        }
      }
      if (fakeRuns.length > 0) {
        errors.push(`${fakeRuns.length} ipucusuz/anlamsız birleşik harf dizisi bulundu.`);
      }
    }
    if (puzzle.stats && puzzle.stats.layoutMode === "compact-crossword" && puzzle.stats.uncluedRuns > 0) {
      errors.push(`${puzzle.stats.uncluedRuns} ipucusuz sahte harf dizisi bulundu.`);
    }

    for (const wordId of wordIds) {
      const word = puzzle.words[wordId];
      const answer = String(word && word.answer || "");
      if (!answer || !Array.isArray(word.cells) || word.cells.length !== Array.from(answer).length) {
        errors.push(`Cevap/hücre uzunluğu uyuşmuyor: ${wordId}`);
        continue;
      }
      if (seenAnswers.has(answer) && Array.from(answer).length > 1) errors.push(`Tekrarlanan cevap: ${answer}`);
      seenAnswers.add(answer);

      const clueCell = puzzle.cells && puzzle.cells[word.clueCell];
      const clue = clueCell && clueCell.type === "clue" && Array.isArray(clueCell.clues)
        ? clueCell.clues.find(item => item.wordId === wordId)
        : null;
      if (!clue) errors.push(`İpucu bağlantısı eksik: ${wordId}`);

      word.cells.forEach((id, index) => {
        const cell = puzzle.cells && puzzle.cells[id];
        if (!cell || cell.type !== "letter" || !Array.isArray(cell.wordIds) || !cell.wordIds.includes(wordId)) {
          errors.push(`Harf hücresi bağlantısı eksik: ${wordId}/${id}`);
        }
        const previous = reconstructedLetters.get(id);
        const letter = Array.from(answer)[index];
        if (previous && previous !== letter) errors.push(`Kesişen harfler uyuşmuyor: ${id}`);
        reconstructedLetters.set(id, letter);
      });

      const coords = word.cells.map(parseCellId);
      if (coords.some(coord => !coord || !inBounds(coord.row, coord.col, puzzle.rows, puzzle.cols))) {
        errors.push(`Kelime sınır dışında: ${wordId}`);
      } else if (coords.length > 1) {
        const rowStep = coords[1].row - coords[0].row;
        const colStep = coords[1].col - coords[0].col;
        const straight = (rowStep === 1 && colStep === 0) || (rowStep === 0 && colStep === 1);
        if (!straight || coords.some((coord, index) =>
          coord.row !== coords[0].row + rowStep * index || coord.col !== coords[0].col + colStep * index
        )) {
          errors.push(`Kelime yolu düz ve kesintisiz değil: ${wordId}`);
        }

        if (clue) {
          const origin = parseCellId(word.clueCell);
          const expectedFirst = ["right", "right-down"].includes(clue.arrow)
            ? { row: origin && origin.row, col: origin && origin.col + 1 }
            : { row: origin && origin.row + 1, col: origin && origin.col };
          const arrowIsHorizontal = ["right", "down-right"].includes(clue.arrow);
          const arrowIsVertical = ["down", "right-down"].includes(clue.arrow);
          if ((!arrowIsHorizontal && !arrowIsVertical) || !origin ||
              coords[0].row !== expectedFirst.row || coords[0].col !== expectedFirst.col ||
              (arrowIsHorizontal && rowStep !== 0) || (arrowIsVertical && colStep !== 0)) {
            errors.push(`İpucu oku cevap yönüyle uyuşmuyor: ${wordId}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  function generate(options) {
    const validated = validateOptions(options || {});
    const targetLang = options.targetLang === "tr" ? "tr" : "en";
    const words = cleanWordList(options.wordList, targetLang, validated.rows, validated.cols);
    if (words.length < 3) {
      throw new Error("Bu ayarlar için kullanılabilir en az 3 kelime gerekli.");
    }

    const random = makeRandom(options.seed);
    const attempts = Math.max(1, Math.min(Number(options.attempts) || 36, 100));
    const candidatePoolSize = Math.max(80, Math.min(Number(options.candidatePoolSize) || 280, words.length));

    let bestModel = null;
    const compact = options.compact !== false;
    const targetFillPercent = Math.max(65, Math.min(Number(options.targetFillPercent) || 70, 80));
    const maxWords = Math.min(
      80,
      words.length,
      Math.max(validated.targetWords, Math.ceil((validated.rows * validated.cols) / 3))
    );
    const growOptions = {
      compact,
      // Yan yana bağımsız cevaplar, karşı yönde ipucusuz sahte kelime
      // dizileri oluşturur. Gerçek bir slot çözücü gelene kadar yasak.
      allowAdjacent: false,
      targetFillPercent,
      maxWords
    };

    for (let attempt = 0; attempt < attempts; attempt++) {
      const model = createModel(validated.rows, validated.cols);
      const attemptWords = shuffle(words, random);
      grow(model, attemptWords, validated.targetWords, random, candidatePoolSize, growOptions);
      if (!bestModel || modelQuality(model) > modelQuality(bestModel)) bestModel = model;
      const bestFill = ((bestModel.letters.size + bestModel.clues.size) /
        (validated.rows * validated.cols)) * 100;
      if (bestModel.placed.length >= validated.targetWords &&
          bestFill >= targetFillPercent - 2 &&
          attempt >= Math.min(17, attempts - 1)) break;
    }

    return toPuzzle(bestModel, options.title || "Otomatik Bulmaca", targetLang);
  }

  root.AutoPuzzleGenerator = {
    generate,
    cleanWordList,
    validatePuzzle
  };
})(typeof globalThis !== "undefined" ? globalThis : window);

/**
 * CROSSWORD-BUILDER.js
 * ------------------------------------------------------------------
 * Gazete eki tarzı, dörtgen ve kesişimli çengel bulmaca üretici.
 *
 * Strateji:
 *  1. Kelimeleri uzunluğa göre sırala (uzunlar önce).
 *  2. Birden fazla rastgele sıra denemesi yap; en yoğun + en bağlantılı
 *     sonucu seç.
 *  3. Her kelime için tüm olası kesişim adaylarını skorla:
 *     - çok harf örtüşmesi
 *     - küçük bounding box
 *     - kareye yakın en-boy oranı
 *  4. Kesişim bulunamayan kelimeleri izole satıra atmak yerine
 *     mevcut bloğun hemen altına / yanına yapıştırmaya çalış.
 *  5. Çıktı: { title, rows, cols, cells, words, targetLang }
 *     cells içinde boş hücreler "block" olarak işaretlenir.
 *
 * KISIT: answer boşluksuz tek kelime, yalnızca harf.
 */

const CrosswordBuilder = (() => {

  const MAX_ATTEMPTS = 24;       // farklı kelime sırası denemesi
  const MAX_EXTENT = 28;         // tek yönde max hücre
  const MIN_INTERSECTION_RATIO = 0.55; // ideal: kelimelerin çoğu kesişsin

  function build(title, wordList, targetLang) {
    const cleaned = wordList
      .map(w => ({
        clue: String(w.clue || "").trim(),
        answer: TextUtils.upper(String(w.answer || "").trim(), targetLang)
      }))
      .filter(w => {
        const valid = /^[A-ZÇĞİIÖŞÜ]+$/.test(w.answer) && w.answer.length >= 2;
        if (!valid) console.warn(`CrosswordBuilder: geçersiz cevap atlandı -> "${w.answer}"`);
        return valid;
      });

    if (cleaned.length === 0) {
      return { title, rows: 1, cols: 1, cells: {}, words: {}, targetLang };
    }

    let best = null;
    let bestScore = -Infinity;

    // 1) uzunluk sırası
    const orders = [cleaned.slice().sort((a, b) => b.answer.length - a.answer.length)];

    // 2) ek rastgele karışımlar
    for (let t = 0; t < MAX_ATTEMPTS - 1; t++) {
      const shuffled = cleaned.slice();
      // uzun kelimeleri önde tut, geri kalanı karıştır
      shuffled.sort((a, b) => {
        const la = a.answer.length, lb = b.answer.length;
        if (la !== lb && (la >= 6 || lb >= 6)) return lb - la;
        return Math.random() - 0.5;
      });
      orders.push(shuffled);
    }

    for (const order of orders) {
      const result = tryBuild(order);
      if (!result) continue;
      const score = scoreLayout(result);
      if (score > bestScore) {
        bestScore = score;
        best = result;
      }
    }

    if (!best) {
      return { title, rows: 1, cols: 1, cells: {}, words: {}, targetLang };
    }

    return finalize(title, best, targetLang);
  }

  function tryBuild(order) {
    const letterGrid = new Map(); // "r,c" -> letter
    const clueGrid = new Map();   // "r,c" -> wordId
    const placed = [];

    function key(r, c) { return `${r},${c}`; }

    function cellsOf(answer, row, col, dir) {
      const out = [];
      for (let i = 0; i < answer.length; i++) {
        const r = dir === "across" ? row : row + i;
        const c = dir === "across" ? col + i : col;
        out.push({ r, c, ch: answer[i] });
      }
      return out;
    }

    function cluePos(row, col, dir) {
      return dir === "across"
        ? { r: row, c: col - 1 }
        : { r: row - 1, c: col };
    }

    function canPlace(answer, row, col, dir) {
      const cp = cluePos(row, col, dir);
      if (letterGrid.has(key(cp.r, cp.c)) || clueGrid.has(key(cp.r, cp.c))) return false;

      for (const { r, c, ch } of cellsOf(answer, row, col, dir)) {
        if (Math.abs(r) > MAX_EXTENT || Math.abs(c) > MAX_EXTENT) return false;
        const k = key(r, c);
        if (clueGrid.has(k)) return false;
        if (letterGrid.has(k) && letterGrid.get(k) !== ch) return false;
      }
      return true;
    }

    function countOverlaps(answer, row, col, dir) {
      let n = 0;
      for (const { r, c } of cellsOf(answer, row, col, dir)) {
        if (letterGrid.has(key(r, c))) n++;
      }
      return n;
    }

    function boundingAreaAfter(answer, row, col, dir) {
      let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
      const consider = (r, c) => {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      };
      letterGrid.forEach((_, k) => {
        const [r, c] = k.split(",").map(Number);
        consider(r, c);
      });
      clueGrid.forEach((_, k) => {
        const [r, c] = k.split(",").map(Number);
        consider(r, c);
      });
      for (const { r, c } of cellsOf(answer, row, col, dir)) consider(r, c);
      const cp = cluePos(row, col, dir);
      consider(cp.r, cp.c);
      if (!isFinite(minR)) return answer.length;
      return (maxR - minR + 1) * (maxC - minC + 1);
    }

    function aspectPenaltyAfter(answer, row, col, dir) {
      let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
      const consider = (r, c) => {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      };
      letterGrid.forEach((_, k) => {
        const [r, c] = k.split(",").map(Number);
        consider(r, c);
      });
      for (const { r, c } of cellsOf(answer, row, col, dir)) consider(r, c);
      if (!isFinite(minR)) return 0;
      const h = maxR - minR + 1;
      const w = maxC - minC + 1;
      return Math.abs(h - w);
    }

    function findBestPlacement(answer) {
      const candidates = [];

      for (const p of placed) {
        for (let i = 0; i < answer.length; i++) {
          for (let j = 0; j < p.answer.length; j++) {
            if (answer[i] !== p.answer[j]) continue;

            // Karşı yönde kesişim (asıl hedef)
            const trials = [];
            if (p.dir === "across") {
              trials.push({
                dir: "down",
                row: p.row - i,
                col: p.col + j
              });
            } else {
              trials.push({
                dir: "across",
                row: p.row + j,
                col: p.col - i
              });
            }

            for (const t of trials) {
              if (!canPlace(answer, t.row, t.col, t.dir)) continue;
              const overlaps = countOverlaps(answer, t.row, t.col, t.dir);
              if (overlaps < 1) continue;
              const area = boundingAreaAfter(answer, t.row, t.col, t.dir);
              const aspect = aspectPenaltyAfter(answer, t.row, t.col, t.dir);
              // Skor: çok örtüşme iyi, küçük alan iyi, kareye yakın iyi
              const score =
                overlaps * 120 -
                area * 1.2 -
                aspect * 4 +
                (overlaps >= 2 ? 40 : 0);
              candidates.push({ score, overlaps, row: t.row, col: t.col, dir: t.dir });
            }
          }
        }
      }

      if (candidates.length === 0) return null;
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0];
    }

    function nearFallback(answer) {
      // Mevcut bloğun hemen altına / yanına yapıştır — izole satır YOK
      if (placed.length === 0) {
        return { row: 0, col: 1, dir: "across" }; // col=1: ipucu için yer
      }

      let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
      letterGrid.forEach((_, k) => {
        const [r, c] = k.split(",").map(Number);
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      });

      const tries = [];
      // Altına across
      for (let r = maxR + 1; r <= maxR + 3; r++) {
        for (let c = minC; c <= maxC; c++) {
          tries.push({ row: r, col: c, dir: "across" });
        }
      }
      // Sağına down
      for (let c = maxC + 1; c <= maxC + 3; c++) {
        for (let r = minR; r <= maxR; r++) {
          tries.push({ row: r, col: c, dir: "down" });
        }
      }
      // Üstüne / soluna da dene
      for (let r = minR - 3; r < minR; r++) {
        for (let c = minC; c <= maxC; c++) {
          tries.push({ row: r, col: c, dir: "across" });
        }
      }

      let best = null;
      let bestSc = -Infinity;
      for (const t of tries) {
        if (!canPlace(answer, t.row, t.col, t.dir)) continue;
        const area = boundingAreaAfter(answer, t.row, t.col, t.dir);
        const sc = -area;
        if (sc > bestSc) {
          bestSc = sc;
          best = t;
        }
      }
      return best;
    }

    function commit(wordId, w, placement) {
      const { row, col, dir } = placement;
      const cellIds = [];
      for (const { r, c, ch } of cellsOf(w.answer, row, col, dir)) {
        letterGrid.set(key(r, c), ch);
        cellIds.push({ r, c });
      }
      const cp = cluePos(row, col, dir);
      clueGrid.set(key(cp.r, cp.c), wordId);
      placed.push({
        id: wordId,
        answer: w.answer,
        clue: w.clue,
        row, col, dir,
        cellIds,
        clueCell: cp
      });
    }

    // İlk kelime
    commit("w0", order[0], { row: 0, col: 1, dir: "across" });

    for (let idx = 1; idx < order.length; idx++) {
      const w = order[idx];
      const wordId = `w${idx}`;
      let placement = findBestPlacement(w.answer);
      // Kesişim yoksa atla — izole kelime grid'i bozar (gazete tipi yoğunluk)
      // Sadece çok az kelime yerleştiyse (ilk 3) yakın fallback dene
      if (!placement && placed.length < 3) {
        placement = nearFallback(w.answer);
      }
      if (!placement) continue;
      commit(wordId, w, placement);
    }

    if (placed.length < 2) return null;
    return { placed, letterGrid, clueGrid };
  }

  function scoreLayout(result) {
    const { placed, letterGrid, clueGrid } = result;
    if (placed.length === 0) return -Infinity;

    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    const consider = (r, c) => {
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    };
    letterGrid.forEach((_, k) => {
      const [r, c] = k.split(",").map(Number);
      consider(r, c);
    });
    clueGrid.forEach((_, k) => {
      const [r, c] = k.split(",").map(Number);
      consider(r, c);
    });

    const rows = maxR - minR + 1;
    const cols = maxC - minC + 1;
    const area = rows * cols;
    const letters = letterGrid.size;
    const density = letters / area;

    // Kesişim sayısı: birden fazla kelimeye ait hücreler
    const cellWordCount = new Map();
    placed.forEach(p => {
      p.cellIds.forEach(({ r, c }) => {
        const k = `${r},${c}`;
        cellWordCount.set(k, (cellWordCount.get(k) || 0) + 1);
      });
    });
    let crossCells = 0;
    cellWordCount.forEach(n => { if (n >= 2) crossCells++; });

    // Bağlantılı kelime oranı (en az bir kesişimi olan)
    let connected = 0;
    placed.forEach(p => {
      const hasCross = p.cellIds.some(({ r, c }) => (cellWordCount.get(`${r},${c}`) || 0) >= 2);
      if (hasCross) connected++;
    });
    const connectRatio = connected / placed.length;

    // En-boy: kareye yakın olsun
    const aspect = Math.abs(rows - cols);

    return (
      density * 200 +
      crossCells * 25 +
      connectRatio * 150 +
      placed.length * 8 -
      aspect * 6 -
      area * 0.15
    );
  }

  function finalize(title, result, targetLang) {
    const { placed } = result;
    let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
    placed.forEach(p => {
      [...p.cellIds, p.clueCell].forEach(({ r, c }) => {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      });
    });

    const shift = (r, c) => `r${r - minR}c${c - minC}`;
    const cells = {};
    const words = {};
    const rows = maxR - minR + 1;
    const cols = maxC - minC + 1;

    // Tüm hücreleri önce block olarak işaretle (dörtgen dolgu)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells[`r${r}c${c}`] = { type: "block" };
      }
    }

    placed.forEach(p => {
      const clueCellId = shift(p.clueCell.r, p.clueCell.c);
      cells[clueCellId] = {
        type: "clue",
        text: p.clue,
        arrow: p.dir === "across" ? "right" : "down",
        wordId: p.id
      };

      const wordCellIds = p.cellIds.map(({ r, c }) => shift(r, c));
      wordCellIds.forEach(cellId => {
        if (cells[cellId] && cells[cellId].type === "letter") {
          cells[cellId].wordIds.push(p.id);
        } else {
          cells[cellId] = { type: "letter", wordIds: [p.id] };
        }
      });

      words[p.id] = {
        answer: p.answer,
        cells: wordCellIds,
        clueCell: clueCellId
      };
    });

    return { title, rows, cols, cells, words, targetLang };
  }

  return { build };
})();

/**
 * CROSSWORD-BUILDER.js
 * ------------------------------------------------------------------
 * Kelime + ipucu listesinden otomatik olarak kesişimli (sağa/aşağı
 * karışık) bir çengel bulmaca grid'i üretir. Elle grid tasarlamak
 * yerine — sen sadece kelime listesini verirsin, algoritma ortak
 * harflerden kesişim bulup yerleştirir; kesişim bulamadığı kelimeleri
 * bağımsız bir satıra yerleştirir.
 *
 * KISIT: cevaplar (answer) boşluksuz TEK kelime olmalı. Boşluk veya
 * rakam içeren girişler otomatik olarak atlanır (console.warn ile
 * bildirilir).
 *
 * Çıktı formatı puzzle-render.js / game.js / scoring.js'in beklediği
 * ile birebir aynı: { title, rows, cols, cells, words, targetLang }
 */

const CrosswordBuilder = (() => {

  /**
   * @param {string} title
   * @param {{clue: string, answer: string}[]} wordList - clue: kaynak dildeki
   *        kelime (ekranda gösterilecek ipucu), answer: hedef dildeki cevap
   * @param {"tr"|"en"} targetLang - answer'ların dili (büyük harf kuralı için)
   */
  function build(title, wordList, targetLang) {
    const cleaned = wordList
      .map(w => ({
        clue: w.clue.trim(),
        answer: TextUtils.upper(w.answer.trim(), targetLang)
      }))
      .filter(w => {
        const valid = /^[A-ZÇĞİIÖŞÜ]+$/.test(w.answer);
        if (!valid) console.warn(`CrosswordBuilder: geçersiz cevap atlandı -> "${w.answer}"`);
        return valid;
      })
      .sort((a, b) => b.answer.length - a.answer.length); // uzun kelimeler önce, kesişim şansı artar

    const letterGrid = new Map();  // "r,c" -> letter
    const clueGrid = new Map();    // "r,c" -> wordId
    const placed = [];             // { id, answer, clue, row, col, dir }
    let fallbackRow = 0;

    cleaned.forEach((w, idx) => {
      const wordId = `w${idx}`;
      const placement = findIntersection(w.answer) || fallbackPlacement(w.answer);
      commitPlacement(wordId, w, placement);
    });

    function key(r, c) { return `${r},${c}`; }

    function findIntersection(answer) {
      for (const p of placed) {
        for (let i = 0; i < answer.length; i++) {
          for (let j = 0; j < p.answer.length; j++) {
            if (answer[i] !== p.answer[j]) continue;

            const dir = p.dir === "across" ? "down" : "across";
            let row, col;
            if (dir === "down") {
              row = p.row - i;
              col = p.col + j;
            } else {
              row = p.row + j;
              col = p.col - i;
            }
            if (canPlace(answer, row, col, dir)) {
              return { row, col, dir };
            }
          }
        }
      }
      return null;
    }

    function canPlace(answer, row, col, dir) {
      // İpucu kutusu için gereken hücre boş olmalı
      const clueR = dir === "across" ? row : row - 1;
      const clueC = dir === "across" ? col - 1 : col;
      const clueKey = key(clueR, clueC);
      if (letterGrid.has(clueKey) || clueGrid.has(clueKey)) return false;

      for (let i = 0; i < answer.length; i++) {
        const r = dir === "across" ? row : row + i;
        const c = dir === "across" ? col + i : col;
        const k = key(r, c);
        if (clueGrid.has(k)) return false; // başka bir kelimenin ipucu kutusuyla çakışıyor
        if (letterGrid.has(k) && letterGrid.get(k) !== answer[i]) return false;
      }
      return true;
    }

    function fallbackPlacement(answer) {
      // Kesişim bulunamadı: bağımsız yeni bir satıra yerleştir.
      let row = fallbackRow;
      let attempts = 0;
      while (!canPlace(answer, row, 0, "across") && attempts < 50) {
        row++;
        attempts++;
      }
      fallbackRow = row + 2; // bir sonraki bağımsız kelime için boşluk bırak
      return { row, col: 0, dir: "across" };
    }

    function commitPlacement(wordId, w, placement) {
      const { row, col, dir } = placement;
      const cellIds = [];

      for (let i = 0; i < w.answer.length; i++) {
        const r = dir === "across" ? row : row + i;
        const c = dir === "across" ? col + i : col;
        letterGrid.set(key(r, c), w.answer[i]);
        cellIds.push({ r, c });
      }

      const clueR = dir === "across" ? row : row - 1;
      const clueC = dir === "across" ? col - 1 : col;
      clueGrid.set(key(clueR, clueC), wordId);

      placed.push({
        id: wordId, answer: w.answer, clue: w.clue,
        row, col, dir,
        cellIds,
        clueCell: { r: clueR, c: clueC }
      });
    }

    return finalize(title, placed, targetLang);
  }

  function finalize(title, placed, targetLang) {
    if (placed.length === 0) {
      return { title, rows: 1, cols: 1, cells: {}, words: {}, targetLang };
    }

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

    placed.forEach(p => {
      const clueCellId = shift(p.clueCell.r, p.clueCell.c);
      cells[clueCellId] = { type: "clue", text: p.clue, arrow: p.dir === "across" ? "right" : "down", wordId: p.id };

      const wordCellIds = p.cellIds.map(({ r, c }) => shift(r, c));
      wordCellIds.forEach(cellId => {
        if (cells[cellId] && cells[cellId].type === "letter") {
          cells[cellId].wordIds.push(p.id);
        } else {
          cells[cellId] = { type: "letter", wordIds: [p.id] };
        }
      });

      words[p.id] = { answer: p.answer, cells: wordCellIds, clueCell: clueCellId };
    });

    return {
      title,
      rows: maxR - minR + 1,
      cols: maxC - minC + 1,
      cells,
      words,
      targetLang
    };
  }

  return { build };
})();

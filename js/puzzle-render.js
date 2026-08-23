/**
 * PUZZLE-RENDER.js
 * ------------------------------------------------------------------
 * PUZZLE_DATA'yı okuyup grid'i DOM'a çizer. Kelime çözme mantığına
 * dokunmaz — sadece görünüm + tıklama olaylarını dışarı bildirir.
 *
 * Bir hücre en fazla 2 ipucu taşıyabilir (üst üste, aralarında çizgiyle
 * ayrılmış). Her ipucunun kendi ok yönü olur:
 *   "right"      -> →  cevap sağdaki hücreden başlar, sağa okunur
 *   "down"       -> ↓  cevap alttaki hücreden başlar, aşağı okunur
 *   "down-right" -> ⤷  cevap alttaki hücreden başlar, SAĞA okunur
 *   "right-down" -> ⤵  cevap sağdaki hücreden başlar, AŞAĞI okunur
 *
 * Bu dosya, hem oyun ekranında (index.html) hem de bulmaca stüdyosunda
 * (admin.html) ortak kullanılır — ikisi de aynı grid görünümünü ister.
 */

const PuzzleRender = (() => {
  const ARROW_GLYPH = {
    right: "→",
    down: "↓",
    "down-right": "⤷",
    "right-down": "⤵"
  };

  let containerEl = null;
  let onClueClick = null; // (wordId, lineElement) => void

  function init(container, clueClickHandler) {
    containerEl = container;
    onClueClick = clueClickHandler;
    containerEl.style.gridTemplateColumns = `repeat(${PUZZLE_DATA.cols}, 64px)`;
    containerEl.style.gridTemplateRows = `repeat(${PUZZLE_DATA.rows}, 64px)`;
    buildGrid();
  }

  function buildGrid() {
    containerEl.innerHTML = "";
    for (let r = 0; r < PUZZLE_DATA.rows; r++) {
      for (let c = 0; c < PUZZLE_DATA.cols; c++) {
        containerEl.appendChild(buildCellEl(`r${r}c${c}`, PUZZLE_DATA.cells[`r${r}c${c}`]));
      }
    }
  }

  function buildCellEl(cellId, cellData) {
    const el = document.createElement("div");
    el.dataset.cellId = cellId;

    if (!cellData || cellData.type === "block") {
      el.className = "cell block";
    } else if (cellData.type === "clue") {
      el.className = "cell clue" + (cellData.clues.length > 1 ? " two-clues" : "");
      cellData.clues.forEach(clue => {
        const line = document.createElement("div");
        line.className = "clue-line";
        line.dataset.wordId = clue.wordId;

        const text = document.createElement("span");
        text.className = "clue-text";
        text.textContent = clue.text;

        const arrow = document.createElement("span");
        arrow.className = `arrow ${clue.arrow}`;
        arrow.textContent = ARROW_GLYPH[clue.arrow] || "?";

        line.appendChild(text);
        line.appendChild(arrow);
        line.addEventListener("click", e => {
          e.stopPropagation();
          if (onClueClick) onClueClick(clue.wordId, line);
        });
        el.appendChild(line);
      });
    } else if (cellData.type === "letter") {
      el.className = "cell letter";
      el.dataset.wordIds = cellData.wordIds.join(",");
    } else if (cellData.type === "photo") {
      el.className = "cell photo";
      if (cellData.imageUrl) el.style.backgroundImage = `url(${cellData.imageUrl})`;
    }

    return el;
  }

  /**
   * Verilen harf durumuna göre tüm harf hücrelerini günceller.
   * @param {Object} filledLetters - { [cellId]: "X" }
   */
  function paintLetters(filledLetters) {
    for (const cellId in filledLetters) {
      const el = containerEl.querySelector(`[data-cell-id="${cellId}"]`);
      if (!el) continue;
      el.textContent = filledLetters[cellId];
      el.classList.add("filled");
    }
  }

  /** Bir kelimenin çözüldüğünü SADECE o ipucu satırında işaretler (hücredeki diğer ipucu etkilenmez) */
  function markWordSolved(wordId) {
    const line = containerEl.querySelector(`.clue-line[data-word-id="${wordId}"]`);
    if (line) line.classList.add("solved");
  }

  function highlightWordCells(wordId, on) {
    const word = PUZZLE_DATA.words[wordId];
    if (!word) return;
    word.cells.forEach(cellId => {
      const el = containerEl.querySelector(`[data-cell-id="${cellId}"]`);
      if (el) el.classList.toggle("highlight", on);
    });
  }

  return { init, buildCellEl, paintLetters, markWordSolved, highlightWordCells, ARROW_GLYPH };
})();

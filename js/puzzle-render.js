/**
 * PUZZLE-RENDER.js
 * ------------------------------------------------------------------
 * PUZZLE_DATA'yı okuyup grid'i DOM'a çizer. Kelime çözme mantığına
 * dokunmaz — sadece görünüm + tıklama olaylarını dışarı bildirir.
 */

const PuzzleRender = (() => {
  let containerEl = null;
  let onClueClick = null; // (wordId, clueCellElement) => void

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
        const cellId = `r${r}c${c}`;
        const cellData = PUZZLE_DATA.cells[cellId];
        const el = document.createElement("div");
        el.dataset.cellId = cellId;

        if (!cellData || cellData.type === "block") {
          el.className = "cell block";
        } else if (cellData.type === "clue") {
          el.className = "cell clue";
          el.textContent = cellData.text;
          const arrow = document.createElement("span");
          arrow.className = `arrow ${cellData.arrow}`;
          arrow.textContent = cellData.arrow === "right" ? "→" : "↓";
          el.appendChild(arrow);
          el.addEventListener("click", () => {
            if (onClueClick) onClueClick(cellData.wordId, el);
          });
        } else if (cellData.type === "letter") {
          el.className = "cell letter";
          el.dataset.wordIds = cellData.wordIds.join(",");
        } else if (cellData.type === "photo") {
          el.className = "cell photo";
          if (cellData.imageUrl) el.style.backgroundImage = `url(${cellData.imageUrl})`;
        }

        containerEl.appendChild(el);
      }
    }
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

  /** Bir kelimenin çözüldüğünü görsel olarak işaretler (ipucu kutusunu da) */
  function markWordSolved(wordId, byName) {
    const word = PUZZLE_DATA.words[wordId];
    if (!word) return;
    const clueEl = containerEl.querySelector(`[data-cell-id="${word.clueCell}"]`);
    if (clueEl) {
      clueEl.classList.add("active");
      clueEl.title = byName ? `${byName} çözdü` : "";
    }
  }

  function highlightWordCells(wordId, on) {
    const word = PUZZLE_DATA.words[wordId];
    if (!word) return;
    word.cells.forEach(cellId => {
      const el = containerEl.querySelector(`[data-cell-id="${cellId}"]`);
      if (el) el.classList.toggle("highlight", on);
    });
  }

  return { init, paintLetters, markWordSolved, highlightWordCells };
})();

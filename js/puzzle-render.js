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
 * Oklar büyük/kalın SVG ikonlar olarak çizilir ve işaret ettikleri
 * komşu hücreye görsel olarak taşar (bkz. .arrow CSS kuralları).
 *
 * Bu dosya, hem oyun ekranında (index.html) hem de bulmaca stüdyosunda
 * (admin.html) ortak kullanılır — ikisi de aynı grid görünümünü ister.
 */

const PuzzleRender = (() => {
  // Admin panelindeki küçük yön butonları gibi metin gerektiren yerler için
  const ARROW_GLYPH = {
    right: "→",
    down: "↓",
    "down-right": "⤷",
    "right-down": "⤵"
  };

  /** Okun ipucu kutusundan çıktığı kenarı döndürür. */
  function arrowExitEdge(direction) {
    if (direction === "right" || direction === "right-down") return "right";
    if (direction === "down" || direction === "down-right") return "bottom";
    return null;
  }

  // Referanstaki gibi sağ kenar oku üst satırda, alt kenar oku ikinci
  // satırda gösterilir.
  function orderClues(clues) {
    return (Array.isArray(clues) ? clues : []).slice().sort((a, b) => {
      const rank = edge => edge === "right" ? 0 : edge === "bottom" ? 1 : 2;
      return rank(arrowExitEdge(a.arrow)) - rank(arrowExitEdge(b.arrow));
    });
  }

  // Gridde gösterilen büyük/kalın oklar — kalın stroke'lu, komşu hücreye taşacak SVG'ler
  const ARROW_SVG = {
    right:
      '<svg viewBox="0 0 32 32"><path d="M3 16 H25 M17 8 L26 16 L17 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down:
      '<svg viewBox="0 0 32 32"><path d="M16 3 V25 M8 17 L16 26 L24 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "down-right":
      '<svg viewBox="0 0 32 32"><path d="M10 3 V13 C10 18 13 21 18 21 H25 M19 14 L28 21 L19 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "right-down":
      '<svg viewBox="0 0 32 32"><path d="M3 10 H13 C18 10 21 13 21 18 V25 M13 19 L21 28 L29 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
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

 /**
   * Bir okun hücre içindeki konumunu hesaplar.
   * ZOOM sorununu çözmek için px yerine % (yüzdelik) oranlar kullanılmıştır.
   */
  function computeArrowStyle(direction, lineIndex, totalLines) {
    const exitEdge = arrowExitEdge(direction);
    
    // Okun boyutunu ve taşma miktarını kutucuğa oranla belirliyoruz.
    // Orijinal 64px hücrede 11px taşma yaklaşık %18'e denk gelir.
    const arrowSize = "30%";
    const offset = "-15%";

    if (exitEdge === "right") {
      const vertPct = totalLines === 1 ? 50 : (lineIndex === 0 ? 25 : 75);
      return { 
        right: offset, 
        top: `${vertPct}%`, 
        transform: "translateY(-50%)",
        width: arrowSize,   // Kutucukla beraber büyüyüp küçülecek
        height: arrowSize 
      };
    }
    
    return { 
      bottom: offset, 
      left: "50%", 
      transform: "translateX(-50%)",
      width: arrowSize,     // Kutucukla beraber büyüyüp küçülecek
      height: arrowSize 
    };
  }

  function buildCellEl(cellId, cellData) {
    const el = document.createElement("div");
    el.dataset.cellId = cellId;

    if (!cellData || cellData.type === "block") {
      el.className = "cell block";
    } else if (cellData.type === "clue") {
      el.className = "cell clue" + (cellData.clues.length > 1 ? " two-clues" : "");
      const clues = orderClues(cellData.clues);
      const totalLines = clues.length;

      // YENİ EKLENEN 1: Kutucuğu bir "Container" (Taşıyıcı) olarak tanımlıyoruz. 
      // Böylece içindeki yazılar bu kutunun genişliğini referans alabilecek.
      el.style.containerType = "inline-size";

      clues.forEach((clue, lineIndex) => {
        const line = document.createElement("div");
        line.className = "clue-line";
        line.dataset.wordId = clue.wordId;

        const text = document.createElement("span");
        text.className = "clue-text";
        text.textContent = clue.text;
        
        // YENİ EKLENEN 2: Font boyutunu px yerine cqw (Container Width) ile veriyoruz.
        text.style.fontSize = totalLines > 1 ? "13cqw" : "18cqw";
        text.style.lineHeight = "1.1"; 
        text.style.wordBreak = "break-word"; 

        line.appendChild(text);

        line.addEventListener("click", e => {
          e.stopPropagation();
          if (onClueClick) onClueClick(clue.wordId, line);
        });
        el.appendChild(line);

        // Ok, satıra değil hücrenin kendisine eklenir
        const arrow = document.createElement("span");
        arrow.className = `arrow arrow-${clue.arrow}`;
        arrow.innerHTML = ARROW_SVG[clue.arrow] || "";
        Object.assign(arrow.style, computeArrowStyle(clue.arrow, lineIndex, totalLines));
        el.appendChild(arrow);
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
   * @param {Object} filledLetters - { [cellId]: {letter, playerId} }
   * @param {(playerId: string) => string} getPlayerColor - harfi o renkte boyamak için
   */
  function paintLetters(filledLetters, getPlayerColor) {
    for (const cellId in filledLetters) {
      const el = containerEl.querySelector(`[data-cell-id="${cellId}"]`);
      if (!el) continue;
      const entry = filledLetters[cellId];
      el.textContent = entry.letter;
      el.classList.add("filled");
      if (getPlayerColor) el.style.color = getPlayerColor(entry.playerId);
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

  return {
    init,
    buildCellEl,
    computeArrowStyle,
    arrowExitEdge,
    orderClues,
    paintLetters,
    markWordSolved,
    highlightWordCells,
    ARROW_GLYPH,
    ARROW_SVG
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PuzzleRender;
}

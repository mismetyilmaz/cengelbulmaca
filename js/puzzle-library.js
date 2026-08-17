/**
 * PUZZLE-LIBRARY.js
 * ------------------------------------------------------------------
 * Bulmacalar seviye (A1-C2) ve yön (tr_en / en_tr) bazında gruplanır.
 * Her (seviye, yön) kombinasyonu için 20 bulmaca slotu vardır.
 *
 * İçerik (kelime listeleri) burada DEĞİL, js/puzzle-content.js
 * dosyasında — sen sadece o dosyaya kelime listeleri eklersin,
 * bu dosyaya dokunman gerekmez.
 *
 * puzzleId formatı: "{level}_{direction}_{index}"  örn. "A1_tr_en_00"
 */

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const DIRECTIONS = ["tr_en", "en_tr"]; // tr_en: ipucu TR, cevap EN | en_tr: ipucu EN, cevap TR
const PUZZLES_PER_LEVEL = 20;

let PUZZLE_DATA = null; // aktif bulmaca — oyuncu odaya girince atanır

const PUZZLE_LIBRARY = {};
LEVELS.forEach(level => {
  PUZZLE_LIBRARY[level] = {};
  DIRECTIONS.forEach(dir => {
    PUZZLE_LIBRARY[level][dir] = new Array(PUZZLES_PER_LEVEL).fill(null);
  });
});

/**
 * Bir bulmaca slotuna kelime listesi kaydeder. js/puzzle-content.js
 * içinden çağrılır.
 *
 * @param {string} level - "A1".."C2"
 * @param {"tr_en"|"en_tr"} direction
 * @param {number} index - 0-19 arası slot numarası
 * @param {{clue: string, answer: string}[]} wordList
 * @param {string} [title]
 */
function registerPuzzle(level, direction, index, wordList, title) {
  if (!LEVELS.includes(level)) { console.warn(`registerPuzzle: geçersiz seviye "${level}"`); return; }
  if (!DIRECTIONS.includes(direction)) { console.warn(`registerPuzzle: geçersiz yön "${direction}"`); return; }
  if (index < 0 || index >= PUZZLES_PER_LEVEL) { console.warn(`registerPuzzle: index 0-${PUZZLES_PER_LEVEL - 1} aralığında olmalı`); return; }

  const targetLang = direction === "tr_en" ? "en" : "tr";
  const data = CrosswordBuilder.build(
    title || `${level} ${direction.toUpperCase()} #${index + 1}`,
    wordList,
    targetLang
  );
  PUZZLE_LIBRARY[level][direction][index] = data;
}

/** O seviye/yönde dolu (kayıtlı) slot indexlerini döner */
function getAvailableIndexes(level, direction) {
  const arr = PUZZLE_LIBRARY[level] && PUZZLE_LIBRARY[level][direction];
  if (!arr) return [];
  const result = [];
  arr.forEach((p, i) => { if (p) result.push(i); });
  return result;
}

/** Rastgele dolu bir slot seçip puzzleId döner, yoksa null */
function pickRandomPuzzleId(level, direction) {
  const available = getAvailableIndexes(level, direction);
  if (available.length === 0) return null;
  const index = available[Math.floor(Math.random() * available.length)];
  return `${level}_${direction}_${String(index).padStart(2, "0")}`;
}

/** puzzleId'yi güvenli şekilde parçalar: "A1_tr_en_00" -> {level, direction, index} */
function parsePuzzleId(puzzleId) {
  const match = puzzleId.match(/^([A-C][12])_(tr_en|en_tr)_(\d+)$/);
  if (!match) return null;
  const [, level, direction, indexStr] = match;
  return { level, direction, index: parseInt(indexStr, 10) };
}

/** puzzleId'den bulmaca verisini getirir */
function getPuzzleData(puzzleId) {
  const parsed = parsePuzzleId(puzzleId);
  if (!parsed) return null;
  const arr = PUZZLE_LIBRARY[parsed.level] && PUZZLE_LIBRARY[parsed.level][parsed.direction];
  if (!arr) return null;
  return arr[parsed.index] || null;
}

/**
 * PUZZLE-LIBRARY.js
 * ------------------------------------------------------------------
 * Bulmacalar artık kod içinde değil, Firebase'de saklanıyor —
 * Bulmaca Stüdyosu'nda (admin.html) tasarlanıp kaydediliyor, oyun
 * ekranı (index.html) buradan okuyor. Bu dosya sadece o okuma/yazma
 * için ortak yardımcıları içerir.
 *
 * Firebase yapısı:
 *   puzzles/{level}/{direction}/{index} -> tam bulmaca verisi
 *     { title, rows, cols, cells, words, targetLang }
 *   puzzleDrafts/{level}/{direction} -> editördeki tek aktif hibrit taslak
 *
 * puzzleId formatı: "{level}_{direction}_{index}"  örn. "A_tr_en_3"
 */

const LEVELS = ["A", "B", "C", "easy", "medium", "hard", "A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_LABELS = {
  A: "A",
  B: "B",
  C: "C",
  easy: "A",
  medium: "B",
  hard: "C",
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C2"
};
const DIRECTIONS = ["tr_en", "en_tr"]; // tr_en: ipucu TR, cevap EN | en_tr: ipucu EN, cevap TR
const PUZZLES_PER_LEVEL = 20;

let PUZZLE_DATA = null; // aktif bulmaca — oyuncu odaya girince atanır

/** Yeni zorluk ve eski CEFR puzzleId'lerini parçalar. */
function parsePuzzleId(puzzleId) {
  const match = String(puzzleId || "").match(/^((?:easy|medium|hard)|(?:[A-C][12]?))_(tr_en|en_tr)_(\d+)$/);
  if (!match) return null;
  const [, level, direction, indexStr] = match;
  return { level, direction, index: parseInt(indexStr, 10) };
}

function getLevelLabel(level) {
  return LEVEL_LABELS[level] || level;
}

globalThis.getLevelLabel = getLevelLabel;

/** O seviye+yönde Firebase'de kayıtlı slot indexlerini döner (dolu olanlar) */
async function getAvailableIndexes(level, direction) {
  const snap = await db.ref(`puzzles/${level}/${direction}`).get();
  if (!snap.exists()) return [];
  return Object.keys(snap.val()).map(k => parseInt(k, 10)).sort((a, b) => a - b);
}

/** O seviye+yönde kayıtlı bulmacaları {index, title} listesi olarak döner (tek okuma) */
async function listPuzzles(level, direction) {
  const snap = await db.ref(`puzzles/${level}/${direction}`).get();
  if (!snap.exists()) return [];
  const val = snap.val();
  return Object.keys(val)
    .map(k => ({ index: parseInt(k, 10), title: (val[k] && val[k].title) || `#${k}` }))
    .sort((a, b) => a.index - b.index);
}

/** Bir bulmacayı Firebase'den siler */
async function deletePuzzleFromLibrary(level, direction, index) {
  await db.ref(`puzzles/${level}/${direction}/${index}`).remove();
}

/** Rastgele dolu bir slot seçip puzzleId döner, hiç yoksa null */
async function pickRandomPuzzleId(level, direction) {
  const indexes = await getAvailableIndexes(level, direction);
  if (indexes.length === 0) return null;
  const index = indexes[Math.floor(Math.random() * indexes.length)];
  return `${level}_${direction}_${index}`;
}

/** puzzleId'den bulmaca verisini Firebase'den getirir */
async function getPuzzleData(puzzleId) {
  const parsed = parsePuzzleId(puzzleId);
  if (!parsed) return null;
  const snap = await db.ref(`puzzles/${parsed.level}/${parsed.direction}/${parsed.index}`).get();
  return snap.exists() ? snap.val() : null;
}

/** Bulmaca Stüdyosu'nun kullandığı kayıt fonksiyonu */
async function savePuzzleToLibrary(level, direction, index, puzzleData) {
  await db.ref(`puzzles/${level}/${direction}/${index}`).set(puzzleData);
}

/** Seviye/yön başına tek aktif editör taslağı saklar; oyun bu yolu okumaz. */
async function savePuzzleDraft(level, direction, puzzleData) {
  await db.ref(`puzzleDrafts/${level}/${direction}`).set(puzzleData);
}

async function getPuzzleDraft(level, direction) {
  const snap = await db.ref(`puzzleDrafts/${level}/${direction}`).get();
  return snap.exists() ? snap.val() : null;
}

async function deletePuzzleDraft(level, direction) {
  await db.ref(`puzzleDrafts/${level}/${direction}`).remove();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parsePuzzleId, getLevelLabel };
}

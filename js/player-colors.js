/**
 * PLAYER-COLORS.js
 * ------------------------------------------------------------------
 * Odaya katılan her oyuncuya, katılma sırasına göre bu paletten sabit
 * bir renk atanır (Game.js). Renkler kağıt/mürekkep temasıyla uyumlu
 * ama birbirinden net ayırt edilebilecek şekilde seçildi.
 */

const PLAYER_COLORS = [
  "#2E7D32", // yeşil
  "#00897B", // teal
  "#1565C0", // mavi
  "#5E35B1", // mor
  "#00695C", // koyu teal
  "#3949AB", // indigo
  "#43A047", // açık yeşil
  "#0277BD", // gök mavisi
  "#6A1B9A", // koyu mor
  "#00838F"  // camgöbeği
];

function colorForPlayerIndex(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

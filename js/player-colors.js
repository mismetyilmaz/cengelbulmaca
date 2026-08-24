/**
 * PLAYER-COLORS.js
 * ------------------------------------------------------------------
 * Odaya katılan her oyuncuya, katılma sırasına göre bu paletten sabit
 * bir renk atanır (Game.js). Renkler kağıt/mürekkep temasıyla uyumlu
 * ama birbirinden net ayırt edilebilecek şekilde seçildi.
 */

const PLAYER_COLORS = [
  "#C0392B", // kiremit kırmızı
  "#1565C0", // mavi
  "#2E7D32", // yeşil
  "#8E24AA", // mor
  "#EF6C00", // turuncu
  "#00838F", // camgöbeği
  "#AD1457", // pembe-bordo
  "#6D4C41", // kahve
  "#558B2F", // zeytin yeşili
  "#4527A0"  // indigo
];

function colorForPlayerIndex(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

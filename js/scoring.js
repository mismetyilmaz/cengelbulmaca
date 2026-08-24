/**
 * SCORING.js
 * ------------------------------------------------------------------
 * Puanlama kuralı:
 * Bir kelime çözüldüğünde, o kelimenin hücrelerinden kaçı ZATEN
 * (başka çözülmüş bir kelimeden kesişim yoluyla) doluysa, oyuncu
 * o harfleri "yazmamış" sayılır. Puan = gerçekten yeni doldurulan
 * harf sayısına göre verilir.
 *
 * Örnek: 5 harfli kelimenin 2 harfi kesişimden zaten doluysa,
 * oyuncu o kelimeyi bilince 3 harflik puan alır.
 *
 * Taban puan çarpanı burada tek bir yerden ayarlanır, ileride
 * zorluk seviyesine göre kelime başına farklı katsayı da eklenebilir.
 */

const SCORING = {
  POINTS_PER_NEW_LETTER: 10,
  MIN_POINTS: 10, // tamamen kesişimden dolu bir kelime bile en az bu kadar puan versin

  /**
   * @param {string[]} wordCellIds - kelimenin hücre id listesi (sırayla)
   * @param {Object} filledLettersMap - { [cellId]: {letter, playerId} } zaten dolu olan harfler
   *        (bu kelime çözülmeden ÖNCEKİ duruma göre, başka kelimelerden gelen)
   * @returns {{ newLetters: number, points: number }}
   */
  calculate(wordCellIds, filledLettersMap) {
    let newLetters = 0;
    for (const cellId of wordCellIds) {
      const alreadyFilled = filledLettersMap && filledLettersMap[cellId];
      if (!alreadyFilled) newLetters++;
    }
    const points = Math.max(
      newLetters * SCORING.POINTS_PER_NEW_LETTER,
      SCORING.MIN_POINTS
    );
    return { newLetters, points };
  }
};

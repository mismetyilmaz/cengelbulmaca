/**
 * PUZZLE-DATA.js
 * ------------------------------------------------------------------
 * Bulmacanın statik verisi burada tutulur. Bu dosya sadece bulmacanın
 * YAPISINI tanımlar (hangi hücre ipucu, hangisi harf, kelimeler neler).
 * Kimin hangi kelimeyi çözdüğü / hangi harflerin dolu olduğu bilgisi
 * burada DEĞİL, Firebase'de (oyuncular arası ortak, değişen veri) tutulur.
 *
 * Bu dosyadaki içerik ŞU AN YER TUTUCUDUR (placeholder).
 * Görseldeki gerçek bulmacayı bir sonraki adımda bu formata çevireceğiz.
 *
 * HÜCRE TİPLERİ:
 *   "block"  -> dolu/siyah kare, boş alan
 *   "clue"   -> ipucu kutusu. text: ipucu metni, arrow: "right" | "down"
 *   "letter" -> harf kutusu. wordIds: bu hücrenin ait olduğu kelime(ler)
 *   "photo"  -> görsel/fotoğraf kutusu (görseldeki ortadaki kadın fotoğrafı gibi)
 *
 * KELİME (word) TANIMI:
 *   id       -> benzersiz kelime kimliği
 *   answer   -> doğru cevap (büyük harf, Türkçe karakterlerle)
 *   cells    -> kelimeye ait harf hücrelerinin id listesi, SIRALI
 *               (answer[i] harfi cells[i] hücresine karşılık gelir)
 *   clueCell -> bu kelimenin ipucu kutusunun hücre id'si
 */

const PUZZLE_DATA = {
  title: "Örnek Mini Bulmaca",
  rows: 5,
  cols: 5,

  cells: {
    // --- satır 0 ---
    "r0c0": { type: "block" },
    "r0c1": { type: "block" },
    "r0c2": { type: "clue", text: "Yanan şey, alev", arrow: "down", wordId: "w3" },
    "r0c3": { type: "block" },
    "r0c4": { type: "block" },

    // --- satır 1 ---
    "r1c0": { type: "clue", text: "Gökyüzünün rengi", arrow: "right", wordId: "w1" },
    "r1c1": { type: "letter", wordIds: ["w1"] },
    "r1c2": { type: "letter", wordIds: ["w1", "w3"] }, // kesişim hücresi
    "r1c3": { type: "letter", wordIds: ["w1"] },
    "r1c4": { type: "letter", wordIds: ["w1"] },

    // --- satır 2 ---
    "r2c0": { type: "block" },
    "r2c1": { type: "block" },
    "r2c2": { type: "letter", wordIds: ["w3"] },
    "r2c3": { type: "block" },
    "r2c4": { type: "block" },

    // --- satır 3 ---
    "r3c0": { type: "block" },
    "r3c1": { type: "block" },
    "r3c2": { type: "letter", wordIds: ["w3"] },
    "r3c3": { type: "block" },
    "r3c4": { type: "block" },

    // --- satır 4 ---
    "r4c0": { type: "block" },
    "r4c1": { type: "block" },
    "r4c2": { type: "letter", wordIds: ["w3"] },
    "r4c3": { type: "block" },
    "r4c4": { type: "block" }
  },

  words: {
    "w1": {
      answer: "MAVİ",
      cells: ["r1c1", "r1c2", "r1c3", "r1c4"],
      clueCell: "r1c0"
    },
    "w3": {
      answer: "ATEŞ",
      cells: ["r1c2", "r2c2", "r3c2", "r4c2"],
      clueCell: "r0c2"
    }
  }
};

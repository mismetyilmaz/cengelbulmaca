/**
 * PUZZLE-DATA.js
 * ------------------------------------------------------------------
 * İki şey burada tanımlanıyor:
 *
 * 1) PUZZLE_CATALOG: oda kurulurken seçilebilecek bulmacaların listesi.
 *    Her giriş bir "boyut + dil" kombinasyonu (örn. "small_tr").
 *    Şu an hepsi PLACEHOLDER veridir — gerçek bulmaca eklenince
 *    buradaki cells/words objeleri değiştirilecek.
 *
 * 2) PUZZLE_DATA: o an oynanan bulmacanın verisi. Oda kurulduğunda
 *    seçilen puzzleId'ye göre app.js tarafından atanır
 *    (PUZZLE_DATA = PUZZLE_CATALOG[puzzleId].data).
 *    game.js / puzzle-render.js / scoring.js hep bu değişkeni okur.
 *
 * HÜCRE TİPLERİ:
 *   "block"  -> dolu/siyah kare, boş alan
 *   "clue"   -> ipucu kutusu. text: ipucu metni, arrow: "right" | "down"
 *   "letter" -> harf kutusu. wordIds: bu hücrenin ait olduğu kelime(ler)
 *   "photo"  -> görsel/fotoğraf kutusu
 *
 * KELİME (word) TANIMI:
 *   answer   -> doğru cevap (büyük harf)
 *   cells    -> kelimeye ait harf hücrelerinin id listesi, SIRALI
 *   clueCell -> bu kelimenin ipucu kutusunun hücre id'si
 */

let PUZZLE_DATA = null; // aktif bulmaca — oda kurulunca doldurulur

/**
 * Basit, kesişimsiz bir bulmaca üretir: her kelime kendi satırında,
 * solda ipucu kutusu + sağında harfler. Kataloğu hızlıca doldurmak
 * için kullanılıyor; gerçek bulmaca eklenince elle tasarlanmış,
 * kesişimli grid'lerle değiştirilecek.
 */
function buildRowPuzzle(title, wordList) {
  const cols = Math.max(...wordList.map(w => w.answer.length)) + 1;
  const rows = wordList.length;
  const cells = {};
  const words = {};

  wordList.forEach((w, r) => {
    const clueCellId = `r${r}c0`;
    cells[clueCellId] = { type: "clue", text: w.clue, arrow: "right", wordId: `w${r}` };

    const wordCells = [];
    for (let i = 0; i < w.answer.length; i++) {
      const cellId = `r${r}c${i + 1}`;
      cells[cellId] = { type: "letter", wordIds: [`w${r}`] };
      wordCells.push(cellId);
    }
    // kullanılmayan sağdaki hücreleri blokla doldur
    for (let c = w.answer.length + 1; c < cols; c++) {
      cells[`r${r}c${c}`] = { type: "block" };
    }

    words[`w${r}`] = { answer: w.answer, cells: wordCells, clueCell: clueCellId };
  });

  return { title, rows, cols, cells, words };
}

const PUZZLE_CATALOG = {
  small_tr: {
    id: "small_tr", label: "Küçük", language: "tr",
    data: buildRowPuzzle("Küçük Bulmaca (TR)", [
      { clue: "Kırmızı meyve", answer: "ELMA" },
      { clue: "Gökyüzünün rengi", answer: "MAVİ" },
      { clue: "Dört ayaklı, havlar", answer: "KÖPEK" }
    ])
  },
  medium_tr: {
    id: "medium_tr", label: "Orta", language: "tr",
    data: buildRowPuzzle("Orta Bulmaca (TR)", [
      { clue: "Kırmızı meyve", answer: "ELMA" },
      { clue: "Gökyüzünün rengi", answer: "MAVİ" },
      { clue: "Dört ayaklı, havlar", answer: "KÖPEK" },
      { clue: "Türkiye'nin başkenti", answer: "ANKARA" },
      { clue: "Yazın yenen soğuk tatlı", answer: "DONDURMA" }
    ])
  },
  large_tr: {
    id: "large_tr", label: "Büyük", language: "tr",
    data: buildRowPuzzle("Büyük Bulmaca (TR)", [
      { clue: "Kırmızı meyve", answer: "ELMA" },
      { clue: "Gökyüzünün rengi", answer: "MAVİ" },
      { clue: "Dört ayaklı, havlar", answer: "KÖPEK" },
      { clue: "Türkiye'nin başkenti", answer: "ANKARA" },
      { clue: "Yazın yenen soğuk tatlı", answer: "DONDURMA" },
      { clue: "Haftanın ilk günü", answer: "PAZARTESİ" },
      { clue: "Yılın en soğuk mevsimi", answer: "KIŞ" },
      { clue: "Yazı yazmak için kullanılır", answer: "KALEM" }
    ])
  },
  small_en: {
    id: "small_en", label: "Small", language: "en",
    data: buildRowPuzzle("Small Puzzle (EN)", [
      { clue: "A red fruit", answer: "APPLE" },
      { clue: "Color of the sky", answer: "BLUE" },
      { clue: "Barks, four legs", answer: "DOG" }
    ])
  },
  medium_en: {
    id: "medium_en", label: "Medium", language: "en",
    data: buildRowPuzzle("Medium Puzzle (EN)", [
      { clue: "A red fruit", answer: "APPLE" },
      { clue: "Color of the sky", answer: "BLUE" },
      { clue: "Barks, four legs", answer: "DOG" },
      { clue: "Capital of France", answer: "PARIS" },
      { clue: "Frozen summer treat", answer: "ICECREAM" }
    ])
  },
  large_en: {
    id: "large_en", label: "Large", language: "en",
    data: buildRowPuzzle("Large Puzzle (EN)", [
      { clue: "A red fruit", answer: "APPLE" },
      { clue: "Color of the sky", answer: "BLUE" },
      { clue: "Barks, four legs", answer: "DOG" },
      { clue: "Capital of France", answer: "PARIS" },
      { clue: "Frozen summer treat", answer: "ICECREAM" },
      { clue: "First day of the week", answer: "MONDAY" },
      { clue: "Coldest season", answer: "WINTER" },
      { clue: "Used for writing", answer: "PENCIL" }
    ])
  }
};

/**
 * KESİŞİM ÖRNEĞİ — format referansı
 * ------------------------------------------------------------------
 * Kataloğun geneli kesişimsiz (buildRowPuzzle), çünkü hızlı ve hatasız
 * üretiliyor. Gerçek bulmacada kesişimler olacağı için format burada
 * elle örnekleniyor — puzzle-render.js ve scoring.js bu şekli bekliyor:
 *
 *   cells: {
 *     "r1c2": { type: "letter", wordIds: ["w1", "w3"] }  // kesişim
 *   }
 *
 * yani bir hücre birden fazla wordId taşıyabilir; scoring.js bu hücre
 * daha önce başka bir kelimeden dolmuşsa puan hesabında hariç tutar.
 */

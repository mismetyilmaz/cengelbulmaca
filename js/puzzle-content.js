/**
 * PUZZLE-CONTENT.js
 * ------------------------------------------------------------------
 * Gerçek kelime listelerini BURAYA ekleyeceksin. Diğer dosyalara
 * dokunmana gerek yok.
 *
 * Her bulmaca için registerPuzzle(...) çağrısı yap:
 *
 *   registerPuzzle(level, direction, index, wordList, title?)
 *
 *   level      -> "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
 *   direction  -> "tr_en" (ipucu Türkçe, cevap İngilizce)
 *              -> "en_tr" (ipucu İngilizce, cevap Türkçe)
 *   index      -> 0'dan 19'a kadar (her seviye+yön için 20 slot var)
 *   wordList   -> [{ clue: "...", answer: "..." }, ...]
 *                 clue: ekranda gösterilecek ipucu (kaynak dil)
 *                 answer: oyuncunun yazması gereken cevap (hedef dil)
 *                 ÖNEMLİ: answer boşluksuz TEK kelime olmalı
 *                 (ör. "ice cream" değil "icecream" ya da tek kelime seç)
 *   title      -> opsiyonel, bulmacanın başlığı
 *
 * Bulmaca otomatik olarak kesişimli grid'e yerleştirilir — elle
 * satır/sütun hesaplaman gerekmiyor.
 *
 * ------------------------------------------------------------------
 * ÖRNEK (A1 seviyesi, Türkçe -> İngilizce, slot 0):
 * Bu, mekanizmanın çalıştığını göstermek için eklenmiş bir örnektir.
 * Aynı formatta kendi 20'şer listeni her seviye + yön için ekleyebilirsin.
 * ------------------------------------------------------------------
 * KELİME BANKASI: Oxford A1 listesinden ayrıştırılmış 824 kelimelik
 * tam liste `data/a1-word-bank.json` içinde duruyor — [{clue, answer}]
 * formatında JSON. Aşağıdaki 80 kelimelik "Büyük Bulmaca" bu bankadan
 * alfabenin geneline yayılmış bir örneklem. Kalan ~744 kelime, A1
 * tr_en'in diğer 18 slotunu (index 2-19) doldurmak ya da aynı bankayı
 * en_tr yönünde (İngilizce ipucu, Türkçe cevap) kullanmak için hazır
 * kaynak olarak duruyor.
 * ------------------------------------------------------------------
 */

registerPuzzle("A1", "tr_en", 0, [
  { clue: "Elma",   answer: "APPLE" },
  { clue: "Kedi",   answer: "CAT" },
  { clue: "Köpek",  answer: "DOG" },
  { clue: "Ev",     answer: "HOUSE" },
  { clue: "Su",     answer: "WATER" }
], "A1 — Temel Kelimeler #1");

/**
 * BÜYÜK BULMACA — Oxford A1 kelime listesinden (824 kelimelik listeden
 * alfabenin geneline yayılmış 80 kelime seçilerek) otomatik üretildi.
 * crossword-builder.js kesişim algoritması bu listeyle 79/80 kelimeyi
 * (%99) birbirine kesişimli bağladı — gerçek çengel bulmaca hissi verir.
 */
registerPuzzle("A1", "tr_en", 1, [
  { clue: "Hakkında", answer: "About" },
  { clue: "Sonra", answer: "After" },
  { clue: "Her zaman", answer: "Always" },
  { clue: "Elma", answer: "Apple" },
  { clue: "Üzerinde", answer: "At" },
  { clue: "Muz", answer: "Banana" },
  { clue: "Yatak", answer: "Bed" },
  { clue: "Bisiklet", answer: "Bicycle" },
  { clue: "Bot", answer: "Boat" },
  { clue: "Erkek çocuk", answer: "Boy" },
  { clue: "İş", answer: "Business" },
  { clue: "Kamera", answer: "Camera" },
  { clue: "Sent", answer: "Cent" },
  { clue: "Sinema", answer: "Cinema" },
  { clue: "Soğuk", answer: "Cold" },
  { clue: "Pişirme", answer: "Cooking" },
  { clue: "Kültür", answer: "Culture" },
  { clue: "Aralık", answer: "December" },
  { clue: "Ölmek", answer: "Die" },
  { clue: "Doktor", answer: "Doctor" },
  { clue: "Boyunca", answer: "During" },
  { clue: "On bir", answer: "Eleven" },
  { clue: "Herkes", answer: "Everybody" },
  { clue: "Göz", answer: "Eye" },
  { clue: "Baba", answer: "Father" },
  { clue: "Final", answer: "Final" },
  { clue: "Çiçek", answer: "Flower" },
  { clue: "On dört", answer: "Fourteen" },
  { clue: "Eğlence", answer: "Fun" },
  { clue: "Bardak", answer: "Glass" },
  { clue: "Gitar", answer: "Guitar" },
  { clue: "O", answer: "He" },
  { clue: "Merhaba", answer: "Hi" },
  { clue: "Hastane", answer: "Hospital" },
  { clue: "Buz", answer: "Ice" },
  { clue: "İlginç", answer: "Interested" },
  { clue: "Meyve suyu", answer: "Juice" },
  { clue: "Geniş", answer: "Large" },
  { clue: "Yalan söylemek", answer: "Lie" },
  { clue: "Uzun", answer: "Long" },
  { clue: "Harita", answer: "Map" },
  { clue: "Et", answer: "Meat" },
  { clue: "Milyon", answer: "Million" },
  { clue: "Daha", answer: "More" },
  { clue: "Müze", answer: "Museum" },
  { clue: "Asla", answer: "Never" },
  { clue: "Burun", answer: "Nose" },
  { clue: "Ofis", answer: "Office" },
  { clue: "Açık", answer: "Open" },
  { clue: "Üstünde", answer: "Over" },
  { clue: "Partner", answer: "Partner" },
  { clue: "Periyot", answer: "Period" },
  { clue: "Domuz", answer: "Pig" },
  { clue: "Polis", answer: "Police" },
  { clue: "Alıştırma yapmak", answer: "Practise" },
  { clue: "Proje", answer: "Project" },
  { clue: "Yağmur", answer: "Rain" },
  { clue: "Tekrar etmek", answer: "Repeat" },
  { clue: "Yol", answer: "Road" },
  { clue: "Cumartesi", answer: "Saturday" },
  { clue: "Cümle", answer: "Sentence" },
  { clue: "Alışveriş", answer: "Shop" },
  { clue: "Kız kardeş", answer: "Sister" },
  { clue: "Küçük", answer: "Small" },
  { clue: "Yakında", answer: "Soon" },
  { clue: "Spor", answer: "Sport" },
  { clue: "Hikaye", answer: "Story" },
  { clue: "Pazar", answer: "Sunday" },
  { clue: "Taksi", answer: "Taxi" },
  { clue: "Korkunç", answer: "Terrible" },
  { clue: "Şey", answer: "Thing" },
  { clue: "Zaman", answer: "Time" },
  { clue: "Diş", answer: "Tooth" },
  { clue: "Salı", answer: "Tuesday" },
  { clue: "Üniversite", answer: "University" },
  { clue: "Video", answer: "Video" },
  { clue: "Sıcak", answer: "Warm" },
  { clue: "Hafta sonu", answer: "Weekend" },
  { clue: "Kazanmak", answer: "Win" },
  { clue: "Dünya", answer: "World" }
], "A1 — Büyük Bulmaca (80 Kelime)");

/**
 * Aşağıya kendi listelerini bu formatta ekleyebilirsin, örnek:
 *
 * registerPuzzle("A1", "tr_en", 1, [
 *   { clue: "...", answer: "..." },
 *   ...
 * ], "A1 — Temel Kelimeler #2");
 *
 * registerPuzzle("A2", "en_tr", 0, [
 *   { clue: "...", answer: "..." },
 *   ...
 * ]);
 *
 * Bir (seviye, yön) kombinasyonunda hiç slot doldurulmazsa, oda
 * kurulum ekranında o kombinasyon seçildiğinde "Bu seviye için henüz
 * bulmaca eklenmedi" uyarısı gösterilir — sistem çökmez.
 */

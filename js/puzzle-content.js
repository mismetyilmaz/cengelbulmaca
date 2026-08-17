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
 */

registerPuzzle("A1", "tr_en", 0, [
  { clue: "Elma",   answer: "APPLE" },
  { clue: "Kedi",   answer: "CAT" },
  { clue: "Köpek",  answer: "DOG" },
  { clue: "Ev",     answer: "HOUSE" },
  { clue: "Su",     answer: "WATER" }
], "A1 — Temel Kelimeler #1");

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

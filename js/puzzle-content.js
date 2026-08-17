/**
 * PUZZLE-CONTENT.js
 * ------------------------------------------------------------------
 * Gerçek kelime listelerini BURAYA ekle.
 *
 * registerPuzzle(level, direction, index, wordList, title?)
 *
 * ÖNEMLİ:
 *  - answer boşluksuz TEK kelime olmalı
 *  - 10–16 kelime ideal (gazete eki yoğunluğu)
 *  - 20+ kelime grid'i seyreltir
 */

/* ─── A1 · TR→EN · Slot 0 — Ev & Okul ─── */
registerPuzzle("A1", "tr_en", 0, [
  { clue: "Elma",      answer: "APPLE" },
  { clue: "Su",        answer: "WATER" },
  { clue: "Masa",      answer: "TABLE" },
  { clue: "Kitap",     answer: "BOOK" },
  { clue: "Kapı",      answer: "DOOR" },
  { clue: "Ev",        answer: "HOME" },
  { clue: "Kedi",      answer: "CAT" },
  { clue: "Köpek",     answer: "DOG" },
  { clue: "Kalem",     answer: "PEN" },
  { clue: "Kağıt",     answer: "PAPER" },
  { clue: "Pencere",   answer: "WINDOW" },
  { clue: "Sınıf",     answer: "CLASS" },
  { clue: "Okul",      answer: "SCHOOL" },
  { clue: "Öğretmen",  answer: "TEACHER" }
], "A1 — Ev ve Okul");

/* ─── A1 · TR→EN · Slot 1 — Aile & Vücut ─── */
registerPuzzle("A1", "tr_en", 1, [
  { clue: "Anne",        answer: "MOTHER" },
  { clue: "Baba",        answer: "FATHER" },
  { clue: "Kardeş",      answer: "BROTHER" },
  { clue: "Kız kardeş",  answer: "SISTER" },
  { clue: "El",          answer: "HAND" },
  { clue: "Baş",         answer: "HEAD" },
  { clue: "Göz",         answer: "EYE" },
  { clue: "Kulak",       answer: "EAR" },
  { clue: "Ayak",        answer: "FOOT" },
  { clue: "Ağız",        answer: "MOUTH" },
  { clue: "Burun",       answer: "NOSE" },
  { clue: "Yüz",         answer: "FACE" },
  { clue: "Saç",         answer: "HAIR" },
  { clue: "Diş",         answer: "TOOTH" }
], "A1 — Aile ve Vücut");

/* ─── A1 · TR→EN · Slot 2 — Yiyecek ─── */
registerPuzzle("A1", "tr_en", 2, [
  { clue: "Ekmek",     answer: "BREAD" },
  { clue: "Süt",       answer: "MILK" },
  { clue: "Peynir",    answer: "CHEESE" },
  { clue: "Yumurta",   answer: "EGG" },
  { clue: "Elma",      answer: "APPLE" },
  { clue: "Muz",       answer: "BANANA" },
  { clue: "Su",        answer: "WATER" },
  { clue: "Çay",       answer: "TEA" },
  { clue: "Kahve",     answer: "COFFEE" },
  { clue: "Et",        answer: "MEAT" },
  { clue: "Balık",     answer: "FISH" },
  { clue: "Pirinç",    answer: "RICE" },
  { clue: "Şeker",     answer: "SUGAR" },
  { clue: "Tuz",       answer: "SALT" }
], "A1 — Yiyecek ve İçecek");

/* ─── A1 · TR→EN · Slot 3 — Renk & Sayı ─── */
registerPuzzle("A1", "tr_en", 3, [
  { clue: "Kırmızı",   answer: "RED" },
  { clue: "Mavi",      answer: "BLUE" },
  { clue: "Yeşil",     answer: "GREEN" },
  { clue: "Sarı",      answer: "YELLOW" },
  { clue: "Siyah",     answer: "BLACK" },
  { clue: "Beyaz",     answer: "WHITE" },
  { clue: "Bir",       answer: "ONE" },
  { clue: "İki",       answer: "TWO" },
  { clue: "Üç",        answer: "THREE" },
  { clue: "Dört",      answer: "FOUR" },
  { clue: "Beş",       answer: "FIVE" },
  { clue: "On",        answer: "TEN" },
  { clue: "Yüz",       answer: "HUNDRED" },
  { clue: "Büyük",     answer: "BIG" }
], "A1 — Renkler ve Sayılar");

/* ─── A1 · TR→EN · Slot 4 — Şehir ─── */
registerPuzzle("A1", "tr_en", 4, [
  { clue: "Şehir",       answer: "CITY" },
  { clue: "Sokak",       answer: "STREET" },
  { clue: "Otobüs",      answer: "BUS" },
  { clue: "Araba",       answer: "CAR" },
  { clue: "Tren",        answer: "TRAIN" },
  { clue: "Uçak",        answer: "PLANE" },
  { clue: "Taksi",       answer: "TAXI" },
  { clue: "İstasyon",    answer: "STATION" },
  { clue: "Havaalanı",   answer: "AIRPORT" },
  { clue: "Harita",      answer: "MAP" },
  { clue: "Yol",         answer: "ROAD" },
  { clue: "Köprü",       answer: "BRIDGE" },
  { clue: "Park",        answer: "PARK" },
  { clue: "Hastane",     answer: "HOSPITAL" }
], "A1 — Şehir ve Ulaşım");

/* ─── A1 · EN→TR · Slot 0 ─── */
registerPuzzle("A1", "en_tr", 0, [
  { clue: "Apple",    answer: "elma" },
  { clue: "Water",    answer: "su" },
  { clue: "Book",     answer: "kitap" },
  { clue: "Door",     answer: "kapı" },
  { clue: "Cat",      answer: "kedi" },
  { clue: "Dog",      answer: "köpek" },
  { clue: "School",   answer: "okul" },
  { clue: "Teacher",  answer: "öğretmen" },
  { clue: "Paper",    answer: "kağıt" },
  { clue: "Window",   answer: "pencere" },
  { clue: "Table",    answer: "masa" },
  { clue: "Home",     answer: "ev" },
  { clue: "Friend",   answer: "arkadaş" },
  { clue: "Class",    answer: "sınıf" }
], "A1 — Ev ve Okul (EN→TR)");

/* ─── A1 · EN→TR · Slot 1 ─── */
registerPuzzle("A1", "en_tr", 1, [
  { clue: "Mother",   answer: "anne" },
  { clue: "Father",   answer: "baba" },
  { clue: "Brother",  answer: "kardeş" },
  { clue: "Sister",   answer: "kız" },
  { clue: "Hand",     answer: "el" },
  { clue: "Head",     answer: "baş" },
  { clue: "Eye",      answer: "göz" },
  { clue: "Ear",      answer: "kulak" },
  { clue: "Foot",     answer: "ayak" },
  { clue: "Mouth",    answer: "ağız" },
  { clue: "Nose",     answer: "burun" },
  { clue: "Face",     answer: "yüz" },
  { clue: "Hair",     answer: "saç" },
  { clue: "Tooth",    answer: "diş" }
], "A1 — Aile ve Vücut (EN→TR)");

/* ─── A1 · EN→TR · Slot 2 ─── */
registerPuzzle("A1", "en_tr", 2, [
  { clue: "Bread",    answer: "ekmek" },
  { clue: "Milk",     answer: "süt" },
  { clue: "Cheese",   answer: "peynir" },
  { clue: "Egg",      answer: "yumurta" },
  { clue: "Apple",    answer: "elma" },
  { clue: "Banana",   answer: "muz" },
  { clue: "Water",    answer: "su" },
  { clue: "Tea",      answer: "çay" },
  { clue: "Coffee",   answer: "kahve" },
  { clue: "Meat",     answer: "et" },
  { clue: "Fish",     answer: "balık" },
  { clue: "Rice",     answer: "pirinç" },
  { clue: "Sugar",    answer: "şeker" },
  { clue: "Salt",     answer: "tuz" }
], "A1 — Yiyecek (EN→TR)");

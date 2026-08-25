/**
 * GAME.js
 * ------------------------------------------------------------------
 * Firebase Realtime Database ile senkron çalışan oyun katmanı.
 *
 * Veritabanı şeması:
 *   rooms/{roomId}/players/{playerId}   -> { name, score, color, joinedAt }
 *   rooms/{roomId}/letters/{cellId}     -> { letter: "X", playerId }
 *   rooms/{roomId}/words/{wordId}       -> { solved, solvedBy, solvedByName }
 *
 * Her hücreye yazılan harfin YANINDA o harfi doğru bilen oyuncunun id'si
 * de tutulur — bu sayede grid'de harfi kimin yazdığı, o oyuncunun
 * rengiyle gösterilebiliyor.
 */

const Game = (() => {
  let roomId = null;
  let playerId = null;
  let playerName = null;

  let roomRef = null;
  let lettersCache = {};   // { cellId: {letter, playerId} }
  let wordsCache = {};     // { wordId: {solved,...} }
  let playersCache = {};   // { playerId: {name, score, color} }

  const listeners = {
    onLettersChange: null,
    onWordsChange: null,
    onPlayersChange: null
  };

  function init(id, pid, pname, callbacks) {
    roomId = id;
    playerId = pid;
    playerName = pname;
    Object.assign(listeners, callbacks);

    roomRef = db.ref(`rooms/${roomId}`);

    registerPlayer();
    // Sekme kapanınca oyuncuyu listeden tamamen silmiyoruz;
    // skorlar ve renk kalıcı kalsın istiyoruz (co-op puan tablosu).

    roomRef.child("letters").on("value", snap => {
      lettersCache = snap.val() || {};
      if (listeners.onLettersChange) listeners.onLettersChange(lettersCache);
    });

    roomRef.child("words").on("value", snap => {
      wordsCache = snap.val() || {};
      if (listeners.onWordsChange) listeners.onWordsChange(wordsCache);
    });

    roomRef.child("players").on("value", snap => {
      playersCache = snap.val() || {};
      if (listeners.onPlayersChange) listeners.onPlayersChange(playersCache);
    });
  }

  /** Oyuncuyu kaydeder; yeniyse mevcut oyuncu sayısına göre sabit bir renk atar. */
  async function registerPlayer() {
    const playerRef = roomRef.child(`players/${playerId}`);
    try {
      const snap = await playerRef.get();
      if (!snap.exists()) {
        const playersSnap = await roomRef.child("players").get();
        const existingCount = playersSnap.exists() ? Object.keys(playersSnap.val()).length : 0;
        await playerRef.set({
          name: playerName,
          score: 0,
          color: colorForPlayerIndex(existingCount),
          joinedAt: firebase.database.ServerValue.TIMESTAMP
        });
      } else {
        // Aynı isimle geri dönmüş olabilir, ismi güncel tut (rengi ve skoru koru)
        await playerRef.update({ name: playerName });
      }
    } catch (err) {
      console.error("registerPlayer hatası:", err);
    }
  }

  /**
   * Bir kelime denemesi gönderir.
   * @returns {Promise<{ correct: boolean, alreadySolved?: boolean, points?: number }>}
   */
  async function submitAnswer(wordId, guess) {
    const word = PUZZLE_DATA.words[wordId];
    if (!word) return { correct: false };

    const normalizedGuess = normalize(guess);
    const normalizedAnswer = normalize(word.answer);

    if (normalizedGuess !== normalizedAnswer) {
      return { correct: false };
    }

    try {
      // Çift çözümü engellemek için transaction: sadece "solved" değilse yaz.
      const wordRef = roomRef.child(`words/${wordId}`);
      const txResult = await withTimeout(
        wordRef.transaction(current => {
          if (current && current.solved) {
            return; // değiştirme, zaten çözülmüş — abort
          }
          return {
            solved: true,
            solvedBy: playerId,
            solvedByName: playerName,
            answer: word.answer
          };
        }),
        8000
      );

      if (!txResult.committed) {
        return { correct: true, alreadySolved: true };
      }

      // Puanı, kesişimden ZATEN dolu olan harfleri hariç tutarak hesapla
      const { points } = SCORING.calculate(word.cells, lettersCache);

      // Harfleri veritabanına yaz — SADECE henüz dolu olmayan hücrelere.
      // Kesişimden zaten dolu gelen bir hücrenin rengi/sahibi değişmesin diye
      // (o hücreyi daha önce dolduran oyuncunun rengi korunur).
      const letterUpdates = {};
      word.answer.split("").forEach((ch, i) => {
        const cellId = word.cells[i];
        if (!lettersCache[cellId]) {
          letterUpdates[`letters/${cellId}`] = { letter: ch, playerId };
        }
      });
      if (Object.keys(letterUpdates).length > 0) {
        await roomRef.update(letterUpdates);
      }

      // Skoru artır
      await roomRef.child(`players/${playerId}/score`).transaction(
        current => (current || 0) + points
      );

      return { correct: true, points };
    } catch (err) {
      console.error("submitAnswer hatası:", err);
      return { correct: true, error: true, errorMessage: describeError(err) };
    }
  }

  /** Firebase bağlantısı hiç cevap vermezse promise'ın sonsuza dek asılı kalmasını engeller. */
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout: Firebase yanıt vermedi")), ms)
      )
    ]);
  }

  function describeError(err) {
    if (err && err.message && err.message.startsWith("timeout")) {
      return "Sunucudan yanıt gelmedi. İnternet bağlantını ve firebase-config.js dosyasındaki ayarları kontrol et.";
    }
    return "Bir hata oluştu: " + (err && err.message ? err.message : "bilinmeyen hata");
  }

  function normalize(str) {
    return TextUtils.upper((str || "").trim(), PUZZLE_DATA.targetLang);
  }

  /** @returns {{[cellId]: {letter, playerId}}} */
  function getFilledLettersForWord(wordId) {
    const word = PUZZLE_DATA.words[wordId];
    if (!word) return {};
    const map = {};
    word.cells.forEach(cellId => {
      if (lettersCache[cellId]) map[cellId] = lettersCache[cellId];
    });
    return map;
  }

  function isWordSolved(wordId) {
    return !!(wordsCache[wordId] && wordsCache[wordId].solved);
  }

  function getTotalWordCount() {
    return Object.keys(PUZZLE_DATA.words).length;
  }

  function getSolvedWordCount() {
    return Object.values(wordsCache).filter(w => w && w.solved).length;
  }

  /** Bir oyuncunun sabit rengini döner (kayıtlı değilse nötr bir gri) */
  function getPlayerColor(pid) {
    return (playersCache[pid] && playersCache[pid].color) || "#6E6555";
  }

  function getPlayersSorted() {
    return Object.entries(playersCache)
      .map(([id, p]) => ({ id, name: p.name, score: p.score || 0, color: p.color || "#6E6555" }))
      .sort((a, b) => b.score - a.score);
  }

  return {
    init,
    submitAnswer,
    getFilledLettersForWord,
    isWordSolved,
    getTotalWordCount,
    getSolvedWordCount,
    getPlayerColor,
    getPlayersSorted,
    get playerId() { return playerId; }
  };
})();

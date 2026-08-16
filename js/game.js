/**
 * GAME.js
 * ------------------------------------------------------------------
 * Firebase Realtime Database ile senkron çalışan oyun katmanı.
 *
 * Veritabanı şeması:
 *   rooms/{roomId}/players/{playerId}   -> { name, score, joinedAt }
 *   rooms/{roomId}/letters/{cellId}     -> "X"   (o hücreye yazılan harf)
 *   rooms/{roomId}/words/{wordId}       -> { solved, solvedBy, solvedByName }
 */

const Game = (() => {
  let roomId = null;
  let playerId = null;
  let playerName = null;

  let roomRef = null;
  let lettersCache = {};   // { cellId: "X" }
  let wordsCache = {};     // { wordId: {solved,...} }
  let playersCache = {};   // { playerId: {name, score} }

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

    // Oyuncuyu kaydet
    const playerRef = roomRef.child(`players/${playerId}`);
    playerRef.get().then(snap => {
      if (!snap.exists()) {
        playerRef.set({
          name: playerName,
          score: 0,
          joinedAt: firebase.database.ServerValue.TIMESTAMP
        });
      } else {
        // Aynı isimle geri dönmüş olabilir, ismi güncel tut
        playerRef.update({ name: playerName });
      }
    });
    // Sekme kapanınca oyuncuyu listeden tamamen silmiyoruz;
    // skorlar kalıcı kalsın istiyoruz (co-op puan tablosu).

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

      // Harfleri veritabanına yaz
      const letterUpdates = {};
      word.answer.split("").forEach((ch, i) => {
        letterUpdates[`letters/${word.cells[i]}`] = ch;
      });
      await roomRef.update(letterUpdates);

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
    return str.toLocaleUpperCase("tr-TR").trim();
  }

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

  function getPlayersSorted() {
    return Object.entries(playersCache)
      .map(([id, p]) => ({ id, name: p.name, score: p.score || 0 }))
      .sort((a, b) => b.score - a.score);
  }

  return {
    init,
    submitAnswer,
    getFilledLettersForWord,
    isWordSolved,
    getTotalWordCount,
    getSolvedWordCount,
    getPlayersSorted,
    get playerId() { return playerId; }
  };
})();

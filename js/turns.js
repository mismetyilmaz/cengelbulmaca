/**
 * TURNS.js
 * ------------------------------------------------------------------
 * Sıra Tabanlı (1v1) mod için oda durumu. rooms/{roomId}/turnState
 * altında Firebase'e yazılır:
 *
 *   { phase: "waiting" | "countdown" | "playing" | "finished",
 *     countdownStartedAt, order: [p1,p2], currentPlayerId,
 *     turnStartedAt, turnNumber, winnerId }
 *
 * Akış:
 *  1) Oda sahibi lobide "Oyunu Başlat"a basar -> phase:"countdown"
 *  2) 10 saniye sonra (SADECE host tarafından) rastgele bir oyuncu
 *     seçilip phase:"playing" yapılır.
 *  3) Her tur 20 saniye. Süre dolarsa (aktif oyuncunun İSTEMCİSİ veya
 *     yedek olarak diğer oyuncunun istemcisi) sırayı puansız geçirir.
 *  4) Doğru cevapta app.js passTurnAfterCorrectAnswer() çağırır.
 *  5) Tüm kelimeler çözülünce herhangi bir istemci phase:"finished"
 *     yazabilir (transaction korumalı, sadece ilk yazan geçerli olur).
 */

const Turns = (() => {
  const TURN_DURATION_MS = 20000;
  const COUNTDOWN_MS = 10000;

  let roomRef = null;
  let playerId = null;
  let isHost = false;
  let onStateChange = null;
  let timeoutTimer = null;
  let countdownFinalizeTimer = null;

  function init(roomId, pid, hostFlag, callbacks) {
    playerId = pid;
    isHost = hostFlag;
    onStateChange = callbacks.onStateChange;
    roomRef = db.ref(`rooms/${roomId}`);

    roomRef.child("turnState").on("value", snap => {
      const state = snap.val();
      handleStateUpdate(state);
      if (onStateChange) onStateChange(state);
    });
  }

  function handleStateUpdate(state) {
    clearTimeout(timeoutTimer);
    clearTimeout(countdownFinalizeTimer);
    if (!state) return;

    if (state.phase === "countdown" && isHost) {
      const remaining = COUNTDOWN_MS - (Date.now() - state.countdownStartedAt);
      countdownFinalizeTimer = setTimeout(finalizeCountdown, Math.max(0, remaining));
    }

    if (state.phase === "playing") {
      const remaining = TURN_DURATION_MS - (Date.now() - state.turnStartedAt);
      const expectedTurnNumber = state.turnNumber;
      timeoutTimer = setTimeout(() => attemptTimeoutPass(expectedTurnNumber), Math.max(0, remaining) + 300);
    }
  }

  /** Sadece host: geri sayım bitince rastgele bir oyuncudan başlat. Transaction korumalı (iki kere tetiklenirse ikincisi no-op). */
  async function finalizeCountdown() {
    try {
      const playersSnap = await roomRef.child("players").get();
      const ids = playersSnap.exists() ? Object.keys(playersSnap.val()) : [];
      if (ids.length < 2) return; // beklenmedik durum, güvenlik için iptal
      const shuffled = ids.slice(0, 2).sort(() => Math.random() - 0.5);

      await roomRef.child("turnState").transaction(current => {
        if (!current || current.phase !== "countdown") return; // zaten ilerlemiş
        return {
          phase: "playing",
          order: shuffled,
          currentPlayerId: shuffled[0],
          turnStartedAt: firebase.database.ServerValue.TIMESTAMP,
          turnNumber: 1
        };
      });
    } catch (err) {
      console.error("finalizeCountdown hatası:", err);
    }
  }

  /** Süre dolunca sırayı puansız geçirir. turnNumber uyuşmuyorsa (zaten ilerlemiş) no-op. */
  function attemptTimeoutPass(expectedTurnNumber) {
    roomRef.child("turnState").transaction(current => {
      if (!current || current.phase !== "playing") return;
      if (current.turnNumber !== expectedTurnNumber) return; // başka bir istemci zaten ilerletti
      const next = otherPlayer(current.currentPlayerId, current.order);
      return {
        ...current,
        currentPlayerId: next,
        turnStartedAt: firebase.database.ServerValue.TIMESTAMP,
        turnNumber: current.turnNumber + 1
      };
    }).catch(err => console.error("attemptTimeoutPass hatası:", err));
  }

  /** Doğru cevap sonrası sırayı hemen karşı tarafa geçirir. */
  async function passTurnAfterCorrectAnswer() {
    try {
      await roomRef.child("turnState").transaction(current => {
        if (!current || current.phase !== "playing") return;
        if (current.currentPlayerId !== playerId) return; // zaten sıra değişmiş
        const next = otherPlayer(current.currentPlayerId, current.order);
        return {
          ...current,
          currentPlayerId: next,
          turnStartedAt: firebase.database.ServerValue.TIMESTAMP,
          turnNumber: current.turnNumber + 1
        };
      });
    } catch (err) {
      console.error("passTurnAfterCorrectAnswer hatası:", err);
    }
  }

  function otherPlayer(current, order) {
    return order[0] === current ? order[1] : order[0];
  }

  /** Host lobide "Oyunu Başlat"a basınca çağrılır. */
  async function startGame() {
    await roomRef.child("turnState").set({
      phase: "countdown",
      countdownStartedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  /** Bulmaca tamamen çözüldüğünde herhangi bir istemci çağırabilir (transaction korumalı). */
  async function finishGame(scores) {
    let winnerId = null;
    let best = -1;
    let tie = false;
    Object.entries(scores).forEach(([pid, score]) => {
      if (score > best) { best = score; winnerId = pid; tie = false; }
      else if (score === best) { tie = true; }
    });
    try {
      await roomRef.child("turnState").transaction(current => {
        if (!current || current.phase === "finished") return; // zaten bitmiş
        return { ...current, phase: "finished", winnerId: tie ? null : winnerId };
      });
    } catch (err) {
      console.error("finishGame hatası:", err);
    }
  }

  return {
    init,
    startGame,
    passTurnAfterCorrectAnswer,
    finishGame,
    TURN_DURATION_MS,
    COUNTDOWN_MS
  };
})();

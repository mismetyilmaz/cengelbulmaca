/**
 * CHAT.js
 * ------------------------------------------------------------------
 * Oda içi sohbet. rooms/{roomId}/chat altında Firebase'e push edilir.
 *
 * Katılınca önce geçmiş mesajlar tek seferlik "once" ile yüklenir
 * (bunlar okunmuş sayılır, okunmamış rozetini tetiklemez), sonra
 * SADECE o andan sonra gelen yeni mesajlar için canlı dinleyici
 * kurulur (bunlar isNew=true ile bildirilir — kapalıyken gelen
 * mesajlar okunmamış sayacını artırır).
 */

const Chat = (() => {
  let roomRef = null;
  let playerId = null;
  let onMessage = null; // (msg, isNew) => void

  function init(roomId, pid, pname, callbacks) {
    playerId = pid;
    onMessage = callbacks.onMessage;
    roomRef = db.ref(`rooms/${roomId}/chat`);

    roomRef.limitToLast(200).once("value").then(snap => {
      let lastKey = null;
      snap.forEach(child => {
        onMessage(child.val(), false);
        lastKey = child.key;
      });

      const liveQuery = lastKey ? roomRef.orderByKey().startAfter(lastKey) : roomRef;
      liveQuery.on("child_added", child => {
        onMessage(child.val(), true);
      });
    });
  }

  function sendMessage(playerName, text) {
    const trimmed = (text || "").trim().slice(0, 300);
    if (!trimmed) return;
    roomRef.push({
      playerId,
      name: playerName,
      text: trimmed,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
  }

  return { init, sendMessage, get playerId() { return playerId; } };
})();

/**
 * ROOM.js
 * ------------------------------------------------------------------
 * Oda oluşturma, oda ayarlarını okuma, katılım öncesi parola/kapasite
 * kontrolü ve Firebase bağlantı durumu burada yönetilir.
 *
 * rooms/{roomId}/config -> {
 *   puzzleId, maxPlayers (0 = sınırsız), password (boş string = yok),
 *   language, createdAt
 * }
 */

const Room = (() => {

  function generateRoomId() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  /**
   * Firebase bağlantı durumunu izler.
   * @param {(connected: boolean) => void} callback
   */
  function watchConnection(callback) {
    db.ref(".info/connected").on("value", snap => {
      callback(snap.val() === true);
    });
  }

  /**
   * Yeni oda oluşturur ve config'i yazar.
   * @returns {Promise<string>} roomId
   */
  async function createRoom({ puzzleId, maxPlayers, password, level, direction }) {
    const roomId = generateRoomId();
    await db.ref(`rooms/${roomId}/config`).set({
      puzzleId,
      maxPlayers: maxPlayers || 0,
      password: password || "",
      level,
      direction,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    return roomId;
  }

  /** @returns {Promise<Object|null>} oda config'i, yoksa null */
  async function fetchConfig(roomId) {
    const snap = await db.ref(`rooms/${roomId}/config`).get();
    return snap.exists() ? snap.val() : null;
  }

  async function getPlayerIds(roomId) {
    const snap = await db.ref(`rooms/${roomId}/players`).get();
    return snap.exists() ? Object.keys(snap.val()) : [];
  }

  /**
   * Katılım için parola ve kapasite kontrolü yapar.
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  async function validateJoin(roomId, config, { playerId, password }) {
    if (config.password && config.password !== password) {
      return { ok: false, reason: "wrong_password" };
    }
    if (config.maxPlayers && config.maxPlayers > 0) {
      const existingIds = await getPlayerIds(roomId);
      const alreadyIn = existingIds.includes(playerId);
      if (!alreadyIn && existingIds.length >= config.maxPlayers) {
        return { ok: false, reason: "room_full" };
      }
    }
    return { ok: true };
  }

  return { generateRoomId, watchConnection, createRoom, fetchConfig, validateJoin };
})();

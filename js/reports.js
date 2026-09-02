/**
 * REPORTS.js
 * ------------------------------------------------------------------
 * Oyuncuların kelime/ipucu raporlarını Firebase'de kalıcı bir kuyruğa
 * yazar ve Stüdyo için aynı kelimeye gelen raporları gruplar.
 *
 * Firebase yolu:
 *   wordReports/{puzzleId}/{wordId}/{playerId}
 *
 * Oyuncu kimliği yolun son parçası olduğu için bir oyuncu aynı kelimeyi
 * tekrar raporlarsa yeni kayıt/spam oluşturmak yerine kendi kaydını günceller.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Reports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REASONS = Object.freeze({
    wrong_translation: "Çeviri yanlış",
    ambiguous: "İpucu belirsiz / birden fazla cevap var",
    typo: "Yazım hatası",
    wrong_level: "Seviye uygun değil",
    other: "Diğer"
  });
  const VALID_STATUSES = new Set(["open", "resolved", "dismissed"]);
  const SAFE_ID = /^[A-Za-z0-9_-]+$/;

  function cleanText(value, maxLength) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
  }

  function validatePayload(payload) {
    const value = payload || {};
    if (!/^([A-C][12])_(tr_en|en_tr)_(\d+)$/.test(String(value.puzzleId || ""))) {
      return { valid: false, error: "Bulmaca kimliği geçersiz." };
    }
    if (!SAFE_ID.test(String(value.wordId || ""))) {
      return { valid: false, error: "Kelime kimliği geçersiz." };
    }
    if (!SAFE_ID.test(String(value.playerId || ""))) {
      return { valid: false, error: "Oyuncu kimliği geçersiz." };
    }
    if (!Object.prototype.hasOwnProperty.call(REASONS, value.reason)) {
      return { valid: false, error: "Rapor nedeni geçersiz." };
    }
    if (!cleanText(value.clue, 160) || !cleanText(value.answer, 40)) {
      return { valid: false, error: "Kelime veya ipucu bilgisi eksik." };
    }
    return { valid: true };
  }

  function normalizePayload(payload) {
    const check = validatePayload(payload);
    if (!check.valid) throw new Error(check.error);
    return {
      puzzleId: String(payload.puzzleId),
      wordId: String(payload.wordId),
      roomId: cleanText(payload.roomId, 32),
      playerId: String(payload.playerId),
      playerName: cleanText(payload.playerName, 18) || "Oyuncu",
      level: cleanText(payload.level, 2),
      direction: cleanText(payload.direction, 5),
      clue: cleanText(payload.clue, 160),
      answer: cleanText(payload.answer, 40),
      bankEntryKey: cleanText(payload.bankEntryKey, 64) || null,
      reason: payload.reason,
      details: cleanText(payload.details, 300),
      status: "open"
    };
  }

  function flattenReportTree(tree) {
    const reports = [];
    Object.entries(tree || {}).forEach(([puzzleId, words]) => {
      Object.entries(words || {}).forEach(([wordId, players]) => {
        Object.entries(players || {}).forEach(([playerId, report]) => {
          if (!report || typeof report !== "object") return;
          reports.push({ ...report, puzzleId, wordId, playerId });
        });
      });
    });
    return reports;
  }

  function groupOpenReports(tree) {
    const groups = new Map();
    flattenReportTree(tree)
      .filter(report => report.status === "open")
      .forEach(report => {
        const key = `${report.puzzleId}:${report.wordId}`;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            puzzleId: report.puzzleId,
            wordId: report.wordId,
            clue: report.clue,
            answer: report.answer,
            level: report.level,
            direction: report.direction,
            bankEntryKey: report.bankEntryKey || null,
            reports: [],
            latestAt: 0
          });
        }
        const group = groups.get(key);
        group.reports.push(report);
        group.latestAt = Math.max(group.latestAt, Number(report.updatedAt || report.createdAt) || 0);
      });
    return Array.from(groups.values()).sort((a, b) =>
      b.reports.length - a.reports.length || b.latestAt - a.latestAt
    );
  }

  function requireFirebase() {
    if (typeof db === "undefined" || typeof firebase === "undefined") {
      throw new Error("Firebase bağlantısı hazır değil.");
    }
  }

  async function submit(payload) {
    requireFirebase();
    const record = normalizePayload(payload);
    const ref = db.ref(`wordReports/${record.puzzleId}/${record.wordId}/${record.playerId}`);
    const previous = await ref.get();
    const createdAt = previous.exists() && previous.val().createdAt
      ? previous.val().createdAt
      : firebase.database.ServerValue.TIMESTAMP;
    await ref.set({
      ...record,
      createdAt,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  function watchOpenGroups(onChange, onError) {
    requireFirebase();
    const ref = db.ref("wordReports");
    const handler = snapshot => onChange(groupOpenReports(snapshot.val()));
    ref.on("value", handler, onError);
    return () => ref.off("value", handler);
  }

  async function moderateGroup(group, status) {
    requireFirebase();
    if (!group || !Array.isArray(group.reports) || !VALID_STATUSES.has(status) || status === "open") {
      throw new Error("Moderasyon işlemi geçersiz.");
    }
    const updates = {};
    group.reports.forEach(report => {
      const base = `wordReports/${group.puzzleId}/${group.wordId}/${report.playerId}`;
      updates[`${base}/status`] = status;
      updates[`${base}/moderatedAt`] = firebase.database.ServerValue.TIMESTAMP;
    });
    await db.ref().update(updates);
  }

  async function blockBankEntry(group) {
    requireFirebase();
    const match = String(group && group.bankEntryKey || "").match(/^([A-C][12]):([A-Z]+)$/);
    if (!match) throw new Error("Bu kelimenin havuz bağlantısı bulunamadı.");
    const [, level, answer] = match;
    await db.ref(`wordBankOverrides/${level}/${answer}`).set({
      status: "blocked",
      source: "player_reports",
      puzzleId: group.puzzleId,
      wordId: group.wordId,
      reportCount: group.reports.length,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
    await moderateGroup(group, "resolved");
  }

  return {
    REASONS,
    validatePayload,
    normalizePayload,
    flattenReportTree,
    groupOpenReports,
    submit,
    watchOpenGroups,
    moderateGroup,
    blockBankEntry
  };
});

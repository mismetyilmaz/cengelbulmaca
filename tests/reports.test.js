"use strict";

const assert = require("assert");
const path = require("path");
const Reports = require(path.join(__dirname, "..", "js", "reports.js"));

const base = {
  puzzleId: "A2_tr_en_3",
  wordId: "w7",
  roomId: "room_1",
  playerId: "p_abc123",
  playerName: "  Ada   Lovelace  ",
  level: "A2",
  direction: "tr_en",
  clue: "  Ev  ",
  answer: "HOUSE",
  reason: "wrong_translation",
  details: "  Doğru çeviri farklı olabilir.  "
};

assert.strictEqual(Reports.validatePayload(base).valid, true);
assert.strictEqual(Reports.normalizePayload(base).playerName, "Ada Lovelace");
assert.strictEqual(Reports.normalizePayload(base).details, "Doğru çeviri farklı olabilir.");
assert.strictEqual(Reports.validatePayload({ ...base, reason: "spam" }).valid, false);
assert.strictEqual(Reports.validatePayload({ ...base, puzzleId: "../../x" }).valid, false);

const tree = {
  A2_tr_en_3: {
    w7: {
      p_a: { ...base, status: "open", reason: "wrong_translation", createdAt: 10 },
      p_b: { ...base, status: "open", reason: "ambiguous", createdAt: 20 },
      p_c: { ...base, status: "resolved", createdAt: 30 }
    },
    w8: {
      p_d: { ...base, wordId: "w8", status: "open", createdAt: 40 }
    }
  }
};

const flattened = Reports.flattenReportTree(tree);
assert.strictEqual(flattened.length, 4);
const groups = Reports.groupOpenReports(tree);
assert.strictEqual(groups.length, 2);
assert.strictEqual(groups[0].wordId, "w7", "En çok raporlu kelime önce gelmeli");
assert.strictEqual(groups[0].reports.length, 2);

console.log("reports: doğrulama ve gruplama testleri geçti");

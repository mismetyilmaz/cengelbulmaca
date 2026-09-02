import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const bankDir = path.join(projectRoot, "data", "word-banks");
const outputPath = path.join(bankDir, "kelime-havuzu-inceleme.csv");
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];

const statusLabels = {
  approved: "İnsan onaylı",
  ai_approved: "AI onaylı",
  candidate: "Aday",
  needs_review: "İnsan incelemesi",
  ai_rejected: "AI reddi"
};

function csvCell(value) {
  const text = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
}

const columns = [
  "Seviye",
  "Türkçe İpucu",
  "İngilizce Cevap",
  "Kelime Türü",
  "Sıklık Sırası",
  "Durum",
  "Durum Kodu",
  "İnceleyen Model",
  "Güven",
  "Önerilen İpucu",
  "İnceleme Gerekçesi",
  "Alternatifler",
  "Kaynak"
];

const rows = [];
for (const level of levels) {
  const bankPath = path.join(bankDir, `${level.toLowerCase()}.json`);
  const bank = JSON.parse(fs.readFileSync(bankPath, "utf8"));
  for (const entry of bank.entries || []) {
    rows.push([
      level,
      entry.clue,
      entry.answer,
      entry.partOfSpeech,
      entry.frequencyRank,
      statusLabels[entry.status] || entry.status,
      entry.status,
      entry.status === "approved" ? "İnsan" : (entry.aiReview?.model || ""),
      entry.aiReview?.confidence ?? "",
      entry.aiReview?.suggestedClue || "",
      entry.humanReview?.reason || entry.aiReview?.reason || "",
      Array.isArray(entry.alternatives) ? entry.alternatives.join(" | ") : "",
      entry.source
    ]);
  }
}

const csv = [columns, ...rows]
  .map(row => row.map(csvCell).join(";"))
  .join("\r\n");

// UTF-8 BOM, Türkçe Excel kurulumlarında karakterlerin doğru açılmasını sağlar.
fs.writeFileSync(outputPath, `\uFEFF${csv}\r\n`, "utf8");
console.log(`${rows.length} kayıt dışa aktarıldı: ${outputPath}`);

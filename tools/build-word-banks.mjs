import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const cacheDir = path.join(projectRoot, ".cache", "word-bank-sources");
const outputDir = path.join(projectRoot, "data", "word-banks");
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const levelOrder = Object.fromEntries(levels.map((level, index) => [level, index]));

const sources = {
  freedict: {
    id: "freedict-eng-tur-0.3",
    revision: "5bdceeac8d0dba3298c1bebe734f60d54dad30f7",
    url: "https://raw.githubusercontent.com/freedict/fd-dictionaries/5bdceeac8d0dba3298c1bebe734f60d54dad30f7/eng-tur/eng-tur.tei",
    cacheFile: "eng-tur.tei"
  },
  kelly: {
    id: "kelly-english-cefr",
    revision: "dca8f2267b3590e0bd8d4b36d3cbfd945c8b1c79",
    url: "https://raw.githubusercontent.com/kotoshu/frequency-list-kelly/dca8f2267b3590e0bd8d4b36d3cbfd945c8b1c79/data/en.json",
    cacheFile: "kelly-en.json"
  },
  frequency: {
    id: "frequencywords-turkish-2018",
    revision: "525f9b560de45753a5ea01069454e72e9aa541c6",
    url: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/tr/tr_50k.txt",
    cacheFile: "tr-50k.txt"
  }
};

async function fetchCached(source) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const destination = path.join(cacheDir, source.cacheFile);
  if (fs.existsSync(destination) && fs.statSync(destination).size > 0) {
    return fs.readFileSync(destination, "utf8");
  }

  process.stdout.write(`İndiriliyor: ${source.id}... `);
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`${source.id} indirilemedi (${response.status}).`);
  const content = await response.text();
  fs.writeFileSync(destination, content, "utf8");
  console.log(`${Math.round(content.length / 1024)} KB`);
  return content;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .trim()
    .normalize("NFC");
}

function isUsableEnglishWord(value) {
  return /^[a-z]+$/.test(value) && value.length >= 3 && value.length <= 18;
}

function cleanTurkishCandidate(value) {
  const cleaned = decodeXml(value).replace(/[.!?]+$/, "").trim();
  if (!/^[A-Za-zÇĞİÖŞÜçğıöşü]+$/.test(cleaned)) return null;
  if (cleaned.length < 3 || cleaned.length > 18) return null;
  return cleaned;
}

function parseFreeDict(xml) {
  const translations = new Map();
  for (const entryMatch of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
    const entry = entryMatch[1];
    const orthMatch = entry.match(/<orth\b[^>]*>([\s\S]*?)<\/orth>/);
    if (!orthMatch) continue;
    const english = decodeXml(orthMatch[1]).toLocaleLowerCase("en-US");
    if (!isUsableEnglishWord(english)) continue;

    const candidates = translations.get(english) || [];
    for (const quoteMatch of entry.matchAll(/<quote\b[^>]*>([\s\S]*?)<\/quote>/g)) {
      const candidate = cleanTurkishCandidate(quoteMatch[1]);
      if (!candidate) continue;
      const normalized = candidate.toLocaleLowerCase("tr-TR");
      if (!candidates.some(item => item.toLocaleLowerCase("tr-TR") === normalized)) {
        candidates.push(candidate);
      }
    }
    if (candidates.length > 0) translations.set(english, candidates);
  }
  return translations;
}

function parseTurkishFrequency(content) {
  const frequencies = new Map();
  content.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(/^(\S+)\s+(\d+)$/);
    if (!match) return;
    frequencies.set(match[1].toLocaleLowerCase("tr-TR"), {
      count: Number(match[2]),
      rank: index + 1
    });
  });
  return frequencies;
}

function parseKelly(content) {
  const data = JSON.parse(content);
  const words = new Map();
  for (const row of data.full_list || []) {
    const english = String(row.word || "").toLocaleLowerCase("en-US");
    if (!isUsableEnglishWord(english) || levelOrder[row.cefr] == null) continue;
    const existing = words.get(english);
    if (!existing || levelOrder[row.cefr] < levelOrder[existing.cefr]) {
      words.set(english, row);
    }
  }
  return words;
}

function scoreCandidate(candidate, index, english, partOfSpeech, frequencies, englishVocabulary) {
  const normalized = candidate.toLocaleLowerCase("tr-TR");
  const frequency = frequencies.get(normalized);
  if (!frequency || frequency.count < 20) return null;
  if (normalized.toLocaleUpperCase("tr-TR") === english.toLocaleUpperCase("en-US")) return null;

  let score = Math.log10(frequency.count + 1) * 10 - index * 0.15;
  const isVerb = /verb/i.test(partOfSpeech || "");
  const looksLikeInfinitive = /m[ae]k$/i.test(normalized);
  if (isVerb && looksLikeInfinitive) score += 5;
  if (!isVerb && looksLikeInfinitive) score -= 4;
  if (englishVocabulary.has(normalized) && frequency.rank > 5000) score -= 8;

  return {
    value: normalized,
    score,
    frequency: frequency.count,
    frequencyRank: frequency.rank
  };
}

function chooseTranslation(english, candidates, partOfSpeech, frequencies, englishVocabulary) {
  const scored = candidates
    .map((candidate, index) => scoreCandidate(
      candidate,
      index,
      english,
      partOfSpeech,
      frequencies,
      englishVocabulary
    ))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  return {
    selected: scored[0],
    alternatives: scored.slice(1, 5).map(item => item.value)
  };
}

function titleCaseTurkish(value) {
  const chars = Array.from(value);
  return chars.length === 0
    ? value
    : chars[0].toLocaleUpperCase("tr-TR") + chars.slice(1).join("");
}

function buildCandidateEntries(translations, cefrWords, frequencies, approvedAnswers) {
  const englishVocabulary = new Set(cefrWords.keys());
  const result = Object.fromEntries(levels.map(level => [level, []]));

  for (const [english, row] of cefrWords.entries()) {
    if (approvedAnswers.has(english)) continue;
    const candidates = translations.get(english);
    if (!candidates) continue;
    const chosen = chooseTranslation(english, candidates, row.pos, frequencies, englishVocabulary);
    if (!chosen) continue;

    result[row.cefr].push({
      clue: titleCaseTurkish(chosen.selected.value),
      answer: english.toLocaleUpperCase("en-US"),
      level: row.cefr,
      partOfSpeech: row.pos || null,
      frequencyRank: Number(row.rank) || null,
      alternatives: chosen.alternatives.map(titleCaseTurkish),
      status: "candidate",
      source: "freedict+kelly+frequencywords"
    });
  }

  for (const level of levels) {
    result[level].sort((a, b) => (a.frequencyRank || Infinity) - (b.frequencyRank || Infinity));
  }
  return result;
}

function validateBank(level, entries) {
  const answers = new Set();
  for (const entry of entries) {
    if (!entry.clue || !/^[A-Z]+$/.test(entry.answer)) {
      throw new Error(`${level}: geçersiz kayıt ${JSON.stringify(entry)}`);
    }
    if (answers.has(entry.answer)) throw new Error(`${level}: tekrarlanan cevap ${entry.answer}`);
    answers.add(entry.answer);
  }
}

function readAiReviews() {
  const reviewPath = path.join(outputDir, "ai-reviews.json");
  if (!fs.existsSync(reviewPath)) return {};
  const payload = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  return payload && payload.reviews && typeof payload.reviews === "object"
    ? payload.reviews
    : {};
}

function readHumanReviews() {
  const reviewPath = path.join(outputDir, "human-reviews.json");
  if (!fs.existsSync(reviewPath)) return {};
  const payload = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  return payload && payload.reviews && typeof payload.reviews === "object"
    ? payload.reviews
    : {};
}

function applyAiReview(level, entry, reviews) {
  const review = reviews[`${level}:${entry.answer}`];
  const decisions = new Set(["ai_approved", "needs_review", "ai_rejected"]);
  if (!review || !decisions.has(review.decision)) return entry;

  const suggestedClue = cleanTurkishCandidate(review.suggestedClue);
  const useSuggestion = review.decision === "ai_approved" && suggestedClue;
  return {
    ...entry,
    clue: useSuggestion ? titleCaseTurkish(suggestedClue) : entry.clue,
    status: review.decision,
    aiReview: {
      confidence: Number(review.confidence) || 0,
      reason: String(review.reason || "").slice(0, 240),
      suggestedClue: suggestedClue ? titleCaseTurkish(suggestedClue) : null,
      reviewedAt: review.reviewedAt || null,
      model: review.model || null
    }
  };
}

function applyHumanReview(level, entry, reviews) {
  const review = reviews[`${level}:${entry.answer}`];
  if (!review || review.decision !== "approved") return entry;

  const reviewedClue = cleanTurkishCandidate(review.clue);
  if (!reviewedClue) {
    throw new Error(`${level}:${entry.answer} için insan onaylı ipucu geçersiz.`);
  }

  const { aiReview, ...baseEntry } = entry;
  return {
    ...baseEntry,
    clue: titleCaseTurkish(reviewedClue),
    partOfSpeech: String(review.partOfSpeech || baseEntry.partOfSpeech || "").trim() || null,
    status: "approved",
    humanReview: {
      reason: String(review.reason || "İnsan tarafından doğrulandı.").slice(0, 240),
      reviewedAt: review.reviewedAt || null
    }
  };
}

async function main() {
  const [freeDictXml, kellyJson, frequencyText] = await Promise.all([
    fetchCached(sources.freedict),
    fetchCached(sources.kelly),
    fetchCached(sources.frequency)
  ]);

  const existingA1Path = path.join(projectRoot, "data", "a1-word-bank.json");
  const existingA1 = JSON.parse(fs.readFileSync(existingA1Path, "utf8"));
  const approvedAnswers = new Set(
    existingA1.map(entry => String(entry.answer || "").toLocaleLowerCase("en-US"))
  );

  const translations = parseFreeDict(freeDictXml);
  const cefrWords = parseKelly(kellyJson);
  const frequencies = parseTurkishFrequency(frequencyText);
  const candidatesByLevel = buildCandidateEntries(
    translations,
    cefrWords,
    frequencies,
    approvedAnswers
  );
  const aiReviews = readAiReviews();
  const humanReviews = readHumanReviews();

  fs.mkdirSync(outputDir, { recursive: true });
  const summary = {};
  for (const level of levels) {
    const baseApproved = level === "A1"
      ? existingA1.map(entry => ({
          clue: entry.clue,
          answer: String(entry.answer).toLocaleUpperCase("en-US"),
          level: "A1",
          partOfSpeech: null,
          alternatives: [],
          status: "approved",
          source: "existing-a1-bank"
        }))
      : [];
    const approved = baseApproved.map(entry =>
      applyHumanReview(level, entry, humanReviews)
    );
    const reviewedCandidates = candidatesByLevel[level].map(entry =>
      applyHumanReview(level, applyAiReview(level, entry, aiReviews), humanReviews)
    );
    const entries = [...approved, ...reviewedCandidates];
    validateBank(level, entries);

    const statusCount = status => entries.filter(entry => entry.status === status).length;

    const payload = {
      metadata: {
        schemaVersion: 1,
        level,
        baseDirection: "tr_en",
        totalEntries: entries.length,
        approvedEntries: statusCount("approved"),
        aiApprovedEntries: statusCount("ai_approved"),
        candidateEntries: statusCount("candidate"),
        needsReviewEntries: statusCount("needs_review"),
        aiRejectedEntries: statusCount("ai_rejected"),
        reviewRequired: statusCount("candidate") + statusCount("needs_review") > 0,
        sourceRevisions: Object.fromEntries(
          Object.values(sources).map(source => [source.id, source.revision])
        )
      },
      entries
    };

    const destination = path.join(outputDir, `${level.toLocaleLowerCase("en-US")}.json`);
    fs.writeFileSync(destination, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    summary[level] = payload.metadata;
  }

  const manifest = {
    schemaVersion: 1,
    levels: summary,
    totals: {
      entries: Object.values(summary).reduce((sum, item) => sum + item.totalEntries, 0),
      approved: Object.values(summary).reduce((sum, item) => sum + item.approvedEntries, 0),
      aiApproved: Object.values(summary).reduce((sum, item) => sum + item.aiApprovedEntries, 0),
      candidates: Object.values(summary).reduce((sum, item) => sum + item.candidateEntries, 0),
      needsReview: Object.values(summary).reduce((sum, item) => sum + item.needsReviewEntries, 0),
      aiRejected: Object.values(summary).reduce((sum, item) => sum + item.aiRejectedEntries, 0)
    }
  };
  fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.table(levels.map(level => ({
    Seviye: level,
    Toplam: summary[level].totalEntries,
    "İnsan onaylı": summary[level].approvedEntries,
    "AI onaylı": summary[level].aiApprovedEntries,
    Aday: summary[level].candidateEntries,
    "İnsan incelemesi": summary[level].needsReviewEntries,
    "AI reddi": summary[level].aiRejectedEntries
  })));
  console.log(`Toplam kelime hazinesi: ${manifest.totals.entries}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

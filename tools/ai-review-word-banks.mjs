import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..");
const bankDir = path.join(projectRoot, "data", "word-banks");
const ledgerPath = path.join(bankDir, "ai-reviews.json");
const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const decisions = new Set(["ai_approved", "needs_review", "ai_rejected"]);

function usage() {
  console.log(`Kullanım:
  node tools/ai-review-word-banks.mjs --provider ollama --model gemma4:12b --level A2 --limit 100
  node tools/ai-review-word-banks.mjs --provider openai --level all --limit 500 [--batch-size 15]

Sağlayıcılar:
  ollama  Varsayılan. Yerel http://127.0.0.1:11434 API'sini kullanır; anahtar gerekmez.
  openai  OPENAI_API_KEY ve OPENAI_REVIEW_MODEL ortam değişkenlerini kullanır.

Seçenekler:
  --model       Ollama/OpenAI model kimliği (ortam değişkenine alternatif)
  --ollama-url  Varsayılan: http://127.0.0.1:11434
  --dry-run     Sonuçları dosyalara yazmadan bağlantıyı ve çıktıyı sınar

--limit zorunludur. Daha önce incelenen kelimeler otomatik atlanır.`);
}

function parseArgs(argv) {
  const options = {
    provider: "ollama",
    model: null,
    ollamaUrl: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
    level: null,
    limit: null,
    batchSize: null,
    dryRun: false
  };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === "--help" || flag === "-h") return { help: true };
    if (flag === "--provider") options.provider = String(argv[++index] || "").toLowerCase();
    else if (flag === "--model") options.model = argv[++index];
    else if (flag === "--ollama-url") options.ollamaUrl = argv[++index];
    else if (flag === "--level") options.level = argv[++index];
    else if (flag === "--limit") options.limit = Number(argv[++index]);
    else if (flag === "--batch-size") options.batchSize = Number(argv[++index]);
    else if (flag === "--dry-run") options.dryRun = true;
    else throw new Error(`Bilinmeyen seçenek: ${flag}`);
  }
  if (!["ollama", "openai"].includes(options.provider)) {
    throw new Error("--provider ollama veya openai olmalı.");
  }
  if (!options.level || (options.level !== "all" && !levels.includes(options.level.toUpperCase()))) {
    throw new Error("--level A1..C2 veya all olmalı.");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("Maliyet kontrolü için --limit pozitif bir tam sayı olarak zorunludur.");
  }
  options.batchSize = options.batchSize == null
    ? (options.provider === "ollama" ? 5 : 15)
    : options.batchSize;
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 20) {
    throw new Error("--batch-size 1 ile 20 arasında olmalı.");
  }
  if (!/^https?:\/\//.test(String(options.ollamaUrl || ""))) {
    throw new Error("--ollama-url geçerli bir http(s) adresi olmalı.");
  }
  options.ollamaUrl = options.ollamaUrl.replace(/\/$/, "");
  options.level = options.level === "all" ? "all" : options.level.toUpperCase();
  return options;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readLedger() {
  if (!fs.existsSync(ledgerPath)) return { schemaVersion: 1, updatedAt: null, reviews: {} };
  const ledger = readJson(ledgerPath);
  if (!ledger.reviews || typeof ledger.reviews !== "object") ledger.reviews = {};
  return ledger;
}

function saveLedger(ledger) {
  ledger.updatedAt = new Date().toISOString();
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

function collectCandidates(selectedLevels, ledger, limit) {
  const result = [];
  for (const level of selectedLevels) {
    const bank = readJson(path.join(bankDir, `${level.toLowerCase()}.json`));
    for (const entry of bank.entries || []) {
      const key = `${level}:${entry.answer}`;
      if (entry.status !== "candidate" || ledger.reviews[key]) continue;
      result.push({
        key,
        level,
        answer: entry.answer,
        clue: entry.clue,
        alternatives: entry.alternatives || [],
        partOfSpeech: entry.partOfSpeech || null,
        frequencyRank: entry.frequencyRank || null
      });
      if (result.length >= limit) return result;
    }
  }
  return result;
}

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reviews"],
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["answer", "decision", "suggestedClue", "confidence", "reason"],
        properties: {
          answer: { type: "string" },
          decision: { type: "string", enum: ["ai_approved", "needs_review", "ai_rejected"] },
          suggestedClue: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string", maxLength: 240 }
        }
      }
    }
  }
};

const reviewInstructions = [
  "Sen Türkçe-İngilizce sözlük ve CEFR kalite denetmenisin.",
  "Her kayıtta answer İngilizce cevap, clue Türkçe tek kelimelik ipucudur.",
  "ai_approved yalnızca ipucu yaygın, doğru, aynı sözcük türünde, tek kelimelik ve seviye yaklaşık doğruysa kullan.",
  "Anlam çokanlamlı/belirsizse, seviye şüpheliyse veya emin değilsen needs_review kullan.",
  "Çeviri açıkça yanlışsa ya da uygun tek kelimelik düzeltme yoksa ai_rejected kullan.",
  "Uygun daha doğru tek kelimelik Türkçe karşılığı suggestedClue alanına yaz; yoksa mevcut ipucunu yaz.",
  "ai_approved için confidence en az 0.85 olmalı. Her giriş için tam bir sonuç döndür."
].join(" ");

function extractOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const output of response.output || []) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("Responses API yanıtında output_text bulunamadı.");
}

async function reviewBatchWithOpenAi(batch, apiKey, model) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: reviewInstructions,
      input: JSON.stringify(batch.map(({ key, ...entry }) => entry)),
      text: {
        format: {
          type: "json_schema",
          name: "word_bank_reviews",
          strict: true,
          schema: reviewSchema
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Responses API hatası (${response.status}): ${body.slice(0, 500)}`);
  }
  return JSON.parse(extractOutputText(await response.json())).reviews;
}

async function reviewBatchWithOllama(batch, model, ollamaUrl) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: "10m",
      format: reviewSchema,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: reviewInstructions },
        {
          role: "user",
          content:
            `Tam olarak ${batch.length} kayıt için reviews dizisi döndür. ` +
            `Beklenen JSON şeması: ${JSON.stringify(reviewSchema)}\n` +
            `İncelenecek kayıtlar: ${JSON.stringify(batch.map(({ key, ...entry }) => entry))}`
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama API hatası (${response.status}): ${body.slice(0, 500)}`);
  }
  const payload = await response.json();
  const content = payload && payload.message && payload.message.content;
  if (!content) throw new Error("Ollama yanıtında message.content bulunamadı.");
  return JSON.parse(content).reviews;
}

function validateReviews(batch, reviews) {
  if (!Array.isArray(reviews) || reviews.length !== batch.length) {
    throw new Error("AI yanıtındaki kayıt sayısı gönderilen paketle uyuşmuyor.");
  }
  const byAnswer = new Map(reviews.map(review => [String(review.answer).toUpperCase(), review]));
  return batch.map(entry => {
    const review = byAnswer.get(entry.answer);
    if (!review || !decisions.has(review.decision)) {
      throw new Error(`${entry.answer} için geçerli AI kararı yok.`);
    }
    const confidence = Math.max(0, Math.min(1, Number(review.confidence) || 0));
    const decision = review.decision === "ai_approved" && confidence < 0.85
      ? "needs_review"
      : review.decision;
    return {
      entry,
      review: {
        decision,
        suggestedClue: String(review.suggestedClue || entry.clue).trim(),
        confidence,
        reason: String(review.reason || "").trim().slice(0, 240)
      }
    };
  });
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exitCode = 1;
    return;
  }
  if (options.help) {
    usage();
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = options.model || (options.provider === "ollama"
    ? process.env.OLLAMA_REVIEW_MODEL
    : process.env.OPENAI_REVIEW_MODEL);
  if (!model) throw new Error("--model veya ilgili REVIEW_MODEL ortam değişkeni ayarlanmalı.");
  if (options.provider === "openai" && !apiKey) {
    throw new Error("OpenAI sağlayıcısı için OPENAI_API_KEY ayarlanmalı.");
  }

  const ledger = readLedger();
  const selectedLevels = options.level === "all" ? levels : [options.level];
  const candidates = collectCandidates(selectedLevels, ledger, options.limit);
  if (candidates.length === 0) {
    console.log("İncelenecek yeni aday bulunamadı.");
    return;
  }

  console.log(`${candidates.length} aday ${options.provider}/${model} ile incelenecek${options.dryRun ? " (dry-run)" : ""}.`);
  for (let offset = 0; offset < candidates.length; offset += options.batchSize) {
    const batch = candidates.slice(offset, offset + options.batchSize);
    const rawReviews = options.provider === "ollama"
      ? await reviewBatchWithOllama(batch, model, options.ollamaUrl)
      : await reviewBatchWithOpenAi(batch, apiKey, model);
    const reviewed = validateReviews(batch, rawReviews);
    if (options.dryRun) {
      console.table(reviewed.map(({ entry, review }) => ({
        Seviye: entry.level,
        Cevap: entry.answer,
        İpucu: entry.clue,
        Karar: review.decision,
        Öneri: review.suggestedClue,
        Güven: review.confidence
      })));
      continue;
    }
    const reviewedAt = new Date().toISOString();
    for (const { entry, review } of reviewed) {
      ledger.reviews[entry.key] = {
        level: entry.level,
        answer: entry.answer,
        originalClue: entry.clue,
        ...review,
        reviewedAt,
        model: `${options.provider}:${model}`
      };
    }
    saveLedger(ledger);
    console.log(`${Math.min(offset + batch.length, candidates.length)} / ${candidates.length} tamamlandı.`);
  }

  if (options.dryRun) return;

  const build = spawnSync(process.execPath, [path.join(projectRoot, "tools", "build-word-banks.mjs")], {
    cwd: projectRoot,
    stdio: "inherit"
  });
  if (build.status !== 0) throw new Error("AI kararları kaydedildi ancak kelime havuzları yeniden üretilemedi.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const outputDir = path.join(projectRoot, "data", "word-banks");
const jsonPath = path.join(outputDir, "short-fillers.json");
const csvPath = path.join(outputDir, "kisa-dolgu-havuzu.csv");

const alphabet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const turkishAlphabet = Array.from("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ");
const elementSymbols = [
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
  "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
  "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
  "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn",
  "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
  "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb",
  "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
  "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th",
  "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm",
  "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds",
  "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og"
];

if (elementSymbols.length !== 118) {
  throw new Error(`Periyodik tablo eksik: ${elementSymbols.length}/118`);
}

const entriesByAnswer = new Map();

alphabet.forEach((letter, index) => {
  const previous = alphabet[index - 1];
  entriesByAnswer.set(letter, {
    answer: letter,
    length: 1,
    category: "alphabet",
    clues: {
      tr: index === 0
        ? "İngiliz alfabesinin ilk harfi"
        : `İngiliz alfabesinde ${previous} harfinden sonra`,
      en: index === 0
        ? "First letter of the English alphabet"
        : `After ${previous} in the English alphabet`
    },
    alternativeClues: { tr: [], en: [] },
    status: "approved",
    source: "curated-alphabet"
  });
});

turkishAlphabet.forEach((letter, index) => {
  if (entriesByAnswer.has(letter)) return;
  const previous = turkishAlphabet[index - 1];
  entriesByAnswer.set(letter, {
    answer: letter,
    length: 1,
    category: "alphabet",
    clues: {
      tr: index === 0
        ? "Türk alfabesinin ilk harfi"
        : `Türk alfabesinde ${previous} harfinden sonra`,
      en: index === 0
        ? "First letter of the Turkish alphabet"
        : `After ${previous} in the Turkish alphabet`
    },
    alternativeClues: { tr: [], en: [] },
    status: "approved",
    source: "curated-alphabet"
  });
});

const pairAnswers = new Set();
for (const letters of [alphabet, turkishAlphabet]) {
  for (const first of letters) {
    for (const second of letters) pairAnswers.add(`${first}${second}`);
  }
}

for (const answer of pairAnswers) {
  const letters = Array.from(answer);
  const usesTurkishSpecificLetter = letters.some(letter => !alphabet.includes(letter));
  const alphabetNameTr = usesTurkishSpecificLetter ? "Türk" : "İngiliz";
  const alphabetNameEn = usesTurkishSpecificLetter ? "Turkish" : "English";
  entriesByAnswer.set(answer, {
    answer,
    length: 2,
    category: "alphabet-pair",
    clues: {
      tr: `${alphabetNameTr} alfabesinde ${letters[0]} ve ${letters[1]} harfleri`,
      en: `Letters ${letters[0]} and ${letters[1]} in the ${alphabetNameEn} alphabet`
    },
    alternativeClues: { tr: [], en: [] },
    status: "approved",
    priority: "last-resort",
    source: "curated-alphabet-pairs"
  });
}

elementSymbols.forEach((symbol, index) => {
  const answer = symbol.toUpperCase();
  const atomicNumber = index + 1;
  const clueTr = `Atom numarası ${atomicNumber} olan elementin simgesi`;
  const clueEn = `Symbol of the element with atomic number ${atomicNumber}`;
  if (answer.length === 1) {
    const existing = entriesByAnswer.get(answer);
    existing.alternativeClues.tr.push(clueTr);
    existing.alternativeClues.en.push(clueEn);
    return;
  }
  const existing = entriesByAnswer.get(answer);
  entriesByAnswer.set(answer, {
    answer,
    length: 2,
    category: "element-symbol",
    atomicNumber,
    clues: { tr: clueTr, en: clueEn },
    alternativeClues: {
      tr: existing ? [existing.clues.tr, ...existing.alternativeClues.tr] : [],
      en: existing ? [existing.clues.en, ...existing.alternativeClues.en] : []
    },
    status: "approved",
    source: "curated-periodic-table"
  });
});

const entries = [...entriesByAnswer.values()]
  .sort((a, b) => a.length - b.length || a.answer.localeCompare(b.answer, "en"));
const countByLength = length => entries.filter(entry => entry.length === length).length;

const payload = {
  metadata: {
    schemaVersion: 1,
    purpose: "zero-fill-short-answers",
    totalEntries: entries.length,
    oneLetterEntries: countByLength(1),
    twoLetterEntries: countByLength(2),
    directions: ["tr_en", "en_tr"],
    reviewStatus: "human-approved-curated"
  },
  entries
};

function csvCell(value) {
  const text = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
}

const csvRows = [
  ["Uzunluk", "Cevap", "Kategori", "Atom Numarası", "Türkçe İpucu", "İngilizce İpucu", "Alternatif Türkçe İpuçları", "Durum"],
  ...entries.map(entry => [
    entry.length,
    entry.answer,
    entry.category,
    entry.atomicNumber || "",
    entry.clues.tr,
    entry.clues.en,
    entry.alternativeClues.tr.join(" | "),
    entry.status
  ])
];

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(
  csvPath,
  `\uFEFF${csvRows.map(row => row.map(csvCell).join(";")).join("\r\n")}\r\n`,
  "utf8"
);

console.log(
  `${entries.length} kısa dolgu üretildi ` +
  `(${payload.metadata.oneLetterEntries} tek harf, ${payload.metadata.twoLetterEntries} iki harf).`
);

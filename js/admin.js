/**
 * ADMIN.js
 * ------------------------------------------------------------------
 * Bulmaca Stüdyosu: satır/sütun seçip boş bir grid oluşturur, sonra
 * hücre hücre tıklayarak ipucu + cevap + yön eklenir. Her hücrede en
 * fazla 2 ipucu olabilir. Eksik hibrit çalışmalar puzzleDrafts altında tutulur;
 * yalnız gap içermeyen doğrulanmış sonuç puzzles/{level}/{direction}/{index}
 * yoluna yayınlanır — index.html sadece bu yayın yolunu okuyup oynatır.
 */

let state = null; // Bulmaca verisi + editör durumu; taslaklarda gaps/stats alanları da bulunur.

const CEFR_BANK_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const DIFFICULTY_BANK_LEVELS = {
  A: ["A1", "A2"],
  B: ["B1", "B2"],
  C: ["C1", "C2"],
  easy: ["A1", "A2"],
  medium: ["B1", "B2"],
  hard: ["C1", "C2"]
};

function bankLevelsFor(level) {
  return DIFFICULTY_BANK_LEVELS[level] || [level];
}

function difficultyLabel(level) {
  return ({ easy: "A", medium: "B", hard: "C" })[level] || level;
}

function bankMetadata(payload) {
  const entries = payload.entries || [];
  return {
    totalEntries: payload.metadata?.totalEntries ?? entries.length,
    approvedEntries: payload.metadata?.approvedEntries ?? entries.filter(entry => entry.status === "approved").length,
    aiApprovedEntries: payload.metadata?.aiApprovedEntries ?? entries.filter(entry => entry.status === "ai_approved").length,
    candidateEntries:
      (payload.metadata?.candidateEntries ?? entries.filter(entry => entry.status === "candidate").length) +
      (payload.metadata?.needsReviewEntries ?? entries.filter(entry => entry.status === "needs_review").length)
  };
}

async function loadWordBanks(levels, includeCandidates) {
  const results = await Promise.all(levels.map(async level => {
    const [response, overrideSnapshot] = await Promise.all([
      fetch(`data/word-banks/${level.toLowerCase()}.json`),
      db.ref(`wordBankOverrides/${level}`).get()
    ]);
    if (!response.ok) throw new Error(`${level} kelime havuzu okunamadı (${response.status}).`);
    const payload = await response.json();
    const overrides = overrideSnapshot.exists() ? overrideSnapshot.val() : {};
    const entries = (payload.entries || [])
      .filter(entry =>
        (!overrides[entry.answer] || overrides[entry.answer].status !== "blocked") &&
        (
          entry.status === "approved" ||
          entry.status === "ai_approved" ||
          (includeCandidates && ["candidate", "needs_review"].includes(entry.status))
        )
      )
      .map(entry => ({
        ...entry,
        sourceLevel: level,
        bankEntryKey: `${level}:${entry.answer}`,
        reviewStatus: entry.status
      }));
    return { entries, metadata: bankMetadata(payload) };
  }));

  return {
    entries: results.flatMap(result => result.entries),
    metadata: results.reduce((sum, result) => ({
      totalEntries: sum.totalEntries + result.metadata.totalEntries,
      approvedEntries: sum.approvedEntries + result.metadata.approvedEntries,
      aiApprovedEntries: sum.aiApprovedEntries + result.metadata.aiApprovedEntries,
      candidateEntries: sum.candidateEntries + result.metadata.candidateEntries
    }), { totalEntries: 0, approvedEntries: 0, aiApprovedEntries: 0, candidateEntries: 0 })
  };
}

function directionalWords(entries, direction) {
  return direction === "tr_en"
    ? entries.map(entry => ({
        clue: entry.clue,
        answer: entry.answer,
        bankEntryKey: entry.bankEntryKey,
        reviewStatus: entry.reviewStatus,
        category: entry.category
      }))
    : entries.map(entry => ({
        clue: entry.answer,
        answer: entry.clue,
        bankEntryKey: entry.bankEntryKey,
        reviewStatus: entry.reviewStatus,
        category: entry.category
      }));
}

function attachBankStats(stats, metadata, includeCandidates) {
  stats.bankTotalEntries = metadata.totalEntries;
  stats.bankApprovedEntries = metadata.approvedEntries;
  stats.bankAiApprovedEntries = metadata.aiApprovedEntries;
  stats.bankCandidateEntries = metadata.candidateEntries;
  stats.includedCandidates = includeCandidates;
  return stats;
}

function nextWordCounter(words) {
  return Object.keys(words || {}).reduce((max, wordId) => {
    const match = String(wordId).match(/^w(\d+)$/);
    return match ? Math.max(max, Number(match[1]) + 1) : max;
  }, 0);
}

function prepareWorkspaceState(nextState) {
  const prepared = {
    ...nextState,
    cells: nextState.cells || {},
    words: nextState.words || {},
    gaps: Array.isArray(nextState.gaps) ? nextState.gaps : [],
    stats: nextState.stats || {},
    highlightedGapId: null
  };
  prepared.wordCounter = Math.max(Number(prepared.wordCounter) || 0, nextWordCounter(prepared.words));
  return prepared;
}

// ---------- Bağlantı durumu ----------
Room.watchConnection(connected => {
  const el = document.getElementById("conn-status");
  const text = document.getElementById("conn-status-text");
  el.classList.remove("conn-unknown", "conn-ok", "conn-bad");
  if (connected) { el.classList.add("conn-ok"); text.textContent = "Bağlı"; }
  else { el.classList.add("conn-bad"); text.textContent = "Bağlantı yok"; }
});

// ================================================================
// ADIM 1: KURULUM
// ================================================================
wireOptionGroup(document.getElementById("studio-level-options"));
wireOptionGroup(document.getElementById("studio-direction-options"));

function wireOptionGroup(container) {
  container.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });
}

function readSetupOptions() {
  const setupError = document.getElementById("setup-error");
  setupError.textContent = "";

  const level = document.getElementById("studio-level-options").querySelector(".selected").dataset.level;
  const direction = document.getElementById("studio-direction-options").querySelector(".selected").dataset.direction;
  const title = document.getElementById("studio-title-input").value.trim();
  const rows = parseInt(document.getElementById("studio-rows-input").value, 10);
  const cols = parseInt(document.getElementById("studio-cols-input").value, 10);

  if (!rows || !cols || rows < 2 || cols < 2 || rows > 30 || cols > 30) {
    setupError.textContent = "Satır/sütun 2 ile 30 arasında olmalı.";
    return null;
  }

  return { level, direction, title, rows, cols };
}

function openNewPuzzleWorkspace(nextState, generationStats) {
  state = prepareWorkspaceState(nextState);

  document.getElementById("setup-panel").classList.add("hidden");
  document.getElementById("library-panel").classList.add("hidden");
  document.getElementById("report-panel").classList.add("hidden");
  document.getElementById("studio-workspace").classList.remove("hidden");
  state.isEditingExisting = false;

  const generationPanel = document.getElementById("generation-panel");
  if (generationStats) {
    generationPanel.classList.remove("hidden");
    const bankSummary = generationStats.bankTotalEntries
      ? ` Havuzda ${generationStats.bankTotalEntries} kayıt var ` +
        `(${generationStats.bankApprovedEntries} insan onaylı, ` +
        `${generationStats.bankAiApprovedEntries} AI onaylı, ` +
        `${generationStats.bankCandidateEntries} bekleyen aday).`
      : "";
    const candidateWarning = generationStats.includedCandidates
      ? " AI onayı olmayan adaylar bu üretime dahil edildi."
      : "";
    const layoutSummary = generationStats.layoutMode === "full-grid"
      ? `${generationStats.gapCount ? "Hibrit taslak" : "%100 çözülmüş doğal grid"}: ` +
        `${generationStats.mainWordCount} seçili zorluk kelimesi ve ` +
        `${generationStats.shortFillerCount} dolgu (${generationStats.wordCount} çözülmüş cevap). ` +
        `${generationStats.gapCount || 0} editör boşluğu kaldı. ` +
        `${generationStats.longHorizontalWords || 0} uzun yatay, ` +
        `${generationStats.longVerticalWords || 0} uzun dikey cevap yerleştirildi. ` +
        (generationStats.lastResortFillerCount
          ? `${generationStats.lastResortFillerCount} son çare alfabe çifti kullanıldı. `
          : "Yapay alfabe çifti kullanılmadı. ")
      : `${generationStats.wordCount} kelime, ` +
        `${generationStats.crossings} kesişim, ` +
        `${generationStats.sharedClueCells} ortak ipucu kutusu, ` +
        `%${generationStats.fillPercent} doluluk ve ` +
        `${generationStats.emptyCells} kontrollü boş hücre üretildi. `;
    document.getElementById("generation-summary").textContent =
      layoutSummary +
      bankSummary + candidateWarning + " Kaydetmeden önce ipuçlarını ve cevapları kontrol et.";
  } else {
    generationPanel.classList.add("hidden");
  }

  renderGrid();
  renderGapPanel();
  updateSaveTargetLabel();
  initResizePanel();
}

document.getElementById("create-grid-btn").addEventListener("click", () => {
  const options = readSetupOptions();
  if (!options) return;

  openNewPuzzleWorkspace({
    level: options.level,
    direction: options.direction,
    targetLang: options.direction === "tr_en" ? "en" : "tr",
    title: options.title,
    rows: options.rows,
    cols: options.cols,
    cells: {},
    words: {},
    wordCounter: 0,
    selectedCellId: null,
    nextIndex: null
  }, null);
});

document.getElementById("load-draft-btn").addEventListener("click", async () => {
  const options = readSetupOptions();
  if (!options) return;
  const button = document.getElementById("load-draft-btn");
  const setupError = document.getElementById("setup-error");
  button.disabled = true;
  button.textContent = "Taslak açılıyor...";
  try {
    const draft = await getPuzzleDraft(options.level, options.direction);
    if (!draft) throw new Error("Bu zorluk ve yönde kayıtlı taslak bulunamadı.");
    openNewPuzzleWorkspace({
      ...draft,
      level: options.level,
      direction: options.direction,
      cells: JSON.parse(JSON.stringify(draft.cells || {})),
      words: JSON.parse(JSON.stringify(draft.words || {})),
      gaps: JSON.parse(JSON.stringify(draft.gaps || [])),
      stats: JSON.parse(JSON.stringify(draft.stats || {})),
      selectedCellId: null,
      isDraft: true,
      nextIndex: draft.nextIndex ?? null
    }, draft.stats || null);
  } catch (error) {
    setupError.textContent = error.message || "Taslak açılamadı.";
  } finally {
    button.disabled = false;
    button.textContent = "Bu Zorluk/Yöndeki Taslağı Aç";
  }
});

document.getElementById("auto-generate-btn").addEventListener("click", async () => {
  const options = readSetupOptions();
  if (!options) return;

  const setupError = document.getElementById("setup-error");
  const button = document.getElementById("auto-generate-btn");
  const targetWords = parseInt(document.getElementById("auto-target-input").value, 10);

  if (!targetWords || targetWords < 3 || targetWords > 80) {
    setupError.textContent = "Hedef kelime sayısı 3 ile 80 arasında olmalı.";
    return;
  }
  if (options.rows < 5 || options.cols < 5) {
    setupError.textContent = "Otomatik üretim için satır ve sütun en az 5 olmalı.";
    return;
  }
  button.disabled = true;
  button.textContent = "Bulmaca oluşturuluyor...";
  try {
    const includeCandidates = document.getElementById("include-candidates-check").checked;
    const bankPayload = await loadWordBanks(bankLevelsFor(options.level), includeCandidates);
    const bank = bankPayload.entries;

    if (bank.length < 3) {
      throw new Error(
        `${options.level} seviyesinde henüz yeterli insan/AI onaylı kelime yok. ` +
        "Önce AI inceleme komutunu çalıştırabilir veya onaysız adayları geçici olarak açabilirsin."
      );
    }

    const targetLang = options.direction === "tr_en" ? "en" : "tr";
    const wordList = directionalWords(bank, options.direction);

    const generated = AutoPuzzleGenerator.generate({
      wordList,
      rows: options.rows,
      cols: options.cols,
      targetWords,
      targetLang,
      compact: true,
      targetFillPercent: 70,
      title: options.title || `${options.level} — Otomatik Bulmaca`,
      seed: `${Date.now()}-${options.direction}-${targetWords}`,
      attempts: 36
    });

    const validation = AutoPuzzleGenerator.validatePuzzle(generated);
    if (!validation.valid) {
      throw new Error(`Üretilen grid doğrulanamadı: ${validation.errors[0]}`);
    }

    if (generated.stats.wordCount < 3) {
      throw new Error("Bu boyutta yeterli sayıda kelime yerleştirilemedi. Daha büyük bir grid dene.");
    }

    const stats = attachBankStats(generated.stats, bankPayload.metadata, includeCandidates);
    openNewPuzzleWorkspace({
      level: options.level,
      direction: options.direction,
      targetLang,
      title: generated.title,
      rows: generated.rows,
      cols: generated.cols,
      cells: generated.cells,
      words: generated.words,
      wordCounter: stats.wordCount,
      selectedCellId: null,
      nextIndex: null
    }, stats);
  } catch (err) {
    console.error("Otomatik bulmaca üretilemedi:", err);
    setupError.textContent = err.message || "Otomatik bulmaca üretilemedi.";
  } finally {
    button.disabled = false;
    button.textContent = "Kelime Havuzundan Otomatik Oluştur";
  }
});

document.getElementById("full-generate-btn").addEventListener("click", async () => {
  const options = readSetupOptions();
  if (!options) return;

  const setupError = document.getElementById("setup-error");
  const button = document.getElementById("full-generate-btn");
  if (options.rows < 5 || options.cols < 5 || options.rows > 16 || options.cols > 16) {
    setupError.textContent = "Hibrit üretimde satır ve sütun 5 ile 16 arasında olmalı.";
    return;
  }
  button.disabled = true;
  button.textContent = "Hibrit taslak oluşturuluyor...";
  try {
    const includeCandidates = document.getElementById("include-candidates-check").checked;
    const difficultyLevels = new Set(bankLevelsFor(options.level));
    const [allBanks, shortResponse] = await Promise.all([
      loadWordBanks(CEFR_BANK_LEVELS, includeCandidates),
      fetch("data/word-banks/short-fillers.json")
    ]);
    if (!shortResponse.ok) throw new Error(`Kısa dolgu havuzu okunamadı (${shortResponse.status}).`);
    const shortPayload = await shortResponse.json();
    const targetLang = options.direction === "tr_en" ? "en" : "tr";
    const coreWords = directionalWords(
      allBanks.entries.filter(entry => difficultyLevels.has(entry.sourceLevel)),
      options.direction
    );
    const bankFillers = directionalWords(allBanks.entries, options.direction)
      .map(entry => ({ ...entry, category: entry.category || "short-word" }));
    const shortFillers = (shortPayload.entries || []).map(entry => ({
      clue: options.direction === "tr_en" ? entry.clues.tr : entry.clues.en,
      answer: entry.answer,
      reviewStatus: entry.status,
      category: entry.category
    }));

    const generated = FullGridGenerator.generate({
      coreWords,
      fillerWords: [...bankFillers, ...shortFillers],
      rows: options.rows,
      cols: options.cols,
      targetLang,
      title: options.title || `${difficultyLabel(options.level)} — Hibrit Bulmaca Taslağı`,
      seed: `${Date.now()}-${options.level}-${options.direction}`,
      attempts: 48,
      maxNodes: 160000,
      timeLimitMs: 1800,
      allowGaps: true
    });
    const validation = AutoPuzzleGenerator.validatePuzzle(generated, { allowGaps: true });
    if (!validation.valid) {
      throw new Error(`Üretilen grid doğrulanamadı: ${validation.errors[0]}`);
    }

    const stats = attachBankStats(generated.stats, allBanks.metadata, includeCandidates);
    openNewPuzzleWorkspace({
      level: options.level,
      direction: options.direction,
      targetLang,
      title: generated.title,
      rows: generated.rows,
      cols: generated.cols,
      cells: generated.cells,
      words: generated.words,
      gaps: generated.gaps,
      stats,
      wordCounter: stats.wordCount,
      selectedCellId: null,
      nextIndex: null
    }, stats);
  } catch (err) {
    console.error("Hibrit bulmaca taslağı üretilemedi:", err);
    setupError.textContent = err.message || "Hibrit bulmaca taslağı üretilemedi.";
  } finally {
    button.disabled = false;
    button.textContent = "Hibrit Taslak Oluştur";
  }
});

document.getElementById("reset-grid-btn").addEventListener("click", () => {
  if (confirm("Mevcut bulmaca silinip yeni bir tane mi başlatılsın? Kaydetmediysen kaybolur.")) {
    window.location.reload();
  }
});

// ================================================================
// KAYITLI BULMACALARI LİSTELEME / DÜZENLEME / SİLME
// ================================================================
const libraryLevelOptions = document.getElementById("library-level-options");
const libraryDirectionOptions = document.getElementById("library-direction-options");
wireOptionGroup(libraryLevelOptions);
wireOptionGroup(libraryDirectionOptions);

[libraryLevelOptions, libraryDirectionOptions].forEach(group => {
  group.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", refreshLibraryList);
  });
});

async function refreshLibraryList() {
  const level = libraryLevelOptions.querySelector(".selected").dataset.level;
  const direction = libraryDirectionOptions.querySelector(".selected").dataset.direction;
  const listEl = document.getElementById("library-list");
  listEl.innerHTML = `<p class="sub">Yükleniyor...</p>`;

  try {
    const puzzles = await listPuzzles(level, direction);
    if (puzzles.length === 0) {
      listEl.innerHTML = `<p class="sub">${level} / ${direction} için henüz kayıtlı bulmaca yok.</p>`;
      return;
    }
    listEl.innerHTML = "";
    puzzles.forEach(p => {
      const row = document.createElement("div");
      row.className = "library-item";

      const info = document.createElement("span");
      info.className = "library-item-info";
      info.innerHTML = `<span class="library-item-index">#${p.index}</span>${escapeHtml(p.title)}`;

      const actions = document.createElement("div");
      actions.className = "library-item-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "library-edit-btn";
      editBtn.textContent = "Düzenle";
      editBtn.addEventListener("click", () => loadPuzzleForEditing(level, direction, p.index));

      const delBtn = document.createElement("button");
      delBtn.className = "library-delete-btn";
      delBtn.textContent = "Sil";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`"${p.title}" kalıcı olarak silinsin mi?`)) return;
        await deletePuzzleFromLibrary(level, direction, p.index);
        refreshLibraryList();
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      row.appendChild(info);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p class="sub">Liste okunamadı (bağlantı sorunu olabilir).</p>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadPuzzleForEditing(level, direction, index) {
  const setupError = document.getElementById("setup-error");
  setupError.textContent = "";
  try {
    const data = await getPuzzleData(`${level}_${direction}_${index}`);
    if (!data) { alert("Bulmaca yüklenemedi."); return; }

    // wordCounter'ı mevcut en yüksek wordId'nin bir fazlasına ayarla (çakışmasın diye)
    let maxNum = -1;
    Object.keys(data.words).forEach(wid => {
      const n = parseInt(wid.replace("w", ""), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });

    state = prepareWorkspaceState({
      level, direction,
      targetLang: data.targetLang,
      title: data.title,
      rows: data.rows, cols: data.cols,
      cells: JSON.parse(JSON.stringify(data.cells)),
      words: JSON.parse(JSON.stringify(data.words)),
      gaps: JSON.parse(JSON.stringify(data.gaps || [])),
      stats: JSON.parse(JSON.stringify(data.stats || {})),
      wordCounter: maxNum + 1,
      selectedCellId: null,
      nextIndex: index,
      isEditingExisting: true
    });

    document.getElementById("setup-panel").classList.add("hidden");
    document.getElementById("library-panel").classList.add("hidden");
    document.getElementById("report-panel").classList.add("hidden");
    document.getElementById("studio-workspace").classList.remove("hidden");
    document.getElementById("generation-panel").classList.add("hidden");
    renderGrid();
    renderGapPanel();
    document.getElementById("save-target-label").textContent =
      `${level} / ${direction} — slot #${index} üzerine kaydedilecek (düzenleniyor)`;
    initResizePanel();
  } catch (err) {
    console.error(err);
    alert("Bulmaca yüklenirken hata oluştu.");
  }
}

refreshLibraryList();

// ================================================================
// OYUNCU RAPORLARI / MODERASYON KUYRUĞU
// ================================================================
const reportQueueList = document.getElementById("report-queue-list");
const reportQueueCount = document.getElementById("report-queue-count");

Reports.watchOpenGroups(renderReportQueue, error => {
  console.error("Rapor kuyruğu okunamadı:", error);
  reportQueueList.innerHTML = "";
  const message = document.createElement("p");
  message.className = "sub";
  message.textContent = "Raporlar okunamadı. Firebase kurallarını ve bağlantıyı kontrol et.";
  reportQueueList.appendChild(message);
});

function renderReportQueue(groups) {
  const totalReports = groups.reduce((sum, group) => sum + group.reports.length, 0);
  reportQueueCount.textContent = String(totalReports);
  reportQueueList.innerHTML = "";

  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "sub";
    empty.textContent = "Açık oyuncu raporu yok.";
    reportQueueList.appendChild(empty);
    return;
  }

  groups.forEach(group => {
    const card = document.createElement("article");
    card.className = "report-group";

    const head = document.createElement("div");
    head.className = "report-group-head";
    const word = document.createElement("div");
    word.className = "report-group-word";
    word.textContent = `${group.clue || "—"} → ${group.answer || "—"}`;
    const count = document.createElement("span");
    count.className = "report-count-badge";
    count.textContent = String(group.reports.length);
    head.append(word, count);

    const meta = document.createElement("p");
    meta.className = "report-group-meta";
    meta.textContent = `${group.puzzleId} · ${group.wordId}` +
      (group.bankEntryKey ? ` · Havuz: ${group.bankEntryKey}` : "");

    const reasons = document.createElement("ul");
    reasons.className = "report-reasons";
    group.reports.forEach(report => {
      const item = document.createElement("li");
      const reason = Reports.REASONS[report.reason] || "Diğer";
      item.textContent = `${reason} — ${report.playerName || "Oyuncu"}` +
        (report.details ? `: ${report.details}` : "");
      reasons.appendChild(item);
    });

    const actions = document.createElement("div");
    actions.className = "report-group-actions";
    const openBtn = makeReportAction("Bulmacayı Aç", "report-open-btn", async () => {
      const parsed = parsePuzzleId(group.puzzleId);
      if (!parsed) return;
      await loadPuzzleForEditing(parsed.level, parsed.direction, parsed.index);
    });
    const resolveBtn = makeReportAction("İncelendi", "report-resolve-btn", () =>
      moderateReportCard(group, "resolved", card)
    );
    const blockBtn = group.bankEntryKey
      ? makeReportAction("Hatalı: Havuzdan Çıkar", "report-block-btn", () =>
          blockReportedBankEntry(group, card)
        )
      : null;
    const dismissBtn = makeReportAction("Geçersiz Say", "report-dismiss-btn", () =>
      moderateReportCard(group, "dismissed", card)
    );
    actions.append(openBtn);
    if (blockBtn) actions.append(blockBtn);
    actions.append(resolveBtn, dismissBtn);
    card.append(head, meta, reasons, actions);
    reportQueueList.appendChild(card);
  });
}

function makeReportAction(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

async function moderateReportCard(group, status, card) {
  const buttons = card.querySelectorAll("button");
  buttons.forEach(button => { button.disabled = true; });
  try {
    await Reports.moderateGroup(group, status);
  } catch (error) {
    console.error("Rapor güncellenemedi:", error);
    alert("Rapor durumu güncellenemedi.");
    buttons.forEach(button => { button.disabled = false; });
  }
}

async function blockReportedBankEntry(group, card) {
  if (!confirm(`${group.answer} kelimesi gelecekteki otomatik bulmacalardan çıkarılsın mı?`)) return;
  const buttons = card.querySelectorAll("button");
  buttons.forEach(button => { button.disabled = true; });
  try {
    await Reports.blockBankEntry(group);
  } catch (error) {
    console.error("Kelime havuzdan çıkarılamadı:", error);
    alert(error.message || "Kelime havuzdan çıkarılamadı.");
    buttons.forEach(button => { button.disabled = false; });
  }
}

// ================================================================
// YARDIMCI: HÜCRE KOORDİNATLARI
// ================================================================
function parseCellId(cellId) {
  const m = cellId.match(/^r(\d+)c(\d+)$/);
  return { r: parseInt(m[1], 10), c: parseInt(m[2], 10) };
}
function makeCellId(r, c) { return `r${r}c${c}`; }

/** Bir ipucunun yönüne göre cevabın kapladığı hücreleri sırayla döner, sınır dışına taşarsa null */
function computePath(originCellId, direction, length) {
  const { r, c } = parseCellId(originCellId);
  let startR, startC, dr, dc;
  if (direction === "right") { startR = r; startC = c + 1; dr = 0; dc = 1; }
  else if (direction === "down") { startR = r + 1; startC = c; dr = 1; dc = 0; }
  else if (direction === "down-right") { startR = r + 1; startC = c; dr = 0; dc = 1; }
  else if (direction === "right-down") { startR = r; startC = c + 1; dr = 1; dc = 0; }
  else return null;

  const path = [];
  for (let i = 0; i < length; i++) {
    const rr = startR + dr * i;
    const cc = startC + dc * i;
    if (rr < 0 || rr >= state.rows || cc < 0 || cc >= state.cols) return null;
    path.push(makeCellId(rr, cc));
  }
  return path;
}

/** O hücrede (varsa) hangi harfin olduğunu, excludeWordId hariç diğer kelimelerden bulur */
function getLetterAt(cellId, excludeWordId) {
  const cd = state.cells[cellId];
  if (!cd || cd.type !== "letter") return null;
  for (const wid of cd.wordIds) {
    if (wid === excludeWordId) continue;
    const w = state.words[wid];
    if (!w) continue;
    const idx = w.cells.indexOf(cellId);
    if (idx !== -1) return w.answer[idx];
  }
  return null;
}

/** @returns {string|null} hata mesajı, sorun yoksa null */
function validatePlacement(originCellId, path, answer) {
  const originCell = state.cells[originCellId];
  if (originCell && originCell.type === "letter") {
    return "Bu hücre zaten başka bir kelimenin harfini taşıyor, ipucu kutusu olamaz.";
  }
  for (let i = 0; i < path.length; i++) {
    const cid = path[i];
    const existing = state.cells[cid];
    if (existing && existing.type === "clue") {
      return `Cevap yolu bir ipucu kutusunun üzerinden geçiyor (${cid}).`;
    }
    if (existing && existing.type === "letter") {
      const letter = getLetterAt(cid, null);
      if (letter && letter !== answer[i]) {
        return `Çakışma: ${cid} hücresinde "${letter}" harfi var, cevabın orada "${answer[i]}" istiyor.`;
      }
    }
  }
  return null;
}

/** Bir kelimeyi tamamen kaldırır (düzenleme veya silme öncesi kullanılır) */
function removeWord(wordId) {
  const w = state.words[wordId];
  if (!w) return;
  w.cells.forEach(cid => {
    const cd = state.cells[cid];
    if (!cd) return;
    cd.wordIds = cd.wordIds.filter(id => id !== wordId);
    if (cd.wordIds.length === 0 && (!Array.isArray(cd.gapIds) || cd.gapIds.length === 0)) {
      delete state.cells[cid];
    }
  });
  const clueCell = state.cells[w.clueCell];
  if (clueCell && clueCell.type === "clue") {
    clueCell.clues = clueCell.clues.filter(cl => cl.wordId !== wordId);
    if (clueCell.clues.length === 0 && (!Array.isArray(clueCell.pendingGaps) || clueCell.pendingGaps.length === 0)) {
      delete state.cells[w.clueCell];
    }
  }
  delete state.words[wordId];
}

function refreshGapPatterns() {
  for (const gap of state.gaps || []) {
    const patternLetters = gap.cells.map(cellId => getLetterAt(cellId, null) || "?");
    gap.pattern = patternLetters.join("");
    gap.suggestions = (gap.suggestions || []).filter(suggestion => {
      const letters = Array.from(suggestion.answer || "");
      return letters.length === gap.length && patternLetters.every((letter, index) =>
        letter === "?" || letter === letters[index]
      );
    });
    gap.clueOptions = gap.suggestions.map(suggestion => suggestion.clue);
  }
}

function refreshEditorialState() {
  refreshGapPatterns();
  const editorial = FullGridGenerator.deriveEditorialStats({ cells: state.cells, words: state.words });
  const unresolved = new Set();
  for (const gap of state.gaps || []) {
    gap.cells.forEach((cellId, index) => {
      if (Array.from(gap.pattern || "")[index] === "?") unresolved.add(cellId);
    });
  }
  state.stats = {
    ...(state.stats || {}),
    ...editorial,
    gapCount: (state.gaps || []).length,
    unresolvedCellCount: unresolved.size
  };
}

function removeGapMetadata(gapId) {
  const gap = (state.gaps || []).find(item => item.id === gapId);
  if (!gap) return;
  state.gaps = state.gaps.filter(item => item.id !== gapId);
  for (const cellId of gap.cells) {
    const cell = state.cells[cellId];
    if (!cell || !Array.isArray(cell.gapIds)) continue;
    cell.gapIds = cell.gapIds.filter(id => id !== gapId);
    if (cell.gapIds.length === 0) delete cell.gapIds;
  }
  const clueCell = state.cells[gap.clueCell];
  if (clueCell && Array.isArray(clueCell.pendingGaps)) {
    clueCell.pendingGaps = clueCell.pendingGaps.filter(item => item.gapId !== gapId);
    if (clueCell.pendingGaps.length === 0) delete clueCell.pendingGaps;
  }
  if (state.highlightedGapId === gapId) state.highlightedGapId = null;
  refreshEditorialState();
}

function matchingGap(originCellId, direction, path) {
  return (state.gaps || []).find(gap =>
    gap.clueCell === originCellId && gap.arrow === direction &&
    gap.cells.length === path.length && gap.cells.every((cellId, index) => cellId === path[index])
  );
}

/** @returns {string|null} hata mesajı, başarılıysa null */
function saveClueSlot(originCellId, { direction, text, answerRaw, metadata }, existingWordId) {
  if (!direction) return "Bir yön seç.";
  if (!text || !text.trim()) return "İpucu metni gir.";
  const answer = TextUtils.upper((answerRaw || "").trim(), state.targetLang);
  if (!/^[A-ZÇĞİIÖŞÜ]+$/.test(answer)) return "Cevap sadece harflerden oluşmalı, boşluk/rakam olmadan.";

  if (Object.entries(state.words).some(([wordId, word]) => wordId !== existingWordId && word.answer === answer)) {
    return "Bu cevap bulmacada zaten kullanılıyor.";
  }

  const path = computePath(originCellId, direction, Array.from(answer).length);
  if (!path) return "Cevap grid sınırlarının dışına taşıyor.";
  const resolvedGap = matchingGap(originCellId, direction, path);

  const currentClues = state.cells[originCellId]?.type === "clue"
    ? state.cells[originCellId].clues
    : [];
  const pendingGaps = state.cells[originCellId]?.type === "clue" && Array.isArray(state.cells[originCellId].pendingGaps)
    ? state.cells[originCellId].pendingGaps.filter(item => item.gapId !== resolvedGap?.id)
    : [];
  const otherClues = currentClues.filter(clue => clue.wordId !== existingWordId);
  if (otherClues.length + pendingGaps.length >= 2) return "Bu hücrede zaten 2 ipucu/boşluk var.";
  const exitEdge = PuzzleRender.arrowExitEdge(direction);
  if ([...otherClues, ...pendingGaps].some(clue => PuzzleRender.arrowExitEdge(clue.arrow) === exitEdge)) {
    return exitEdge === "right"
      ? "Bu kutunun sağ kenarında zaten bir ok var. İkinci cevap alt kenardan başlamalı."
      : "Bu kutunun alt kenarında zaten bir ok var. İkinci cevap sağ kenardan başlamalı.";
  }

  if (existingWordId) removeWord(existingWordId);

  const err = validatePlacement(originCellId, path, answer);
  if (err) return err;

  const wordId = existingWordId || `w${state.wordCounter++}`;

  path.forEach(cid => {
    if (!state.cells[cid]) state.cells[cid] = { type: "letter", wordIds: [] };
    if (!state.cells[cid].wordIds.includes(wordId)) state.cells[cid].wordIds.push(wordId);
  });

  if (!state.cells[originCellId] || state.cells[originCellId].type !== "clue") {
    state.cells[originCellId] = { type: "clue", clues: [] };
  }
  if (state.cells[originCellId].clues.length >= 2) return "Bu hücrede zaten 2 ipucu var.";
  state.cells[originCellId].clues.push({ text: text.trim(), arrow: direction, wordId });
  state.cells[originCellId].clues = PuzzleRender.orderClues(state.cells[originCellId].clues);

  state.words[wordId] = {
    answer,
    cells: path,
    clueCell: originCellId,
    sourceKind: metadata?.sourceKind || "core",
    ...(metadata?.bankEntryKey ? { bankEntryKey: metadata.bankEntryKey } : {}),
    ...(metadata?.reviewStatus ? { reviewStatus: metadata.reviewStatus } : {}),
    ...(metadata?.category ? { fillerCategory: metadata.category } : {})
  };

  if (resolvedGap) removeGapMetadata(resolvedGap.id);
  else refreshEditorialState();

  renderGrid();
  renderGapPanel();
  renderEditorFor(originCellId);
  updateSaveTargetLabel();
  return null;
}

function deleteClueSlot(originCellId, wordId) {
  removeWord(wordId);
  refreshEditorialState();
  renderGrid();
  renderGapPanel();
  renderEditorFor(originCellId);
  updateSaveTargetLabel();
}

// ================================================================
// GRID ÇİZİMİ
// ================================================================
function renderGapPanel() {
  const panel = document.getElementById("gap-panel");
  const list = document.getElementById("gap-list");
  const gaps = state && Array.isArray(state.gaps) ? state.gaps : [];
  document.getElementById("gap-count-badge").textContent = String(gaps.length);
  panel.classList.toggle("hidden", gaps.length === 0);
  list.innerHTML = "";

  for (const gap of gaps) {
    const item = document.createElement("div");
    item.className = "gap-item";

    const head = document.createElement("div");
    head.className = "gap-item-head";
    const label = document.createElement("span");
    label.textContent = `${gap.orientation === "vertical" ? "Dikey" : gap.orientation === "horizontal" ? "Yatay" : "Tek harf"} · ${gap.length} harf`;
    const pattern = document.createElement("span");
    pattern.className = "gap-pattern";
    pattern.textContent = gap.pattern;
    head.append(label, pattern);

    const select = document.createElement("select");
    select.className = "gap-select";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = gap.suggestions.length ? "Öneri seç veya elle yaz" : "Uygun otomatik öneri yok — elle yaz";
    select.appendChild(placeholder);
    gap.suggestions.forEach((suggestion, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      const qualityLabel = suggestion.quality === 0 ? "doğal" : suggestion.quality === 1
        ? "alfabe" : suggestion.quality === 2 ? "element" : "son çare";
      option.textContent = `${suggestion.answer} — ${suggestion.clue} (${qualityLabel})`;
      select.appendChild(option);
    });

    const answerInput = document.createElement("input");
    answerInput.className = "gap-manual-input answer-input";
    answerInput.placeholder = `Cevap (${gap.length} harf)`;
    const clueInput = document.createElement("input");
    clueInput.className = "gap-manual-input";
    clueInput.placeholder = "İpucu";
    select.addEventListener("change", () => {
      const suggestion = gap.suggestions[Number(select.value)];
      if (!suggestion) return;
      answerInput.value = suggestion.answer;
      clueInput.value = suggestion.clue;
    });

    const actions = document.createElement("div");
    actions.className = "gap-actions";
    const goButton = document.createElement("button");
    goButton.className = "gap-goto-btn";
    goButton.textContent = "Gridde göster";
    goButton.addEventListener("click", () => {
      state.highlightedGapId = gap.id;
      state.selectedCellId = gap.clueCell;
      renderGrid();
      renderEditorFor(gap.clueCell);
      document.querySelector(`[data-cell-id="${gap.clueCell}"]`)?.scrollIntoView({ block: "center", inline: "center" });
    });
    const resolveButton = document.createElement("button");
    resolveButton.className = "gap-resolve-btn";
    resolveButton.textContent = "Boşluğu Doldur";
    const error = document.createElement("p");
    error.className = "slot-error";
    resolveButton.addEventListener("click", () => {
      const answer = TextUtils.upper(answerInput.value.trim(), state.targetLang);
      const letters = Array.from(answer);
      const patternLetters = Array.from(gap.pattern || "");
      if (letters.length !== gap.length) {
        error.textContent = `Cevap tam olarak ${gap.length} harf olmalı.`;
        return;
      }
      if (patternLetters.some((letter, index) => letter !== "?" && letter !== letters[index])) {
        error.textContent = `${gap.pattern} kesişim kalıbına uymuyor.`;
        return;
      }
      const suggestion = gap.suggestions.find(item => item.answer === answer && item.clue === clueInput.value.trim());
      const saveError = saveClueSlot(gap.clueCell, {
        direction: gap.arrow,
        text: clueInput.value,
        answerRaw: answer,
        metadata: {
          sourceKind: "filler",
          category: suggestion?.category || "editor-entry",
          bankEntryKey: suggestion?.bankEntryKey,
          reviewStatus: suggestion?.reviewStatus
        }
      }, null);
      if (saveError) error.textContent = saveError;
    });
    actions.append(goButton, resolveButton);
    item.append(head, select, answerInput, clueInput, actions, error);
    list.appendChild(item);
  }
}

function renderGrid() {
  const container = document.getElementById("studio-grid");
  container.style.gridTemplateColumns = `repeat(${state.cols}, 64px)`;
  container.style.gridTemplateRows = `repeat(${state.rows}, 64px)`;
  container.innerHTML = "";
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      container.appendChild(buildAdminCellEl(makeCellId(r, c)));
    }
  }
}

function buildAdminCellEl(cellId) {
  const cellData = state.cells[cellId];
  const el = document.createElement("div");
  el.dataset.cellId = cellId;
  const selected = cellId === state.selectedCellId;

  if (!cellData) {
    el.className = "cell block" + (selected ? " selected" : "");
  } else if (cellData.type === "clue") {
    const pendingClues = (cellData.pendingGaps || []).map(pending => {
      const gap = (state.gaps || []).find(item => item.id === pending.gapId);
      return { text: `? ${gap?.pattern || ""}`, arrow: pending.arrow, gapId: pending.gapId, pending: true };
    });
    const visualClues = [...cellData.clues, ...pendingClues];
    el.className = "cell clue" + (visualClues.length > 1 ? " two-clues" : "") + (selected ? " selected" : "");
    const clues = PuzzleRender.orderClues(visualClues);
    const totalLines = clues.length;
    clues.forEach((clue, lineIndex) => {
      const line = document.createElement("div");
      line.className = "clue-line";
      if (clue.pending) line.classList.add("gap-clue-line");
      const text = document.createElement("span");
      text.className = "clue-text";
      text.textContent = clue.text;
      line.appendChild(text);
      el.appendChild(line);

      const arrow = document.createElement("span");
      arrow.className = `arrow arrow-${clue.arrow}`;
      arrow.innerHTML = PuzzleRender.ARROW_SVG[clue.arrow] || "";
      Object.assign(arrow.style, PuzzleRender.computeArrowStyle(clue.arrow, lineIndex, totalLines));
      el.appendChild(arrow);
      if (clue.pending) {
        line.addEventListener("click", event => {
          event.stopPropagation();
          state.highlightedGapId = clue.gapId;
          renderGrid();
        });
      }
    });
  } else if (cellData.type === "letter") {
    const hasGap = Array.isArray(cellData.gapIds) && cellData.gapIds.length > 0;
    const focused = hasGap && cellData.gapIds.includes(state.highlightedGapId);
    el.className = "cell letter" + (hasGap ? " gap-pending" : "") +
      (focused ? " gap-focus" : "") + (selected ? " selected" : "");
    const letter = getLetterAt(cellId, null);
    if (letter) el.textContent = letter;
  }

  el.addEventListener("click", () => selectCell(cellId));
  return el;
}

function selectCell(cellId) {
  state.selectedCellId = cellId;
  renderGrid();
  renderEditorFor(cellId);
}

// ================================================================
// SAĞ PANEL — HÜCRE EDİTÖRÜ
// ================================================================
function renderEditorFor(cellId) {
  document.getElementById("editor-title").textContent = `Hücre: ${cellId}`;
  const container = document.getElementById("clue-slots-container");
  container.innerHTML = "";

  const cellData = state.cells[cellId];
  const existingClues = (cellData && cellData.type === "clue") ? cellData.clues : [];

  existingClues.forEach(clue => container.appendChild(buildSlotEditor(cellId, clue)));

  const addBtn = document.getElementById("add-slot-btn");
  if (existingClues.length === 0) {
    container.appendChild(buildSlotEditor(cellId, null));
    addBtn.classList.add("hidden");
  } else if (existingClues.length === 1) {
    addBtn.classList.remove("hidden");
    addBtn.onclick = () => {
      container.appendChild(buildSlotEditor(cellId, null));
      addBtn.classList.add("hidden");
    };
  } else {
    addBtn.classList.add("hidden");
  }
}

function buildSlotEditor(originCellId, clue) {
  const wrap = document.createElement("div");
  wrap.className = "clue-slot-editor";

  const dirPicker = document.createElement("div");
  dirPicker.className = "direction-picker";
  const dirs = [
    ["right", "→", "Sağındaki hücreden sağa"],
    ["down", "↓", "Altındaki hücreden aşağı"],
    ["down-right", "⤷", "Altındaki hücreden sağa"],
    ["right-down", "⤵", "Sağındaki hücreden aşağı"]
  ];
  let selectedDir = clue ? clue.arrow : null;
  dirs.forEach(([key, glyph, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "direction-btn" + (selectedDir === key ? " selected" : "");
    btn.textContent = glyph;
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.addEventListener("click", () => {
      selectedDir = key;
      dirPicker.querySelectorAll(".direction-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
    dirPicker.appendChild(btn);
  });

  const textInput = document.createElement("input");
  textInput.className = "slot-input";
  textInput.placeholder = "İpucu metni";
  textInput.value = clue ? clue.text : "";

  const answerInput = document.createElement("input");
  answerInput.className = "slot-input answer-input";
  answerInput.placeholder = "Cevap";
  answerInput.value = clue && state.words[clue.wordId] ? state.words[clue.wordId].answer : "";

  const actions = document.createElement("div");
  actions.className = "slot-actions";

  const saveBtn = document.createElement("button");
  saveBtn.className = "slot-save-btn";
  saveBtn.textContent = "Kaydet";
  actions.appendChild(saveBtn);

  if (clue) {
    const delBtn = document.createElement("button");
    delBtn.className = "slot-delete-btn";
    delBtn.textContent = "Sil";
    delBtn.addEventListener("click", () => deleteClueSlot(originCellId, clue.wordId));
    actions.appendChild(delBtn);
  }

  const errEl = document.createElement("p");
  errEl.className = "slot-error";

  saveBtn.addEventListener("click", () => {
    errEl.textContent = "";
    const err = saveClueSlot(
      originCellId,
      { direction: selectedDir, text: textInput.value, answerRaw: answerInput.value },
      clue ? clue.wordId : null
    );
    if (err) errEl.textContent = err;
  });

  wrap.appendChild(dirPicker);
  wrap.appendChild(textInput);
  wrap.appendChild(answerInput);
  wrap.appendChild(actions);
  wrap.appendChild(errEl);
  return wrap;
}

// ================================================================
// KAYDETME
// ================================================================
async function updateSaveTargetLabel() {
  const label = document.getElementById("save-target-label");

  if ((state.gaps || []).length > 0) {
    label.textContent = `${state.gaps.length} boşluk kaldı — taslak kaydedilebilir, yayınlanamaz.`;
    return;
  }

  if (state.isEditingExisting) {
    label.textContent = `${state.level} / ${state.direction} — slot #${state.nextIndex} üzerine kaydedilecek (düzenleniyor)`;
    return;
  }

  label.textContent = "Hesaplanıyor...";
  try {
    const used = await getAvailableIndexes(state.level, state.direction);
    let nextIndex = null;
    for (let i = 0; i < PUZZLES_PER_LEVEL; i++) {
      if (!used.includes(i)) { nextIndex = i; break; }
    }
    state.nextIndex = nextIndex;
    label.textContent = nextIndex === null
      ? `${state.level} / ${state.direction}: 20 slot da dolu!`
      : `${state.level} / ${state.direction} — slot #${nextIndex} olarak kaydedilecek`;
  } catch (err) {
    console.error(err);
    label.textContent = "Slot bilgisi okunamadı (bağlantı sorunu olabilir).";
  }
}

function currentPuzzleData() {
  return {
    title: state.title || `${state.level} ${state.direction}`,
    rows: state.rows,
    cols: state.cols,
    cells: state.cells,
    words: state.words,
    gaps: state.gaps || [],
    stats: state.stats || {},
    targetLang: state.targetLang,
    nextIndex: state.nextIndex
  };
}

document.getElementById("save-draft-btn").addEventListener("click", async () => {
  const statusEl = document.getElementById("save-status");
  const button = document.getElementById("save-draft-btn");
  statusEl.textContent = "";
  const puzzleData = currentPuzzleData();
  const validation = AutoPuzzleGenerator.validatePuzzle(puzzleData, { allowGaps: true });
  if (!validation.valid) {
    statusEl.textContent = `Taslak doğrulanamadı: ${validation.errors[0]}`;
    return;
  }
  button.disabled = true;
  button.textContent = "Taslak kaydediliyor...";
  try {
    await savePuzzleDraft(state.level, state.direction, puzzleData);
    state.isDraft = true;
    statusEl.textContent = "Taslak kaydedildi. Oyuncular henüz göremez.";
    statusEl.className = "success-text";
  } catch (error) {
    statusEl.textContent = "Taslak kaydedilemedi: " + (error.message || "bilinmeyen hata");
    statusEl.className = "error-text";
  } finally {
    button.disabled = false;
    button.textContent = "Taslağı Kaydet";
  }
});

document.getElementById("save-puzzle-btn").addEventListener("click", async () => {
  const statusEl = document.getElementById("save-status");
  const btn = document.getElementById("save-puzzle-btn");
  statusEl.textContent = "";
  statusEl.className = "error-text";

  if ((state.gaps || []).length > 0) {
    statusEl.textContent = `${state.gaps.length} boşluk tamamlanmadan bulmaca yayınlanamaz.`;
    return;
  }

  if (state.nextIndex === null) {
    statusEl.textContent = "Kaydedilemiyor: bu seviye/yön için 20 slot da dolu.";
    return;
  }
  if (Object.keys(state.words).length === 0) {
    statusEl.textContent = "En az bir ipucu eklemeden kaydedemezsin.";
    return;
  }

  const puzzleData = currentPuzzleData();
  const validation = AutoPuzzleGenerator.validatePuzzle(puzzleData);
  if (!validation.valid) {
    statusEl.textContent = `Yayın doğrulaması başarısız: ${validation.errors[0]}`;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Yayınlanıyor...";
  try {
    await savePuzzleToLibrary(state.level, state.direction, state.nextIndex, puzzleData);
    await deletePuzzleDraft(state.level, state.direction);
    state.isDraft = false;
    statusEl.textContent = "Yayınlandı! ✓";
    statusEl.className = "success-text";
    await updateSaveTargetLabel();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Kaydedilemedi: " + (err.message || "bilinmeyen hata");
  } finally {
    btn.disabled = false;
    btn.textContent = "Yayınla";
  }
});

// ================================================================
// GRID BOYUTUNU DEĞİŞTİRME
// ================================================================
function initResizePanel() {
  document.getElementById("resize-rows-input").value = state.rows;
  document.getElementById("resize-cols-input").value = state.cols;
  document.getElementById("resize-error").textContent = "";
}

/** Yeni boyutta sınır dışında kalacak kelimelerin ipucu metinlerini döner (boşsa güvenli demektir) */
function findClueTextsOutOfBounds(newRows, newCols) {
  const texts = [];
  Object.entries(state.words).forEach(([wordId, w]) => {
    const clueRC = parseCellId(w.clueCell);
    const clueOutOfBounds = clueRC.r >= newRows || clueRC.c >= newCols;
    const lettersOutOfBounds = w.cells.some(cellId => {
      const { r, c } = parseCellId(cellId);
      return r >= newRows || c >= newCols;
    });
    if (clueOutOfBounds || lettersOutOfBounds) {
      const clueCellData = state.cells[w.clueCell];
      const clue = clueCellData && clueCellData.clues.find(cl => cl.wordId === wordId);
      texts.push(clue ? clue.text : wordId);
    }
  });
  (state.gaps || []).forEach(gap => {
    const affected = [gap.clueCell, ...gap.cells].some(cellId => {
      const { r, c } = parseCellId(cellId);
      return r >= newRows || c >= newCols;
    });
    if (affected) texts.push(`boşluk ${gap.pattern}`);
  });
  return texts;
}

document.getElementById("resize-grid-btn").addEventListener("click", () => {
  const errEl = document.getElementById("resize-error");
  errEl.textContent = "";

  const newRows = parseInt(document.getElementById("resize-rows-input").value, 10);
  const newCols = parseInt(document.getElementById("resize-cols-input").value, 10);

  if (!newRows || !newCols || newRows < 2 || newCols < 2 || newRows > 30 || newCols > 30) {
    errEl.textContent = "Satır/sütun 2 ile 30 arasında olmalı.";
    return;
  }

  if (newRows === state.rows && newCols === state.cols) {
    return; // değişiklik yok
  }

  // Büyütme her zaman güvenli. Küçültme sadece hiçbir ipucu sınır dışında
  // kalmıyorsa uygulanır.
  const shrinking = newRows < state.rows || newCols < state.cols;
  if (shrinking) {
    const affected = findClueTextsOutOfBounds(newRows, newCols);
    if (affected.length > 0) {
      const preview = affected.slice(0, 4).join(", ") + (affected.length > 4 ? ` ve ${affected.length - 4} tane daha` : "");
      errEl.textContent = `Bu boyuta küçültülemez — sınır dışında kalacak ipucular var: ${preview}. Önce onları sil.`;
      return;
    }
  }

  state.rows = newRows;
  state.cols = newCols;
  renderGrid();
});

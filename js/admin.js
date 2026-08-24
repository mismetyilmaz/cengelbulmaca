/**
 * ADMIN.js
 * ------------------------------------------------------------------
 * Bulmaca Stüdyosu: satır/sütun seçip boş bir grid oluşturur, sonra
 * hücre hücre tıklayarak ipucu + cevap + yön eklenir. Her hücrede en
 * fazla 2 ipucu olabilir. Bitince Firebase'e (puzzles/{level}/{direction}/{index})
 * kaydedilir — index.html oradan okuyup oynatır.
 */

let state = null; // { level, direction, targetLang, title, rows, cols, cells, words, wordCounter, selectedCellId, nextIndex }

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

document.getElementById("create-grid-btn").addEventListener("click", () => {
  const setupError = document.getElementById("setup-error");
  setupError.textContent = "";

  const level = document.getElementById("studio-level-options").querySelector(".selected").dataset.level;
  const direction = document.getElementById("studio-direction-options").querySelector(".selected").dataset.direction;
  const title = document.getElementById("studio-title-input").value.trim();
  const rows = parseInt(document.getElementById("studio-rows-input").value, 10);
  const cols = parseInt(document.getElementById("studio-cols-input").value, 10);

  if (!rows || !cols || rows < 2 || cols < 2 || rows > 30 || cols > 30) {
    setupError.textContent = "Satır/sütun 2 ile 30 arasında olmalı.";
    return;
  }

  state = {
    level, direction,
    targetLang: direction === "tr_en" ? "en" : "tr",
    title, rows, cols,
    cells: {}, words: {}, wordCounter: 0,
    selectedCellId: null, nextIndex: null
  };

  document.getElementById("setup-panel").classList.add("hidden");
  document.getElementById("library-panel").classList.add("hidden");
  document.getElementById("studio-workspace").classList.remove("hidden");
  state.isEditingExisting = false;
  renderGrid();
  updateSaveTargetLabel();
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

    state = {
      level, direction,
      targetLang: data.targetLang,
      title: data.title,
      rows: data.rows, cols: data.cols,
      cells: JSON.parse(JSON.stringify(data.cells)),
      words: JSON.parse(JSON.stringify(data.words)),
      wordCounter: maxNum + 1,
      selectedCellId: null,
      nextIndex: index,
      isEditingExisting: true
    };

    document.getElementById("setup-panel").classList.add("hidden");
    document.getElementById("library-panel").classList.add("hidden");
    document.getElementById("studio-workspace").classList.remove("hidden");
    renderGrid();
    document.getElementById("save-target-label").textContent =
      `${level} / ${direction} — slot #${index} üzerine kaydedilecek (düzenleniyor)`;
  } catch (err) {
    console.error(err);
    alert("Bulmaca yüklenirken hata oluştu.");
  }
}

refreshLibraryList();

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
    if (cd.wordIds.length === 0) delete state.cells[cid];
  });
  const clueCell = state.cells[w.clueCell];
  if (clueCell && clueCell.type === "clue") {
    clueCell.clues = clueCell.clues.filter(cl => cl.wordId !== wordId);
    if (clueCell.clues.length === 0) delete state.cells[w.clueCell];
  }
  delete state.words[wordId];
}

/** @returns {string|null} hata mesajı, başarılıysa null */
function saveClueSlot(originCellId, { direction, text, answerRaw }, existingWordId) {
  if (!direction) return "Bir yön seç.";
  if (!text || !text.trim()) return "İpucu metni gir.";
  const answer = TextUtils.upper((answerRaw || "").trim(), state.targetLang);
  if (!/^[A-ZÇĞİIÖŞÜ]+$/.test(answer)) return "Cevap sadece harflerden oluşmalı, boşluk/rakam olmadan.";

  if (existingWordId) removeWord(existingWordId);

  const path = computePath(originCellId, direction, answer.length);
  if (!path) return "Cevap grid sınırlarının dışına taşıyor.";

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

  state.words[wordId] = { answer, cells: path, clueCell: originCellId };

  renderGrid();
  renderEditorFor(originCellId);
  return null;
}

function deleteClueSlot(originCellId, wordId) {
  removeWord(wordId);
  renderGrid();
  renderEditorFor(originCellId);
}

// ================================================================
// GRID ÇİZİMİ
// ================================================================
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
    el.className = "cell clue" + (cellData.clues.length > 1 ? " two-clues" : "") + (selected ? " selected" : "");
    cellData.clues.forEach(clue => {
      const line = document.createElement("div");
      line.className = "clue-line";
      const text = document.createElement("span");
      text.className = "clue-text";
      text.textContent = clue.text;
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = PuzzleRender.ARROW_GLYPH[clue.arrow] || "?";
      line.appendChild(text);
      line.appendChild(arrow);
      el.appendChild(line);
    });
  } else if (cellData.type === "letter") {
    el.className = "cell letter" + (selected ? " selected" : "");
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
  const dirs = [["right", "→"], ["down", "↓"], ["down-right", "⤷"], ["right-down", "⤵"]];
  let selectedDir = clue ? clue.arrow : null;
  dirs.forEach(([key, glyph]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "direction-btn" + (selectedDir === key ? " selected" : "");
    btn.textContent = glyph;
    btn.title = key;
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

document.getElementById("save-puzzle-btn").addEventListener("click", async () => {
  const statusEl = document.getElementById("save-status");
  const btn = document.getElementById("save-puzzle-btn");
  statusEl.textContent = "";
  statusEl.className = "error-text";

  if (state.nextIndex === null) {
    statusEl.textContent = "Kaydedilemiyor: bu seviye/yön için 20 slot da dolu.";
    return;
  }
  if (Object.keys(state.words).length === 0) {
    statusEl.textContent = "En az bir ipucu eklemeden kaydedemezsin.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Kaydediliyor...";
  try {
    const puzzleData = {
      title: state.title || `${state.level} ${state.direction} #${state.nextIndex + 1}`,
      rows: state.rows,
      cols: state.cols,
      cells: state.cells,
      words: state.words,
      targetLang: state.targetLang
    };
    await savePuzzleToLibrary(state.level, state.direction, state.nextIndex, puzzleData);
    statusEl.textContent = "Kaydedildi! ✓";
    statusEl.className = "success-text";
    await updateSaveTargetLabel();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Kaydedilemedi: " + (err.message || "bilinmeyen hata");
  } finally {
    btn.disabled = false;
    btn.textContent = "Kaydet";
  }
});

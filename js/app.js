/**
 * APP.js
 * ------------------------------------------------------------------
 * Akış:
 *
 *  URL'de ?room YOK  -> Oda Kurulum Ekranı (boyut / dil / max oyuncu / parola
 *                        seçilir) -> "Oda Oluştur" -> oda Firebase'e yazılır,
 *                        URL güncellenir -> İsim Ekranı (kurucu olarak,
 *                        parola sorulmadan, link paylaşım banner'ıyla)
 *
 *  URL'de ?room VAR   -> oda config'i Firebase'den okunur
 *                        -> bulunamazsa hata + "yeni oda kur" linki
 *                        -> bulunursa İsim Ekranı (parola varsa parola
 *                           alanı da gösterilir)
 */

(function () {
  // ---------- Ortak elementler ----------
  const connStatus = document.getElementById("conn-status");
  const connStatusText = document.getElementById("conn-status-text");

  const setupGate = document.getElementById("setup-gate");
  const directionOptions = document.getElementById("direction-options");
  const levelOptions = document.getElementById("level-options");
  const maxPlayersSelect = document.getElementById("max-players-select");
  const usePasswordCheck = document.getElementById("use-password-check");
  const setupPasswordInput = document.getElementById("setup-password-input");
  const createRoomBtn = document.getElementById("create-room-btn");
  const setupError = document.getElementById("setup-error");

  const nameGate = document.getElementById("name-gate");
  const nameGateEyebrow = document.getElementById("name-gate-eyebrow");
  const roomShareBanner = document.getElementById("room-share-banner");
  const shareLinkInput = document.getElementById("share-link-input");
  const setupCopyBtn = document.getElementById("setup-copy-btn");
  const nameInput = document.getElementById("name-input");
  const joinPasswordInput = document.getElementById("join-password-input");
  const joinBtn = document.getElementById("join-btn");
  const nameError = document.getElementById("name-error");

  const gameRoot = document.getElementById("game-root");
  const roomLabel = document.getElementById("room-label");
  const shareBtn = document.getElementById("share-btn");
  const playerNameLabel = document.getElementById("player-name-label");

  const puzzleGridEl = document.getElementById("puzzle-grid");
  const scoreboardList = document.getElementById("scoreboard-list");
  const progressFill = document.getElementById("progress-fill");
  const progressLabel = document.getElementById("progress-label");

  const popover = document.getElementById("answer-popover");
  const answerClueText = document.getElementById("answer-clue-text");
  const answerBoxes = document.getElementById("answer-boxes");
  const answerSubmit = document.getElementById("answer-submit");
  const answerCancel = document.getElementById("answer-cancel");
  const answerFeedback = document.getElementById("answer-feedback");

  let activeWordId = null;
  let roomId = null;
  let roomConfig = null;
  let isCreator = false;

  // ---------- Bağlantı durumu ----------
  Room.watchConnection(connected => {
    connStatus.classList.remove("conn-unknown", "conn-ok", "conn-bad");
    if (connected) {
      connStatus.classList.add("conn-ok");
      connStatusText.textContent = "Bağlı";
    } else {
      connStatus.classList.add("conn-bad");
      connStatusText.textContent = "Bağlantı yok";
    }
  });

  // ---------- Oyuncu kimliği (cihazda kalıcı) ----------
  const playerId = getOrCreatePlayerId();
  const savedName = localStorage.getItem("cb_playerName");
  if (savedName) nameInput.value = savedName;

  function getOrCreatePlayerId() {
    let id = localStorage.getItem("cb_playerId");
    if (!id) {
      id = "p_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("cb_playerId", id);
    }
    return id;
  }

  // ================================================================
  // BAŞLANGIÇ: room var mı yok mu bak
  // ================================================================
  const params = new URLSearchParams(window.location.search);
  roomId = params.get("room");

  if (!roomId) {
    showSetupGate();
  } else {
    loadExistingRoom(roomId);
  }

  // ================================================================
  // ODA KURULUM EKRANI
  // ================================================================
  function showSetupGate() {
    setupGate.classList.remove("hidden");
  }

  wireOptionGroup(directionOptions, "direction");
  wireOptionGroup(levelOptions, "level");

  function wireOptionGroup(container, attr) {
    container.querySelectorAll(".option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
  }

  usePasswordCheck.addEventListener("change", () => {
    setupPasswordInput.classList.toggle("hidden", !usePasswordCheck.checked);
    if (!usePasswordCheck.checked) setupPasswordInput.value = "";
  });

  createRoomBtn.addEventListener("click", async () => {
    setupError.textContent = "";
    const direction = directionOptions.querySelector(".selected").dataset.direction;
    const level = levelOptions.querySelector(".selected").dataset.level;
    const maxPlayers = parseInt(maxPlayersSelect.value, 10);
    const password = usePasswordCheck.checked ? setupPasswordInput.value.trim() : "";

    if (usePasswordCheck.checked && password.length < 3) {
      setupError.textContent = "Parola en az 3 karakter olmalı.";
      return;
    }

    const puzzleId = await pickRandomPuzzleId(level, direction);
    if (!puzzleId) {
      setupError.textContent = "Bu seviye ve yön için henüz bulmaca eklenmedi. Başka bir seviye/yön dene.";
      return;
    }

    createRoomBtn.disabled = true;
    createRoomBtn.textContent = "Oluşturuluyor...";
    try {
      roomId = await Room.createRoom({ puzzleId, maxPlayers, password, level, direction });
      roomConfig = { puzzleId, maxPlayers, password, level, direction };
      isCreator = true;

      params.set("room", roomId);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);

      setupGate.classList.add("hidden");
      showNameGate({ showPassword: false, showShareBanner: true });
    } catch (err) {
      console.error(err);
      setupError.textContent = "Oda oluşturulamadı. Firebase ayarlarını kontrol et (konsolda detay var).";
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = "Oda Oluştur";
    }
  });

  // ================================================================
  // VAR OLAN ODAYA KATILMA
  // ================================================================
  async function loadExistingRoom(id) {
    nameGate.classList.remove("hidden");
    nameGateEyebrow.textContent = "Yükleniyor...";
    nameInput.disabled = true;
    joinBtn.disabled = true;

    try {
      const config = await Room.fetchConfig(id);
      if (!config) {
        nameGateEyebrow.textContent = "Oda bulunamadı";
        nameError.textContent = "Bu link geçersiz olabilir. ";
        const link = document.createElement("a");
        link.href = window.location.pathname;
        link.textContent = "Yeni oda kur";
        link.style.color = "var(--pen-red)";
        nameError.appendChild(link);
        return;
      }
      roomConfig = config;
      nameGateEyebrow.textContent = "Odaya katılıyorsun";
      nameInput.disabled = false;
      joinBtn.disabled = false;
      if (config.password) {
        joinPasswordInput.classList.remove("hidden");
      }
    } catch (err) {
      console.error(err);
      nameGateEyebrow.textContent = "Bağlantı hatası";
      nameError.textContent = "Oda bilgisi okunamadı. İnternet bağlantını ve firebase-config.js ayarlarını kontrol et.";
    }
  }

  // ================================================================
  // İSİM EKRANI
  // ================================================================
  function showNameGate({ showPassword, showShareBanner }) {
    nameGate.classList.remove("hidden");
    joinPasswordInput.classList.toggle("hidden", !showPassword);
    roomShareBanner.classList.toggle("hidden", !showShareBanner);
    if (showShareBanner) {
      shareLinkInput.value = window.location.href;
    }
    nameInput.disabled = false;
    joinBtn.disabled = false;
  }

  setupCopyBtn.addEventListener("click", () => {
    shareLinkInput.select();
    navigator.clipboard.writeText(shareLinkInput.value).then(() => {
      setupCopyBtn.textContent = "Kopyalandı!";
      setTimeout(() => (setupCopyBtn.textContent = "Kopyala"), 1500);
    });
  });

  joinBtn.addEventListener("click", handleJoin);
  nameInput.addEventListener("keydown", e => { if (e.key === "Enter") handleJoin(); });
  joinPasswordInput.addEventListener("keydown", e => { if (e.key === "Enter") handleJoin(); });

  async function handleJoin() {
    nameError.textContent = "";
    const name = nameInput.value.trim();
    if (name.length < 2) {
      nameError.textContent = "Lütfen en az 2 karakterli bir isim gir.";
      return;
    }

    if (!isCreator) {
      joinBtn.disabled = true;
      joinBtn.textContent = "Kontrol ediliyor...";
      try {
        const result = await Room.validateJoin(roomId, roomConfig, {
          playerId,
          password: joinPasswordInput.value.trim()
        });
        if (!result.ok) {
          nameError.textContent = result.reason === "wrong_password"
            ? "Parola yanlış."
            : "Oda dolu, yeni oyuncu alınamıyor.";
          joinBtn.disabled = false;
          joinBtn.textContent = "Bulmacaya Katıl";
          return;
        }
      } catch (err) {
        console.error(err);
        nameError.textContent = "Kontrol sırasında hata oluştu. Tekrar dene.";
        joinBtn.disabled = false;
        joinBtn.textContent = "Bulmacaya Katıl";
        return;
      }
    }

    localStorage.setItem("cb_playerName", name);
    PUZZLE_DATA = await getPuzzleData(roomConfig.puzzleId);
    if (!PUZZLE_DATA) {
      nameError.textContent = "Bulmaca verisi yüklenemedi. js/puzzle-content.js dosyasını kontrol et.";
      joinBtn.disabled = false;
      joinBtn.textContent = "Bulmacaya Katıl";
      return;
    }
    startGame(name);
  }

  function startGame(name) {
    nameGate.classList.add("hidden");
    gameRoot.classList.remove("hidden");
    playerNameLabel.textContent = name;
    const directionLabel = roomConfig.direction === "tr_en" ? "TR→EN" : "EN→TR";
    roomLabel.textContent = `Oda: ${roomId} · ${roomConfig.level} · ${directionLabel}`;

    PuzzleRender.init(puzzleGridEl, handleClueClick);

    Game.init(roomId, playerId, name, {
      onLettersChange: letters => PuzzleRender.paintLetters(letters),
      onWordsChange: () => {
        Object.keys(PUZZLE_DATA.words).forEach(wid => {
          if (Game.isWordSolved(wid)) PuzzleRender.markWordSolved(wid);
        });
        renderProgress();
      },
      onPlayersChange: () => renderScoreboard()
    });
  }

  // ================================================================
  // İPUCUNA TIKLAMA -> CEVAP KUTUSU
  // ================================================================
  function handleClueClick(wordId, clueEl) {
    if (Game.isWordSolved(wordId)) return;

    activeWordId = wordId;
    const word = PUZZLE_DATA.words[wordId];
    const cellData = PUZZLE_DATA.cells[word.clueCell];
    const clue = cellData.clues.find(cl => cl.wordId === wordId);

    answerClueText.textContent = clue ? clue.text : "";
    answerFeedback.textContent = "";
    answerFeedback.className = "answer-feedback";

    buildAnswerBoxes(wordId);
    positionPopover(clueEl);
    popover.classList.remove("hidden");
    PuzzleRender.highlightWordCells(wordId, true);

    const firstEmpty = answerBoxes.querySelector("input:not(.locked)");
    if (firstEmpty) firstEmpty.focus();
  }

  function buildAnswerBoxes(wordId) {
    const word = PUZZLE_DATA.words[wordId];
    const filled = Game.getFilledLettersForWord(wordId);
    answerBoxes.innerHTML = "";

    word.cells.forEach((cellId, i) => {
      const box = document.createElement("input");
      box.className = "answer-box";
      box.maxLength = 1;
      box.dataset.index = i;

      if (filled[cellId]) {
        box.value = filled[cellId];
        box.classList.add("locked");
        box.disabled = true;
      } else {
        box.addEventListener("input", () => {
          box.value = TextUtils.upper(box.value, PUZZLE_DATA.targetLang).slice(-1);
          if (box.value) {
            const next = answerBoxes.children[i + 1];
            if (next && !next.classList.contains("locked")) next.focus();
          }
        });
        box.addEventListener("keydown", e => {
          if (e.key === "Backspace" && !box.value) {
            const prev = answerBoxes.children[i - 1];
            if (prev && !prev.classList.contains("locked")) prev.focus();
          }
          if (e.key === "Enter") submitCurrentAnswer();
        });
      }
      answerBoxes.appendChild(box);
    });
  }

  function positionPopover(anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const popoverWidth = 320;
    let left = rect.left + window.scrollX;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    popover.style.left = `${Math.max(16, left)}px`;
    popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
  }

  answerSubmit.addEventListener("click", submitCurrentAnswer);
  answerCancel.addEventListener("click", closePopover);

  async function submitCurrentAnswer() {
    if (!activeWordId) return;
    const guess = Array.from(answerBoxes.children).map(el => el.value || "").join("");
    const word = PUZZLE_DATA.words[activeWordId];

    if (guess.length < word.answer.length) {
      showFeedback("Tüm harfleri doldur.", false);
      return;
    }

    answerSubmit.disabled = true;
    answerSubmit.textContent = "Kontrol ediliyor...";

    let result;
    try {
      result = await Game.submitAnswer(activeWordId, guess);
    } catch (err) {
      console.error(err);
      result = { correct: true, error: true, errorMessage: "Beklenmeyen bir hata oluştu." };
    }

    answerSubmit.disabled = false;
    answerSubmit.textContent = "Onayla";

    if (result.error) {
      showFeedback(result.errorMessage || "Bağlantı hatası oluştu.", false);
      return;
    }

    if (!result.correct) {
      showFeedback("Yanlış, tekrar dene.", false);
      Array.from(answerBoxes.children).forEach(el => {
        if (!el.classList.contains("locked")) el.value = "";
      });
      const first = answerBoxes.querySelector("input:not(.locked)");
      if (first) first.focus();
      return;
    }

    if (result.alreadySolved) {
      showFeedback("Bu kelimeyi başka biri az önce çözdü.", true);
    } else {
      showFeedback(`Doğru! +${result.points} puan`, true);
    }
    setTimeout(closePopover, 900);
  }

  function showFeedback(text, correct) {
    answerFeedback.textContent = text;
    answerFeedback.className = "answer-feedback " + (correct ? "correct" : "wrong");
  }

  function closePopover() {
    if (activeWordId) PuzzleRender.highlightWordCells(activeWordId, false);
    activeWordId = null;
    popover.classList.add("hidden");
  }

  document.addEventListener("click", e => {
    if (!popover.classList.contains("hidden") &&
        !popover.contains(e.target) &&
        !e.target.closest(".cell.clue")) {
      closePopover();
    }
  });

  // ================================================================
  // SKOR TABLOSU / İLERLEME
  // ================================================================
  function renderScoreboard() {
    const players = Game.getPlayersSorted();
    scoreboardList.innerHTML = "";
    players.forEach((p, i) => {
      const li = document.createElement("li");
      li.className = "score-row" + (p.id === playerId ? " me" : "");
      li.innerHTML = `
        <span class="rank">${i + 1}.</span>
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="points">${p.score}</span>
      `;
      scoreboardList.appendChild(li);
    });
  }

  function renderProgress() {
    const total = Game.getTotalWordCount();
    const solved = Game.getSolvedWordCount();
    const pct = total ? Math.round((solved / total) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressLabel.textContent = `${solved} / ${total} kelime çözüldü`;
  }

  shareBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      shareBtn.textContent = "Kopyalandı!";
      setTimeout(() => (shareBtn.textContent = "Linki Kopyala"), 1500);
    });
  });

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();

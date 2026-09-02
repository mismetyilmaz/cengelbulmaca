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
  const puzzleZoomWrap = document.getElementById("puzzle-zoom-wrap");
  const scoreboardList = document.getElementById("scoreboard-list");
  const progressFill = document.getElementById("progress-fill");
  const progressLabel = document.getElementById("progress-label");

  const popover = document.getElementById("answer-popover");
  const answerClueText = document.getElementById("answer-clue-text");
  const answerBoxes = document.getElementById("answer-boxes");
  const answerActions = popover.querySelector(".answer-actions");
  const answerSubmit = document.getElementById("answer-submit");
  const answerCancel = document.getElementById("answer-cancel");
  const answerFeedback = document.getElementById("answer-feedback");
  const reportWordBtn = document.getElementById("report-word-btn");
  const reportModal = document.getElementById("report-modal");
  const reportWordSummary = document.getElementById("report-word-summary");
  const reportReasonSelect = document.getElementById("report-reason-select");
  const reportDetailsInput = document.getElementById("report-details-input");
  const reportSubmitBtn = document.getElementById("report-submit-btn");
  const reportCancelBtn = document.getElementById("report-cancel-btn");
  const reportStatus = document.getElementById("report-status");

  const chatBubble = document.getElementById("chat-bubble");
  const chatUnreadBadge = document.getElementById("chat-unread-badge");
  const chatPanel = document.getElementById("chat-panel");
  const chatCloseBtn = document.getElementById("chat-close-btn");
  const chatMessagesEl = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");

  let activeWordId = null;
  let roomId = null;
  let roomConfig = null;
  let isCreator = false;
  let reportingWordId = null;

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

  const puzzleSelect = document.getElementById("puzzle-select");
  let puzzleSelectRequestId = 0;

  wireOptionGroup(directionOptions, "direction");
  wireOptionGroup(levelOptions, "level");
  [directionOptions, levelOptions].forEach(group => {
    group.querySelectorAll(".option-btn").forEach(btn => {
      btn.addEventListener("click", refreshPuzzleSelect);
    });
  });
  refreshPuzzleSelect();

  function wireOptionGroup(container, attr) {
    container.querySelectorAll(".option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
  }

  async function refreshPuzzleSelect() {
    const direction = directionOptions.querySelector(".selected").dataset.direction;
    const level = levelOptions.querySelector(".selected").dataset.level;
    const requestId = ++puzzleSelectRequestId;

    puzzleSelect.innerHTML = `<option value="random">🎲 Rastgele seç</option><option value="" disabled>Yükleniyor...</option>`;
    try {
      const puzzles = await listPuzzles(level, direction);
      if (requestId !== puzzleSelectRequestId) return; // bu arada başka bir seviye/yön seçildi, bu cevap artık geçersiz

      puzzleSelect.innerHTML = `<option value="random">🎲 Rastgele seç</option>`;
      puzzles.forEach(p => {
        const opt = document.createElement("option");
        opt.value = String(p.index);
        opt.textContent = `#${p.index} — ${p.title}`;
        puzzleSelect.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      if (requestId !== puzzleSelectRequestId) return;
      puzzleSelect.innerHTML = `<option value="random">🎲 Rastgele seç</option>`;
    }
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

    const puzzleChoice = puzzleSelect.value;
    const puzzleId = puzzleChoice === "random"
      ? await pickRandomPuzzleId(level, direction)
      : `${level}_${direction}_${puzzleChoice}`;
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
    const levelLabel = typeof globalThis.getLevelLabel === "function"
      ? globalThis.getLevelLabel(roomConfig.level)
      : roomConfig.level;
    roomLabel.textContent = `Oda: ${roomId} · ${levelLabel} · ${directionLabel}`;

    PuzzleRender.init(puzzleGridEl, handleClueClick);
    initZoom();

    // YENİ EKLENEN: Otomatik çözülen kelimelerde tekrarlı istek atmayı önlemek için
    const pendingAutoSolves = new Set(); 

    Game.init(roomId, playerId, name, {
      onLettersChange: letters => {
        PuzzleRender.paintLetters(letters, Game.getPlayerColor);
        
        // YENİ EKLENEN BLOK: Bütün harfleri çıkan kelimeleri otomatik onayla
        Object.keys(PUZZLE_DATA.words).forEach(async wordId => {
          // Eğer kelime zaten çözüldüyse veya şu an sunucuya gönderiliyorsa atla
          if (Game.isWordSolved(wordId) || pendingAutoSolves.has(wordId)) return;
          
          const word = PUZZLE_DATA.words[wordId];
          let isComplete = true;
          let currentGuess = "";
          
          // Kelimenin tüm hücreleri grid üzerinde dolu mu diye kontrol et
          for (const cellId of word.cells) {
            if (!letters[cellId] || !letters[cellId].letter) {
              isComplete = false;
              break;
            }
            currentGuess += letters[cellId].letter;
          }
          
          // Eğer kelime tamamen dolmuşsa, oyuncu tıklamadan arka planda cevabı gönder
          if (isComplete && currentGuess.length === word.answer.length) {
            pendingAutoSolves.add(wordId);
            try {
              await Game.submitAnswer(wordId, currentGuess);
            } catch (err) {
              console.error("Otomatik onaylama başarısız:", err);
            } finally {
              pendingAutoSolves.delete(wordId);
            }
          }
        });
      },
      onWordsChange: () => {
        Object.keys(PUZZLE_DATA.words).forEach(wid => {
          if (Game.isWordSolved(wid)) PuzzleRender.markWordSolved(wid);
        });
        renderProgress();
      },
      onPlayersChange: () => renderScoreboard()
    });

    chatBubble.classList.remove("hidden");
    Chat.init(roomId, playerId, name, {
      onMessage: (msg, isNew) => {
        renderChatMessage(msg);
        if (isNew && chatPanel.classList.contains("hidden")) {
          chatUnreadCount++;
          updateChatBadge();
        }
      }
    });
  }

  // ================================================================
  // İPUCUNA TIKLAMA -> CEVAP KUTUSU
  // ================================================================
  function handleClueClick(wordId, clueEl) {
    activeWordId = wordId;
    const word = PUZZLE_DATA.words[wordId];
    const cellData = PUZZLE_DATA.cells[word.clueCell];
    const clue = cellData.clues.find(cl => cl.wordId === wordId);
    const isSolved = Game.isWordSolved(wordId);

    answerClueText.textContent = clue ? clue.text : "";
    answerFeedback.textContent = "";
    answerFeedback.className = "answer-feedback";
    answerBoxes.classList.toggle("hidden", isSolved);
    answerActions.classList.toggle("hidden", isSolved);

    if (!isSolved) buildAnswerBoxes(wordId);
    popover.classList.remove("hidden");
    positionPopover(clueEl);
    PuzzleRender.highlightWordCells(wordId, true);

    if (!isSolved) {
      const firstEmpty = answerBoxes.querySelector("input:not(.locked)");
      if (firstEmpty) firstEmpty.focus();
    }
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
        box.value = filled[cellId].letter;
        box.style.color = Game.getPlayerColor(filled[cellId].playerId);
        box.classList.add("locked");
        box.disabled = true;
      } else {
        box.addEventListener("input", () => {
          box.value = TextUtils.upper(box.value, PUZZLE_DATA.targetLang).slice(-1);
          if (box.value) focusNextEditableBox(i);
        });
        box.addEventListener("keydown", e => {
          if (e.key === "Backspace" && !box.value) {
            focusPrevEditableBox(i);
          }
          if (e.key === "Enter") submitCurrentAnswer();
        });
      }
      answerBoxes.appendChild(box);
    });
  }

  /** Kilitli (kesişimden zaten dolu) kutuları atlayarak bir sonraki boş kutuya odaklanır */
  function focusNextEditableBox(fromIndex) {
    for (let idx = fromIndex + 1; idx < answerBoxes.children.length; idx++) {
      const el = answerBoxes.children[idx];
      if (!el.classList.contains("locked")) { el.focus(); return; }
    }
  }

  /** Kilitli kutuları atlayarak bir önceki boş kutuya odaklanır */
  function focusPrevEditableBox(fromIndex) {
    for (let idx = fromIndex - 1; idx >= 0; idx--) {
      const el = answerBoxes.children[idx];
      if (!el.classList.contains("locked")) { el.focus(); return; }
    }
  }

  function positionPopover(anchorEl) {
    const margin = 12;
    const rect = anchorEl.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth || 320;
    const popoverHeight = popover.offsetHeight || 220;

    // position: fixed olduğu için scrollX/scrollY EKLENMEZ — viewport'a göre konumlanır
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - margin) {
      left = window.innerWidth - popoverWidth - margin;
    }
    if (left < margin) left = margin;

    let top = rect.bottom + 8;
    if (top + popoverHeight > window.innerHeight - margin) {
      // Ekranın altına sığmıyor — ipucunun ÜSTÜNE aç
      top = rect.top - popoverHeight - 8;
    }
    if (top < margin) top = margin;

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
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
  // OYUN İÇİ KELİME / İPUCU RAPORU
  // ================================================================
  reportWordBtn.addEventListener("click", () => {
    if (!activeWordId) return;
    reportingWordId = activeWordId;
    const word = PUZZLE_DATA.words[reportingWordId];
    const clueCell = PUZZLE_DATA.cells[word.clueCell];
    const clue = clueCell.clues.find(item => item.wordId === reportingWordId);
    reportWordSummary.textContent = `İpucu: ${clue ? clue.text : "—"} · Cevap: ${word.answer}`;
    reportReasonSelect.value = "wrong_translation";
    reportDetailsInput.value = "";
    reportStatus.textContent = "";
    reportStatus.className = "answer-feedback";
    closePopover();
    reportModal.classList.remove("hidden");
    reportReasonSelect.focus();
  });

  reportCancelBtn.addEventListener("click", closeReportModal);
  reportModal.addEventListener("click", event => {
    if (event.target === reportModal) closeReportModal();
  });

  reportSubmitBtn.addEventListener("click", async () => {
    if (!reportingWordId) return;
    const word = PUZZLE_DATA.words[reportingWordId];
    const clueCell = PUZZLE_DATA.cells[word.clueCell];
    const clue = clueCell.clues.find(item => item.wordId === reportingWordId);
    reportSubmitBtn.disabled = true;
    reportSubmitBtn.textContent = "Gönderiliyor...";
    reportStatus.textContent = "";
    try {
      await Reports.submit({
        puzzleId: roomConfig.puzzleId,
        wordId: reportingWordId,
        roomId,
        playerId,
        playerName: playerNameLabel.textContent,
        level: roomConfig.level,
        direction: roomConfig.direction,
        clue: clue ? clue.text : "",
        answer: word.answer,
        bankEntryKey: word.bankEntryKey || null,
        reason: reportReasonSelect.value,
        details: reportDetailsInput.value
      });
      reportStatus.textContent = "Raporun alındı. Teşekkürler!";
      reportStatus.className = "answer-feedback correct";
      setTimeout(closeReportModal, 900);
    } catch (err) {
      console.error("Rapor gönderilemedi:", err);
      reportStatus.textContent = err.message || "Rapor gönderilemedi. Tekrar dene.";
      reportStatus.className = "answer-feedback wrong";
    } finally {
      reportSubmitBtn.disabled = false;
      reportSubmitBtn.textContent = "Raporu Gönder";
    }
  });

  function closeReportModal() {
    reportingWordId = null;
    reportModal.classList.add("hidden");
  }

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
        <span class="player-dot" style="background:${p.color}"></span>
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

  // ================================================================
  // ZOOM — mobilde pinch, masaüstünde +/- butonlar
  // ================================================================
  const CELL_PX = 64;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.5;
  let currentZoom = 1;
  let pinchStartDist = null;
  let pinchStartZoom = 1;

  function initZoom() {
    currentZoom = 1;
    applyZoom(1);

    document.getElementById("zoom-in-btn").onclick = () => applyZoom(currentZoom + 0.2);
    document.getElementById("zoom-out-btn").onclick = () => applyZoom(currentZoom - 0.2);
    document.getElementById("zoom-reset-btn").onclick = () => applyZoom(1);

    puzzleZoomWrap.ontouchstart = e => {
      if (e.touches.length === 2) {
        pinchStartDist = touchDistance(e.touches);
        pinchStartZoom = currentZoom;
      }
    };
    puzzleZoomWrap.ontouchmove = e => {
      if (e.touches.length === 2 && pinchStartDist) {
        e.preventDefault();
        const dist = touchDistance(e.touches);
        applyZoom(pinchStartZoom * (dist / pinchStartDist));
      }
    };
    puzzleZoomWrap.ontouchend = e => {
      if (e.touches.length < 2) pinchStartDist = null;
    };
  }

  function touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function applyZoom(scale) {
    currentZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
    const px = Math.round(CELL_PX * currentZoom);
    puzzleGridEl.style.setProperty("--cell-size", `${px}px`);
    puzzleGridEl.style.gridTemplateColumns = `repeat(${PUZZLE_DATA.cols}, var(--cell-size))`;
    puzzleGridEl.style.gridTemplateRows = `repeat(${PUZZLE_DATA.rows}, var(--cell-size))`;
  }

  // ================================================================
  // SOHBET
  // ================================================================
  let chatUnreadCount = 0;

  function renderChatMessage(msg) {
    const div = document.createElement("div");
    div.className = "chat-msg" + (msg.playerId === playerId ? " me" : "");
    const nameSpan = document.createElement("span");
    nameSpan.className = "chat-msg-name";
    nameSpan.textContent = msg.name + ": ";
    div.appendChild(nameSpan);
    div.appendChild(document.createTextNode(msg.text));
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function updateChatBadge() {
    if (chatUnreadCount > 0) {
      chatUnreadBadge.textContent = chatUnreadCount > 9 ? "9+" : String(chatUnreadCount);
      chatUnreadBadge.classList.remove("hidden");
    } else {
      chatUnreadBadge.classList.add("hidden");
    }
  }

  chatBubble.addEventListener("click", () => {
    chatPanel.classList.remove("hidden");
    chatUnreadCount = 0;
    updateChatBadge();
    chatInput.focus();
  });

  chatCloseBtn.addEventListener("click", () => {
    chatPanel.classList.add("hidden");
  });

  function sendChatMessage() {
    const text = chatInput.value;
    if (!text.trim()) return;
    Chat.sendMessage(playerNameLabel.textContent, text);
    chatInput.value = "";
  }

  chatSendBtn.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendChatMessage();
  });
})();

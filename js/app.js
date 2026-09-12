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
  const modeOptions = document.getElementById("mode-options");
  const maxPlayersField = document.getElementById("max-players-field");
  const turnsModeNote = document.getElementById("turns-mode-note");
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
  const answerSubmit = document.getElementById("answer-submit");
  const answerCancel = document.getElementById("answer-cancel");
  const answerFeedback = document.getElementById("answer-feedback");

  const chatBubble = document.getElementById("chat-bubble");
  const chatUnreadBadge = document.getElementById("chat-unread-badge");
  const chatPanel = document.getElementById("chat-panel");
  const chatCloseBtn = document.getElementById("chat-close-btn");
  const chatMessagesEl = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");

  const lobbyGate = document.getElementById("lobby-gate");
  const lobbyStatus = document.getElementById("lobby-status");
  const lobbyPlayersList = document.getElementById("lobby-players-list");
  const lobbyStartBtn = document.getElementById("lobby-start-btn");
  const lobbyHostHint = document.getElementById("lobby-host-hint");
  const lobbyGuestHint = document.getElementById("lobby-guest-hint");
  const lobbyCountdownBox = document.getElementById("lobby-countdown-box");
  const lobbyCountdownNumber = document.getElementById("lobby-countdown-number");

  const finishedGate = document.getElementById("finished-gate");
  const finishedTitle = document.getElementById("finished-title");
  const finishedScores = document.getElementById("finished-scores");

  const turnBanner = document.getElementById("turn-banner");
  const turnBannerText = document.getElementById("turn-banner-text");
  const turnBannerTimer = document.getElementById("turn-banner-timer");
  const gameCountdownOverlay = document.getElementById("game-countdown-overlay");
  const gameCountdownNumber = document.getElementById("game-countdown-number");
  const toastContainer = document.getElementById("toast-container");
  
  let currentPhase = "waiting"; // Oyunun şu an hangi aşamada olduğunu tutacağız

  const knownSolvedWords = new Set();
  let isInitialLoad = true; // İlk veri çekimindeki bildirimleri engellemek için
  let isHost = false;
  let gameStarted = false;
  let currentTurnPlayerId = null;
  let tickerInterval = null;

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

  const puzzleSelect = document.getElementById("puzzle-select");
  let puzzleSelectRequestId = 0;

  wireOptionGroup(modeOptions, "mode");
  modeOptions.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const isTurns = modeOptions.querySelector(".selected").dataset.mode === "turns";
      maxPlayersField.classList.toggle("hidden", isTurns);
      turnsModeNote.classList.toggle("hidden", !isTurns);
    });
  });

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
    const mode = modeOptions.querySelector(".selected").dataset.mode;
    const direction = directionOptions.querySelector(".selected").dataset.direction;
    const level = levelOptions.querySelector(".selected").dataset.level;
    const maxPlayers = mode === "turns" ? 2 : parseInt(maxPlayersSelect.value, 10);
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
      roomId = await Room.createRoom({ puzzleId, maxPlayers, password, level, direction, mode, hostId: playerId });
      roomConfig = { puzzleId, maxPlayers, password, level, direction, mode, hostId: playerId };
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

    // Game.init BURADA çağrılır (lobiden önce) ki oyuncu Firebase'e hemen
    // kaydolsun — sıra tabanlı modda lobi ekranı oyuncu listesini
    // gösterebilsin, oyun tahtası henüz çizilmemiş olsa bile.
    initGameSync(name);

    if (roomConfig.mode === "turns") {
      enterLobby(name);
    } else {
      startGame(name);
    }
  }

  // ================================================================
  // LOBİ (SIRA TABANLI MOD)
  // ================================================================
  function enterLobby(name) {
    nameGate.classList.add("hidden");
    lobbyGate.classList.remove("hidden");
    playerNameLabel.textContent = name;
    isHost = playerId === roomConfig.hostId;

    lobbyHostHint.classList.toggle("hidden", !isHost);
    lobbyGuestHint.classList.toggle("hidden", isHost);
    lobbyStartBtn.classList.toggle("hidden", !isHost);

    db.ref(`rooms/${roomId}/players`).on("value", snap => {
      renderLobbyPlayers(snap.val() || {});
    });

    Turns.init(roomId, playerId, isHost, { onStateChange: handleTurnStateChange });
  }

  function renderLobbyPlayers(players) {
    const ids = Object.keys(players);
    lobbyStatus.textContent = `${ids.length} / 2 oyuncu hazır`;
    lobbyPlayersList.innerHTML = "";
    ids.forEach(pid => {
      const p = players[pid];
      const li = document.createElement("li");
      li.className = "lobby-player-row";
      li.innerHTML = `
        <span class="player-dot" style="background:${p.color || "#6E6555"}"></span>
        <span class="lobby-player-name">${escapeHtml(p.name)}</span>
        ${pid === roomConfig.hostId ? '<span class="lobby-player-tag">Oda Sahibi</span>' : ""}
      `;
      lobbyPlayersList.appendChild(li);
    });
    if (isHost) lobbyStartBtn.disabled = ids.length !== 2;
  }

  lobbyStartBtn.addEventListener("click", () => Turns.startGame());

  function handleTurnStateChange(state) {
    clearInterval(tickerInterval);
    if (!state) return;

    currentPhase = state.phase; // Fazı güncelliyoruz

    if (state.phase === "countdown") {
      // Eğer oyun tahtası çizilmediyse hemen çiz!
      if (!gameStarted) startGame(playerNameLabel.textContent);
      
      lobbyGate.classList.add("hidden");
      gameCountdownOverlay.classList.remove("hidden"); // Tahta üstü sayacı göster
      
      tickerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((state.countdownStartedAt + Turns.COUNTDOWN_MS - Date.now()) / 1000));
        gameCountdownNumber.textContent = remaining;
      }, 250);
    } else if (state.phase === "playing") {
      gameCountdownOverlay.classList.add("hidden"); // Sayacı gizle, oyun başlasın
      currentTurnPlayerId = state.currentPlayerId;
      
      if (!gameStarted) startGame(playerNameLabel.textContent);
      
      updateTurnBanner(state);
      tickerInterval = setInterval(() => {
        currentTurnPlayerId = state.currentPlayerId;
        const remaining = Math.max(0, Math.ceil((state.turnStartedAt + Turns.TURN_DURATION_MS - Date.now()) / 1000));
        turnBannerTimer.textContent = remaining;
      }, 250);
    } else if (state.phase === "finished") {
      gameCountdownOverlay.classList.add("hidden");
      showFinishedScreen(state);
    }
  }

  function updateTurnBanner(state) {
    const myTurn = state.currentPlayerId === playerId;
    turnBanner.classList.remove("hidden");
    turnBanner.classList.toggle("my-turn", myTurn);
    turnBanner.classList.toggle("their-turn", !myTurn);
    turnBannerText.textContent = myTurn ? "Senin Sıran!" : "Rakibinin Sırası...";
  }

  function showFinishedScreen(state) {
    if (activeWordId) closePopover();
    gameRoot.classList.add("hidden");
    finishedGate.classList.remove("hidden");
    const players = Game.getPlayersSorted();
    const winner = players.find(p => p.id === state.winnerId);
    finishedTitle.textContent = winner ? `${winner.name} kazandı! 🎉` : "Berabere!";
    finishedScores.innerHTML = "";
    players.forEach(p => {
      const li = document.createElement("li");
      li.className = "lobby-player-row";
      li.innerHTML = `
        <span class="player-dot" style="background:${p.color}"></span>
        <span class="lobby-player-name">${escapeHtml(p.name)}</span>
        <span class="lobby-player-tag">${p.score} puan</span>
      `;
      finishedScores.appendChild(li);
    });
  }

  // ================================================================
  // FIREBASE SENKRONİZASYONU — lobiden ÖNCE çağrılır (oyuncu hemen kaydolsun)
  // ================================================================
  let gridReady = false;
  const pendingAutoSolves = new Set();

  function initGameSync(name) {
    Game.init(roomId, playerId, name, {
      onLettersChange: letters => {
        if (gridReady) PuzzleRender.paintLetters(letters, Game.getPlayerColor);

        // Otomatik onaylama SADECE serbest (co-op) modda çalışır — sıra
        // tabanlı modda hangi oyuncunun tur hakkını kullandığı belirsizleşir.
        if (roomConfig.mode === "turns") return;

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
        if (gridReady) {
          Object.keys(PUZZLE_DATA.words).forEach(wid => {
            if (Game.isWordSolved(wid)) {
              PuzzleRender.markWordSolved(wid);

              // Sadece daha önce bildirimini atmadığımız kelimeleri işle
              if (!knownSolvedWords.has(wid)) {
                knownSolvedWords.add(wid);
                
                // Sayfa ilk açıldığında daha önceden çözülmüş olanları es geç
                if (!isInitialLoad) {
                  const wordData = PUZZLE_DATA.words[wid];
                  const answer = wordData.answer;
                  
                  const cellData = PUZZLE_DATA.cells[wordData.clueCell];
                  const clueObj = cellData.clues.find(cl => cl.wordId === wid);
                  const clueText = clueObj ? clueObj.text : "";

                  // Kelimenin harflerine bakıp çözen kişiyi bul
                  const filled = Game.getFilledLettersForWord(wid);
                  const firstCellId = wordData.cells[0];
                  const solverId = filled[firstCellId] ? filled[firstCellId].playerId : null;
                  
                  // Firebase gecikmesi olursa "Bir oyuncu" yazarak iptal olmasını engelle
                  let solverName = "Bir oyuncu";
                  if (solverId) {
                    const players = Game.getPlayersSorted();
                    const solver = players.find(p => p.id === solverId);
                    if (solver) solverName = solver.name;
                  }
                  
                  const points = answer.length * 10; 
                  
                  showToast(`<span class="toast-highlight">${escapeHtml(solverName)}</span>, <i>${escapeHtml(clueText)}</i> > <span class="toast-word">${escapeHtml(answer)}</span> ile ${points} puan aldı!`);
                }
              }
            }
          });
          
          isInitialLoad = false; // İlk yükleme taraması bitti, sonrakilerde bildirim çıksın
          renderProgress();
        }

        // Sıra tabanlı modda bulmaca tamamen çözülünce oyunu bitir
        if (roomConfig.mode === "turns" && Game.getSolvedWordCount() === Game.getTotalWordCount()) {
          const scores = {};
          Game.getPlayersSorted().forEach(p => { scores[p.id] = p.score; });
          Turns.finishGame(scores);
        }
      },
      onPlayersChange: () => renderScoreboard()
    });
  }

 function startGame(name) {
    gameStarted = true;
    nameGate.classList.add("hidden");
    lobbyGate.classList.add("hidden");
    gameRoot.classList.remove("hidden");
    playerNameLabel.textContent = name;
    const directionLabel = roomConfig.direction === "tr_en" ? "TR→EN" : "EN→TR";
    roomLabel.textContent = `Oda: ${roomId} · ${roomConfig.level} · ${directionLabel}`;

    PuzzleRender.init(puzzleGridEl, handleClueClick);
    gridReady = true;
    initZoom();

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
    if (Game.isWordSolved(wordId)) return;
    
    if (roomConfig.mode === "turns") {
      if (currentPhase === "countdown") return; // Geri sayım (scouting) sırasında tıklamayı engelle
      if (currentTurnPlayerId !== playerId) return; // Sıra bende değilse engelle
    }

    activeWordId = wordId;
    const word = PUZZLE_DATA.words[wordId];
    const cellData = PUZZLE_DATA.cells[word.clueCell];
    const clue = cellData.clues.find(cl => cl.wordId === wordId);

    answerClueText.textContent = clue ? clue.text : "";
    answerFeedback.textContent = "";
    answerFeedback.className = "answer-feedback";

    buildAnswerBoxes(wordId);
    popover.classList.remove("hidden");
    positionPopover(clueEl);
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
      if (roomConfig.mode === "turns") Turns.passTurnAfterCorrectAnswer();
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
  function showToast(htmlMessage) {
    let container = document.getElementById("toast-container");
    
    // Eğer HTML içine eklenmemişse veya JS'den sonra yükleniyorsa otomatik oluştur:
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = htmlMessage;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 300); 
    }, 4000);
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

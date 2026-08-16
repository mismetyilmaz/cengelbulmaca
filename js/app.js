/**
 * APP.js
 * ------------------------------------------------------------------
 * Sayfa açılış akışı:
 * 1) URL'de ?room=xxxx var mı bak. Yoksa yeni bir oda id'si üret ve
 *    URL'e ekle (bu kişi linki ilk paylaşan olur).
 * 2) İsim ekranını göster.
 * 3) İsim girilince Game.init() çağrılır, grid çizilir, Firebase
 *    dinleyicileri bağlanır.
 */

(function () {
  const nameGate = document.getElementById("name-gate");
  const nameInput = document.getElementById("name-input");
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
  let playerId = null;

  // ---------- Oda id'si ----------
  const params = new URLSearchParams(window.location.search);
  let roomId = params.get("room");
  if (!roomId) {
    roomId = generateRoomId();
    params.set("room", roomId);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }
  roomLabel.textContent = `Oda: ${roomId}`;

  function generateRoomId() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  // ---------- Oyuncu kimliği (cihazda kalıcı) ----------
  playerId = localStorage.getItem("cb_playerId");
  if (!playerId) {
    playerId = "p_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("cb_playerId", playerId);
  }
  const savedName = localStorage.getItem("cb_playerName");
  if (savedName) nameInput.value = savedName;

  // ---------- İsim ekranı ----------
  joinBtn.addEventListener("click", handleJoin);
  nameInput.addEventListener("keydown", e => {
    if (e.key === "Enter") handleJoin();
  });

  function handleJoin() {
    const name = nameInput.value.trim();
    if (name.length < 2) {
      nameError.textContent = "Lütfen en az 2 karakterli bir isim gir.";
      return;
    }
    localStorage.setItem("cb_playerName", name);
    startGame(name);
  }

  function startGame(name) {
    nameGate.classList.add("hidden");
    gameRoot.classList.remove("hidden");
    playerNameLabel.textContent = name;

    PuzzleRender.init(puzzleGridEl, handleClueClick);

    Game.init(roomId, playerId, name, {
      onLettersChange: letters => PuzzleRender.paintLetters(letters),
      onWordsChange: () => {
        Object.keys(PUZZLE_DATA.words).forEach(wid => {
          if (Game.isWordSolved(wid)) {
            PuzzleRender.markWordSolved(wid, wordsSolvedByName(wid));
          }
        });
        renderProgress();
      },
      onPlayersChange: () => renderScoreboard()
    });
  }

  function wordsSolvedByName(wordId) {
    // Basit yardımcı: Game içindeki cache'e doğrudan erişimimiz yok,
    // bu yüzden ipucunu sade tutuyoruz (isim göstermek istersen
    // Game.js'e küçük bir getter eklenebilir).
    return null;
  }

  // ---------- İpucuna tıklama -> cevap kutusu ----------
  function handleClueClick(wordId, clueEl) {
    if (Game.isWordSolved(wordId)) return; // zaten çözülmüş, tekrar açma

    activeWordId = wordId;
    const word = PUZZLE_DATA.words[wordId];
    const cellData = PUZZLE_DATA.cells[word.clueCell];

    answerClueText.textContent = cellData.text;
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
          box.value = box.value.toLocaleUpperCase("tr-TR").slice(-1);
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

    const result = await Game.submitAnswer(activeWordId, guess);

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

  // ---------- Skor tablosu ----------
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

  // ---------- İlerleme çubuğu ----------
  function renderProgress() {
    const total = Game.getTotalWordCount();
    const solved = Game.getSolvedWordCount();
    const pct = total ? Math.round((solved / total) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressLabel.textContent = `${solved} / ${total} kelime çözüldü`;
  }

  // ---------- Link kopyalama ----------
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

(() => {
  "use strict";

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const blueCountEl = document.getElementById("blueCount");
  const redCountEl = document.getElementById("redCount");
  const resetButton = document.getElementById("resetButton");

  const SIZE = 8;
  const BLUE = "blue";
  const RED = "red";

  let board = [];
  let turn = BLUE;
  let selected = null;
  let forcedPiece = null;
  let gameOver = false;
  let computerTimer = null;
  let audioCtx = null;

  // --- ระบบเสียงเอฟเฟกต์ (รองรับการปลดล็อกเสียงบนมือถือ) ---
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    try {
      initAudio();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'capture') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } else if (type === 'start') {
        // เสียงดนตรีต้อนรับตอนเริ่มเกม (เสียงใสๆ รัว 3 โน้ต)
        const now = audioCtx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(261.63, now); // Do
        osc.frequency.setValueAtTime(329.63, now + 0.1); // Mi
        osc.frequency.setValueAtTime(392.00, now + 0.2); // Sol
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {}
  }

  // --- เอฟเฟกต์แบนเนอร์เด้งต้อนรับตอนกดเริ่มเกม ---
  const styleSheet = document.createElement("style");
  styleSheet.innerText = `
@keyframes bounceIn {
    0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
    70% { transform: translate(-50%, -50%) scale(0.95); }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}`;
  document.head.appendChild(styleSheet);

  function showStartEffect() {
    playSound('start');
    const oldBanner = document.getElementById('startBanner');
    if (oldBanner) oldBanner.remove();

    const banner = document.createElement('div');
    banner.id = 'startBanner';
    banner.innerHTML = '🎉 เริ่มเกมใหม่แล้ว! ลุยกันเลย สู้ๆ! 👑';
    banner.style.position = 'fixed';
    banner.style.top = '18%';
    banner.style.left = '50%';
    banner.style.transform = 'translate(-50%, -50%)';
    banner.style.background = 'linear-gradient(135deg, #f39c12, #d35400)';
    banner.style.color = '#fff';
    banner.style.padding = '12px 24px';
    banner.style.borderRadius = '25px';
    banner.style.fontSize = '1.1rem';
    banner.style.fontWeight = 'bold';
    banner.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    banner.style.zIndex = '1000';
    banner.style.textAlign = 'center';
    banner.style.animation = 'bounceIn 0.8s ease-out forwards';

    document.body.appendChild(banner);
    setTimeout(() => {
      banner.remove();
    }, 2000);
  }
  // ---------------------------------------------

  function isDarkSquare(row, col) {
    return (row + col) % 2 === 1;
  }

  function isInside(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function samePosition(a, b) {
    return a && b && a.row === b.row && a.col === b.col;
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function createEmptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  function newGame() {
    clearTimeout(computerTimer);
    initAudio();

    board = createEmptyBoard();
    turn = BLUE;
    selected = null;
    forcedPiece = null;
    gameOver = false;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (isDarkSquare(row, col)) {
          board[row][col] = { color: RED, king: false };
        }
      }
    }

    for (let row = 5; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (isDarkSquare(row, col)) {
          board[row][col] = { color: BLUE, king: false };
        }
      }
    }

    setStatus("ตาคุณ · เลือกหมากสีน้ำเงินเพื่อเดิน");
    render();
    showStartEffect(); // แสดงเสียงและเอฟเฟกต์เด้งต้อนรับตอนเริ่มเกม
  }

  function getDirections(piece) {
    if (piece.king) {
      return [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1]
      ];
    }

    return piece.color === BLUE
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]];
  }

  function getPieceMoves(row, col, capturesOnly = false) {
    const piece = board[row][col];
    if (!piece) return [];

    const moves = [];

    for (const [dr, dc] of getDirections(piece)) {
      const nextRow = row + dr;
      const nextCol = col + dc;
      const jumpRow = row + dr * 2;
      const jumpCol = col + dc * 2;

      if (
        isInside(nextRow, nextCol) &&
        !capturesOnly &&
        !board[nextRow][nextCol]
      ) {
        moves.push({
          from: { row, col },
          to: { row: nextRow, col: nextCol },
          capture: null
        });
      }

      if (
        isInside(nextRow, nextCol) &&
        isInside(jumpRow, jumpCol) &&
        board[nextRow][nextCol] &&
        board[nextRow][nextCol].color !== piece.color &&
        !board[jumpRow][jumpCol]
      ) {
        moves.push({
          from: { row, col },
          to: { row: jumpRow, col: jumpCol },
          capture: { row: nextRow, col: nextCol }
        });
      }
    }

    return moves;
  }

  function getAllMoves(color) {
    const normalMoves = [];
    const captureMoves = [];

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const piece = board[row][col];
        if (!piece || piece.color !== color) continue;

        for (const move of getPieceMoves(row, col)) {
          if (move.capture) captureMoves.push(move);
          else normalMoves.push(move);
        }
      }
    }

    return captureMoves.length > 0 ? captureMoves : normalMoves;
  }

  function getSelectedMoves() {
    if (!selected) return [];

    return getAllMoves(turn).filter(
      move =>
        move.from.row === selected.row &&
        move.from.col === selected.col
    );
  }

  function countPieces(color) {
    let count = 0;

    for (const row of board) {
      for (const piece of row) {
        if (piece?.color === color) count++;
      }
    }

    return count;
  }

  function makeMove(move) {
    const piece = board[move.from.row][move.from.col];

    board[move.to.row][move.to.col] = piece;
    board[move.from.row][move.from.col] = null;

    if (move.capture) {
      board[move.capture.row][move.capture.col] = null;
      playSound('capture');
    } else {
      playSound('move');
    }

    if (piece.color === BLUE && move.to.row === 0) {
      piece.king = true;
    }

    if (piece.color === RED && move.to.row === SIZE - 1) {
      piece.king = true;
    }
  }

  function finishGame(message) {
    gameOver = true;
    selected = null;
    forcedPiece = null;
    setStatus(message);
    render();
  }

  function switchTurn() {
    selected = null;
    forcedPiece = null;

    if (countPieces(BLUE) === 0) {
      finishGame("คอมพิวเตอร์ชนะ · หมากสีน้ำเงินหมดแล้ว");
      return;
    }

    if (countPieces(RED) === 0) {
      finishGame("คุณชนะ! · หมากสีแดงหมดแล้ว");
      return;
    }

    turn = turn === BLUE ? RED : BLUE;

    const availableMoves = getAllMoves(turn);

    if (!availableMoves.length) {
      finishGame(
        turn === BLUE
          ? "คอมพิวเตอร์ชนะ · คุณเดินต่อไม่ได้"
          : "คุณชนะ! · คอมพิวเตอร์เดินต่อไม่ได้"
      );
      return;
    }

    render();

    if (turn === RED) {
      setStatus("คอมพิวเตอร์กำลังคิดแผน...");
      computerTimer = setTimeout(computerMove, 500);
    } else {
      const mustCapture = availableMoves.some(move => move.capture);
      setStatus(
        mustCapture
          ? "ตาคุณ · ต้องกินหมากสีแดง"
          : "ตาคุณ · เลือกหมากสีน้ำเงินเพื่อเดิน"
      );
    }
  }

  function continueCaptureOrSwitch(position) {
    const nextCaptures = getPieceMoves(position.row, position.col, true)
      .filter(move => move.capture);

    if (nextCaptures.length > 0) {
      selected = { ...position };
      forcedPiece = { ...position };
      setStatus("ต้องกินต่อด้วยหมากตัวเดิม");
      render();
      return;
    }

    switchTurn();
  }

  function handleSquareClick(row, col) {
    initAudio();
    if (gameOver || turn !== BLUE) return;

    const selectedMoves = getSelectedMoves();
    const chosenMove = selectedMoves.find(
      move => move.to.row === row && move.to.col === col
    );

    if (chosenMove) {
      makeMove(chosenMove);

      if (chosenMove.capture) {
        continueCaptureOrSwitch(chosenMove.to);
      } else {
        switchTurn();
      }
      return;
    }

    if (forcedPiece) {
      setStatus("ต้องกินต่อด้วยหมากตัวเดิม");
      return;
    }

    const piece = board[row][col];

    if (piece?.color === BLUE) {
      const availableMoves = getAllMoves(BLUE);
      const movesForPiece = availableMoves.filter(
        move => move.from.row === row && move.from.col === col
      );

      if (!movesForPiece.length) {
        setStatus("หมากตัวนี้เดินไม่ได้");
        return;
      }

      selected = { row, col };

      setStatus(
        availableMoves.some(move => move.capture)
          ? "เลือกช่องเพื่อกินหมากสีแดง"
          : "เลือกช่องที่ต้องการเดิน"
      );

      render();
    }
  }

  function evaluateBoard() {
    let score = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = board[r][c];
        if (!p) continue;
        
        let val = 10;
        if (p.king) val = 25;

        if (p.color === RED) {
          score += val + (r * 1.5);
        } else {
          score -= val + ((7 - r) * 1.5);
        }
      }
    }
    return score;
  }

  function scoreComputerMove(move) {
    let score = 0;

    const fromPiece = board[move.from.row][move.from.col];
    const targetPiece = board[move.to.row][move.to.col];
    let capturedPiece = null;

    board[move.to.row][move.to.col] = fromPiece;
    board[move.from.row][move.from.col] = null;

    if (move.capture) {
      capturedPiece = board[move.capture.row][move.capture.col];
      board[move.capture.row][move.capture.col] = null;
      score += 150;
      if (capturedPiece && capturedPiece.king) score += 50;
    }

    if (!fromPiece.king && move.to.row === SIZE - 1) {
      score += 80;
    }

    if (move.to.col >= 2 && move.to.col <= 5) {
      score += 10;
    }

    let unsafe = false;
    outer: for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c]?.color === BLUE) {
          const enemyCaptures = getPieceMoves(r, c, true);
          if (enemyCaptures.some(ec => ec.capture.row === move.to.row && ec.capture.col === move.to.col)) {
            unsafe = true;
            break outer;
          }
        }
      }
    }

    if (unsafe && !move.capture) {
      score -= 120;
    }

    score += evaluateBoard() * 0.5;

    board[move.from.row][move.from.col] = fromPiece;
    board[move.to.row][move.to.col] = targetPiece;
    if (move.capture) {
      board[move.capture.row][move.capture.col] = capturedPiece;
    }

    return score;
  }

  function computerMove() {
    if (gameOver || turn !== RED) return;

    const moves = getAllMoves(RED);

    if (!moves.length) {
      finishGame("คุณชนะ! · คอมพิวเตอร์เดินต่อไม่ได้");
      return;
    }

    const scoredMoves = moves.map(item => ({ item, score: scoreComputerMove(item) }));
    scoredMoves.sort((a, b) => b.score - a.score);

    const bestScore = scoredMoves[0].score;
    const bestMoves = scoredMoves.filter(m => Math.abs(m.score - bestScore) < 5);
    const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)].item;

    makeMove(chosen);
    render();

    if (chosen.capture) {
      computerTimer = setTimeout(
        () => computerContinueCapture(chosen.to),
        400
      );
    } else {
      computerTimer = setTimeout(switchTurn, 350);
    }
  }

  function computerContinueCapture(position) {
    if (gameOver || turn !== RED) return;

    const captures = getPieceMoves(position.row, position.col, true)
      .filter(move => move.capture);

    if (!captures.length) {
      switchTurn();
      return;
    }

    const move = captures[Math.floor(Math.random() * captures.length)];

    makeMove(move);
    render();

    computerTimer = setTimeout(
      () => computerContinueCapture(move.to),
      400
    );
  }

  function render() {
    const validMoves = getSelectedMoves();

    boardEl.innerHTML = "";

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const square = document.createElement("button");
        const piece = board[row][col];

        square.type = "button";
        square.className = `square ${isDarkSquare(row, col) ? "dark" : "light"}`;
        square.dataset.row = row;
        square.dataset.col = col;

        if (samePosition(selected, { row, col })) {
          square.classList.add("selected");
        }

        if (
          validMoves.some(
            move => move.to.row === row && move.to.col === col
          )
        ) {
          square.classList.add("valid-move");
        }

        if (piece) {
          const checker = document.createElement("span");
          checker.className = `piece ${piece.color}`;

          if (piece.king) {
            checker.classList.add("king");
          }

          square.appendChild(checker);
        }

        square.addEventListener("click", () => handleSquareClick(row, col));
        boardEl.appendChild(square);
      }
    }

    blueCountEl.textContent = countPieces(BLUE);
    redCountEl.textContent = countPieces(RED);
  }

  resetButton.addEventListener("click", newGame);

  newGame();
})();

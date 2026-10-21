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

  // --- ระบบเสียงดนตรีและเอฟเฟกต์ ---
  function playSound(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'capture') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'start') {
        // เสียงดนตรีต้อนรับเริ่มเกม (เสียงใสๆ รัว 3 โน้ต)
        const now = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(261.63, now); // โน้ต Do
        osc.frequency.setValueAtTime(329.63, now + 0.1); // โน้ต Mi
        osc.frequency.setValueAtTime(392.00, now + 0.2); // โน้ต Sol
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'win') {
        // เสียงชัยชนะตอนจบเกม
        const now = ctx.currentTime;
        osc.type = 'square';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.setValueAtTime(392, now + 0.15);
        osc.frequency.setValueAtTime(523, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      }
    } catch (e) {}
  }

  // เอฟเฟกต์พาเหรดต้อนรับก่อนเริ่มเกม (เป็ดเดินปรบมือ + เสียงต้อนรับ)
  function showWelcomeParade() {
    playSound('start');
    const paradeBox = document.createElement('div');
    paradeBox.innerHTML = '🦆 🦏 🎉 ยินดีต้อนรับสู่เกมหมากฮอส!';
    paradeBox.style.position = 'fixed';
    paradeBox.style.top = '20%';
    paradeBox.style.left = '50%';
    paradeBox.style.transform = 'translate(-50%, -50%)';
    paradeBox.style.background = 'linear-gradient(135deg, #f39c12, #d35400)';
    paradeBox.style.color = '#fff';
    paradeBox.style.padding = '15px 30px';
    paradeBox.style.borderRadius = '30px';
    paradeBox.style.fontSize = '20px';
    paradeBox.style.fontWeight = 'bold';
    paradeBox.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    paradeBox.style.zIndex = '1000';
    paradeBox.style.animation = 'bounceIn 1.5s ease-out forwards';

    document.body.appendChild(paradeBox);
    setTimeout(() => {
      paradeBox.remove();
    }, 2000);
  }

  // เอฟเฟกต์เป็ดชูธงสู้ๆ ตอนจบเกม
  function showEndGameBanner(message) {
    playSound('win');
    const banner = document.createElement('div');
    banner.innerHTML = `🏆 🦆 🚩 ${message} สู้ๆ เยี่ยมมาก!`;
    banner.style.position = 'fixed';
    banner.style.top = '30%';
    banner.style.left = '50%';
    banner.style.transform = 'translate(-50%, -50%)';
    banner.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
    banner.style.color = '#fff';
    banner.style.padding = '20px 35px';
    banner.style.borderRadius = '20px';
    banner.style.fontSize = '22px';
    banner.style.fontWeight = 'bold';
    banner.style.boxShadow = '0 15px 30px rgba(0,0,0,0.6)';
    banner.style.zIndex = '1000';
    banner.style.textAlign = 'center';
    banner.style.animation = 'bounceIn 1s ease-out forwards';

    document.body.appendChild(banner);
  }

  // ฉีด CSS Animation สำหรับเอฟเฟกต์เด้งไปมา
  const styleSheet = document.createElement("style");
  styleSheet.innerText = `
@keyframes bounceIn {
    0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
    70% { transform: translate(-50%, -50%) scale(0.95); }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}`;
  document.head.appendChild(styleSheet);
  // ---------------------------------

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
    
    // แสดงขบวนพาเหรดต้อนรับตอนเริ่มเกมใหม่
    showWelcomeParade();
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
      playSound('capture'); // เล่นเสียงตอนกินหมากปกติ
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
    
    // แสดงเป็ดชูธงสู้ๆ ตอนจบเกม
    showEndGameBanner(message);
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
      setStatus("คอมพิวเตอร์กำลังคิด...");
      computerTimer = setTimeout(computerMove, 600);
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

  function scoreComputerMove(move) {
    let score = Math.random() * 10;

    if (move.capture) score += 100;
    if (move.to.row === SIZE - 1) score += 30;
    if (move.to.col >= 2 && move.to.col <= 5) score += 4;

    return score;
  }

  function computerMove() {
    if (gameOver || turn !== RED) return;

    const moves = getAllMoves(RED);

    if (!moves.length) {
      finishGame("คุณชนะ! · คอมพิวเตอร์เดินต่อไม่ได้");
      return;
    }

    const move = moves
      .map(item => ({ item, score: scoreComputerMove(item) }))
      .sort((a, b) => b.score - a.score)[0].item;

    makeMove(move);
    render();

    if (move.capture) {
      computerTimer = setTimeout(
        () => computerContinueCapture(move.to),
        420
      );
    } else {
      computerTimer = setTimeout(switchTurn, 380);
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
      420
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
            checker.textContent = "♛";
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

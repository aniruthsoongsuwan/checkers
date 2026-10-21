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

  // --- ระบบเสียงเอฟเฟกต์ตอนเดินและกินหมาก ---
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
      } else if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) {}
  }

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

  // --- สมองกล AI ระดับอัจฉริยะ (Smart AI Evaluation) ---
  function evaluateBoard() {
    let score = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = board[r][c];
        if (!p) continue;
        
        let val = 10;
        if (p.king) val = 25; // ให้คุณค่าหมากฮอสสูงมาก

        // AI (RED) เดินหน้าลงล่าง ยิ่งแถวเยอะยิ่งได้เปรียบ (เข้าใกล้ฮอส)
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

    // จำลองการเดินจริงบนกระดานชั่วคราว
    const fromPiece = board[move.from.row][move.from.col];
    const targetPiece = board[move.to.row][move.to.col];
    let capturedPiece = null;

    board[move.to.row][move.to.col] = fromPiece;
    board[move.from.row][move.from.col] = null;

    if (move.capture) {
      capturedPiece = board[move.capture.row][move.capture.col];
      board[move.capture.row][move.capture.col] = null;
      score += 150; // ให้คะแนนสูงมากเมื่อมีการกินหมาก
      if (capturedPiece && capturedPiece.king) score += 50; // โบนัสกินฮอสผู้เล่น
    }

    // ถ้าเดินแล้วได้เป็นฮอส รับโบนัสทันที
    if (!fromPiece.king && move.to.row === SIZE - 1) {
      score += 80;
    }

    // คุมพื้นที่ตรงกลางกระดาน
    if (move.to.col >= 2 && move.to.col <= 5) {
      score += 10;
    }

    // เช็คความปลอดภัยหลังเดิน: ตาต่อไปผู้เล่นจะกินคืนได้ไหม?
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
      score -= 120; // ลงโทษหนักถ้าเดินไปให้เขากินฟรีโดยไม่ได้กินกลับ
    }

    // ประเมินภาพรวมกระดานคร่าวๆ เพิ่มเติม
    score += evaluateBoard() * 0.5;

    // คืนค่ากระดานกลับเหมือนเดิม
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

    // จัดลำดับตาเดินตามคะแนนความฉลาด
    const scoredMoves = moves.map(item => ({ item, score: scoreComputerMove(item) }));
    scoredMoves.sort((a, b) => b.score - a.score);

    // เลือกตาเดินที่ดีที่สุด (หากคะแนนเท่ากันสุ่มเลือกนิดหน่อยเพื่อความหลากหลาย)
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

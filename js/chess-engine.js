// Chess Engine - handles all game rules, move validation, and state
// Designed with configurable max distance per piece type for future variants

export class ChessEngine {
  constructor(options = {}) {
    // Max sliding distance per piece type (null = unlimited)
    // This enables future "limited movement" variant
    this.maxDistance = {
      bishop: options.maxBishopDistance || null,
      rook: options.maxRookDistance || null,
      queen: options.maxQueenDistance || null,
    };

    // Ice Skate Chess: sliding pieces must travel the maximum distance in each
    // direction — they cannot choose to stop early.
    this.iceskate = options.iceskate || false;

    // Angry Chess: pieces can capture their own pieces (except the king).
    this.angry = options.angry || false;

    // Dark Chess: board is shrouded in darkness; enemy pieces hidden until
    // a friendly piece "shines a torch" (is selected) to reveal its targets.
    this.dark = options.dark || false;

    // Superchess: pawns may promote to an Amazon (queen + knight combo piece).
    this.superchess = options.superchess || false;

    // Risky Chess: no check/checkmate — kings can be captured like any other piece.
    // Game ends when a king is taken; winner determined by total capture points.
    this.risky = options.risky || false;

    this.reset();
  }

  reset(position = null) {
    this.board = position || this.getStartingPosition();
    this.startingBoard = this.board.map((row) => row.slice());
    this.turn = "white";
    this.castlingRights = { white: { king: true, queen: true }, black: { king: true, queen: true } };
    this.enPassantTarget = null; // square behind the pawn that just double-moved
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    this.moveHistory = [];
    this.capturedPieces = { white: [], black: [] };
    this.gameOver = false;
    this.result = null; // 'white', 'black', 'draw'
    this.resultReason = null;
    this.positionHistory = {};
    this.recordPosition();
  }

  getStartingPosition() {
    // Board is 8x8 array, [rank][file], rank 0 = rank 8 (black's back rank)
    // Each cell is null or { type, color }
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));

    const backRank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

    for (let file = 0; file < 8; file++) {
      board[0][file] = { type: backRank[file], color: "black" };
      board[1][file] = { type: "pawn", color: "black" };
      board[6][file] = { type: "pawn", color: "white" };
      board[7][file] = { type: backRank[file], color: "white" };
    }

    return board;
  }

  // Setup for Chess960 - randomized back rank
  setup960() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const backRank = this.generate960BackRank();

    for (let file = 0; file < 8; file++) {
      board[0][file] = { type: backRank[file], color: "black" };
      board[1][file] = { type: "pawn", color: "black" };
      board[6][file] = { type: "pawn", color: "white" };
      board[7][file] = { type: backRank[file], color: "white" };
    }

    this.board = board;
    this.startingBoard = board.map((row) => row.slice());
    this.turn = "white";
    this.castlingRights = { white: { king: true, queen: true }, black: { king: true, queen: true } };
    this.enPassantTarget = null;
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    this.moveHistory = [];
    this.capturedPieces = { white: [], black: [] };
    this.gameOver = false;
    this.result = null;
    this.resultReason = null;
    this.positionHistory = {};
    this.recordPosition();

    // Store original king/rook positions for 960 castling
    this.initialKingFile = backRank.indexOf("king");
    this.initialRookFiles = {
      queen: backRank.indexOf("rook"),
      king: backRank.lastIndexOf("rook"),
    };
  }

  generate960BackRank() {
    // Generate a valid Chess960 position
    const pieces = Array(8).fill(null);

    // 1. Place bishops on opposite colors
    const lightSquares = [0, 2, 4, 6];
    const darkSquares = [1, 3, 5, 7];
    const lightIdx = lightSquares[Math.floor(Math.random() * 4)];
    const darkIdx = darkSquares[Math.floor(Math.random() * 4)];
    pieces[lightIdx] = "bishop";
    pieces[darkIdx] = "bishop";

    // 2. Place queen on a random empty square
    let empty = pieces.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
    const queenIdx = empty[Math.floor(Math.random() * empty.length)];
    pieces[queenIdx] = "queen";

    // 3. Place knights on two random empty squares
    empty = pieces.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
    const knight1Idx = Math.floor(Math.random() * empty.length);
    pieces[empty[knight1Idx]] = "knight";
    empty.splice(knight1Idx, 1);
    const knight2Idx = Math.floor(Math.random() * empty.length);
    pieces[empty[knight2Idx]] = "knight";
    empty.splice(knight2Idx, 1);

    // 4. Place rook, king, rook in remaining squares (king between rooks)
    empty = pieces.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
    pieces[empty[0]] = "rook";
    pieces[empty[1]] = "king";
    pieces[empty[2]] = "rook";

    return pieces;
  }

  // Build a compact hash of the position for repetition detection.
  // Encodes: active color, all 64 squares, castling rights, en-passant file.
  getBoardHash() {
    let hash = this.turn[0]; // 'w' or 'b'
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = this.board[r][f];
        if (p) {
          const sym = p.type === "knight" ? "n" : p.type[0];
          hash += p.color === "white" ? sym.toUpperCase() : sym;
        } else {
          hash += "_";
        }
      }
    }
    hash +=
      (this.castlingRights.white.king ? "K" : "-") +
      (this.castlingRights.white.queen ? "Q" : "-") +
      (this.castlingRights.black.king ? "k" : "-") +
      (this.castlingRights.black.queen ? "q" : "-");
    hash += this.enPassantTarget !== null ? String(this.enPassantTarget.file) : "-";
    return hash;
  }

  recordPosition() {
    const hash = this.getBoardHash();
    this.positionHistory[hash] = (this.positionHistory[hash] || 0) + 1;
    return this.positionHistory[hash];
  }

  // Returns true when neither side has sufficient material to deliver checkmate.
  // Covers: K-K, K+B-K, K+N-K, and K+B-K+B with same-colour bishops.
  hasInsufficientMaterial() {
    const pieces = { white: [], black: [] };
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = this.board[r][f];
        if (p && p.type !== "king") pieces[p.color].push({ type: p.type, rank: r, file: f });
      }
    }
    const w = pieces.white;
    const b = pieces.black;
    // K vs K
    if (w.length === 0 && b.length === 0) return true;
    // K+minor vs K (either side)
    if (w.length === 0 && b.length === 1 && (b[0].type === "bishop" || b[0].type === "knight")) return true;
    if (b.length === 0 && w.length === 1 && (w[0].type === "bishop" || w[0].type === "knight")) return true;
    // K+B vs K+B on same square colour
    if (w.length === 1 && b.length === 1 && w[0].type === "bishop" && b[0].type === "bishop") {
      if ((w[0].rank + w[0].file) % 2 === (b[0].rank + b[0].file) % 2) return true;
    }
    return false;
  }

  // Risky Chess: K vs K is a deliberate house-rule draw — even though kings can capture kings,
  // two lone kings chasing each other indefinitely isn't meaningful play. Any other material
  // present can still lead to a king capture, so the game continues in those cases.
  hasOnlyKings() {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = this.board[r][f];
        if (p && p.type !== "king") return false;
      }
    }
    return true;
  }

  // Risky Chess: resolve a rule-based ending (50-move, repetition) by comparing
  // board material. The side with more remaining material wins; equal = draw.
  _resolveRiskyBoardPoints(moveData, reason) {
    const pv = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, amazon: 13, king: 12 };
    let whiteScore = 0,
      blackScore = 0;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = this.board[r][f];
        if (p) {
          if (p.color === "white") whiteScore += pv[p.type] || 0;
          else blackScore += pv[p.type] || 0;
        }
      }
    }
    const diff = Math.abs(whiteScore - blackScore);
    if (whiteScore > blackScore) {
      this.result = "white";
      this.resultReason = `${reason} — ${diff} ${diff === 1 ? "point" : "points"} ahead`;
    } else if (blackScore > whiteScore) {
      this.result = "black";
      this.resultReason = `${reason} — ${diff} ${diff === 1 ? "point" : "points"} ahead`;
    } else {
      moveData.draw = true;
      this.result = "draw";
      this.resultReason = `${reason} — tied on points`;
    }
    moveData.ruleEnding = true;
  }

  getPiece(rank, file) {
    if (rank < 0 || rank > 7 || file < 0 || file > 7) return undefined;
    return this.board[rank][file];
  }

  // Get all legal moves for a piece at (rank, file)
  getLegalMoves(rank, file) {
    const piece = this.getPiece(rank, file);
    if (!piece || piece.color !== this.turn) return [];

    const pseudoMoves = this.getPseudoLegalMoves(rank, file, piece);

    // Filter out moves that leave the king in check.
    // Risky Chess: no check — any move is allowed, even exposing your own king.
    let legalMoves = this.risky
      ? pseudoMoves
      : pseudoMoves.filter((move) => {
          return !this.wouldBeInCheck(rank, file, move.rank, move.file, piece.color, move);
        });

    // Ice Skate: sliding pieces must go to the end of their path.
    // Exception: when the king is already in check, stopping at an intermediate
    // square to block is valid ("as far as you can go" to escape check).
    if (this.iceskate && ["bishop", "rook", "queen"].includes(piece.type) && !this.isInCheck(piece.color)) {
      const endpoints = this.getIceskateEndpointSet(rank, file, piece.color, piece.type);
      legalMoves = legalMoves.filter((m) => endpoints.has(`${m.rank},${m.file}`));
    }

    return legalMoves;
  }

  getIceskateEndpointSet(rank, file, color, pieceType) {
    const endpoints = new Set();
    let directions;
    if (pieceType === "bishop") {
      directions = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
    } else if (pieceType === "rook") {
      directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
    } else {
      directions = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
    }
    for (const [dr, df] of directions) {
      let endRank = null,
        endFile = null;
      for (let dist = 1; dist <= 7; dist++) {
        const r = rank + dr * dist;
        const f = file + df * dist;
        if (r < 0 || r > 7 || f < 0 || f > 7) break;
        const target = this.board[r][f];
        if (!target) {
          endRank = r;
          endFile = f;
        } else {
          if (target.color !== color) {
            endRank = r;
            endFile = f;
          }
          break;
        }
      }
      if (endRank !== null) endpoints.add(`${endRank},${endFile}`);
    }
    return endpoints;
  }

  getPseudoLegalMoves(rank, file, piece) {
    switch (piece.type) {
      case "pawn":
        return this.getPawnMoves(rank, file, piece.color);
      case "knight":
        return this.getKnightMoves(rank, file, piece.color);
      case "bishop":
        return this.getSlidingMoves(rank, file, piece.color, "bishop");
      case "rook":
        return this.getSlidingMoves(rank, file, piece.color, "rook");
      case "queen":
        return this.getSlidingMoves(rank, file, piece.color, "queen");
      case "amazon":
        // Amazon = queen + knight moves
        return [
          ...this.getSlidingMoves(rank, file, piece.color, "queen"),
          ...this.getKnightMoves(rank, file, piece.color),
        ];
      case "king":
        return this.getKingMoves(rank, file, piece.color);
      default:
        return [];
    }
  }

  getPawnMoves(rank, file, color) {
    const moves = [];
    const direction = color === "white" ? -1 : 1;
    const startRank = color === "white" ? 6 : 1;
    const promotionRank = color === "white" ? 0 : 7;

    // Determine promotion options
    const promotionOptions = ["queen", "rook", "bishop", "knight"];
    if (this.superchess) promotionOptions.unshift("amazon");

    // Forward one
    const oneAhead = rank + direction;
    if (oneAhead >= 0 && oneAhead <= 7 && !this.board[oneAhead][file]) {
      if (oneAhead === promotionRank) {
        for (const promo of promotionOptions) {
          moves.push({ rank: oneAhead, file, promotion: promo });
        }
      } else {
        moves.push({ rank: oneAhead, file });
      }

      // Forward two from starting position
      const twoAhead = rank + 2 * direction;
      if (rank === startRank && !this.board[twoAhead][file]) {
        moves.push({ rank: twoAhead, file });
      }
    }

    // Captures (including en passant)
    for (const df of [-1, 1]) {
      const captureFile = file + df;
      if (captureFile < 0 || captureFile > 7) continue;

      const target = this.board[oneAhead][captureFile];
      const isEnemyCapture = target && target.color !== color;
      const isFriendlyCapture = this.angry && target && target.color === color && target.type !== "king";
      if (isEnemyCapture || isFriendlyCapture) {
        if (oneAhead === promotionRank) {
          for (const promo of promotionOptions) {
            moves.push({
              rank: oneAhead,
              file: captureFile,
              promotion: promo,
              friendlyCapture: isFriendlyCapture || undefined,
            });
          }
        } else {
          moves.push({ rank: oneAhead, file: captureFile, friendlyCapture: isFriendlyCapture || undefined });
        }
      }

      // En passant
      if (this.enPassantTarget && this.enPassantTarget.rank === oneAhead && this.enPassantTarget.file === captureFile) {
        moves.push({ rank: oneAhead, file: captureFile, enPassant: true });
      }
    }

    return moves;
  }

  getKnightMoves(rank, file, color) {
    const moves = [];
    const offsets = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];

    for (const [dr, df] of offsets) {
      const r = rank + dr;
      const f = file + df;
      if (r < 0 || r > 7 || f < 0 || f > 7) continue;
      const target = this.board[r][f];
      if (target && target.type === "king" && !this.risky) continue; // Never capture king (unless risky)
      if (!target || target.color !== color) {
        moves.push({ rank: r, file: f });
      } else if (this.angry && target.color === color && target.type !== "king") {
        moves.push({ rank: r, file: f, friendlyCapture: true });
      }
    }

    return moves;
  }

  getSlidingMoves(rank, file, color, pieceType) {
    const moves = [];
    let directions;

    if (pieceType === "bishop") {
      directions = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
    } else if (pieceType === "rook") {
      directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
    } else {
      // queen
      directions = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
    }

    const maxDist = this.maxDistance[pieceType] || 7;

    for (const [dr, df] of directions) {
      // Generate all squares along the path. The ice skate "endpoint only"
      // constraint is enforced in getLegalMoves (with a check-blocking exception).
      for (let dist = 1; dist <= maxDist; dist++) {
        const r = rank + dr * dist;
        const f = file + df * dist;
        if (r < 0 || r > 7 || f < 0 || f > 7) break;

        const target = this.board[r][f];
        if (target && target.type === "king" && !this.risky) break; // Never capture king (unless risky)
        if (!target) {
          moves.push({ rank: r, file: f });
        } else {
          if (target.color !== color) {
            moves.push({ rank: r, file: f });
          } else if (this.angry && target.color === color && target.type !== "king") {
            moves.push({ rank: r, file: f, friendlyCapture: true });
          }
          break; // blocked
        }
      }
    }

    return moves;
  }

  getKingMoves(rank, file, color) {
    const moves = [];
    const offsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    for (const [dr, df] of offsets) {
      const r = rank + dr;
      const f = file + df;
      if (r < 0 || r > 7 || f < 0 || f > 7) continue;
      const target = this.board[r][f];
      if (!target || target.color !== color) {
        moves.push({ rank: r, file: f });
      } else if (this.angry && target.color === color && target.type !== "king") {
        moves.push({ rank: r, file: f, friendlyCapture: true });
      }
    }

    // Castling
    const rights = this.castlingRights[color];
    const baseRank = color === "white" ? 7 : 0;

    // Risky Chess: no check concept, so castling is always allowed (no attacked-square checks)
    if (rank === baseRank && (this.risky || !this.isSquareAttacked(rank, file, color))) {
      // Kingside
      if (rights.king) {
        if (this.canCastle(color, "king")) {
          moves.push({ rank: baseRank, file: 6, castling: "king" });
        }
      }
      // Queenside
      if (rights.queen) {
        if (this.canCastle(color, "queen")) {
          moves.push({ rank: baseRank, file: 2, castling: "queen" });
        }
      }
    }

    return moves;
  }

  canCastle(color, side) {
    const baseRank = color === "white" ? 7 : 0;

    const kingFile = this.getInitialKingFile();
    const rookFile = this.getInitialRookFile(side);
    const kingDest = side === "king" ? 6 : 2;
    const rookDest = side === "king" ? 5 : 3;

    // Check rook is there
    const rook = this.board[baseRank][rookFile];
    if (!rook || rook.type !== "rook" || rook.color !== color) return false;

    // Check squares between king and destination are empty (excluding king and rook positions)
    const kingPath = this.getSquaresBetween(kingFile, kingDest);
    const rookPath = this.getSquaresBetween(rookFile, rookDest);
    const allSquares = new Set([...kingPath, ...rookPath, kingDest, rookDest]);
    allSquares.delete(kingFile);
    allSquares.delete(rookFile);

    for (const f of allSquares) {
      if (this.board[baseRank][f]) return false;
    }

    // Check king doesn't pass through or land on attacked square
    // Risky Chess: skip this check — no check concept
    if (!this.risky) {
      const kingTravel = this.getSquaresBetween(kingFile, kingDest);
      kingTravel.push(kingDest);
      for (const f of kingTravel) {
        if (this.isSquareAttacked(baseRank, f, color)) return false;
      }
    }

    return true;
  }

  getSquaresBetween(fileA, fileB) {
    const squares = [];
    if (fileA === fileB) return squares;
    const step = fileA < fileB ? 1 : -1;
    for (let f = fileA + step; f !== fileB; f += step) {
      squares.push(f);
    }
    return squares;
  }

  // Returns the file the king started on (4 for standard, varies for 960).
  getInitialKingFile() {
    return this.initialKingFile ?? 4;
  }

  // Returns the file the king-side or queen-side rook started on.
  getInitialRookFile(side) {
    return this.initialRookFiles?.[side] ?? (side === "king" ? 7 : 0);
  }

  isSquareAttacked(rank, file, byColor) {
    // Check if any opponent piece attacks this square
    const opponent = byColor === "white" ? "black" : "white";

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = this.board[r][f];
        if (!piece || piece.color !== opponent) continue;

        // Get attack squares (not full legal moves, just raw attacks)
        if (this.doesPieceAttack(r, f, piece, rank, file)) {
          return true;
        }
      }
    }
    return false;
  }

  doesPieceAttack(fromRank, fromFile, piece, targetRank, targetFile) {
    const dr = targetRank - fromRank;
    const df = targetFile - fromFile;
    const absDr = Math.abs(dr);
    const absDf = Math.abs(df);

    switch (piece.type) {
      case "pawn": {
        const direction = piece.color === "white" ? -1 : 1;
        return dr === direction && absDf === 1;
      }
      case "knight":
        return (absDr === 2 && absDf === 1) || (absDr === 1 && absDf === 2);
      case "king":
        return absDr <= 1 && absDf <= 1 && absDr + absDf > 0;
      case "bishop": {
        if (absDr !== absDf || absDr === 0) return false;
        const maxDist = this.maxDistance.bishop || 7;
        if (absDr > maxDist) return false;
        return this.isSlidingPathClear(fromRank, fromFile, targetRank, targetFile);
      }
      case "rook": {
        if (dr !== 0 && df !== 0) return false;
        const maxDist = this.maxDistance.rook || 7;
        if (Math.max(absDr, absDf) > maxDist) return false;
        return this.isSlidingPathClear(fromRank, fromFile, targetRank, targetFile);
      }
      case "queen": {
        if (dr !== 0 && df !== 0 && absDr !== absDf) return false;
        const maxDist = this.maxDistance.queen || 7;
        if (Math.max(absDr, absDf) > maxDist) return false;
        return this.isSlidingPathClear(fromRank, fromFile, targetRank, targetFile);
      }
      case "amazon": {
        // Amazon attacks as both queen and knight
        // Queen part
        if ((dr === 0 || df === 0 || absDr === absDf) && (dr !== 0 || df !== 0)) {
          const maxDist = this.maxDistance.queen || 7;
          if (
            Math.max(absDr, absDf) <= maxDist &&
            this.isSlidingPathClear(fromRank, fromFile, targetRank, targetFile)
          ) {
            return true;
          }
        }
        // Knight part
        if ((absDr === 2 && absDf === 1) || (absDr === 1 && absDf === 2)) {
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  isSlidingPathClear(fromRank, fromFile, toRank, toFile) {
    const dr = Math.sign(toRank - fromRank);
    const df = Math.sign(toFile - fromFile);
    let r = fromRank + dr;
    let f = fromFile + df;

    while (r !== toRank || f !== toFile) {
      if (this.board[r][f]) return false;
      r += dr;
      f += df;
    }
    return true;
  }

  wouldBeInCheck(fromRank, fromFile, toRank, toFile, color, move) {
    // Simulate the move and check if own king is in check
    const savedBoard = this.board.map((row) => row.slice());
    const savedEnPassant = this.enPassantTarget;

    // Make the move on the board
    const piece = this.board[fromRank][fromFile];
    this.board[toRank][toFile] = piece;
    this.board[fromRank][fromFile] = null;

    // Handle en passant capture
    if (move.enPassant) {
      const capturedRank = fromRank; // pawn is on the same rank
      this.board[capturedRank][toFile] = null;
    }

    // Handle castling - move the rook too
    if (move.castling) {
      const baseRank = color === "white" ? 7 : 0;
      const rookFromFile = this.getInitialRookFile(move.castling);
      const rookToFile = move.castling === "king" ? 5 : 3;
      // Read rook from the saved (pre-move) board to handle 960 overlap cases
      // where the rook's start square coincides with the king's destination.
      const rookPiece = savedBoard[baseRank][rookFromFile];
      this.board[baseRank][rookFromFile] = null;
      this.board[baseRank][toFile] = piece; // re-place king (handles rookFromFile === toFile)
      this.board[baseRank][rookToFile] = rookPiece;
    }

    // Find king position
    let kingRank, kingFile;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = this.board[r][f];
        if (p && p.type === "king" && p.color === color) {
          kingRank = r;
          kingFile = f;
        }
      }
    }

    const inCheck = this.isSquareAttacked(kingRank, kingFile, color);

    // Restore board
    this.board = savedBoard;
    this.enPassantTarget = savedEnPassant;

    return inCheck;
  }

  isInCheck(color) {
    // Find king
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = this.board[r][f];
        if (p && p.type === "king" && p.color === color) {
          return this.isSquareAttacked(r, f, color);
        }
      }
    }
    return false;
  }

  hasLegalMoves(color) {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = this.board[r][f];
        if (!piece || piece.color !== color) continue;
        const savedTurn = this.turn;
        this.turn = color;
        const moves = this.getLegalMoves(r, f);
        this.turn = savedTurn;
        if (moves.length > 0) return true;
      }
    }
    return false;
  }

  // Count how many of a player's pieces of a given type have been genuinely
  // captured by the opponent (as opposed to entries in the capture list that
  // were self-credited from the opponent's own promotions).
  //
  // genuineCaptured = (pieces the player ever had) − (pieces still on board)
  //   where "ever had" = starting pieces + prior promotions to that type.
  //
  // IMPORTANT: call this BEFORE placing a newly promoted piece on the board so
  // that both makeMove() and UI preview callers see consistent counts.
  genuineCapturedCount(color, pieceType) {
    let startingCount = 0;
    for (let r = 0; r < 8; r++)
      for (let f = 0; f < 8; f++) {
        const p = this.startingBoard[r][f];
        if (p && p.color === color && p.type === pieceType) startingCount++;
      }
    let previousPromotions = 0;
    for (const m of this.moveHistory) {
      if (m.piece.color === color && m.promotion === pieceType) previousPromotions++;
    }
    let onBoard = 0;
    for (let r = 0; r < 8; r++)
      for (let f = 0; f < 8; f++) {
        const p = this.board[r][f];
        if (p && p.color === color && p.type === pieceType) onBoard++;
      }
    return startingCount + previousPromotions - onBoard;
  }

  // Simulate a move and return { check, checkmate } for the opponent — without
  // permanently modifying game state. Used for move-preview indicators.
  previewMoveResult(fromRank, fromFile, toRank, toFile, promotion = null, castling = undefined) {
    const piece = this.board[fromRank][fromFile];
    if (!piece)
      return {
        check: false,
        checkmate: false,
        stalemate: false,
        draw: false,
        kingCapture: false,
        capturedPieces: null,
      };

    // Deep-copy the entire engine state, apply the move for real, read the result
    // flags (check/checkmate/stalemate/draw), then restore. This avoids brittle
    // manual hash re-computation and correctly handles all draw conditions.
    const savedState = JSON.parse(JSON.stringify(this.serialize()));
    const moveData = this.makeMove(fromRank, fromFile, toRank, toFile, promotion, castling);

    if (!moveData) {
      this.deserialize(savedState);
      return {
        check: false,
        checkmate: false,
        stalemate: false,
        draw: false,
        kingCapture: false,
        capturedPieces: null,
      };
    }
    const capturedPieces = { white: [...this.capturedPieces.white], black: [...this.capturedPieces.black] };
    this.deserialize(savedState);
    return {
      check: !!moveData.check,
      checkmate: !!moveData.checkmate,
      stalemate: !!moveData.stalemate,
      draw: !!moveData.draw,
      kingCapture: !!moveData.kingCapture,
      capturedPieces,
    };
  }

  // Make a move. Returns move data for sync, or null if illegal.
  makeMove(fromRank, fromFile, toRank, toFile, promotion = null, castling = undefined) {
    const piece = this.getPiece(fromRank, fromFile);
    if (!piece || piece.color !== this.turn) return null;

    const legalMoves = this.getLegalMoves(fromRank, fromFile);
    const matchingMove = legalMoves.find((m) => {
      if (m.rank !== toRank || m.file !== toFile) return false;
      if (m.promotion && promotion) return m.promotion === promotion;
      if (m.promotion && !promotion) return m.promotion === "queen"; // default
      // Disambiguate castling when caller specifies a preference
      if (castling !== undefined) return (m.castling || null) === castling;
      return true;
    });

    if (!matchingMove) return null;

    const moveData = {
      from: { rank: fromRank, file: fromFile },
      to: { rank: toRank, file: toFile },
      piece: { ...piece },
      captured: null,
      promotion: matchingMove.promotion || null,
      castling: matchingMove.castling || null,
      enPassant: matchingMove.enPassant || false,
      friendlyCapture: matchingMove.friendlyCapture || false,
      check: false,
      checkmate: false,
      stalemate: false,
      disambiguation: this.computeDisambiguation(fromRank, fromFile, toRank, toFile, piece),
    };

    // Capture
    // In Chess 960, castling is encoded as the king moving to the rook's square,
    // so the destination square holds a friendly rook — not a capture.
    const targetPiece = this.board[toRank][toFile];
    if (targetPiece && !matchingMove.castling) {
      moveData.captured = { ...targetPiece };
      // Friendly capture (angry chess): credit the opponent so display is correct
      if (targetPiece.color === piece.color) {
        const opponent = piece.color === "white" ? "black" : "white";
        this.capturedPieces[opponent].push(targetPiece.type);
      } else {
        this.capturedPieces[piece.color].push(targetPiece.type);
      }
    }

    // En passant capture
    if (matchingMove.enPassant) {
      const capturedRank = fromRank;
      moveData.captured = { ...this.board[capturedRank][toFile] };
      this.capturedPieces[piece.color].push("pawn");
      this.board[capturedRank][toFile] = null;
    }

    // Pre-save castling rook BEFORE the king moves (avoids 960 overlap issues
    // where the rook's start square coincides with the king's destination).
    let castleRookFromFile = null;
    let castleRookPiece = null;
    if (matchingMove.castling) {
      const baseRank = piece.color === "white" ? 7 : 0;
      castleRookFromFile = this.getInitialRookFile(matchingMove.castling);
      castleRookPiece = this.board[baseRank][castleRookFromFile];
    }

    // Move the piece
    this.board[toRank][toFile] = piece;
    this.board[fromRank][fromFile] = null;

    // Promotion — capture-pen accounting runs BEFORE the board is updated so
    // that genuineCapturedCount() sees the pre-promotion board (consistent with
    // the UI preview path which also reads the pre-move board).
    if (matchingMove.promotion) {
      const opponent = piece.color === "white" ? "black" : "white";
      const promoType = matchingMove.promotion;

      // The promoting pawn leaves the board → opponent "gains" a pawn.
      this.capturedPieces[opponent].push("pawn");

      // Determine whether the opponent genuinely captured one of the promoter's
      // pieces of this type. If so, the promoted piece "comes back" from their
      // captures; otherwise the promoting player is credited with a new one.
      const capturedFromPromoter = this.genuineCapturedCount(piece.color, promoType);
      if (capturedFromPromoter > 0) {
        const opponentIdx = this.capturedPieces[opponent].indexOf(promoType);
        if (opponentIdx !== -1) {
          this.capturedPieces[opponent].splice(opponentIdx, 1);
        } else {
          this.capturedPieces[piece.color].push(promoType);
        }
      } else {
        this.capturedPieces[piece.color].push(promoType);
      }

      // Now place the promoted piece on the board.
      this.board[toRank][toFile] = { type: promoType, color: piece.color };
    }

    // Castling - move the rook
    if (matchingMove.castling) {
      const baseRank = piece.color === "white" ? 7 : 0;
      const rookToFile = matchingMove.castling === "king" ? 5 : 3;
      this.board[baseRank][castleRookFromFile] = null;
      this.board[baseRank][toFile] = piece; // re-place king (handles 960 rookFromFile === toFile overlap)
      this.board[baseRank][rookToFile] = castleRookPiece;
    }

    // Update en passant target
    if (piece.type === "pawn" && Math.abs(toRank - fromRank) === 2) {
      this.enPassantTarget = {
        rank: (fromRank + toRank) / 2,
        file: fromFile,
      };
    } else {
      this.enPassantTarget = null;
    }

    // Update castling rights
    if (piece.type === "king") {
      this.castlingRights[piece.color].king = false;
      this.castlingRights[piece.color].queen = false;
    }
    if (piece.type === "rook") {
      const baseRank = piece.color === "white" ? 7 : 0;
      if (fromRank === baseRank && fromFile === this.getInitialRookFile("queen"))
        this.castlingRights[piece.color].queen = false;
      if (fromRank === baseRank && fromFile === this.getInitialRookFile("king"))
        this.castlingRights[piece.color].king = false;
    }
    // If a rook is captured, remove that side's castling rights
    if (moveData.captured && moveData.captured.type === "rook") {
      const capturedColor = moveData.captured.color;
      const capturedBaseRank = capturedColor === "white" ? 7 : 0;
      if (toRank === capturedBaseRank && toFile === this.getInitialRookFile("queen"))
        this.castlingRights[capturedColor].queen = false;
      if (toRank === capturedBaseRank && toFile === this.getInitialRookFile("king"))
        this.castlingRights[capturedColor].king = false;
    }

    // Update half-move clock
    if (piece.type === "pawn" || moveData.captured) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    // Switch turn
    if (this.turn === "black") this.fullMoveNumber++;
    this.turn = this.turn === "white" ? "black" : "white";

    // Risky Chess: king capture ends the game — winner by total capture points
    if (this.risky && moveData.captured && moveData.captured.type === "king") {
      moveData.kingCapture = true;
      this.gameOver = true;
      const RISKY_KING_VALUE = 12;
      const RISKY_TIE_IS_DRAW = true;
      const pv = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, amazon: 13, king: RISKY_KING_VALUE };
      let whiteScore = 0,
        blackScore = 0;
      for (const t of this.capturedPieces.white) whiteScore += pv[t] || 0;
      for (const t of this.capturedPieces.black) blackScore += pv[t] || 0;
      const diff = Math.abs(whiteScore - blackScore);
      if (whiteScore > blackScore) {
        this.result = "white";
        this.resultReason = `king captured — ${diff} ${diff === 1 ? "point" : "points"} ahead`;
        if (piece.color !== "white") moveData.kingCaptureLoss = true;
      } else if (blackScore > whiteScore) {
        this.result = "black";
        this.resultReason = `king captured — ${diff} ${diff === 1 ? "point" : "points"} ahead`;
        if (piece.color !== "black") moveData.kingCaptureLoss = true;
      } else {
        if (RISKY_TIE_IS_DRAW) {
          moveData.draw = true;
          this.result = "draw";
          this.resultReason = "king captured — tied on points";
        } else {
          this.result = piece.color;
          this.resultReason = "king captured — tiebreaker";
        }
      }
    }

    // Check for check/checkmate/stalemate (skip in Risky Chess — no check concept)
    if (!this.risky) {
      if (this.isInCheck(this.turn)) {
        moveData.check = true;
        if (!this.hasLegalMoves(this.turn)) {
          moveData.checkmate = true;
          this.gameOver = true;
          this.result = piece.color;
          this.resultReason = "checkmate";
        }
      } else if (!this.hasLegalMoves(this.turn)) {
        moveData.stalemate = true;
        this.gameOver = true;
        this.result = "draw";
        this.resultReason = "stalemate";
      }
    }

    // 50-move rule
    if (!this.gameOver && this.halfMoveClock >= 100) {
      this.gameOver = true;
      if (this.risky) {
        this._resolveRiskyBoardPoints(moveData, "fifty-move rule");
      } else {
        moveData.draw = true;
        this.result = "draw";
        this.resultReason = "fifty-move rule";
      }
    }

    // Threefold repetition
    if (!this.gameOver && this.recordPosition() >= 3) {
      this.gameOver = true;
      if (this.risky) {
        this._resolveRiskyBoardPoints(moveData, "repetition");
      } else {
        moveData.draw = true;
        this.result = "draw";
        this.resultReason = "repetition";
      }
    }

    // Insufficient material
    // Risky Chess: K vs K is a house-rule draw (kings can technically capture each other,
    // but it's an intentional dead-position rule). Any other material keeps the game alive.
    // Standard: K vs K, K+minor vs K, K+B vs K+B (same colour bishops).
    if (!this.gameOver && (this.risky ? this.hasOnlyKings() : this.hasInsufficientMaterial())) {
      moveData.draw = true;
      this.gameOver = true;
      this.result = "draw";
      this.resultReason = "insufficient material";
    }

    this.moveHistory.push(moveData);
    return moveData;
  }

  // Serialize the game state for Firebase
  serialize() {
    return {
      board: this.board,
      turn: this.turn,
      castlingRights: this.castlingRights,
      enPassantTarget: this.enPassantTarget,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
      moveHistory: this.moveHistory,
      capturedPieces: this.capturedPieces,
      gameOver: this.gameOver,
      result: this.result,
      resultReason: this.resultReason,
      maxDistance: this.maxDistance,
      iceskate: this.iceskate,
      angry: this.angry,
      dark: this.dark,
      superchess: this.superchess,
      risky: this.risky,
      positionHistory: this.positionHistory,
      startingBoard: this.startingBoard,
      initialKingFile: this.initialKingFile ?? null,
      initialRookFiles: this.initialRookFiles ?? null,
    };
  }

  // Restore from serialized state
  deserialize(state) {
    // Firebase strips null values from arrays/objects, so we must rebuild
    // the board as a proper 8x8 array, replacing any missing entries with null.
    this.board = Array.from({ length: 8 }, (_, r) => {
      const row = state.board ? state.board[r] : null;
      return Array.from({ length: 8 }, (_, f) => {
        if (!row) return null;
        return row[f] || null;
      });
    });

    this.turn = state.turn || "white";
    this.castlingRights = state.castlingRights || {
      white: { king: true, queen: true },
      black: { king: true, queen: true },
    };
    this.enPassantTarget = state.enPassantTarget || null;
    this.halfMoveClock = state.halfMoveClock || 0;
    this.fullMoveNumber = state.fullMoveNumber || 1;
    // Firebase may convert arrays to objects with numeric keys — normalize both
    this.moveHistory = state.moveHistory ? Object.values(state.moveHistory) : [];
    // Always rebuild capturedPieces as proper arrays.
    // Firebase strips empty arrays entirely, so .white/.black may be absent or
    // come back as a numeric-keyed object when non-empty.
    const cp = state.capturedPieces || {};
    this.capturedPieces = {
      white: Array.isArray(cp.white) ? [...cp.white] : cp.white ? Object.values(cp.white) : [],
      black: Array.isArray(cp.black) ? [...cp.black] : cp.black ? Object.values(cp.black) : [],
    };
    this.gameOver = state.gameOver || false;
    this.result = state.result || null;
    this.resultReason = state.resultReason || null;
    if (state.maxDistance) {
      this.maxDistance = state.maxDistance;
    }
    this.iceskate = state.iceskate || false;
    this.angry = state.angry || false;
    this.dark = state.dark || false;
    this.superchess = state.superchess || false;
    this.risky = state.risky || false;
    this.positionHistory = state.positionHistory
      ? typeof state.positionHistory === "object"
        ? { ...state.positionHistory }
        : {}
      : {};
    this.startingBoard = state.startingBoard
      ? Array.from({ length: 8 }, (_, r) => {
          const row = state.startingBoard[r] || null;
          return Array.from({ length: 8 }, (_, f) => (row ? row[f] || null : null));
        })
      : this.getStartingPosition();

    // Restore 960 initial positions (serialized directly, or inferred from startingBoard
    // for backward compatibility with states saved before this field was added).
    this.initialKingFile = state.initialKingFile ?? null;
    this.initialRookFiles = state.initialRookFiles ?? null;
    if (this.initialKingFile === null && this.startingBoard) {
      const backRank = this.startingBoard[7];
      const rooks = [];
      for (let f = 0; f < 8; f++) {
        const p = backRank[f];
        if (!p) continue;
        if (p.type === "king") this.initialKingFile = f;
        if (p.type === "rook") rooks.push(f);
      }
      if (rooks.length >= 2) {
        this.initialRookFiles = { queen: rooks[0], king: rooks[1] };
      }
    }
  }

  // Find disambiguation string for a piece moving from (fromRank,fromFile) to (toRank,toFile).
  // Must be called before the move is applied to the board.
  computeDisambiguation(fromRank, fromFile, toRank, toFile, piece) {
    if (piece.type === "pawn" || piece.type === "king") return "";

    const ambiguous = [];
    const savedTurn = this.turn;
    const savedIceskate = this.iceskate;
    this.turn = piece.color;
    // Disable ice skate for disambiguation so notation is valid for standard
    // engines — they don't know about the ice skate stopping restriction.
    this.iceskate = false;

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        if (r === fromRank && f === fromFile) continue;
        const p = this.board[r][f];
        if (!p || p.type !== piece.type || p.color !== piece.color) continue;
        const moves = this.getLegalMoves(r, f);
        if (moves.some((m) => m.rank === toRank && m.file === toFile)) {
          ambiguous.push({ rank: r, file: f });
        }
      }
    }

    this.turn = savedTurn;
    this.iceskate = savedIceskate;

    if (ambiguous.length === 0) return "";

    const files = "abcdefgh";
    const ranks = "87654321";
    const fileUnique = ambiguous.every((p) => p.file !== fromFile);
    const rankUnique = ambiguous.every((p) => p.rank !== fromRank);

    if (fileUnique) return files[fromFile];
    if (rankUnique) return ranks[fromRank];
    return files[fromFile] + ranks[fromRank];
  }

  // Get algebraic notation for a move
  getMoveNotation(moveData) {
    if (moveData.castling === "king" || moveData.castling === "queen") {
      let notation = moveData.castling === "king" ? "O-O" : "O-O-O";
      if (moveData.checkmate) notation += "#";
      else if (moveData.check) notation += "+";
      else if (moveData.stalemate || moveData.draw || moveData.ruleEnding) notation += "$";
      return notation;
    }

    const files = "abcdefgh";
    const ranks = "87654321";
    let notation = "";

    if (moveData.piece.type !== "pawn") {
      const symbols = { king: "K", queen: "Q", rook: "R", bishop: "B", knight: "N", amazon: "A" };
      notation += symbols[moveData.piece.type] || "?";
      if (moveData.disambiguation) notation += moveData.disambiguation;
    }

    if (moveData.captured) {
      if (moveData.piece.type === "pawn") {
        notation += files[moveData.from.file];
      }
      notation += "x";
    }

    notation += files[moveData.to.file] + ranks[moveData.to.rank];

    if (moveData.promotion) {
      const symbols = { queen: "Q", rook: "R", bishop: "B", knight: "N", amazon: "A" };
      notation += "=" + (symbols[moveData.promotion] || "?");
    }

    if (moveData.friendlyCapture) notation += "*";
    if (moveData.kingCaptureLoss) notation += "@";
    else if (moveData.checkmate || (moveData.kingCapture && !moveData.draw)) notation += "#";
    else if (moveData.check) notation += "+";
    else if (moveData.stalemate || moveData.draw || moveData.ruleEnding) notation += "$";

    return notation;
  }
}

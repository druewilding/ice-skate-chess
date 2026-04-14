// Chess Test Harness — a fluent DSL for testing chess variant games.
//
// Usage:
//   import { chess } from './harness.js';
//
//   chess('standard')
//     .play('e4', 'e5', 'Nf3', 'Nc6')
//     .assertTurn('white')
//     .assertBoard({ e4: 'wp', e5: 'bp', f3: 'wN', c6: 'bN' })
//     .assertCaptures({ white: [], black: [] })
//     .assertMaterial(0)
//     .play('Nxe5')
//     .assertCaptures({ white: ['pawn'], black: [] })
//     .assertMaterial(1)
//     .preview('Nxc6')
//     .assertPreviewCaptures({ white: ['pawn', 'knight'], black: [] })
//     .assertPreviewMaterial(4)
//     .cancelPreview()
//     .goToMove(2)
//     .assertTurn('white')
//     .goToLive()
//     .assertTurn('black');

import { ChessEngine } from '../js/chess-engine.js';
import { parseAlgebraic } from './parse-notation.js';

const PIECE_VALUES = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, amazon: 13 };
const FILES = 'abcdefgh';
const RANKS = '87654321';

// ── Helpers ──────────────────────────────────────────────────────────

/** Convert a square name like "e4" to { rank, file }. */
function sq(name) {
  const file = FILES.indexOf(name[0]);
  const rank = RANKS.indexOf(name[1]);
  if (file < 0 || rank < 0) throw new Error(`Invalid square: "${name}"`);
  return { rank, file };
}

/** Compact piece description: "wp" = white pawn, "bQ" = black queen, etc. */
function describePiece(piece) {
  if (!piece) return null;
  const symbols = { pawn: 'p', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K', amazon: 'A' };
  return (piece.color === 'white' ? 'w' : 'b') + (symbols[piece.type] || '?');
}

/** Sort a piece list for deterministic comparison. */
function sortPieces(arr) {
  const order = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'amazon'];
  return [...arr].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Compute material score for a color by scanning the board. */
function boardMaterialScore(engine, color) {
  let total = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = engine.board[r][f];
      if (p && p.color === color) total += PIECE_VALUES[p.type] || 0;
    }
  }
  return total;
}

/** Compute material advantage (white's perspective: positive = white ahead). */
function materialAdvantage(engine) {
  return boardMaterialScore(engine, 'white') - boardMaterialScore(engine, 'black');
}

// ── Preview helpers (replicates chess-ui.js pending-move logic) ──────

function computePreviewCaptures(engine, pending) {
  let whiteCaps = [...engine.capturedPieces.white];
  let blackCaps = [...engine.capturedPieces.black];

  const movingPiece = engine.getPiece(pending.fromRank, pending.fromFile);
  const capturedPiece = pending.enPassant
    ? engine.getPiece(pending.fromRank, pending.toFile)
    : engine.getPiece(pending.toRank, pending.toFile);

  if (movingPiece && capturedPiece && !pending.castling) {
    // Friendly capture (angry): credit opponent
    if (capturedPiece.color === movingPiece.color) {
      const opponent = movingPiece.color === 'white' ? 'black' : 'white';
      if (opponent === 'white') whiteCaps.push(capturedPiece.type);
      else blackCaps.push(capturedPiece.type);
    } else {
      if (movingPiece.color === 'white') whiteCaps.push(capturedPiece.type);
      else blackCaps.push(capturedPiece.type);
    }
  }

  // Promotion adjustments
  if (pending.promotion && movingPiece) {
    const opponentColor = movingPiece.color === 'white' ? 'black' : 'white';
    const opponentCaps = opponentColor === 'white' ? whiteCaps : blackCaps;
    const promoterCaps = movingPiece.color === 'white' ? whiteCaps : blackCaps;
    opponentCaps.push('pawn');
    const idx = opponentCaps.indexOf(pending.promotion);
    if (idx !== -1) {
      opponentCaps.splice(idx, 1);
    } else {
      promoterCaps.push(pending.promotion);
    }
  }

  return { white: whiteCaps, black: blackCaps };
}

function computePreviewMaterial(engine, pending) {
  let whiteScore = boardMaterialScore(engine, 'white');
  let blackScore = boardMaterialScore(engine, 'black');

  const movingPiece = engine.getPiece(pending.fromRank, pending.fromFile);
  const capturedPiece = pending.enPassant
    ? engine.getPiece(pending.fromRank, pending.toFile)
    : engine.getPiece(pending.toRank, pending.toFile);

  if (movingPiece && capturedPiece && !pending.castling) {
    const val = PIECE_VALUES[capturedPiece.type] || 0;
    if (capturedPiece.color === 'white') whiteScore -= val;
    else blackScore -= val;
  }

  if (pending.promotion && movingPiece) {
    const gain = (PIECE_VALUES[pending.promotion] || 0) - (PIECE_VALUES['pawn'] || 0);
    if (movingPiece.color === 'white') whiteScore += gain;
    else blackScore += gain;
  }

  return whiteScore - blackScore;
}

// ── ChessTestGame ───────────────────────────────────────────────────

class ChessTestGame {
  constructor(engine) {
    this.engine = engine;
    this._snapshots = [JSON.parse(JSON.stringify(engine.serialize()))]; // index 0 = start
    this._moveNotations = [];
    this._pending = null;       // pending move preview
    this._viewIndex = null;     // null = live, number = snapshot index
    this._errors = [];
  }

  // ── Playing moves ──────────────────────────────────────────────────

  /** Play one or more moves in algebraic notation. */
  play(...moves) {
    for (const notation of moves) {
      if (this._viewIndex !== null) {
        throw new Error(`Cannot play moves while reviewing history (at move ${this._viewIndex}). Call .goToLive() first.`);
      }
      if (this._pending) {
        throw new Error(`Cannot play moves with a pending preview. Call .commitPreview() or .cancelPreview() first.`);
      }
      if (this.engine.gameOver) {
        throw new Error(`Game is already over (${this.engine.result}, ${this.engine.resultReason}). Cannot play "${notation}".`);
      }

      const parsed = parseAlgebraic(this.engine, notation);
      const moveData = this.engine.makeMove(
        parsed.fromRank, parsed.fromFile,
        parsed.toRank, parsed.toFile,
        parsed.promotion, parsed.castling
      );

      if (!moveData) {
        throw new Error(`Engine rejected move "${notation}" — makeMove returned null`);
      }

      this._moveNotations.push(this.engine.getMoveNotation(moveData));
      this._snapshots.push(JSON.parse(JSON.stringify(this.engine.serialize())));
    }
    return this;
  }

  // ── Move preview (simulates UI pending-confirm flow) ──────────────

  /** Stage a move for preview without committing it. */
  preview(notation) {
    if (this._pending) {
      throw new Error('A preview is already active. Cancel or commit it first.');
    }
    if (this._viewIndex !== null) {
      throw new Error('Cannot preview while reviewing history.');
    }
    this._pending = parseAlgebraic(this.engine, notation);
    return this;
  }

  /** Commit the previewed move (equivalent to the user pressing ✓). */
  commitPreview() {
    if (!this._pending) throw new Error('No preview to commit.');

    const p = this._pending;
    this._pending = null;

    const moveData = this.engine.makeMove(
      p.fromRank, p.fromFile, p.toRank, p.toFile, p.promotion, p.castling
    );
    if (!moveData) throw new Error('Engine rejected previewed move on commit.');

    this._moveNotations.push(this.engine.getMoveNotation(moveData));
    this._snapshots.push(JSON.parse(JSON.stringify(this.engine.serialize())));
    return this;
  }

  /** Cancel the previewed move (equivalent to the user pressing ✕). */
  cancelPreview() {
    if (!this._pending) throw new Error('No preview to cancel.');
    this._pending = null;
    return this;
  }

  // ── History navigation ─────────────────────────────────────────────

  /**
   * Navigate to the position after move N (1-based).
   * goToMove(0) goes to the starting position.
   */
  goToMove(n) {
    if (this._pending) throw new Error('Cannot navigate with a pending preview.');
    if (n < 0 || n >= this._snapshots.length) {
      throw new Error(`Move ${n} out of range [0..${this._snapshots.length - 1}]`);
    }
    this._viewIndex = n;
    return this;
  }

  /** Return to the live (latest) position. */
  goToLive() {
    this._viewIndex = null;
    return this;
  }

  /** Get the engine state we should be checking (respects history navigation). */
  _currentEngine() {
    if (this._viewIndex !== null) {
      // Build a temporary engine from the snapshot
      const snap = this._snapshots[this._viewIndex];
      const tmp = new ChessEngine({
        iceskate: this.engine.iceskate,
        angry: this.engine.angry,
        dark: this.engine.dark,
      });
      tmp.deserialize(JSON.parse(JSON.stringify(snap)));
      return tmp;
    }
    return this.engine;
  }

  // ── Assertions — board state ───────────────────────────────────────

  /**
   * Assert pieces at specific squares.
   * Pass an object: { 'e4': 'wp', 'e5': 'bp', 'd1': null }
   * Piece format: color prefix (w/b) + symbol (p/N/B/R/Q/K/A), or null for empty.
   */
  assertBoard(squares) {
    const eng = this._currentEngine();
    for (const [sqName, expected] of Object.entries(squares)) {
      const { rank, file } = sq(sqName);
      const piece = eng.board[rank][file];
      const actual = describePiece(piece);
      if (actual !== expected) {
        throw new Error(
          `Board mismatch at ${sqName}: expected ${expected ?? 'empty'}, got ${actual ?? 'empty'}`
        );
      }
    }
    return this;
  }

  /**
   * Assert the full board matches a FEN-like 8-line description.
   * Each line is a rank (8→1), pieces use standard symbols, dots for empty.
   * Example: 'rnbqkbnr/pppppppp/......../......../....P.../......../PPPP.PPP/RNBQKBNR'
   */
  assertBoardFEN(fen) {
    const eng = this._currentEngine();
    const fenSymbols = {
      king: { white: 'K', black: 'k' },
      queen: { white: 'Q', black: 'q' },
      rook: { white: 'R', black: 'r' },
      bishop: { white: 'B', black: 'b' },
      knight: { white: 'N', black: 'n' },
      pawn: { white: 'P', black: 'p' },
      amazon: { white: 'A', black: 'a' },
    };
    const ranks = fen.split('/');
    if (ranks.length !== 8) throw new Error(`Expected 8 ranks in FEN, got ${ranks.length}`);

    for (let r = 0; r < 8; r++) {
      const rankStr = ranks[r];
      if (rankStr.length !== 8) throw new Error(`Rank ${8 - r} should have 8 chars, got ${rankStr.length}: "${rankStr}"`);
      for (let f = 0; f < 8; f++) {
        const piece = eng.board[r][f];
        const expected = rankStr[f];
        const actual = piece ? fenSymbols[piece.type]?.[piece.color] || '?' : '.';
        if (actual !== expected) {
          throw new Error(
            `Board mismatch at ${FILES[f]}${8 - r}: expected '${expected}', got '${actual}'`
          );
        }
      }
    }
    return this;
  }

  /** Assert a specific square is empty. */
  assertEmpty(...squareNames) {
    const eng = this._currentEngine();
    for (const sqName of squareNames) {
      const { rank, file } = sq(sqName);
      const piece = eng.board[rank][file];
      if (piece) {
        throw new Error(`Expected ${sqName} to be empty, but found ${describePiece(piece)}`);
      }
    }
    return this;
  }

  /** Assert a specific square has a piece. */
  assertPiece(sqName, expectedType, expectedColor) {
    const eng = this._currentEngine();
    const { rank, file } = sq(sqName);
    const piece = eng.board[rank][file];
    if (!piece) {
      throw new Error(`Expected ${expectedColor} ${expectedType} at ${sqName}, but square is empty`);
    }
    if (piece.type !== expectedType || piece.color !== expectedColor) {
      throw new Error(
        `Expected ${expectedColor} ${expectedType} at ${sqName}, got ${piece.color} ${piece.type}`
      );
    }
    return this;
  }

  // ── Assertions — game state ────────────────────────────────────────

  assertTurn(color) {
    const eng = this._currentEngine();
    if (eng.turn !== color) {
      throw new Error(`Expected turn: ${color}, got: ${eng.turn}`);
    }
    return this;
  }

  assertCheck(expected = true) {
    const eng = this._currentEngine();
    const inCheck = eng.isInCheck(eng.turn);
    if (inCheck !== expected) {
      throw new Error(`Expected check=${expected}, got check=${inCheck}`);
    }
    return this;
  }

  assertGameOver(result, reason) {
    const eng = this._currentEngine();
    if (!eng.gameOver) {
      throw new Error(`Expected game over (${result}, ${reason}), but game is still in progress`);
    }
    if (result !== undefined && eng.result !== result) {
      throw new Error(`Expected result="${result}", got "${eng.result}"`);
    }
    if (reason !== undefined && eng.resultReason !== reason) {
      throw new Error(`Expected reason="${reason}", got "${eng.resultReason}"`);
    }
    return this;
  }

  assertNotGameOver() {
    const eng = this._currentEngine();
    if (eng.gameOver) {
      throw new Error(`Expected game in progress, but game is over: ${eng.result} (${eng.resultReason})`);
    }
    return this;
  }

  assertStalemate() {
    return this.assertGameOver('draw', 'stalemate');
  }

  assertDraw(reason) {
    return this.assertGameOver('draw', reason);
  }

  // ── Assertions — captured pieces & material ────────────────────────

  /**
   * Assert the capture pens.
   * { white: ['pawn', 'knight'], black: ['rook'] }
   * white = pieces captured BY white (shown as black piece icons in UI).
   */
  assertCaptures(expected) {
    const eng = this._currentEngine();
    const actualWhite = sortPieces(eng.capturedPieces.white);
    const actualBlack = sortPieces(eng.capturedPieces.black);
    const expWhite = sortPieces(expected.white || []);
    const expBlack = sortPieces(expected.black || []);

    if (JSON.stringify(actualWhite) !== JSON.stringify(expWhite)) {
      throw new Error(
        `Captured by white: expected [${expWhite}], got [${actualWhite}]`
      );
    }
    if (JSON.stringify(actualBlack) !== JSON.stringify(expBlack)) {
      throw new Error(
        `Captured by black: expected [${expBlack}], got [${actualBlack}]`
      );
    }
    return this;
  }

  /**
   * Assert the material advantage from white's perspective.
   * Positive = white ahead, negative = black ahead, 0 = equal.
   */
  assertMaterial(expected) {
    const eng = this._currentEngine();
    const actual = materialAdvantage(eng);
    if (actual !== expected) {
      throw new Error(`Material advantage: expected ${expected}, got ${actual}`);
    }
    return this;
  }

  // ── Assertions — preview (pending move) ────────────────────────────

  /** Assert preview captures (what the capture pen would show during pending-confirm). */
  assertPreviewCaptures(expected) {
    if (!this._pending) throw new Error('No preview active. Call .preview() first.');

    const previewCaps = computePreviewCaptures(this.engine, this._pending);
    const actualWhite = sortPieces(previewCaps.white);
    const actualBlack = sortPieces(previewCaps.black);
    const expWhite = sortPieces(expected.white || []);
    const expBlack = sortPieces(expected.black || []);

    if (JSON.stringify(actualWhite) !== JSON.stringify(expWhite)) {
      throw new Error(
        `Preview captured by white: expected [${expWhite}], got [${actualWhite}]`
      );
    }
    if (JSON.stringify(actualBlack) !== JSON.stringify(expBlack)) {
      throw new Error(
        `Preview captured by black: expected [${expBlack}], got [${actualBlack}]`
      );
    }
    return this;
  }

  /** Assert preview material advantage. */
  assertPreviewMaterial(expected) {
    if (!this._pending) throw new Error('No preview active. Call .preview() first.');

    const actual = computePreviewMaterial(this.engine, this._pending);
    if (actual !== expected) {
      throw new Error(`Preview material advantage: expected ${expected}, got ${actual}`);
    }
    return this;
  }

  /** Assert preview ends the game (check/checkmate/stalemate/draw). */
  assertPreviewResult(expected) {
    if (!this._pending) throw new Error('No preview active. Call .preview() first.');
    const p = this._pending;
    const result = this.engine.previewMoveResult(
      p.fromRank, p.fromFile, p.toRank, p.toFile, p.promotion, p.castling
    );
    for (const [key, val] of Object.entries(expected)) {
      if (result[key] !== val) {
        throw new Error(`Preview result.${key}: expected ${val}, got ${result[key]}`);
      }
    }
    return this;
  }

  // ── Assertions — move history ──────────────────────────────────────

  /** Assert the notation of moves played so far. */
  assertMoveHistory(...expected) {
    if (JSON.stringify(this._moveNotations) !== JSON.stringify(expected)) {
      throw new Error(
        `Move history mismatch:\n  expected: ${expected.join(', ')}\n  got:      ${this._moveNotations.join(', ')}`
      );
    }
    return this;
  }

  /** Assert the last N notations match. */
  assertLastMoves(...expected) {
    const actual = this._moveNotations.slice(-expected.length);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `Last moves mismatch:\n  expected: ${expected.join(', ')}\n  got:      ${actual.join(', ')}`
      );
    }
    return this;
  }

  /** Assert the total number of moves played. */
  assertMoveCount(n) {
    if (this._moveNotations.length !== n) {
      throw new Error(`Expected ${n} moves played, got ${this._moveNotations.length}`);
    }
    return this;
  }

  // ── Assertions — legal moves ───────────────────────────────────────

  /** Assert that a piece at the given square has certain legal target squares. */
  assertLegalMoves(sqName, ...expectedTargets) {
    const eng = this._currentEngine();
    const { rank, file } = sq(sqName);
    const moves = eng.getLegalMoves(rank, file);
    const actual = moves.map(m => FILES[m.file] + RANKS[m.rank]).sort();
    const expected = [...expectedTargets].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `Legal moves from ${sqName}: expected [${expected}], got [${actual}]`
      );
    }
    return this;
  }

  /** Assert that a piece at the given square has at least these targets among its legal moves. */
  assertLegalMovesInclude(sqName, ...targets) {
    const eng = this._currentEngine();
    const { rank, file } = sq(sqName);
    const moves = eng.getLegalMoves(rank, file);
    const actual = new Set(moves.map(m => FILES[m.file] + RANKS[m.rank]));
    const missing = targets.filter(t => !actual.has(t));
    if (missing.length > 0) {
      throw new Error(
        `Legal moves from ${sqName} missing [${missing}]. Has: [${[...actual].sort()}]`
      );
    }
    return this;
  }

  /** Assert that a piece at the given square does NOT have these targets. */
  assertLegalMovesExclude(sqName, ...targets) {
    const eng = this._currentEngine();
    const { rank, file } = sq(sqName);
    const moves = eng.getLegalMoves(rank, file);
    const actual = new Set(moves.map(m => FILES[m.file] + RANKS[m.rank]));
    const present = targets.filter(t => actual.has(t));
    if (present.length > 0) {
      throw new Error(
        `Legal moves from ${sqName} should not include [${present}]. Has: [${[...actual].sort()}]`
      );
    }
    return this;
  }

  // ── Utility ────────────────────────────────────────────────────────

  /** Get a snapshot of the current state for debugging. */
  dump() {
    const eng = this._currentEngine();
    const fenSymbols = {
      king: { white: 'K', black: 'k' },
      queen: { white: 'Q', black: 'q' },
      rook: { white: 'R', black: 'r' },
      bishop: { white: 'B', black: 'b' },
      knight: { white: 'N', black: 'n' },
      pawn: { white: 'P', black: 'p' },
      amazon: { white: 'A', black: 'a' },
    };
    console.log('┌────────┐');
    for (let r = 0; r < 8; r++) {
      let row = '│';
      for (let f = 0; f < 8; f++) {
        const p = eng.board[r][f];
        row += p ? fenSymbols[p.type][p.color] : '.';
      }
      row += `│ ${8 - r}`;
      console.log(row);
    }
    console.log('└────────┘');
    console.log(' abcdefgh');
    console.log(`Turn: ${eng.turn} | Material: ${materialAdvantage(eng)} | GameOver: ${eng.gameOver}`);
    console.log(`Captures W: [${eng.capturedPieces.white}] B: [${eng.capturedPieces.black}]`);
    if (this._moveNotations.length) {
      console.log(`Moves: ${this._moveNotations.join(' ')}`);
    }
    return this;
  }
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Create a new test game.
 *
 * @param {'standard'|'iceskate'|'angry'|'dark'|'superchess'} variant
 * @param {object} [options]
 * @param {boolean} [options.chess960] - Use randomised back rank
 * @param {number[]} [options.backRank960] - Specific 960 back rank (array of piece type strings)
 * @returns {ChessTestGame}
 */
export function chess(variant = 'standard', options = {}) {
  const engineOpts = {};

  switch (variant) {
    case 'iceskate':
      engineOpts.iceskate = true;
      break;
    case 'angry':
      engineOpts.angry = true;
      break;
    case 'dark':
      engineOpts.dark = true;
      break;
    case 'superchess':
      // superchess isn't a constructor option — set after creation
      break;
    case 'standard':
      break;
    default:
      throw new Error(`Unknown variant: "${variant}"`);
  }

  const engine = new ChessEngine(engineOpts);

  if (variant === 'superchess') {
    engine.superchess = true;
  }

  if (options.chess960) {
    engine.setup960();
  }

  return new ChessTestGame(engine);
}

/**
 * Create a test game from a custom board position.
 *
 * @param {string} fen  - FEN-like board: 'rnbqkbnr/pppppppp/.../RNBQKBNR'
 * @param {object} opts - { turn, variant, castling, enPassant }
 * @returns {ChessTestGame}
 */
export function chessFromPosition(fen, opts = {}) {
  const variant = opts.variant || 'standard';
  const engineOpts = {};
  if (variant === 'iceskate') engineOpts.iceskate = true;
  if (variant === 'angry') engineOpts.angry = true;
  if (variant === 'dark') engineOpts.dark = true;

  const engine = new ChessEngine(engineOpts);
  if (variant === 'superchess') engine.superchess = true;

  // Parse FEN board
  const fenSymbols = {
    K: { type: 'king', color: 'white' },
    Q: { type: 'queen', color: 'white' },
    R: { type: 'rook', color: 'white' },
    B: { type: 'bishop', color: 'white' },
    N: { type: 'knight', color: 'white' },
    P: { type: 'pawn', color: 'white' },
    A: { type: 'amazon', color: 'white' },
    k: { type: 'king', color: 'black' },
    q: { type: 'queen', color: 'black' },
    r: { type: 'rook', color: 'black' },
    b: { type: 'bishop', color: 'black' },
    n: { type: 'knight', color: 'black' },
    p: { type: 'pawn', color: 'black' },
    a: { type: 'amazon', color: 'black' },
  };

  const ranks = fen.split('/');
  if (ranks.length !== 8) throw new Error(`Expected 8 ranks, got ${ranks.length}`);

  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of ranks[r]) {
      if (ch === '.' || ch === ' ') { f++; continue; }
      if (/[1-8]/.test(ch)) { f += parseInt(ch); continue; }
      const piece = fenSymbols[ch];
      if (!piece) throw new Error(`Unknown piece symbol: '${ch}'`);
      board[r][f] = { ...piece };
      f++;
    }
  }

  engine.board = board;
  engine.startingBoard = board.map(row => row.slice());
  engine.turn = opts.turn || 'white';
  engine.capturedPieces = { white: [], black: [] };
  engine.moveHistory = [];
  engine.gameOver = false;
  engine.result = null;
  engine.resultReason = null;
  engine.halfMoveClock = opts.halfMoveClock || 0;
  engine.fullMoveNumber = opts.fullMoveNumber || 1;
  engine.positionHistory = {};
  engine.recordPosition();

  // Castling rights
  if (opts.castling !== undefined) {
    engine.castlingRights = opts.castling;
  } else {
    // Default: no castling from custom positions
    engine.castlingRights = {
      white: { king: false, queen: false },
      black: { king: false, queen: false },
    };
  }

  // En passant
  if (opts.enPassant) {
    const { rank, file } = sq(opts.enPassant);
    engine.enPassantTarget = { rank, file };
  }

  return new ChessTestGame(engine);
}

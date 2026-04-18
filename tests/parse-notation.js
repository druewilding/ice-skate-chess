// Algebraic notation parser — converts SAN strings to engine coordinates.
//
// Supports: e4, Nf3, Bxe5, O-O, O-O-O, exd5, e8=Q, Rae1, R1e3, Qd1d3,
// plus suffixes (+, #, *, $, @, !, ?) which are stripped before matching.

const FILES = "abcdefgh";
const RANKS = "87654321"; // rank 0 = '8', rank 7 = '1'

/**
 * Parse an algebraic notation string and find the matching legal move
 * on the given engine. Returns { fromRank, fromFile, toRank, toFile, promotion, castling }
 * or throws if no matching move is found.
 */
export function parseAlgebraic(engine, notation) {
  // Strip decorative suffixes
  let san = notation.replace(/[+#*$@!?]+$/, "").trim();

  // --- Castling ---
  if (san === "O-O" || san === "0-0") {
    return findCastlingMove(engine, "king");
  }
  if (san === "O-O-O" || san === "0-0-0") {
    return findCastlingMove(engine, "queen");
  }

  // --- Promotion ---
  let promotion = null;
  const promoMatch = san.match(/=([QRBNKA])$/i);
  if (promoMatch) {
    const promoMap = { K: "knight", Q: "queen", R: "rook", B: "bishop", N: "knight", A: "amazon" };
    promotion = promoMap[promoMatch[1].toUpperCase()];
    san = san.replace(/=[QRBNKA]$/i, "");
  }

  // --- Piece type ---
  const pieceSymbols = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", A: "amazon" };
  let pieceType = "pawn";
  if (/^[KQRBNKA]/.test(san)) {
    pieceType = pieceSymbols[san[0]];
    san = san.slice(1);
  }

  // --- Strip capture marker ---
  san = san.replace(/x/g, "");

  // Now san is something like: "e4", "f3", "ae1", "1e3", "d1d3", "d5"
  // Last two chars are always the target square
  if (san.length < 2) {
    throw new Error(`Cannot parse notation: "${notation}" — remaining "${san}" too short`);
  }

  const targetFile = FILES.indexOf(san[san.length - 2]);
  const targetRank = RANKS.indexOf(san[san.length - 1]);
  if (targetFile < 0 || targetRank < 0) {
    throw new Error(`Cannot parse target square in "${notation}" — got "${san.slice(-2)}"`);
  }

  // --- Disambiguation ---
  const disambig = san.slice(0, -2); // everything before the target square
  let disambigFile = null;
  let disambigRank = null;
  for (const ch of disambig) {
    if (FILES.includes(ch)) disambigFile = FILES.indexOf(ch);
    else if (RANKS.includes(ch)) disambigRank = RANKS.indexOf(ch);
  }

  // --- Find the matching legal move ---
  const candidates = [];

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = engine.board[r][f];
      if (!piece || piece.color !== engine.turn || piece.type !== pieceType) continue;

      // Apply disambiguation filter
      if (disambigFile !== null && f !== disambigFile) continue;
      if (disambigRank !== null && r !== disambigRank) continue;

      const moves = engine.getLegalMoves(r, f);
      for (const move of moves) {
        if (move.rank !== targetRank || move.file !== targetFile) continue;
        if (promotion && move.promotion !== promotion) continue;
        if (!promotion && move.promotion && move.promotion !== "queen") continue; // default to queen
        candidates.push({
          fromRank: r,
          fromFile: f,
          toRank: move.rank,
          toFile: move.file,
          promotion: move.promotion || null,
          castling: move.castling || null,
          enPassant: move.enPassant || false,
        });
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      `No legal move found for "${notation}" (${engine.turn} to move). ` +
        `Parsed: ${pieceType} → ${FILES[targetFile]}${RANKS[targetRank]}` +
        (promotion ? ` promote=${promotion}` : "")
    );
  }

  if (candidates.length > 1) {
    // Try to narrow — shouldn't happen with correct notation, but be safe
    throw new Error(
      `Ambiguous move "${notation}" — ${candidates.length} candidates: ` +
        candidates
          .map((c) => `${FILES[c.fromFile]}${RANKS[c.fromRank]}-${FILES[c.toFile]}${RANKS[c.toRank]}`)
          .join(", ")
    );
  }

  return candidates[0];
}

function findCastlingMove(engine, side) {
  const color = engine.turn;
  const baseRank = color === "white" ? 7 : 0;

  for (let f = 0; f < 8; f++) {
    const piece = engine.board[baseRank][f];
    if (!piece || piece.type !== "king" || piece.color !== color) continue;

    const moves = engine.getLegalMoves(baseRank, f);
    const castleMove = moves.find((m) => m.castling === side);
    if (castleMove) {
      return {
        fromRank: baseRank,
        fromFile: f,
        toRank: castleMove.rank,
        toFile: castleMove.file,
        promotion: null,
        castling: side,
        enPassant: false,
      };
    }
  }

  throw new Error(`Castling ${side === "king" ? "O-O" : "O-O-O"} is not legal for ${color}`);
}

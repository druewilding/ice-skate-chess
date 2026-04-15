import { describe, expect, it } from "vitest";

import { ChessEngine } from "../js/chess-engine.js";
import { chess, chessFromPosition } from "./harness.js";

describe("Angry Chess", () => {
  // ── Friendly captures ──────────────────────────────────────────────

  it("can capture own pieces (except king)", () => {
    chess("angry")
      .play("e4", "e5", "Nf3", "Nc6", "Bc4")
      // White bishop on c4 — it's now black's turn, so let's check white moves after black plays
      .play("d6")
      // Now it's white's turn. White bishop on c4 can capture friendly pawn on d3? No, d3 is empty.
      // Let's check that Nf3 can capture own pawn on d2 — but d2 pawn blocks.
      // Actually, Nf3 can reach d2 via knight move. d2 has a white pawn.
      .assertLegalMovesInclude("f3", "d2") // knight can capture own pawn on d2
      .play("Nfxd2")
      .assertCaptures({ white: [], black: ["pawn"] }) // friendly capture credited to opponent
      .assertMaterial(-1);
  });

  it("friendly capture credits the opponent capture list", () => {
    // White knight on f3 captures own pawn on d2 — friendly capture
    chess("angry")
      .play("e4", "e5", "Nf3", "Nc6")
      .play("Nfxd2") // knight captures own pawn on d2
      .assertPiece("d2", "knight", "white")
      .assertEmpty("f3")
      // Friendly capture: the captured piece (own pawn) is credited to OPPONENT's list
      .assertCaptures({ white: [], black: ["pawn"] })
      .assertMaterial(-1);
  });

  it("friendly capture notation uses * suffix", () => {
    chess("angry").play("e4", "e5", "Nf3", "Nc6", "Nfxd2").assertLastMoves("Nfxd2*");
  });

  // ── Cannot capture own king ────────────────────────────────────────

  it("cannot capture own king", () => {
    chess("angry")
      .play("e4", "e5", "Qf3", "Nc6")
      // White queen on f3 — should NOT be able to capture own king on e1
      .assertLegalMovesExclude("f3", "e1");
  });

  // ── Friendly capture preview ───────────────────────────────────────

  it("preview friendly capture shows correct pen adjustment", () => {
    chess("angry")
      .play("e4", "e5", "Nf3", "Nc6")
      .preview("Nfxd2") // knight captures own pawn
      .assertPreviewCaptures({ white: [], black: ["pawn"] }) // credited to opponent
      .assertPreviewMaterial(-1)
      .cancelPreview()
      .assertCaptures({ white: [], black: [] }); // unchanged after cancel
  });

  it("preview enemy capture in angry chess is normal", () => {
    chess("angry")
      .play("e4", "d5")
      .preview("exd5")
      .assertPreviewCaptures({ white: ["pawn"], black: [] })
      .assertPreviewMaterial(1)
      .commitPreview()
      .assertCaptures({ white: ["pawn"], black: [] });
  });

  // ── Material tracking after mixed captures ─────────────────────────

  it("mixed friendly and enemy captures", () => {
    chess("angry")
      .play("e4", "e5", "Nf3", "Nc6")
      .play("Nxe5") // capture enemy pawn on e5
      .assertCaptures({ white: ["pawn"], black: [] })
      .assertMaterial(1)
      .play("Nxe5") // black recaptures white knight
      .assertCaptures({ white: ["pawn"], black: ["knight"] })
      .assertMaterial(-2);
  });

  // ── History navigation with angry captures ─────────────────────────

  it("navigate history of angry captures", () => {
    chess("angry")
      .play("e4", "e5", "Nf3", "Nc6", "Nfxd2") // friendly capture move 5
      .goToMove(4) // before the friendly capture
      .assertCaptures({ white: [], black: [] })
      .assertMaterial(0)
      .goToMove(5) // after the friendly capture
      .assertCaptures({ white: [], black: ["pawn"] })
      .assertMaterial(-1)
      .goToLive();
  });

  // ── Checkmate still works ──────────────────────────────────────────

  it("checkmate with no friendly escape in angry chess", () => {
    // Black king alone on h8. White queen on b7 → Qg7# covers g8 (file),
    // h7 (rank), and f8 (diagonal). No friendly black pieces to escape into.
    chessFromPosition(".......k/.Q....../.....K../......../......../......../......../........", {
      variant: "angry",
      turn: "white",
    })
      .play("Qg7#")
      .assertGameOver("white", "checkmate");
  });

  // ── Scholar's mate is NOT checkmate in Angry Chess ─────────────────

  it("scholar's mate is check but not checkmate — king escapes via Kxd8", () => {
    // After Qxf7+, the white queen is on f7 defended by Bc4.
    // In standard chess this is checkmate: the king can't go to d8 (own queen)
    // or f8 (own bishop, also covered by Qf7), and Kxf7 is illegal (Bc4 covers f7).
    // In ANGRY CHESS the king CAN capture its own friendly pieces (except other kings),
    // so Kxd8 — capturing the black queen — is a legal escape.
    chess("angry")
      .play("e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7+")
      .assertCheck(true)
      .assertNotGameOver()
      // The king's legal escape: capture own queen on d8
      .assertLegalMovesInclude("e8", "d8")
      // Play the escape and verify the king is safe on d8
      .play("Kxd8")
      .assertPiece("d8", "king", "black")
      .assertEmpty("e8")
      .assertCheck(false)
      .assertNotGameOver();
  });

  // ── Snapshot rebuild (simulates buildPositionSnapshots in game.html) ──

  it("snapshot rebuild correctly identifies non-castling king move via castling ?? null", () => {
    // Chess960 position: white king at f1 (file 5), kingside rook at h1 (file 7).
    // g1 (file 6) is EMPTY and is BOTH the one-step king move destination AND the
    // kingside-castling destination.  The player plays the plain king move (NOT
    // castling), so moveHistory records castling: null.
    //
    // Regression guard for the `castling ?? null` fix in buildPositionSnapshots:
    // ─ `move.castling ?? null`  → passes null  → makeMove filters to non-castling
    //   move (king to g1, rook stays at h1).
    // ─ `move.castling || undefined` → passes undefined (null is falsy) → makeMove
    //   skips the castling filter entirely and falls through to the plain `return true`
    //   branch, accepting whichever move appears first in getKingMoves.
    //
    // The plain king move to g1 happens to appear before the castling entry in
    // getLegalMoves, so both paths produce the same board in the current engine.
    // However, passing null is the ONLY semantically correct signal: it explicitly
    // tells makeMove "this was not a castling move", protecting against any future
    // ordering change in getLegalMoves and ensuring the castling-vs-plain-move
    // contract is enforced by the disambiguation branch (line 743 of chess-engine.js)
    // rather than relying on incidental array ordering.
    //
    // The inverse scenario (castling mistaken for plain move) is tested below.
    const engine = new ChessEngine({ angry: true });

    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[7][5] = { type: "king", color: "white" };
    board[7][7] = { type: "rook", color: "white" }; // rook at h1 — NOT on g1
    board[0][4] = { type: "king", color: "black" };

    engine.board = board;
    engine.startingBoard = board.map((row) => row.slice());
    engine.turn = "white";
    engine.capturedPieces = { white: [], black: [] };
    engine.moveHistory = [];
    engine.castlingRights = { white: { king: true, queen: false }, black: { king: false, queen: false } };
    engine.initialKingFile = 5; // f1
    engine.initialRookFiles = { king: 7, queen: null }; // rook at h1; castles to g1
    engine.positionHistory = {};
    engine.recordPosition();

    // Confirm both moves exist: a plain king move and a castling move both target g1.
    const legalMoves = engine.getLegalMoves(7, 5);
    const plainToG1 = legalMoves.filter((m) => m.rank === 7 && m.file === 6 && !m.castling);
    const castleToG1 = legalMoves.filter((m) => m.rank === 7 && m.file === 6 && m.castling === "king");
    expect(plainToG1).toHaveLength(1);
    expect(castleToG1).toHaveLength(1);

    // Directly verify that the castling disambiguation branch works:
    // passing castling=null MUST select the non-castling move (rook stays at h1),
    // and passing castling='king' MUST select the castling move (rook moves to f1).
    const nonCastleResult = engine.makeMove(7, 5, 7, 6, null, null);
    expect(nonCastleResult).not.toBeNull();
    expect(nonCastleResult.castling).toBeNull();
    expect(engine.board[7][6]).toMatchObject({ type: "king", color: "white" }); // king at g1
    expect(engine.board[7][7]).toMatchObject({ type: "rook", color: "white" }); // rook still at h1
    expect(engine.capturedPieces.white).toHaveLength(0);
    expect(engine.capturedPieces.black).toHaveLength(0);

    // Reset and verify that passing castling='king' on the same square gives the
    // opposite result: rook ends up at f1 (castled), king at g1.
    // Use startingBoard (captured before any move) to get the original positions.
    const engine2 = new ChessEngine({ angry: true });
    const startBoard = JSON.parse(JSON.stringify(engine.startingBoard));
    engine2.board = startBoard.map((row) => row.slice());
    engine2.startingBoard = startBoard.map((row) => row.slice());
    engine2.turn = "white";
    engine2.capturedPieces = { white: [], black: [] };
    engine2.moveHistory = [];
    engine2.castlingRights = { white: { king: true, queen: false }, black: { king: false, queen: false } };
    engine2.initialKingFile = 5;
    engine2.initialRookFiles = { king: 7, queen: null };
    engine2.positionHistory = {};
    engine2.recordPosition();
    const castleResult = engine2.makeMove(7, 5, 7, 6, null, "king");
    expect(castleResult).not.toBeNull();
    expect(castleResult.castling).toBe("king");
    expect(engine2.board[7][6]).toMatchObject({ type: "king", color: "white" }); // king at g1
    expect(engine2.board[7][5]).toMatchObject({ type: "rook", color: "white" }); // rook moved to f1
    expect(engine2.board[7][7]).toBeNull(); // h1 vacated

    // Now replay the plain-move game via buildPositionSnapshots logic (castling ?? null).
    // moveHistory entry has castling: null → `null ?? null` = null → non-castling filter.
    const tempEng = new ChessEngine({ angry: true });
    tempEng.reset(JSON.parse(JSON.stringify(engine.startingBoard)));
    tempEng.initialKingFile = engine.initialKingFile;
    tempEng.initialRookFiles = engine.initialRookFiles ? { ...engine.initialRookFiles } : null;

    for (const move of engine.moveHistory) {
      const result = tempEng.makeMove(
        move.from.rank,
        move.from.file,
        move.to.rank,
        move.to.file,
        move.promotion ?? null,
        move.castling ?? null // THE FIX: null preserves "this was not a castling move"
      );
      expect(result).not.toBeNull();
      expect(result.castling).toBeNull(); // must have replayed as plain king move
    }

    // Rook must still be at h1 — castling was NOT triggered during replay.
    expect(tempEng.board[7][6]).toMatchObject({ type: "king", color: "white" });
    expect(tempEng.board[7][7]).toMatchObject({ type: "rook", color: "white" });
    expect(tempEng.board[7][5]).toBeNull();
    expect(tempEng.capturedPieces.white).toHaveLength(0);
    expect(tempEng.capturedPieces.black).toHaveLength(0);
  });

  it("deserialize copies capturedPieces arrays to prevent aliasing", () => {
    // After deserialize, mutating engine.capturedPieces must not affect the
    // source state object (no shared array references).
    const engine = new ChessEngine({ angry: true });
    // e4, d5, exd5 — white captures black pawn so capturedPieces is non-empty
    engine.makeMove(6, 4, 4, 4); // e4
    engine.makeMove(1, 3, 3, 3); // d5
    engine.makeMove(4, 4, 3, 3); // exd5 — white captures black pawn

    expect(engine.capturedPieces.white).toEqual(["pawn"]);

    const serialized = JSON.parse(JSON.stringify(engine.serialize()));
    engine.deserialize(serialized);

    // The arrays must be copies, not the same reference as in serialized
    expect(engine.capturedPieces.white).not.toBe(serialized.capturedPieces.white);
    expect(engine.capturedPieces.black).not.toBe(serialized.capturedPieces.black);

    // Mutating the engine's capturedPieces must not affect the serialized snapshot
    const originalWhite = [...serialized.capturedPieces.white];
    engine.capturedPieces.white.push("queen");
    expect(serialized.capturedPieces.white).toEqual(originalWhite);
  });
});

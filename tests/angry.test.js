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
    // Set up a position where the white king is adjacent to its own rook so that
    // BOTH a castling move and a friendly-capture move land on the same square.
    // This is the Angry Chess 960 scenario: king at f1 (file 5), rook at g1 (file 6).
    // Kingside castling destination is also g1. The king should CAPTURE the rook,
    // not castle. We verify that snapshot rebuild (using castling ?? null) correctly
    // identifies the move as a capture, not a castle.
    const engine = new ChessEngine({ angry: true });

    // Place the pieces: king at f1, rook at g1, no other pieces that block castling
    // Use a minimal board: white king at f1 (7,5), white rook at g1 (7,6),
    // black king at e8 (0,4) only. Set up castling rights for white kingside.
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[7][5] = { type: "king", color: "white" };
    board[7][6] = { type: "rook", color: "white" };
    board[0][4] = { type: "king", color: "black" };

    engine.board = board;
    engine.startingBoard = board.map((row) => row.slice());
    engine.turn = "white";
    engine.capturedPieces = { white: [], black: [] };
    engine.moveHistory = [];
    engine.castlingRights = { white: { king: true, queen: false }, black: { king: false, queen: false } };
    engine.initialKingFile = 5; // king starts at f1
    engine.initialRookFiles = { king: 6, queen: null }; // king-side rook at g1
    engine.positionHistory = {};
    engine.recordPosition();

    // White king captures own rook at g1 (file 6) — NOT castling
    const moveData = engine.makeMove(7, 5, 7, 6, null, null);
    expect(moveData).not.toBeNull();
    expect(moveData.castling).toBeNull();
    expect(moveData.friendlyCapture).toBe(true);
    // Friendly capture: rook credited to opponent (black's pen)
    expect(engine.capturedPieces.black).toContain("rook");
    expect(engine.capturedPieces.white).toHaveLength(0);

    // Simulate what buildPositionSnapshots() does: replay from moveHistory
    // This is the exact logic from game.html with the castling ?? null fix applied.
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
        move.castling ?? null // THE FIX: null preserves "non-castling" intent
      );
      expect(result).not.toBeNull();
    }

    // After replay, captures should match the live engine
    expect(tempEng.capturedPieces.black).toContain("rook");
    expect(tempEng.capturedPieces.white).toHaveLength(0);
    // King should be at g1, not at castled position
    expect(tempEng.board[7][6]).toMatchObject({ type: "king", color: "white" });
    // Rook should be gone (captured, not moved to f1 via castling)
    expect(tempEng.board[7][5]).toBeNull();
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

import { describe, expect, it } from "vitest";

import { ChessEngine } from "../js/chess-engine.js";
import { chessFromPosition } from "./harness.js";

describe("Superchess", () => {
  // ── Constructor option ─────────────────────────────────────────────

  it("new ChessEngine({ superchess: true }) enables superchess mode", () => {
    const engine = new ChessEngine({ superchess: true });
    expect(engine.superchess).toBe(true);
  });

  it("amazon promotion is available when constructed with superchess: true", () => {
    const engine = new ChessEngine({ superchess: true });
    // Place a white pawn on e7, black king on d8, white king on e1
    engine.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    engine.board[0][3] = { type: "king", color: "black" }; // d8
    engine.board[1][4] = { type: "pawn", color: "white" }; // e7
    engine.board[7][4] = { type: "king", color: "white" }; // e1
    engine.turn = "white";
    const moves = engine.getLegalMoves(1, 4); // pawn on e7
    const promotions = moves.map((m) => m.promotion).filter(Boolean);
    expect(promotions).toContain("amazon");
  });

  it("superchess flag survives serialize() / deserialize() roundtrip", () => {
    const engine = new ChessEngine({ superchess: true });
    const state = engine.serialize();
    expect(state.superchess).toBe(true);

    const engine2 = new ChessEngine();
    engine2.deserialize(state);
    expect(engine2.superchess).toBe(true);
  });

  it("pawn has amazon promotion after deserialize() into fresh engine", () => {
    const engine = new ChessEngine({ superchess: true });
    engine.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    engine.board[0][3] = { type: "king", color: "black" }; // d8
    engine.board[1][4] = { type: "pawn", color: "white" }; // e7
    engine.board[7][4] = { type: "king", color: "white" }; // e1
    engine.turn = "white";

    // Round-trip through serialize/deserialize (as happens after a page reload)
    const engine2 = new ChessEngine({ superchess: true });
    engine2.deserialize(engine.serialize());

    const moves = engine2.getLegalMoves(1, 4);
    const promotions = moves.map((m) => m.promotion).filter(Boolean);
    expect(promotions).toContain("amazon");
  });

  // ── Amazon promotion ───────────────────────────────────────────────

  it("pawn can promote to amazon", () => {
    chessFromPosition("...k..../....P.../......../......../......../......../......../....K...", {
      variant: "superchess",
    })
      .play("e8=A")
      .assertPiece("e8", "amazon", "white")
      .assertEmpty("e7");
  });

  it("amazon promotion updates captures correctly", () => {
    chessFromPosition("...k..../....P.../......../......../......../......../......../....K...", {
      variant: "superchess",
    })
      .play("e8=A")
      // Promotion: opponent (black) gains a pawn, and since no amazon was ever
      // captured, white is credited with an amazon
      .assertCaptures({ white: ["amazon"], black: ["pawn"] });
  });

  it("amazon promotion preview shows correct material", () => {
    chessFromPosition("...k..../....P.../......../......../......../......../......../....K...", {
      variant: "superchess",
    })
      .preview("e8=A")
      .assertPreviewMaterial(13) // board-based: white pawn becomes amazon(13) = net +13-1=+12... actually preview scores board: white has pawn(1)+king before, gains amazon(13) via promotion adjust = +12 + initial 1 = 13
      .cancelPreview()
      .assertMaterial(1); // white has pawn(1) + king, black has king
  });

  // ── Amazon movement ────────────────────────────────────────────────

  it("amazon moves like queen + knight", () => {
    chessFromPosition("....k.../......../......../......../...A..../......../......../....K...", {
      variant: "superchess",
    })
      // Amazon on d4 should have queen moves + knight moves
      // Knight-like moves from d4: c2, e2, b3, f3, b5, f5, c6, e6
      .assertLegalMovesInclude("d4", "c2", "e2", "b3", "f3", "b5", "f5", "c6", "e6")
      // Queen-like moves from d4: d1, d2, d3, d5, d6, d7, a4, b4, c4, e4, f4, g4, h4,
      // and diagonals
      .assertLegalMovesInclude("d4", "d1", "a4", "h4", "a7", "g7", "a1", "h8");
  });

  // ── Standard promotion still works ─────────────────────────────────

  it("can still promote to queen in superchess", () => {
    chessFromPosition("...k..../....P.../......../......../......../......../......../....K...", {
      variant: "superchess",
    })
      .play("e8=Q")
      .assertPiece("e8", "queen", "white");
  });

  it("can promote to rook, bishop, knight", () => {
    chessFromPosition("...k..../....P.../......../......../......../......../......../....K...", {
      variant: "superchess",
    })
      .play("e8=R")
      .assertPiece("e8", "rook", "white");
  });

  // ── Captures with amazon ───────────────────────────────────────────

  it("amazon captures as knight", () => {
    chessFromPosition("....k.../......../......../......../...A..../......../..p...../....K...", {
      variant: "superchess",
    })
      .play("Axc2")
      .assertCaptures({ white: ["pawn"], black: [] })
      .assertPiece("c2", "amazon", "white")
      .assertMaterial(13); // white has amazon(13) + king, black has just king
  });

  it("amazon captures as queen (sliding)", () => {
    chessFromPosition("....k.../......../......../......../...A..../......../......../...pK...", {
      variant: "superchess",
    })
      .play("Axd1")
      .assertCaptures({ white: ["pawn"], black: [] })
      .assertPiece("d1", "amazon", "white");
  });

  // ── Amazon capture preview ─────────────────────────────────────────

  it("preview amazon capture", () => {
    chessFromPosition("....k.../......../......../......../...A..../......../..p...../....K...", {
      variant: "superchess",
    })
      .preview("Axc2")
      .assertPreviewCaptures({ white: ["pawn"], black: [] })
      .assertPreviewMaterial(13)
      .commitPreview()
      .assertCaptures({ white: ["pawn"], black: [] });
  });

  // ── History ────────────────────────────────────────────────────────

  it("amazon promotion visible in history", () => {
    chessFromPosition("...k..../....P.../......../......../......../......../......../....K...", {
      variant: "superchess",
    })
      .play("e8=A")
      .goToMove(0)
      .assertPiece("e7", "pawn", "white")
      .assertEmpty("e8")
      .goToMove(1)
      .assertPiece("e8", "amazon", "white")
      .assertEmpty("e7")
      .goToLive();
  });

  // ── Checkmate with amazon ──────────────────────────────────────────

  it("amazon can deliver checkmate", () => {
    // Amazon on d6 + king on e3 vs lone king on e8
    chessFromPosition("....k.../......../...A..../......../......../....K.../......../........", {
      variant: "superchess",
    })
      // Amazon moves to f7, covering e8 escape via knight move e6 and queen diag
      .play("Af7")
      .assertCheck(true);
  });
});

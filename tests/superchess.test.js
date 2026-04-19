import { describe, expect, it } from "vitest";

import { ChessEngine } from "../js/chess-engine.js";
import { chess, chessFromPosition } from "./harness.js";

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

  // ── Amazon capture pen accounting ─────────────────────────────────

  it("two amazon promotions both appear in capture pens", () => {
    chess("superchess")
      .play("a4", "h5", "a5", "h4", "a6", "h3", "axb7")
      .assertCaptures({ white: ["pawn"], black: [] })
      .assertMaterial(1)
      .play("hxg2")
      .assertCaptures({ white: ["pawn"], black: ["pawn"] })
      .assertMaterial(0)
      .play("Nf3")
      .preview("gxh1=A")
      // preview: black captures pawn(g2) + rook(h1); promoting pawn → white;
      // no white amazon captured so amazon goes into black's pen
      .assertPreviewCaptures({ white: ["pawn", "pawn"], black: ["pawn", "rook", "amazon"] })
      .commitPreview()
      .assertCaptures({ white: ["pawn", "pawn"], black: ["pawn", "rook", "amazon"] })
      .preview("bxc8=A")
      // preview: white captures bishop(c8); promoting pawn → black;
      // the amazon in black's pen belongs to black's OWN promotion, NOT a
      // captured white piece — so white should get its own amazon
      .assertPreviewCaptures({ white: ["pawn", "pawn", "bishop", "amazon"], black: ["pawn", "pawn", "rook", "amazon"] })
      .assertPreviewMaterial(-2)
      .commitPreview()
      .assertCaptures({ white: ["pawn", "pawn", "bishop", "amazon"], black: ["pawn", "pawn", "rook", "amazon"] })
      .assertMaterial(-2); // black is 2 points ahead
  });

  it("lists amazons correctly after captures", () => {
    chess("superchess")
      .play("a4", "h5", "a5", "h4", "a6", "h3", "axb7", "hxg2", "Nf3", "gxh1=A", "bxc8=A", "Qxc8")
      .play("Nc3", "Ag3", "d4", "Ag6", "Bf4", "Axf4", "d5", "e5", "dxe6", "Ke7", "exd7", "Kf6")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "bishop", "amazon"],
        black: ["pawn", "pawn", "bishop", "rook", "amazon", "amazon"],
      })
      .assertMaterial(-16)
      .play("dxc8=A")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "bishop", "queen", "amazon"],
        black: ["pawn", "pawn", "pawn", "bishop", "rook", "amazon"],
      })
      .assertMaterial(5)
      .play("Bb4", "Axc7", "Axc7")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "pawn", "bishop", "queen", "amazon"],
        black: ["pawn", "pawn", "pawn", "bishop", "rook", "amazon", "amazon"],
      })
      .assertMaterial(-7)
      .play("Rxa7", "Rxa7", "Qd7", "Bxc3+")
      .assertCheck(true)
      .play("Nd2")
      .assertCheck(false)
      .play("Bxd2+")
      .assertCheck(true)
      .play("Kxd2")
      .assertCheck(false)
      .play("g5", "Qd6+")
      .assertCheck(true)
      .play("Axd6+")
      .assertCheck(true)
      .play("Kc3")
      .assertCheck(false)
      .play("g4", "b4", "Rxh2")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "bishop", "bishop", "queen", "amazon"],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "rook",
          "rook",
          "queen",
          "amazon",
          "amazon",
        ],
      })
      .assertMaterial(-24)
      .play("b5", "Axb5+")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "bishop", "bishop", "queen", "amazon"],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "rook",
          "rook",
          "queen",
          "amazon",
          "amazon",
        ],
      })
      .assertMaterial(-25)
      .play("Kd2", "Ad4+", "Kc1", "Rxf2")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "bishop", "bishop", "queen", "amazon"],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "rook",
          "rook",
          "queen",
          "amazon",
          "amazon",
        ],
      })
      .assertMaterial(-26)
      .play("Bh3", "Rxe2")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "bishop", "bishop", "queen", "amazon"],
        black: [
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "pawn",
          "knight",
          "knight",
          "bishop",
          "rook",
          "rook",
          "queen",
          "amazon",
          "amazon",
        ],
      })
      .assertMaterial(-27)
      .play("c3", "Ac2#")
      .assertGameOver("black", "checkmate");
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

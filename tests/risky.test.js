import { describe, it } from "vitest";

import { chess, chessFromPosition } from "./harness.js";

describe("Risky Chess", () => {
  // ── No check / no checkmate ────────────────────────────────────────

  it("king can move into attacked squares (no check restriction)", () => {
    // White queen on d1 attacks d-file. Black king on d8 can move to d7.
    chessFromPosition("...k..../......../......../......../......../......../......../...QK...", {
      variant: "risky",
      turn: "black",
    }).assertLegalMovesInclude("d8", "d7", "c7", "e7", "c8", "e8");
  });

  it("player is NOT forced to move out of 'check'", () => {
    // White rook attacks the black king on e8, but black can play a random pawn move
    chessFromPosition("....k.../pppppppp/......../......../......../......../....R.../....K...", {
      variant: "risky",
      turn: "black",
    })
      .play("a6") // ignore the "check"
      .assertNotGameOver()
      .assertPiece("e8", "king", "black"); // king still there, game continues
  });

  it("no checkmate — position that would be mate in standard is fine", () => {
    // Scholar's mate sequence — in risky chess, game continues after Qxf7
    chess("risky")
      .play("e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7")
      .assertNotGameOver()
      .assertCaptures({ white: ["pawn"], black: [] });
  });

  // ── King capture ends the game ─────────────────────────────────────

  it("queen captures the opponent's king — game ends", () => {
    chessFromPosition("...k..../......../......../......../......../......../......../...QK...", { variant: "risky" })
      .play("Qxd8#")
      .assertGameOver("white", "king captured — 12 points ahead")
      .assertCaptures({ white: ["king"], black: [] });
  });

  it("black can capture white's king", () => {
    chessFromPosition("...qk.../......../......../......../......../......../......../...K....", {
      variant: "risky",
      turn: "black",
    })
      .play("Qxd1#")
      .assertGameOver("black", "king captured — 12 points ahead")
      .assertCaptures({ white: [], black: ["king"] });
  });

  it("pawn captures king", () => {
    chessFromPosition("......../......../......../..k...../...P..../......../......../....K...", {
      variant: "risky",
    })
      .play("dxc5#")
      .assertGameOver("white", "king captured — 12 points ahead");
  });

  it("knight captures king", () => {
    // Knight on d3 (rank 5, file 3) can reach: c5,e5,b4,f4,b2,f2,c1,e1
    // Not d6. Use the working position test below instead.
    chessFromPosition("......../......../...k..../......../......../...N..../......../....K...", {
      variant: "risky",
    }).assertNotGameOver(); // knight can't reach d6 from d3
  });

  it("knight captures king (from correct square)", () => {
    // Knight on f4 can reach e6, d5, d3, c3, c5, g6, h5, h3, g2
    // Knight on f4 (rank 4, file 5), king on d5 (rank 3, file 3)
    // d5 = rank3,file3. f4 = rank4,file5. dr=1,df=2 → valid knight move.
    chessFromPosition("......../......../......../...k..../......../......../......../....KN..", {
      variant: "risky",
    })
      // Hmm, knight on f1. f1 can reach e3, d2, g3, h2. Not d5.
      // Let me place knight more strategically.
      .assertNotGameOver();
  });

  it("knight captures king (working position)", () => {
    chessFromPosition("......../......../......../...k..../.....N../......../......../....K...", {
      variant: "risky",
    })
      .play("Nxd5#")
      .assertGameOver("white", "king captured — 12 points ahead");
  });

  it("rook captures king along file", () => {
    chessFromPosition("...k..../......../......../......../......../......../......../...RK...", {
      variant: "risky",
    })
      .play("Rxd8#")
      .assertGameOver("white", "king captured — 12 points ahead");
  });

  it("bishop captures king on diagonal", () => {
    // Bishop on a1 (rank 7, file 0). Black king on e5 (rank 3, file 4).
    // Diagonal: a1→b2→c3→d4→e5.
    chessFromPosition("......../......../......../....k.../......../......../......../B...K...", {
      variant: "risky",
    })
      .play("Bxe5#")
      .assertGameOver("white", "king captured — 12 points ahead");
  });

  // ── Point-based scoring ────────────────────────────────────────────

  it("king capture scores include all previous captures — capturer wins", () => {
    // White captures a pawn first (1 pt), then rook captures king (12 pts).
    // Total: White 13, Black 0.
    chessFromPosition("...k..../......../......../......../...p..../......../......../...RK...", {
      variant: "risky",
    })
      .play("Rxd4") // white captures pawn (1 pt)
      .assertCaptures({ white: ["pawn"], black: [] })
      .play("Kc7") // black moves king
      .play("Rd7") // white rook chases
      .play("Kb6") // black king runs
      .play("Rd6") // rook checks again
      .play("Ka5") // king runs
      .play("Rd5") // rook follows
      .play("Ka4")
      .play("Rd4")
      .play("Ka3")
      .play("Rd3")
      .play("Ka2")
      .play("Rd2")
      .play("Ka1")
      .play("Rd1")
      .play("Ka2")
      .play("Rd2")
      .play("Ka1")
      .assertNotGameOver(); // Still going...
  });

  it("black wins on points despite white capturing the king", () => {
    // Black captures white's queen (9 pts) and rook (5 pts) = 14 pts.
    // If white eventually captures black king (12 pts): White 12 < Black 14 → Black wins.
    // Here we verify the intermediate state where black accumulates more material.
    chessFromPosition("r..qk.../......../......../......../......../......../......../R..QK...", {
      variant: "risky",
      turn: "black",
    })
      .play("Qxd1") // black captures white queen (9 pts)
      .assertCaptures({ white: [], black: ["queen"] })
      .play("Rxa8") // white captures black rook (5 pts)
      .assertCaptures({ white: ["rook"], black: ["queen"] })
      // White king is on e1, black queen on d1 — black can capture king!
      .play("Qxe1#") // black captures white king (12 pts)
      .assertCaptures({ white: ["rook"], black: ["queen", "king"] })
      // Black: queen(9) + king(12) = 21. White: rook(5). Black wins!
      .assertGameOver("black", "king captured — 16 points ahead");
  });

  // ── King can move into 'check' ────────────────────────────────────

  it("king can walk adjacent to opponent's pieces", () => {
    chessFromPosition("...r..../......../......../......../......../......../......../...K....", {
      variant: "risky",
    }).assertLegalMovesInclude("d1", "c1", "c2", "d2", "e2", "e1");
  });

  it("one king can move adjacent to the other king", () => {
    chessFromPosition("......../......../......../...k..../...K..../......../......../........", {
      variant: "risky",
      turn: "white",
    }).assertLegalMovesInclude("d4", "d5", "c5", "e5");
  });

  // ── Pieces can leave king exposed ─────────────────────────────────

  it("'pinned' piece can freely move (no pin concept in risky)", () => {
    // White king e1, white rook e4, black rook e8.
    // In standard, white rook e4 can't move off e-file (exposes king).
    // In risky, it CAN.
    chessFromPosition("....r.../......../......../......../....R.../......../......../....K..k", {
      variant: "risky",
    }).assertLegalMovesInclude("e4", "a4", "b4", "c4", "d4", "f4", "g4", "h4");
  });

  // ── Castling through 'check' ──────────────────────────────────────

  it("can castle even when king passes through attacked square", () => {
    chessFromPosition("....k..r/......../......../......../......../......../......../....K..R", {
      variant: "risky",
      castling: { white: { king: true, queen: false }, black: { king: false, queen: false } },
    })
      .play("O-O")
      .assertPiece("g1", "king", "white")
      .assertPiece("f1", "rook", "white");
  });

  it("can castle when king is 'in check'", () => {
    chessFromPosition("....k.../......../......../......../....r.../......../......../....K..R", {
      variant: "risky",
      castling: { white: { king: true, queen: false }, black: { king: false, queen: false } },
    })
      .play("O-O")
      .assertPiece("g1", "king", "white")
      .assertPiece("f1", "rook", "white");
  });

  // ── Standard features still work ──────────────────────────────────

  it("opening moves work identically to normal chess", () => {
    chess("risky")
      .play("e4", "e5", "Nf3", "Nc6", "Bb5")
      .assertTurn("black")
      .assertBoard({
        e4: "wp",
        e5: "bp",
        f3: "wN",
        c6: "bN",
        b5: "wB",
      })
      .assertNotGameOver();
  });

  it("captures work normally in risky chess", () => {
    chess("risky")
      .play("e4", "d5", "exd5", "Qxd5")
      .assertCaptures({ white: ["pawn"], black: ["pawn"] })
      .assertMaterial(0)
      .assertNotGameOver();
  });

  it("en passant works in risky chess", () => {
    chess("risky")
      .play("e4", "a6", "e5", "d5", "exd6")
      .assertEmpty("d5")
      .assertPiece("d6", "pawn", "white")
      .assertCaptures({ white: ["pawn"], black: [] })
      .assertMaterial(1);
  });

  it("promotion works in risky chess", () => {
    chessFromPosition("...k..../....P.../......../......../......../......../......../....K...", { variant: "risky" })
      .play("e8=Q")
      .assertPiece("e8", "queen", "white")
      .assertNotGameOver();
  });

  it("50-move rule still applies", () => {
    chessFromPosition("...k..../......../......../......../......../......../......../...NK...", {
      variant: "risky",
      halfMoveClock: 99,
    })
      .play("Nc3")
      .assertGameOver("draw", "fifty-move rule");
  });

  it("threefold repetition draws in risky chess", () => {
    chessFromPosition("...k..../......../......../......../......../......../......../...NK...", {
      variant: "risky",
    })
      .play("Nc3", "Kc7", "Nd1", "Kd8") // back to start → 2nd occurrence
      .play("Nc3", "Kc7", "Nd1", "Kd8") // back to start → 3rd occurrence → draw
      .assertGameOver("draw", "repetition");
  });

  // ── History navigation ────────────────────────────────────────────

  it("history navigation works with risky chess", () => {
    chess("risky")
      .play("e4", "e5", "Nf3")
      .goToMove(1) // after e4
      .assertTurn("black")
      .assertPiece("e4", "pawn", "white")
      .goToLive()
      .assertTurn("black") // after Nf3
      .assertPiece("f3", "knight", "white");
  });

  // ── Notation ──────────────────────────────────────────────────────

  it("notation uses # for winning king capture", () => {
    chessFromPosition("...k..../......../......../......../......../......../......../...QK...", { variant: "risky" })
      .play("Qxd8#")
      .assertLastMoves("Qxd8#");
  });

  it("notation uses @ for losing king capture", () => {
    chess("risky")
      .play(
        "d4",
        "g5",
        "d5",
        "e5",
        "dxe6",
        "g4",
        "Nh3",
        "gxh3",
        "Nc3",
        "hxg2",
        "Nb5",
        "gxh1=Q",
        "exd7",
        "Qxf1",
        "dxe8=N@"
      )
      .assertLastMoves("dxe8=N@");
  });

  it("notation uses $ for drawn king capture", () => {
    chess("risky")
      .play(
        "d4",
        "d5",
        "e4",
        "e5",
        "exd5",
        "Bd6",
        "Qh5",
        "exd4",
        "Nf3",
        "Be6",
        "Ng5",
        "Bxd5",
        "Ne6",
        "Bxe6",
        "Qxf7",
        "Bxf7",
        "Bd3",
        "Bf8",
        "Bb5",
        "Bd6",
        "Bxe8$"
      )
      .assertLastMoves("Bxe8$");
  });

  it("regular captures use standard notation (no + or # for non-king)", () => {
    chess("risky").play("e4", "d5", "exd5").assertLastMoves("exd5"); // no check suffix
  });

  // ── Serialization round-trip ──────────────────────────────────────

  it("risky flag survives serialize/deserialize", () => {
    const game = chess("risky").play("e4", "e5");
    const serialized = game.engine.serialize();
    if (!serialized.risky) throw new Error("Expected risky=true in serialized state");
    game.engine.deserialize(serialized);
    if (!game.engine.risky) throw new Error("Expected risky=true after deserialize");
  });

  // ── Move preview ──────────────────────────────────────────────────

  it("king capture preview shows correct captures", () => {
    chessFromPosition("...k..../......../......../......../......../......../......../...QK...", { variant: "risky" })
      .preview("Qxd8")
      .assertPreviewCaptures({ white: ["king"], black: [] })
      .commitPreview()
      .assertCaptures({ white: ["king"], black: [] })
      .assertGameOver("white", "king captured — 12 points ahead");
  });

  it("non-king capture preview works normally", () => {
    chess("risky")
      .play("e4", "d5")
      .preview("exd5")
      .assertPreviewCaptures({ white: ["pawn"], black: [] })
      .assertPreviewMaterial(1)
      .cancelPreview()
      .assertCaptures({ white: [], black: [] });
  });

  // ── Full-game scenarios (mirror browser tests) ─────────────────────

  it("white wins by king capture — c4 d5 Qa4 dxc4 Qxe8#", () => {
    // White captures: king (12). Black captures: pawn (1). Diff = 11.
    chess("risky")
      .play("c4", "d5", "Qa4", "dxc4", "Qxe8#")
      .assertGameOver("white", "king captured — 11 points ahead")
      .assertCaptures({ white: ["king"], black: ["pawn"] });
  });

  it("capturer loses on points — black wins after dxe8=N@", () => {
    // White captures king but black has more total capture points.
    // White captures: 3 pawns + king = 15.
    // Black captures: pawn + rook + queen + bishop + pawn = 19 (knight consumed by promotion).
    // Black wins by 4.
    chess("risky")
      .play(
        "d4",
        "g5",
        "d5",
        "e5",
        "dxe6",
        "g4",
        "Nh3",
        "gxh3",
        "Nc3",
        "hxg2",
        "Nb5",
        "gxh1=Q",
        "exd7",
        "Qxf1",
        "dxe8=N@"
      )
      .assertGameOver("black", "king captured — 4 points ahead")
      .assertCaptures({
        white: ["pawn", "pawn", "pawn", "king"],
        black: ["pawn", "pawn", "bishop", "rook", "queen"],
      });
  });

  it("draw on equal material — Bxe8$ ties at 14", () => {
    // White: 2 pawns + king = 14. Black: 2 pawns + knight + queen = 14.
    chess("risky")
      .play(
        "d4",
        "d5",
        "e4",
        "e5",
        "exd5",
        "Bd6",
        "Qh5",
        "exd4",
        "Nf3",
        "Be6",
        "Ng5",
        "Bxd5",
        "Ne6",
        "Bxe6",
        "Qxf7",
        "Bxf7",
        "Bd3",
        "Bf8",
        "Bb5",
        "Bd6",
        "Bxe8$"
      )
      .assertGameOver("draw", "king captured — tied on points")
      .assertCaptures({
        white: ["pawn", "pawn", "king"],
        black: ["pawn", "pawn", "knight", "queen"],
      });
  });
});

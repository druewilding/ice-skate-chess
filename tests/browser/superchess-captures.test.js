// Superchess — amazon promotion capture pen accounting in the browser.
//
// Reproduces the two unit tests from superchess.test.js as browser tests
// to verify that the UI (capture pen icons and advantage labels) renders
// exactly what the engine computes, including preview state.
//
// Test 1 — Two amazon promotions: both promotions should independently
//   appear in the capture pens. The bug was that the second promotion
//   consumed the first from the opponent's pen instead of crediting a
//   a new amazon to the promoter.
//
// Test 2 — Full game with multiple amazon promotions, captures and
//   recaptures, verifying capture pens throughout until checkmate.

import { test } from "@playwright/test";

import { TwoPlayerGame } from "./harness.js";

test.describe("Superchess — amazon capture pen accounting", () => {
  let game;

  test.beforeAll(async ({ browser }) => {
    game = await TwoPlayerGame.create(browser, "superchess", "white");
  });

  test.afterAll(async () => {
    await game?.close();
  });

  test("two amazon promotions both appear in capture pens with correct previews", async () => {
    // a4 h5 a5 h4 a6 h3 axb7 — white captures b7 pawn
    await game.play("a4", "h5", "a5", "h4", "a6", "h3", "axb7");
    await game.assertCaptures("white", { lower: ["pawn"], upper: [] });
    await game.assertCaptures("black", { lower: [], upper: ["pawn"] });
    await game.assertAdvantage("white", { lower: 1, upper: 0 });

    // hxg2 — black captures g2 pawn, now equal
    await game.play("hxg2");
    await game.assertCaptures("white", { lower: ["pawn"], upper: ["pawn"] });
    await game.assertCaptures("black", { lower: ["pawn"], upper: ["pawn"] });
    await game.assertAdvantage("white", { lower: 0, upper: 0 });

    // Nf3, then preview gxh1=A before confirming
    await game.play("Nf3");
    await game.preview("gxh1=A");
    // Preview: black captures pawn(g2) + rook(h1); promoting pawn → white;
    // no white amazon ever captured so amazon goes into black's pen
    // black's page: lower (black's captures) should show [pawn, rook, amazon]
    await game.assertPreviewCaptures("black", {
      lower: ["pawn", "rook", "amazon"],
      upper: ["pawn", "pawn"],
    });
    await game.confirmPreview();

    // After commit: verify both perspectives see the same captures
    await game.assertCaptures("white", {
      lower: ["pawn", "pawn"],
      upper: ["pawn", "rook", "amazon"],
    });
    await game.assertCaptures("black", {
      lower: ["pawn", "rook", "amazon"],
      upper: ["pawn", "pawn"],
    });

    // Preview bxc8=A — the critical case: white promotes to amazon and captures bishop.
    // The amazon already in black's pen belongs to BLACK's own promotion, NOT a white piece.
    await game.preview("bxc8=A");
    await game.assertPreviewCaptures("white", {
      lower: ["pawn", "pawn", "bishop", "amazon"],
      upper: ["pawn", "pawn", "rook", "amazon"],
    });
    await game.confirmPreview();

    // Final state: both players see both amazons in the capture pens
    await game.assertCaptures("white", {
      lower: ["pawn", "pawn", "bishop", "amazon"],
      upper: ["pawn", "pawn", "rook", "amazon"],
    });
    await game.assertCaptures("black", {
      lower: ["pawn", "pawn", "rook", "amazon"],
      upper: ["pawn", "pawn", "bishop", "amazon"],
    });
    // black is 2 points ahead (rook=5 vs bishop=3)
    await game.assertAdvantage("white", { lower: 0, upper: 2 });
    await game.assertAdvantage("black", { lower: 2, upper: 0 });
  });
});

test.describe("Superchess — full game with amazon captures and checkmate", () => {
  let game;

  test.beforeAll(async ({ browser }) => {
    game = await TwoPlayerGame.create(browser, "superchess", "white");
  });

  test.afterAll(async () => {
    await game?.close();
  });

  test("amazons listed correctly through captures, recaptures, and checkmate", async () => {
    // Opening: pawn races and promotions
    await game.play("a4", "h5", "a5", "h4", "a6", "h3", "axb7", "hxg2", "Nf3", "gxh1=A", "bxc8=A", "Qxc8");

    // Manoeuvring: knight develops, amazon moves, bishop captured
    await game.play("Nc3", "Ag3", "d4", "Ag6", "Bf4", "Axf4", "d5", "e5", "dxe6", "Ke7", "exd7", "Kf6");
    await game.assertCaptures("white", {
      lower: ["pawn", "pawn", "pawn", "pawn", "bishop", "amazon"],
      upper: ["pawn", "pawn", "bishop", "rook", "amazon", "amazon"],
    });
    await game.assertCaptures("black", {
      lower: ["pawn", "pawn", "bishop", "rook", "amazon", "amazon"],
      upper: ["pawn", "pawn", "pawn", "pawn", "bishop", "amazon"],
    });
    await game.assertAdvantage("white", { lower: 0, upper: 16 });
    await game.assertAdvantage("black", { lower: 16, upper: 0 });

    // White promotes second amazon
    await game.play("dxc8=A");
    await game.assertCaptures("white", {
      lower: ["pawn", "pawn", "pawn", "pawn", "bishop", "queen", "amazon"],
      upper: ["pawn", "pawn", "pawn", "bishop", "rook", "amazon"],
    });
    await game.assertCaptures("black", {
      lower: ["pawn", "pawn", "pawn", "bishop", "rook", "amazon"],
      upper: ["pawn", "pawn", "pawn", "pawn", "bishop", "queen", "amazon"],
    });

    // Amazon and rook exchanges
    await game.play("Bb4", "Axc7", "Axc7");
    await game.assertCaptures("white", {
      lower: ["pawn", "pawn", "pawn", "pawn", "pawn", "bishop", "queen", "amazon"],
      upper: ["pawn", "pawn", "pawn", "bishop", "rook", "amazon", "amazon"],
    });
    await game.assertCaptures("black", {
      lower: ["pawn", "pawn", "pawn", "bishop", "rook", "amazon", "amazon"],
      upper: ["pawn", "pawn", "pawn", "pawn", "pawn", "bishop", "queen", "amazon"],
    });

    // Rook and queen exchanges, checks
    await game.play("Rxa7", "Rxa7", "Qd7", "Bxc3+");
    await game.play("Nd2", "Bxd2+", "Kxd2");
    await game.play("g5", "Qd6+", "Axd6+", "Kc3");
    await game.play("g4", "b4", "Rxh2");
    await game.assertCaptures("white", {
      lower: ["pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "bishop", "bishop", "queen", "amazon"],
      upper: [
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
    });
    await game.assertCaptures("black", {
      lower: [
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
      upper: ["pawn", "pawn", "pawn", "pawn", "pawn", "pawn", "bishop", "bishop", "queen", "amazon"],
    });

    // Final moves
    await game.play("b5", "Axb5+");
    await game.play("Kd2", "Ad4+", "Kc1", "Rxf2");
    await game.play("Bh3", "Rxe2");
    await game.play("c3", "Ac2#");

    // Game over — checkmate
    await game.assertGameOver("white", "You Lose", "by checkmate");
    await game.assertGameOver("black", "You Win!", "by checkmate");
  });
});

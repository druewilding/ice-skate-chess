// Replay of a real Dark Chess game from 2026-04-14.
// Tests captured-piece rendering from BOTH players' perspectives across
// the entire game, including history navigation and promotion preview.

import { test } from "@playwright/test";

import { TwoPlayerGame } from "../harness.js";

// Helper: assert captures from both POVs in one call.
// `caps` uses the engine convention: { white: [...], black: [...] }
// where white = pieces captured BY white, black = pieces captured BY black.
async function assertBothCaptures(game, caps) {
  // White's screen: lower = white's captures, upper = black's captures
  await game.assertCaptures("white", { lower: caps.white, upper: caps.black });
  // Black's screen: lower = black's captures, upper = white's captures
  await game.assertCaptures("black", { lower: caps.black, upper: caps.white });
}

test.describe("Dark Chess replay — 2026-04-14", () => {
  let game;

  test.beforeAll(async ({ browser }) => {
    game = await TwoPlayerGame.create(browser, "dark", "white");
  });

  test.afterAll(async () => {
    await game?.close();
  });

  test("capture accounting is correct from both perspectives throughout the game", async () => {
    // ── Opening: no captures ───────────────────────────────────────
    await game.play("e4", "Nf6");
    await assertBothCaptures(game, { white: [], black: [] });

    // ── First captures ─────────────────────────────────────────────
    await game.play("Qf3", "e6", "e5", "d6", "exf6", "gxf6");
    await assertBothCaptures(game, { white: ["knight"], black: ["pawn"] });

    await game.play("Bc4", "Rg8", "Nc3", "Rxg2");
    await assertBothCaptures(game, { white: ["knight"], black: ["pawn", "pawn"] });

    await game.play("Qxg2", "Bh6");
    await assertBothCaptures(game, { white: ["knight", "rook"], black: ["pawn", "pawn"] });

    // ── Reload #1: test Firebase round-trip of capturedPieces after first captures
    await game.reload("white");
    await game.reload("black");
    await assertBothCaptures(game, { white: ["knight", "rook"], black: ["pawn", "pawn"] });

    await game.play("Nf3", "f5", "d3", "Bxc1");
    await assertBothCaptures(game, {
      white: ["knight", "rook"],
      black: ["pawn", "pawn", "bishop"],
    });

    await game.play("Rxc1", "Qh4");
    await assertBothCaptures(game, {
      white: ["knight", "bishop", "rook"],
      black: ["pawn", "pawn", "bishop"],
    });

    await game.play("Nxh4", "f4");
    await assertBothCaptures(game, {
      white: ["knight", "bishop", "rook", "queen"],
      black: ["pawn", "pawn", "bishop"],
    });

    await game.play("Nb5", "f3", "Nxc7+", "Ke7");

    await game.play("Nxa8");
    await assertBothCaptures(game, {
      white: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "bishop"],
    });

    await game.play("fxg2");
    await assertBothCaptures(game, {
      white: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "bishop", "queen"],
    });

    // ── Reload #2: test snapshot rebuild after significant capture accumulation
    await game.reload("white");
    await game.reload("black");
    await assertBothCaptures(game, {
      white: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "bishop", "queen"],
    });

    // ── History navigation checkpoint ──────────────────────────────
    // Go to move 27 on white's page, check captures
    await game.goToMove("white", 27);
    await game.assertCaptures("white", {
      lower: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
      upper: ["pawn", "pawn", "bishop"],
    });

    // Go to move 27 on black's page too
    await game.goToMove("black", 27);
    await game.assertCaptures("black", {
      lower: ["pawn", "pawn", "bishop"],
      upper: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
    });

    // Return both to live
    await game.goToLive("white");
    await game.goToLive("black");
    await assertBothCaptures(game, {
      white: ["pawn", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "bishop", "queen"],
    });

    // ── Continue the game ──────────────────────────────────────────
    await game.play("Nxg2", "a5");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "bishop", "queen"],
    });

    await game.play("O-O", "Nc6", "Rfe1", "Ne5", "Rxe5");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "bishop", "queen"],
    });

    await game.play("dxe5");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "bishop", "rook", "queen"],
    });

    await game.play("f4", "exf4");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "pawn", "bishop", "rook", "queen"],
    });

    await game.play("Re1", "a4", "Rxe6+", "fxe6");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "pawn", "bishop", "rook", "rook", "queen"],
    });

    await game.play("b3", "axb3");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "pawn", "pawn", "bishop", "rook", "rook", "queen"],
    });

    await game.play("axb3", "f3");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "pawn", "pawn", "bishop", "rook", "rook", "queen"],
    });

    await game.play("Nc7", "fxg2");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "pawn", "pawn", "knight", "bishop", "rook", "rook", "queen"],
    });

    await game.play("Nxe6", "Bxe6");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
    });

    await game.play("Bb5", "Bxb3");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
    });

    await game.play("cxb3", "h5");
    await assertBothCaptures(game, {
      white: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "bishop", "rook", "rook", "queen"],
      black: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
    });

    await game.play("h4", "b6", "d4", "Kf6", "Be2", "b5", "Bxh5", "Kg7");
    await assertBothCaptures(game, {
      white: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
      black: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "rook", "rook", "queen"],
    });

    await game.play("d5", "Kh6", "Bg6", "Kxg6");
    await assertBothCaptures(game, {
      white: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
      black: ["pawn", "pawn", "pawn", "pawn", "pawn", "knight", "knight", "bishop", "bishop", "rook", "rook", "queen"],
    });

    await game.play("d6", "Kf5", "d7", "Kg4", "b4", "Kxh4");
    await assertBothCaptures(game, {
      white: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
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
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
    });

    // ── Reload #3: test snapshot rebuild right before promotion
    await game.reload("white");
    await game.reload("black");
    await assertBothCaptures(game, {
      white: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
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
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
    });

    // ── Promotion d8=Q+ ────────────────────────────────────────────
    await game.play("d8=Q+");
    await assertBothCaptures(game, {
      white: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
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
        "bishop",
        "rook",
        "rook",
      ],
    });

    // ── Reload #4: test post-promotion capture accounting after reload
    await game.reload("white");
    await game.reload("black");
    await assertBothCaptures(game, {
      white: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
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
        "bishop",
        "rook",
        "rook",
      ],
    });

    await game.play("Kg3");

    await game.play("Qd3+", "Kf4");

    await game.play("Kxg2", "Ke5");
    await assertBothCaptures(game, {
      white: [
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
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
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
        "bishop",
        "rook",
        "rook",
      ],
    });

    await game.play("Qxb5+", "Ke4");

    await game.play("Kf2", "Kd4", "Kf3", "Kc3", "Ke3", "Kc2", "Qd3+", "Kb2");

    await game.play("Kd2", "Ka2", "Kc2", "Ka1");
    await game.play("Qa3#");

    // ── Game over: check from both sides ───────────────────────────
    await game.assertGameOver("white", "You Win!");
    await game.assertGameOver("black", "You Lose");

    // ── Reload #5: test state after game over, before history review
    await game.reload("white");
    await game.reload("black");
    await game.assertGameOver("white", "You Win!");
    await game.assertGameOver("black", "You Lose");

    // ── History review after game over ─────────────────────────────
    await game.dismissGameOver("white");
    await game.dismissGameOver("black");

    // Go to move 1 — no captures yet
    await game.goToMove("white", 1);
    await game.assertCaptures("white", { lower: [], upper: [] });
    await game.goToMove("black", 1);
    await game.assertCaptures("black", { lower: [], upper: [] });

    // Go to move 72 (one BEFORE d8=Q+ promotion) — captures should NOT
    // include the promotion-related pawn yet (reproduces "one move too early" bug)
    await game.goToMove("white", 72);
    await game.assertCaptures("white", {
      lower: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
      upper: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
    });
    await game.goToMove("black", 72);
    await game.assertCaptures("black", {
      lower: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
      upper: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
    });

    // Go to move 73 (after d8=Q+) — check from both perspectives
    await game.goToMove("white", 73);
    await game.assertCaptures("white", {
      lower: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
      upper: [
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
        "bishop",
        "rook",
        "rook",
      ],
    });
    await game.goToMove("black", 73);
    await game.assertCaptures("black", {
      lower: [
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
        "bishop",
        "rook",
        "rook",
      ],
      upper: [
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "pawn",
        "knight",
        "knight",
        "bishop",
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
    });

    // Return to live — final position
    await game.goToLive("white");
    await game.goToLive("black");
    await assertBothCaptures(game, {
      white: [
        "pawn",
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
        "bishop",
        "rook",
        "rook",
        "queen",
      ],
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
        "bishop",
        "rook",
        "rook",
      ],
    });
  });
});

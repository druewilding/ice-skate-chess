// Risky Chess — game-over modal shows correct text for both players.
//
// Test 1 — White wins by king capture:
//   1. c4 d5  2. Qa4 dxc4  3. Qxe8#
//   White: king (12). Black: pawn (1). Diff = 11.
//
// Test 2 — Capturer loses on points (Black wins):
//   1. d4 g5  2. d5 e5  3. dxe6 g4  4. Nh3 gxh3  5. Nc3 hxg2
//   6. Nb5 gxh1=Q  7. exd7 Qxf1  8. dxe8=N@
//   White captures king but Black has 4 more points of material.
//
// Test 3 — Draw on equal material:
//   1. d4 d5  2. e4 e5  3. exd5 Bd6  4. Qh5 exd4  5. Nf3 Be6
//   6. Ng5 Bxd5  7. Ne6 Bxe6  8. Qxf7 Bxf7  9. Bd3 Bf8  10. Bb5 Bd6  11. Bxe8$
//   Both sides capture king + equal material (14 points each) = draw.

import { test } from "@playwright/test";

import { TwoPlayerGame } from "./harness.js";

test.describe("Risky Chess — game-over text from both perspectives", () => {
  let game;

  test.beforeAll(async ({ browser }) => {
    game = await TwoPlayerGame.create(browser, "risky", "white");
  });

  test.afterAll(async () => {
    await game?.close();
  });

  test("white sees 'points ahead', black sees 'points behind'", async () => {
    await game.play(
      "c4", // 1. white
      "d5", // 1. black
      "Qa4", // 2. white (in standard chess this would be Qa4+, but no check in risky)
      "dxc4", // 2. black captures pawn
      "Qxe8#" // 3. white captures black king — game over
    );

    // White (winner) sees "points ahead"
    await game.assertGameOver("white", "You Win!", "by king captured — 11 points ahead");

    // Black (loser) sees "points behind"
    await game.assertGameOver("black", "You Lose", "by king captured — 11 points behind");
  });
});

test.describe("Risky Chess — capturer loses on points", () => {
  let game;

  test.beforeAll(async ({ browser }) => {
    game = await TwoPlayerGame.create(browser, "risky", "white");
  });

  test.afterAll(async () => {
    await game?.close();
  });

  test("white captures king but black wins on material", async () => {
    // 1. d4 g5  2. d5 e5  3. dxe6 g4  4. Nh3 gxh3  5. Nc3 hxg2
    // 6. Nb5 gxh1=Q  7. exd7 Qxf1+  8. dxe8=N@
    // White captures: 3 pawns + king = 15 pts
    // Black captures: knight + rook + bishop + queen + 2 pawns = 19 pts (adjusted for promotion)
    // Black wins by 4 points
    await game.play(
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
    );

    // White (capturer but loser) sees "points behind"
    await game.assertGameOver("white", "You Lose", "by king captured — 4 points behind");

    // Black (winner on points) sees "points ahead"
    await game.assertGameOver("black", "You Win!", "by king captured — 4 points ahead");
  });
});

test.describe("Risky Chess — draw on equal material", () => {
  let game;

  test.beforeAll(async ({ browser }) => {
    game = await TwoPlayerGame.create(browser, "risky", "white");
  });

  test.afterAll(async () => {
    await game?.close();
  });

  test("king capture with tied points produces a draw", async () => {
    // 1. d4 d5  2. e4 e5  3. exd5 Bd6  4. Qh5 exd4  5. Nf3 Be6
    // 6. Ng5 Bxd5  7. Ne6 Bxe6  8. Qxf7 Bxf7  9. Bd3 Bf8  10. Bb5 Bd6  11. Bxe8$
    // White: 2 pawns + king = 14. Black: 2 pawns + knight + queen = 14. Draw.
    await game.play(
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
    );

    // Both players see "Draw" / "tied on points"
    await game.assertGameOver("white", "Draw", "by king captured — tied on points");
    await game.assertGameOver("black", "Draw", "by king captured — tied on points");
  });
});

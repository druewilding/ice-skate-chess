// Browser test harness — drives two real browser windows through Firebase.
//
// Usage:
//   import { test, expect } from "@playwright/test";
//   import { TwoPlayerGame } from "../harness.js";
//
//   test("my replay", async ({ browser }) => {
//     const game = await TwoPlayerGame.create(browser, "dark", "white");
//
//     await game.play("e4");            // white plays e2→e4
//     await game.play("e5");            // black plays e7→e5
//
//     // Assert captured pieces from both POVs
//     await game.assertCaptures("white", { upper: [], lower: [] });
//     await game.assertCaptures("black", { upper: [], lower: [] });
//
//     // History review — navigate and assert
//     await game.goToMove("white", 1);
//     await game.goToLive("white");
//
//     await game.close();
//   });

import { expect } from "@playwright/test";

const BASE = "http://localhost:3847";
const FILES = "abcdefgh";
const RANKS = "87654321"; // rank index 0 = "8", 7 = "1"

const PIECE_ORDER = ["pawn", "knight", "bishop", "rook", "queen", "amazon"];

function sortPieces(arr) {
  return [...arr].sort((a, b) => PIECE_ORDER.indexOf(a) - PIECE_ORDER.indexOf(b));
}

// ── Move‑notation parser (minimal, mirrors tests/parse-notation.js) ─

function parseNotation(san) {
  let s = san.replace(/[+#*$@!?]+$/, "").trim();

  // Castling
  if (s === "O-O" || s === "0-0") return { castle: "king" };
  if (s === "O-O-O" || s === "0-0-0") return { castle: "queen" };

  // Promotion
  let promotion = null;
  const promoMatch = s.match(/=([QRBNKA])$/i);
  if (promoMatch) {
    const map = { K: "knight", Q: "queen", R: "rook", B: "bishop", N: "knight", A: "amazon" };
    promotion = map[promoMatch[1].toUpperCase()];
    s = s.replace(/=[QRBNKA]$/i, "");
  }

  // Piece type
  const symbols = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", A: "amazon" };
  let pieceType = "pawn";
  if (/^[KQRBNKA]/.test(s)) {
    pieceType = symbols[s[0]];
    s = s.slice(1);
  }

  s = s.replace(/x/g, "");
  if (s.length < 2) throw new Error(`Cannot parse: "${san}"`);

  const toFile = FILES.indexOf(s[s.length - 2]);
  const toRank = RANKS.indexOf(s[s.length - 1]);
  if (toFile < 0 || toRank < 0) throw new Error(`Bad target in "${san}"`);

  const disambig = s.slice(0, -2);
  let disambigFile = null;
  let disambigRank = null;
  for (const ch of disambig) {
    if (FILES.includes(ch)) disambigFile = FILES.indexOf(ch);
    else if (RANKS.includes(ch)) disambigRank = RANKS.indexOf(ch);
  }

  return { pieceType, toRank, toFile, disambigFile, disambigRank, promotion };
}

// ── Read captures from the DOM ───────────────────────────────────────

/**
 * Read the capture pen contents from a page.
 * Returns { upper: string[], lower: string[], upperAdvantage: number, lowerAdvantage: number }
 * where each string is a piece name like "pawn", "knight", etc.
 */
async function readCaptures(page) {
  return page.evaluate(() => {
    function readPen(container) {
      if (!container) return { pieces: [], advantage: 0 };
      const imgs = container.querySelectorAll("img.captured-piece:not(.captured-piece--preview)");
      const pieces = [...imgs].map((img) => img.alt);
      const parent = container.parentElement;
      const advEl = parent?.querySelector(".captured-advantage");
      const advantage = advEl ? parseInt(advEl.textContent.replace("+", ""), 10) || 0 : 0;
      return { pieces, advantage };
    }
    const top = readPen(document.getElementById("captured-top"));
    const bottom = readPen(document.getElementById("captured-bottom"));
    return {
      upper: top.pieces,
      lower: bottom.pieces,
      upperAdvantage: top.advantage,
      lowerAdvantage: bottom.advantage,
    };
  });
}

/**
 * Read capture pen contents including preview pieces (pending move).
 */
async function readCapturesWithPreview(page) {
  return page.evaluate(() => {
    function readPen(container) {
      if (!container) return { pieces: [], preview: [] };
      const normal = [...container.querySelectorAll("img.captured-piece:not(.captured-piece--preview)")].map(
        (img) => img.alt
      );
      const preview = [...container.querySelectorAll("img.captured-piece.captured-piece--preview")].map(
        (img) => img.alt
      );
      const parent = container.parentElement;
      const advEl = parent?.querySelector(".captured-advantage");
      const advantage = advEl ? parseInt(advEl.textContent.replace("+", ""), 10) || 0 : 0;
      const isPreview = advEl ? advEl.classList.contains("captured-advantage--preview") : false;
      return { pieces: normal, preview, advantage, isPreview };
    }
    const top = readPen(document.getElementById("captured-top"));
    const bottom = readPen(document.getElementById("captured-bottom"));
    return { upper: top, lower: bottom };
  });
}

// ── TwoPlayerGame ────────────────────────────────────────────────────

export class TwoPlayerGame {
  /**
   * @param {import("@playwright/test").Page} whitePage
   * @param {import("@playwright/test").Page} blackPage
   */
  constructor(whitePage, blackPage) {
    this.pages = { white: whitePage, black: blackPage };
    this._moveCount = 0; // total half-moves played
  }

  /**
   * Create a two-player game.
   *
   * @param {import("@playwright/test").Browser} browser
   * @param {string} variant — "dark", "iceskate", "angry", "superchess", etc.
   * @param {string} creatorColor — which color creates the game ("white" | "black")
   * @returns {Promise<TwoPlayerGame>}
   */
  static async create(browser, variant, creatorColor = "white") {
    // ── Player 1: create the game ─────────────────────────────────
    const ctx1 = await browser.newContext();
    const p1 = await ctx1.newPage();
    await p1.goto(`${BASE}/index.html`);

    // Map variant to button ID
    const variantButtonMap = {
      iceskate: "btn-new-standard",
      "iceskate-960": "btn-new-960",
      angry: "btn-new-angry",
      "angry-960": "btn-new-angry-960",
      dark: "btn-new-dark",
      "dark-960": "btn-new-dark-960",
      superchess: "btn-new-superchess",
      "superchess-960": "btn-new-superchess-960",
      risky: "btn-new-risky",
      "risky-960": "btn-new-risky-960",
    };
    const btnId = variantButtonMap[variant];
    if (!btnId) throw new Error(`Unknown variant: "${variant}"`);

    await p1.click(`#${btnId}`);
    await p1.click(`#btn-color-${creatorColor}`);

    // Wait for navigation to game.html (serve may strip the .html extension)
    await p1.waitForURL(/game(\.html)?#/);

    // Wait for the waiting overlay to appear (has the game code)
    await p1.waitForSelector("#game-code-display");
    const gameCode = await p1.textContent("#game-code-display");

    // ── Player 2: join the game ───────────────────────────────────
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/game.html#${gameCode}`);

    // Wait for both pages to be active (waiting overlay hidden on p1)
    await p1.waitForFunction(() => document.getElementById("waiting-overlay").hidden, { timeout: 15_000 });

    // Wait for p2 to have the board rendered
    await p2.waitForSelector("#chess-board .square", { timeout: 10_000 });

    // Wait for white page to be interactive (it's white's turn first)
    const whitePage = creatorColor === "white" ? p1 : p2;
    const blackPage = creatorColor === "white" ? p2 : p1;

    // Give Firebase a moment to fully sync both sides
    await whitePage.waitForFunction(
      () => {
        const status = document.getElementById("game-status");
        return status && status.textContent.includes("Your turn");
      },
      { timeout: 10_000 }
    );

    return new TwoPlayerGame(whitePage, blackPage);
  }

  /** Get the page for the side whose turn it is. */
  get activePage() {
    return this._moveCount % 2 === 0 ? this.pages.white : this.pages.black;
  }

  /** Get the page for the side waiting. */
  get waitingPage() {
    return this._moveCount % 2 === 0 ? this.pages.black : this.pages.white;
  }

  /** Which color is to move. */
  get activeColor() {
    return this._moveCount % 2 === 0 ? "white" : "black";
  }

  // ── Playing moves ──────────────────────────────────────────────────

  /**
   * Play a move in algebraic notation on the active player's page.
   * Clicks the source square, then the destination, handles promotion
   * dialogs, then clicks confirm. Waits for the move to sync to the
   * other player's page.
   */
  async play(...moves) {
    for (const notation of moves) {
      await this._playOne(notation);
    }
    return this;
  }

  /**
   * Stage a move for preview without confirming it.
   * The confirm bar will be visible and capture pens show the preview state.
   * Call assertPreviewCaptures() to check the preview, then confirmPreview()
   * or cancelPreview() to proceed.
   */
  async preview(notation) {
    const page = this.activePage;
    const parsed = parseNotation(notation);

    if (parsed.castle) {
      await this._playCastling(page, parsed.castle);
    } else {
      const from = await this._findSourceSquare(page, parsed);
      const toSq = `[data-rank="${parsed.toRank}"][data-file="${parsed.toFile}"]`;
      const fromSq = `[data-rank="${from.rank}"][data-file="${from.file}"]`;

      await page.click(`#chess-board .square${fromSq}`);
      await page.click(`#chess-board .square${toSq}`);

      if (parsed.promotion) {
        const promoType = parsed.promotion;
        await page.click(`.promotion-overlay .promotion-choice:has(img[alt$="${promoType}"])`);
      }
    }

    // Wait for the confirm bar to appear (move is staged)
    await page.waitForFunction(() => !document.getElementById("confirm-move-bar").hidden, { timeout: 5_000 });
    return this;
  }

  /**
   * Confirm a previously previewed move and wait for sync.
   */
  async confirmPreview() {
    const page = this.activePage;
    await page.click("#btn-confirm-move");
    await page.waitForFunction(() => document.getElementById("confirm-move-bar").hidden, { timeout: 5_000 });

    this._moveCount++;

    const other = this.activePage;
    await other.waitForFunction(
      () => {
        const status = document.getElementById("game-status");
        return (
          (status && status.textContent.includes("Your turn")) ||
          !document.getElementById("game-over-overlay").hidden ||
          engine.gameOver
        );
      },
      { timeout: 10_000 }
    );
    return this;
  }

  /**
   * Cancel a previously previewed move (click anywhere on the board).
   */
  async cancelPreview() {
    const page = this.activePage;
    await page.click("#btn-cancel-move");
    await page.waitForFunction(() => document.getElementById("confirm-move-bar").hidden, { timeout: 5_000 });
    return this;
  }

  async _playOne(notation) {
    const page = this.activePage;
    const parsed = parseNotation(notation);

    if (parsed.castle) {
      await this._playCastling(page, parsed.castle);
    } else {
      // Find the source square by asking the engine in the browser
      const from = await this._findSourceSquare(page, parsed);
      const toSq = `[data-rank="${parsed.toRank}"][data-file="${parsed.toFile}"]`;
      const fromSq = `[data-rank="${from.rank}"][data-file="${from.file}"]`;

      // Click source square
      await page.click(`#chess-board .square${fromSq}`);
      // Click destination square
      await page.click(`#chess-board .square${toSq}`);

      // Handle promotion dialog if needed
      if (parsed.promotion) {
        const promoType = parsed.promotion;
        // The promotion dialog shows buttons with img alt="<color> <type>"
        await page.click(`.promotion-overlay .promotion-choice:has(img[alt$="${promoType}"])`);
      }
    }

    // Confirm the move
    await page.waitForFunction(() => !document.getElementById("confirm-move-bar").hidden, { timeout: 5_000 });
    await page.click("#btn-confirm-move");

    // Wait for the move to be applied locally (confirm bar hidden again)
    await page.waitForFunction(() => document.getElementById("confirm-move-bar").hidden, { timeout: 5_000 });

    this._moveCount++;

    // Wait for the move to sync to the other player via Firebase.
    // Accept either "Your turn" (game continues) or game over (checkmate/stalemate/draw).
    const other = this.activePage; // after incrementing, activePage is now the next mover
    await other.waitForFunction(
      () => {
        const status = document.getElementById("game-status");
        return (
          (status && status.textContent.includes("Your turn")) ||
          !document.getElementById("game-over-overlay").hidden ||
          engine.gameOver
        );
      },
      { timeout: 10_000 }
    );
  }

  async _playCastling(page, side) {
    // Find king position and castling destination by querying the engine
    const castleInfo = await page.evaluate((side) => {
      /* global engine */
      const color = engine.turn;
      const baseRank = color === "white" ? 7 : 0;
      for (let f = 0; f < 8; f++) {
        const p = engine.board[baseRank][f];
        if (p && p.type === "king" && p.color === color) {
          const moves = engine.getLegalMoves(baseRank, f);
          const castleMove = moves.find((m) => m.castling === side);
          if (castleMove) {
            return {
              fromRank: baseRank,
              fromFile: f,
              toRank: castleMove.rank,
              toFile: castleMove.file,
            };
          }
        }
      }
      return null;
    }, side);

    if (!castleInfo) throw new Error(`Castling ${side} not legal`);

    const fromSq = `[data-rank="${castleInfo.fromRank}"][data-file="${castleInfo.fromFile}"]`;
    const toSq = `[data-rank="${castleInfo.toRank}"][data-file="${castleInfo.toFile}"]`;

    await page.click(`#chess-board .square${fromSq}`);
    await page.click(`#chess-board .square${toSq}`);

    // If there's a castling disambiguation dialog (Chess960), pick "Castle"
    const hasCastleDialog = await page.$(".castling-choice");
    if (hasCastleDialog) {
      const buttons = await page.$$(".castling-choice");
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text.trim() === "Castle") {
          await btn.click();
          break;
        }
      }
    }
  }

  async _findSourceSquare(page, parsed) {
    return page.evaluate((p) => {
      /* global engine */
      const FILES = "abcdefgh";
      const RANKS = "87654321";
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const piece = engine.board[r][f];
          if (!piece || piece.color !== engine.turn || piece.type !== p.pieceType) continue;
          if (p.disambigFile !== null && f !== p.disambigFile) continue;
          if (p.disambigRank !== null && r !== p.disambigRank) continue;
          const moves = engine.getLegalMoves(r, f);
          const match = moves.find((m) => m.rank === p.toRank && m.file === p.toFile);
          if (match) return { rank: r, file: f };
        }
      }
      throw new Error(`No source for ${p.pieceType} → ${FILES[p.toFile]}${RANKS[p.toRank]} (${engine.turn} to move)`);
    }, parsed);
  }

  async _isGameOver(page) {
    return page.evaluate(() => engine.gameOver);
  }

  // ── Capture assertions ─────────────────────────────────────────────

  /**
   * Assert the capture pens displayed on a specific player's page.
   *
   * @param {string} color — "white" or "black" (whose page to check)
   * @param {object} expected — { upper: string[], lower: string[] }
   *   upper = the capture pen at the top of *their* screen
   *   lower = the capture pen at the bottom of *their* screen
   *
   * For the white player:  lower = white's captures (black pieces),
   *                        upper = black's captures (white pieces).
   * For the black player:  lower = black's captures (white pieces),
   *                        upper = white's captures (black pieces).
   */
  async assertCaptures(color, expected) {
    const page = this.pages[color];
    const caps = await readCaptures(page);
    const actualUpper = sortPieces(caps.upper);
    const actualLower = sortPieces(caps.lower);
    const expUpper = sortPieces(expected.upper || []);
    const expLower = sortPieces(expected.lower || []);

    expect(actualUpper, `${color} upper capture pen`).toEqual(expUpper);
    expect(actualLower, `${color} lower capture pen`).toEqual(expLower);
    return this;
  }

  /**
   * Assert material advantage displayed on a player's page.
   * @param {string} color — "white" or "black"
   * @param {object} expected — { upper: number, lower: number }
   */
  async assertAdvantage(color, expected) {
    const page = this.pages[color];
    const caps = await readCaptures(page);
    expect(caps.upperAdvantage, `${color} upper advantage`).toBe(expected.upper);
    expect(caps.lowerAdvantage, `${color} lower advantage`).toBe(expected.lower);
    return this;
  }

  /**
   * Assert captures while a move is being previewed (pending confirm).
   * Call after playing a partial move (before confirm).
   */
  async assertPreviewCaptures(color, expected) {
    const page = this.pages[color];
    const caps = await readCapturesWithPreview(page);

    const upperAll = sortPieces([...caps.upper.pieces, ...caps.upper.preview]);
    const lowerAll = sortPieces([...caps.lower.pieces, ...caps.lower.preview]);
    const expUpper = sortPieces(expected.upper || []);
    const expLower = sortPieces(expected.lower || []);

    expect(upperAll, `${color} upper preview captures`).toEqual(expUpper);
    expect(lowerAll, `${color} lower preview captures`).toEqual(expLower);
    return this;
  }

  // ── History navigation ─────────────────────────────────────────────

  /**
   * Navigate a player's page to a specific move number in review mode.
   * @param {string} color — "white" or "black" (whose page to navigate)
   * @param {number} moveIndex — 0 = start, 1 = after first move, etc.
   */
  async goToMove(color, moveIndex) {
    const page = this.pages[color];

    // First go to start (force: true because the button may be disabled when already at position 0)
    await page.click("#btn-review-start", { force: true });
    await page.waitForTimeout(300);

    // Then step forward to the desired position
    for (let i = 0; i < moveIndex; i++) {
      await page.click("#btn-review-next");
      await page.waitForTimeout(200);
    }

    return this;
  }

  /**
   * Return a player's page to the live position.
   * @param {string} color — "white" or "black"
   */
  async goToLive(color) {
    const page = this.pages[color];
    await page.click("#btn-review-end", { force: true });
    await page.waitForTimeout(300);
    return this;
  }

  // ── Game over ──────────────────────────────────────────────────────

  /**
   * Assert the game-over overlay is showing on a player's page.
   */
  async assertGameOver(color, expectedTitle, expectedReason) {
    const page = this.pages[color];
    await page.waitForFunction(() => !document.getElementById("game-over-overlay").hidden, { timeout: 5_000 });
    if (expectedTitle) {
      const title = await page.textContent("#game-over-title");
      expect(title.trim(), `${color} game-over title`).toBe(expectedTitle);
    }
    if (expectedReason) {
      const reason = await page.textContent("#game-over-reason");
      expect(reason.trim(), `${color} game-over reason`).toBe(expectedReason);
    }
    return this;
  }

  /**
   * Dismiss the game-over overlay (click "Review Game") on a player's page.
   */
  async dismissGameOver(color) {
    const page = this.pages[color];
    await page.click("#btn-review-game");
    await page.waitForFunction(() => document.getElementById("game-over-overlay").hidden, { timeout: 3_000 });
    return this;
  }

  // ── Page reload ─────────────────────────────────────────────────────

  /**
   * Reload a player's page and wait for Firebase to re-sync.
   * Simulates a real user refreshing the browser mid-game.
   *
   * @param {string} color — "white" or "black"
   */
  async reload(color) {
    const page = this.pages[color];
    await page.reload({ waitUntil: "domcontentloaded" });

    // Wait for the board to render
    await page.waitForSelector("#chess-board .square", { timeout: 10_000 });

    // Wait for Firebase state to sync — status shows "Your turn" or
    // "Opponent's turn" or game is over
    await page.waitForFunction(
      () => {
        const status = document.getElementById("game-status");
        if (!status) return false;
        const text = status.textContent;
        return (
          text.includes("Your turn") ||
          text.includes("Opponent") ||
          !document.getElementById("game-over-overlay").hidden ||
          (typeof engine !== "undefined" && engine.gameOver)
        );
      },
      { timeout: 15_000 }
    );

    // Small additional settle time for capture pen rendering
    await page.waitForTimeout(500);
  }

  // ── Game actions ───────────────────────────────────────────────────

  /**
   * Resign on a player's page. Handles the window.confirm dialog automatically.
   * Waits for the game-over overlay to appear.
   * @param {string} color — "white" or "black"
   */
  async resign(color) {
    const page = this.pages[color];
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#btn-resign");
    await page.waitForFunction(() => !document.getElementById("game-over-overlay").hidden, { timeout: 5_000 });
    return this;
  }

  /**
   * Offer a draw on a player's page.
   * @param {string} color — "white" or "black"
   */
  async offerDraw(color) {
    const page = this.pages[color];
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#btn-draw");
    return this;
  }

  /**
   * Accept a draw offer on a player's page.
   * Waits for the draw-offer banner to be visible first, then clicks Accept.
   * Waits for the game-over overlay to appear on that page.
   * @param {string} color — "white" or "black"
   */
  async acceptDraw(color) {
    const page = this.pages[color];
    await page.waitForFunction(() => !document.getElementById("draw-offer-banner").hidden, { timeout: 8_000 });
    await page.click("#btn-accept-draw");
    await page.waitForFunction(() => !document.getElementById("game-over-overlay").hidden, { timeout: 8_000 });
    return this;
  }

  // ── Dark Chess assertions ──────────────────────────────────────────

  /**
   * Assert that no squares on a player's board are dark-shrouded (board is fully revealed).
   * @param {string} color — "white" or "black"
   */
  async assertBoardRevealed(color) {
    const page = this.pages[color];
    const count = await page.evaluate(() => document.querySelectorAll("#chess-board .dark-shrouded").length);
    expect(count, `${color} board should be fully revealed (no dark-shrouded squares)`).toBe(0);
    return this;
  }

  /**
   * Assert that no move-list entries are hidden with the dark-hidden class.
   * @param {string} color — "white" or "black"
   */
  async assertMoveNotationRevealed(color) {
    const page = this.pages[color];
    const count = await page.evaluate(() => document.querySelectorAll(".move-notation--dark-hidden").length);
    expect(count, `${color} move notation should have no hidden entries`).toBe(0);
    return this;
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  async close() {
    for (const page of Object.values(this.pages)) {
      await page.context().close();
    }
  }
}

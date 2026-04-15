# Chess Variants

A vanilla JS progressive web app implementing chess variants with real-time multiplayer and local bot play.

**Play now at [druewilding.com/chess](https://www.druewilding.com/chess/)**

## Variants

### Ice Skate Chess

Sliding pieces (bishop, rook, queen) must travel the maximum possible distance; they cannot stop early.

![Ice Skate Chess](assets/images/ice-skate-chess.png)

### Angry Chess

Players may capture their own pieces (except the king).

![Angry Chess](assets/images/angry-chess.png)

### Dark Chess

Standard chess, but the board is shrouded in darkness. Tap a piece to shine a torch and reveal enemies in its path.

![Dark Chess](assets/images/dark-chess.png)

### Superchess

The same as standard chess, until you get to promotion, at which point you can claim an Amazon, a powerful piece combining the abilities of both a queen and a knight.

![Superchess](assets/images/superchess.png)

### Chess960

All variants have a **Chess960** (Fischer Random) mode, where the back rank pieces are shuffled into one of 960 possible starting positions.

![Chess960](assets/images/chess-960.png)

## Features

- Real-time multiplayer via Firebase Realtime Database
- Bot opponent with adjustable difficulty
- Push notifications for your opponent's move
- Offline support via service worker
- Snapshot replay — step through any move in the game history

## Tech Stack

- Vanilla JS, HTML, CSS — no build step
- Firebase Realtime Database (multiplayer sync) and Cloud Functions (push notifications)
- Hosted on GitHub Pages

## Project Structure

| File                 | Responsibility                                            |
| -------------------- | --------------------------------------------------------- |
| `index.html`         | Lobby — variant picker, game creation/joining, bot launch |
| `game.html`          | Gameplay — board, move history, bot AI, Firebase sync     |
| `js/chess-engine.js` | Rules engine — move generation, legality, check/checkmate |
| `js/chess-ui.js`     | Board rendering — piece display, selection, animation     |
| `js/game-manager.js` | Firebase — game creation, real-time sync, draw offers     |
| `functions/index.js` | Cloud Function — FCM push notifications                   |

## Testing

### Unit tests (Vitest)

Tests are written with [Vitest](https://vitest.dev/) and live in the `tests/` directory. They cover all five variants: standard chess, Ice Skate, Angry, Dark, and Superchess.

```bash
npm test            # single run
npm run test:watch  # watch mode
```

| File                       | What's tested                                                         |
| -------------------------- | --------------------------------------------------------------------- |
| `tests/standard.test.js`   | Captures, castling, en passant, promotion, stalemate, notation, draws |
| `tests/angry.test.js`      | Friendly captures, capture accounting, `*` notation, checkmate cases  |
| `tests/dark.test.js`       | Rules parity with standard, Scholar's mate, castling, en passant      |
| `tests/iceskate.test.js`   | Forced maximum slide, check-blocking exception, captures              |
| `tests/superchess.test.js` | Amazon promotion, amazon movement (queen + knight), checkmate         |

Unit tests run automatically on every pull request via GitHub Actions.

### Browser tests (Playwright)

End-to-end tests spin up two real browser windows connected through Firebase and play actual multiplayer games. They live in `tests/browser/` and use a `TwoPlayerGame` harness that handles game creation, move input, and Firebase sync.

```bash
npm run test:browser           # run all browser tests headlessly
npm run test:browser:headed    # run with visible browser windows (useful for debugging)

# Run a single test file:
npx playwright test tests/browser/dark-chess-draw.test.js

# Run a single test file with visible browser windows:
npx playwright test tests/browser/dark-chess-draw.test.js --headed
```

Browser tests require a running local server — the Playwright config starts one automatically via `start-test.sh`.

## Running Locally

```bash
cp .env.example .env
# Fill in your Firebase credentials in .env
./start.sh
```

No build step required. Multiplayer and push notifications require a Firebase project configured via `.env`.

## Deploying the Push Notification Function

The Cloud Function in [functions/index.js](functions/index.js) sends push notifications when it's a player's turn. To deploy it:

1. **Install Firebase CLI** (if not already installed):

   ```bash
   npm install -g firebase-tools
   ```

2. **Authenticate with Firebase**:

   ```bash
   firebase login
   ```

3. **Deploy the function**:
   ```bash
   firebase deploy --only functions
   ```

**Requirements:**

- Your Firebase project must have **Blaze (pay-as-you-go) billing enabled** — the Cloud Function cannot send FCM messages on the free Spark plan
- The function is deployed to `europe-west1` to match the Realtime Database region
- It triggers on writes to `games/{gameId}/lastMoveAt` and sends a data-only FCM message to the player whose turn it is

For more details, see the [functions/index.js](functions/index.js) implementation.

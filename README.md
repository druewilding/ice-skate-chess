# Chess Variants

A vanilla JS progressive web app implementing chess variants with real-time multiplayer and local bot play.

**Play now at [druewilding.com/chess](https://www.druewilding.com/chess/)**

## Variants

- **Ice Skate Chess** — Sliding pieces (bishop, rook, queen) must travel the maximum possible distance; they cannot stop early.
- **Angry Chess** — Players may capture their own pieces (except the king).
- **Dark Chess** — Standard chess, but the board is shrouded in darkness. Tap a piece to shine a torch and reveal enemies in its path.
- All three variants have a **Chess960** (Fischer Random) mode.

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

## Running Locally

```bash
cp .env.example .env
# Fill in your Firebase credentials in .env
./start.sh
```

No build step required. Multiplayer and push notifications require a Firebase project configured via `.env`.

# Chess Variants PWA

A vanilla JS progressive web app implementing chess variants with real-time multiplayer (Firebase) and local bot play.

## Variants

- **Ice Skate Chess** — Sliding pieces (bishop, rook, queen) must travel maximum distance; cannot stop early. Exception: when in check, a piece may stop at an intermediate square that blocks the check.
- **Angry Chess** — Players can capture their own pieces (except king). Friendly captures are marked with `*` in notation and blue highlights in the UI.
- **Dark Chess** — Standard chess rules, but the board is shrouded in darkness. Own pieces are always visible; enemy pieces are hidden. Selecting (tapping) a friendly piece "shines a torch", illuminating its legal move squares and revealing any enemy pieces there. The `dark` flag on the engine is purely informational (no rule changes); all hiding is handled by `ChessUI` via the `dark`, `playerColor`, and `darkRevealed` properties.
- **Superchess** — Standard chess rules, but pawns can promote to an Amazon (queen+knight combo piece). The Amazon moves as either a queen or a knight, making it a powerful addition to the game.  The Amazon's movement and notation are handled by treating it as a separate piece type in `chess-engine.js` and `chess-ui.js`.
- **Chess960 (Fischer Random)** — Randomised back-rank setup. All variants above have a 960 mode.

## Architecture

| File                    | Responsibility                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `index.html`            | Lobby — variant picker, game creation/joining, bot launch                                          |
| `game.html`             | Gameplay — board, move history, captured pieces, bot AI, snapshot replay, Firebase sync            |
| `js/chess-engine.js`    | Rules engine — move generation, legality, check/checkmate, serialisation, captured pieces tracking |
| `js/chess-ui.js`        | Board rendering — piece display, selection, move confirmation, animation, captured pieces display  |
| `js/game-manager.js`    | Firebase — game creation/joining, real-time state sync, draw offers, FCM tokens                    |
| `js/firebase-config.js` | Firebase project config                                                                            |
| `sw.js`                 | Service worker — offline caching, push notifications                                               |

## Critical gotchas

### Chess960 castling overlaps
In 960, the king's destination can coincide with the rook's starting square (or vice versa). The engine pre-saves the rook piece before moving the king to avoid data loss. `getVisualPiece()` in the UI checks destinations before sources for the same reason.

### Castling vs friendly capture ambiguity (Angry Chess960)
In Angry Chess960, a king moving to a friendly rook's square could be either a castling move or a friendly capture. The `castling` property on move objects **must** be preserved and passed through all code paths — `makeMove()`, `buildPositionSnapshots()`, bot `makeBotMove()`, and `confirmPendingMove()`. Dropping it causes `makeMove` to match the friendly-capture variant instead, corrupting `capturedPieces` and the board from that point onward.

### Captured pieces accounting
`capturedPieces.white` tracks pieces captured **by** white (displayed as black piece icons). For friendly captures (Angry Chess), the captured piece is credited to the **opponent's** list since they benefit from the material loss. Promotion adds a pawn to the opponent's list and either removes a matching piece type from their list (piece "returned") or credits the promoter.

### Snapshot replay system
`positionSnapshots[i]` is the serialised engine state after move i (index 0 = starting position). Rebuilds replay a temp engine from `startingBoard` with 960 initial positions (`initialKingFile`, `initialRookFiles`) and pass `move.castling` to `makeMove`. Missing either causes incorrect castling rights or castling-as-capture misidentification.

### Firebase data normalisation
Firebase strips `null` from arrays and may convert arrays to objects with numeric keys. `deserialize()` rebuilds the board as a proper 8×8 array, normalises `moveHistory` and `capturedPieces` via `Object.values()`, and infers 960 positions from `startingBoard` if not explicitly stored.

### Confirm-move flow
Moves are staged in `pendingMoveConfirm` before execution. `getVisualPiece()` shows the piece at its destination during preview. `updateCapturedPieces()` adjusts the display to reflect the pending capture/promotion. The `castling`, `enPassant`, and `promotion` properties must all be preserved on the pending object.

### En passant
The captured pawn sits on `(fromRank, toFile)` — not the destination square. `makeMove()` removes it from that square explicitly after the moving pawn has been placed. In `getVisualPiece()` the captured pawn must be hidden at `(fromRank, toFile)` during pending-move preview. In `updateCapturedPieces()` the pending capture is also read from `(fromRank, toFile)` rather than the destination.

### Promotion
When a pawn promotes: the opponent gains a pawn in their `capturedPieces` list (it "left" the board), and the promoted piece either comes back from the opponent's existing captures (removed from their list) or, if they never captured one, is added to the promoter's list. The UI pending-move preview adjusts displayed piece icons and material score accordingly before the move is confirmed.

### Ice Skate check-blocking exception
`getLegalMoves()` applies ice skate restrictions in two stages: first generate all pseudo-legal sliding moves, filter for legality (not leaving king in check), then restrict to `getIceskateEndpointSet()` — but **only when the king is not already in check**. When in check, the full set of legal intermediate squares is kept so the player can block. `getIceskateEndpointSet()` walks each direction to find the last reachable square (including stops on enemy pieces), building a `Set` of `"rank,file"` strings. Modifying sliding move generation or check detection without accounting for this two-phase filter will break the check-blocking exception.

### Draw detection
Four automatic draw conditions are checked at the end of `makeMove()`, in this order:
- **50-move rule** — `halfMoveClock` increments on every non-pawn, non-capture move and resets to 0 on a pawn move or capture. When it reaches 100 (50 full moves), the game ends as a draw with `resultReason: 'fifty-move rule'`.
- **Threefold repetition** — `positionHistory` maps a compact position hash (active color + all 64 squares + castling rights + en passant file) to a count. `recordPosition()` increments the count and returns it; when it hits 3, the game ends as a draw with `resultReason: 'repetition'`. Both are serialised and restored so repetition tracking survives page reloads and Firebase sync.
- **Insufficient material** — `hasInsufficientMaterial()` scans the board after every move and returns true for K-K, K+B-K, K+N-K, and K+B-K+B with both bishops on the same square colour. Results in `resultReason: 'insufficient material'`. K+N-K+N is intentionally excluded (a helpmate is theoretically possible). This check runs last among the automatic draws, guarded by `!this.gameOver`.

### Move notation
`getMoveNotation()` produces standard algebraic notation with custom suffixes:
- `*` — friendly capture (Angry Chess)
- `$` — move ends the game as a draw: stalemate (`moveData.stalemate`), or one of the three rule-based draws — fifty-move rule, threefold repetition, insufficient material (`moveData.draw`)
- `+` — check, `#` — checkmate (standard)
- `=Q` etc — promotion piece

Disambiguation (`Rae1`, `R1e3`, etc.) is computed by `computeDisambiguation()` **before** the move is applied. Critically, it **temporarily disables ice skate mode** while checking whether other same-type pieces could reach the same square — because ice skate restrictions don't exist in standard notation and would produce incorrect disambiguation strings.

## Bot AI

Bot games are launched via hash `game.html#bot:variant:color`. The bot scores every legal move each turn:

| Criterion                            | Score                              |
| ------------------------------------ | ---------------------------------- |
| Capture opponent piece               | piece value (Q=9, R=5, B/N=3, P=1) |
| Friendly capture (Angry Chess)       | −piece value                       |
| En passant                           | +2                                 |
| Castling                             | +4                                 |
| Gives check                          | +10                                |
| Gives checkmate                      | +20                                |
| Lands on centre (d4/e4/d5/e5)        | +2                                 |
| Lands on extended centre             | +1                                 |
| Pawn two-square advance              | +1                                 |
| Develops knight/bishop off back rank | +1/+2                              |
| King move (non-castling)             | −3                                 |

After scoring, the bot **randomly ignores the scores 30% of the time** and picks any non-negative move at random instead. The other 70% it plays the highest-scoring move, breaking ties randomly. This makes it imperfect but unpredictable. In the random pool, moves with negative scores (e.g. pointless friendly captures) are excluded unless all moves are negative.

The random rate is controlled by `BOT_RANDOM_RATE` at the top of `makeBotMove()` in `game.html`. Set it to `0` for a fully deterministic bot, or `1` for a completely random one.

## Deployment

### Frontend — GitHub Pages
All static files (`index.html`, `game.html`, `js/`, `css/`, `assets/`, `sw.js`, `manifest.json`) are served directly from GitHub Pages. No build step. Hash-based routing (`game.html#gameId`) means the server never needs to handle deep links.

### Backend — Firebase Cloud Function
Push notifications are handled by a single Cloud Function in `functions/index.js`, deployed to Firebase (europe-west1 to match the Realtime Database region). It triggers on writes to `games/{gameId}/lastMoveAt`, which `sendGameState()` in `game-manager.js` touches on every move.

The function:
1. Reads the full game state to find whose turn it is (`game.state.turn`)
2. Looks up that player's FCM token from `game.players[color].fcmToken`
3. Sends a **data-only** FCM message (no `notification` payload) so the service worker's `push` handler controls display — this ensures the notification includes a click URL back to the game
4. Silently swallows errors for expired/invalid tokens so a stale token doesn't crash the function

To deploy: `firebase deploy --only functions` from the repo root. The function requires the Firebase project to have Blaze (pay-as-you-go) billing enabled for outbound FCM calls.

## Routing
Hash-based (`game.html#gameId` or `game.html#bot:variant:color`) so static hosts never strip the game code.

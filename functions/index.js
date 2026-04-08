const { onValueWritten } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getDatabase } = require("firebase-admin/database");

initializeApp();

// Fires whenever a move is made (lastMoveAt is written by sendGameState()).
// Looks up whose turn it now is, finds their FCM token, and sends a push.
exports.notifyPlayerTurn = onValueWritten(
  {
    ref: "games/{gameId}/lastMoveAt",
    // Must match the region your Realtime Database is in.
    region: "europe-west1",
    instance: "ice-skate-chess-default-rtdb",
  },
  async (event) => {
    // Ignore deletions
    if (!event.data.after.exists()) return;

    const gameId = event.params.gameId;
    const db = getDatabase();
    const gameSnap = await db.ref(`games/${gameId}`).get();
    const game = gameSnap.val();

    if (!game?.state || game.state.gameOver) return;

    const currentTurn = game.state.turn; // 'white' or 'black'
    const token = game.players?.[currentTurn]?.fcmToken;
    const gameUrl = game.players?.[currentTurn]?.gameUrl || "";

    if (!token) return;

    try {
      await getMessaging().send({
        token,
        // Send as data-only so our sw.js push handler displays the notification
        // (avoids the browser auto-displaying it with no click URL).
        data: {
          title: "Ice Skate Chess",
          body: "It's your turn!",
          url: gameUrl,
        },
        webpush: {
          headers: { Urgency: "high" },
        },
      });
    } catch (err) {
      // Log but don't throw — a bad/expired token shouldn't crash the function.
      console.error("Failed to send push notification:", err.message);
    }
  }
);

// Game Manager - handles Firebase sync, game creation/joining

import firebaseConfig from './firebase-config.js';

export class GameManager {
  constructor() {
    this.app = null;
    this.db = null;
    this.gameRef = null;
    this.gameId = null;
    this.playerColor = null;
    this.onGameStateChanged = null;
    this.onPlayerJoined = null;
    this.onGameOver = null;
    this.unsubscribe = null;
  }

  async init() {
    // Dynamic import of Firebase SDK from CDN
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js');
    const { getDatabase, ref, set, get, onValue, update, push, onDisconnect, serverTimestamp }
      = await import('https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js');

    this.app = initializeApp(firebaseConfig);
    // Pass databaseURL explicitly — required for non-US regions (Europe, Asia, etc.)
    this.db = getDatabase(this.app, firebaseConfig.databaseURL);

    // Store Firebase functions for later use
    this._fb = { ref, set, get, onValue, update, push, onDisconnect, serverTimestamp };
  }

  generateGameId() {
    // Generate a short, readable game ID
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  async createGame(variant = 'iceskate', creatorColor = 'white') {
    const { ref, set, serverTimestamp } = this._fb;

    this.gameId = this.generateGameId();
    this.playerColor = creatorColor;

    const gameData = {
      variant,
      status: 'waiting', // waiting, active, finished
      players: {
        [creatorColor]: { connected: true, joinedAt: Date.now() },
      },
      createdAt: Date.now(),
      state: null, // Will be set when game starts
    };

    this.gameRef = ref(this.db, `games/${this.gameId}`);
    await set(this.gameRef, gameData);

    this.listenForChanges();

    return this.gameId;
  }

  async joinGame(gameId) {
    const { ref, get, update } = this._fb;

    this.gameId = gameId;
    this.gameRef = ref(this.db, `games/${this.gameId}`);

    // Get current game data
    const snapshot = await get(this.gameRef);
    if (!snapshot.exists()) {
      throw new Error('Game not found');
    }

    const gameData = snapshot.val();

    if (gameData.status === 'finished') {
      throw new Error('Game is already finished');
    }

    const hasWhite = !!gameData.players?.white;
    const hasBlack = !!gameData.players?.black;

    if (hasWhite && hasBlack) {
      throw new Error('Game is full');
    }

    const joinColor = hasWhite ? 'black' : 'white';
    this.playerColor = joinColor;

    await update(this.gameRef, {
      [`players/${joinColor}`]: { connected: true, joinedAt: Date.now() },
      status: 'active',
    });

    // Note: listenForChanges() is NOT called here.
    // game.html sets up callbacks first, then calls listenForChanges itself.
    return this.playerColor;
  }

  listenForChanges() {
    const { ref, onValue } = this._fb;

    this.unsubscribe = onValue(this.gameRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();

      if (data.status === 'active' && this.onPlayerJoined) {
        this.onPlayerJoined(data);
      }

      if (data.state && this.onGameStateChanged) {
        this.onGameStateChanged(data.state, data);
      }

      if (data.status === 'finished' && this.onGameOver) {
        this.onGameOver(data);
      }
    });
  }

  async sendGameState(engineState) {
    const { update } = this._fb;

    await update(this.gameRef, {
      state: engineState,
      lastMoveAt: Date.now(),
    });
  }

  async sendResignation(color) {
    const { update } = this._fb;

    const winner = color === 'white' ? 'black' : 'white';
    await update(this.gameRef, {
      status: 'finished',
      'state/gameOver': true,
      'state/result': winner,
      'state/resultReason': 'resignation',
      lastMoveAt: Date.now(),
    });
  }

  async offerDraw(color) {
    const { update } = this._fb;
    await update(this.gameRef, {
      [`drawOffer`]: color,
    });
  }

  async acceptDraw() {
    const { update } = this._fb;
    await update(this.gameRef, {
      status: 'finished',
      drawOffer: null,
      'state/gameOver': true,
      'state/result': 'draw',
      'state/resultReason': 'agreement',
      lastMoveAt: Date.now(),
    });
  }

  async declineDraw() {
    const { update } = this._fb;
    await update(this.gameRef, {
      drawOffer: null,
    });
  }

  async registerFCMToken(myColor) {
    if (!firebaseConfig.vapidKey) return;
    if (!('serviceWorker' in navigator)) return;
    try {
      const { getMessaging, getToken } = await import('https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging.js');
      const messaging = getMessaging(this.app);
      const swReg = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, {
        vapidKey: firebaseConfig.vapidKey,
        serviceWorkerRegistration: swReg,
      });
      if (!token) return;
      const { update } = this._fb;
      await update(this.gameRef, {
        [`players/${myColor}/fcmToken`]: token,
        [`players/${myColor}/gameUrl`]: window.location.href,
      });
    } catch (err) {
      console.warn('[FCM] Token registration failed:', err.message);
    }
  }

  getShareLink() {
    // Use hash routing — the hash is never sent to the server so static hosts
    // (serve, GitHub Pages, Netlify, etc.) cannot strip or redirect it.
    const base = window.location.href
      .replace(/#.*$/, '')          // strip existing hash
      .replace(/game(\.html)?$/, '') // strip game / game.html filename
      .replace(/\/$/, '');           // strip trailing slash
    return `${base}/game.html#${this.gameId}`;
  }

  disconnect() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

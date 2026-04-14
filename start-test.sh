#!/bin/bash
# Starts the app on a dedicated port for Playwright tests.
# Replicates what start.sh does (env → firebase config) but on port 3847
# so it doesn't clash with a dev server on the default port.
set -a
source .env
set +a

cat > js/firebase-config.js <<EOF
export default {
  apiKey: "$FIREBASE_API_KEY",
  authDomain: "$FIREBASE_AUTH_DOMAIN",
  databaseURL: "$FIREBASE_DATABASE_URL",
  projectId: "$FIREBASE_PROJECT_ID",
  storageBucket: "$FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "$FIREBASE_MESSAGING_SENDER_ID",
  appId: "$FIREBASE_APP_ID",
  vapidKey: "$FIREBASE_VAPID_KEY",
};
EOF

npx serve . -l 3847 --no-clipboard

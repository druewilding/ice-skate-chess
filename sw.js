// Ice Skate Chess — Service Worker
// Enables PWA installability and handles Web Push notifications (Tier 2).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// --- Push: triggered by a Firebase Cloud Function ---
self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {};
  // FCM wraps data-only messages as { data: { title, body, url } };
  // fall back to the flat payload shape just in case.
  const data = payload.data ?? payload;
  const title = data.title ?? 'Ice Skate Chess';
  const options = {
    body: data.body ?? "It's your turn!",
    tag: 'your-turn',        // replaces any existing notification
    renotify: true,
    icon: data.icon ?? null,
    vibrate: [200, 100, 200], // triggers lock-screen display on Android
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// --- Notification click: focus or open the game tab ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

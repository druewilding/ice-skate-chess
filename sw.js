// Ice Skate Chess — Service Worker
// Enables PWA installability and handles Web Push notifications (Tier 2).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// --- Push: triggered by a Firebase Cloud Function ---
self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {};
  const data = payload.data ?? payload;
  const title = data.title ?? 'Ice Skate Chess';
  const options = {
    body: data.body ?? "It's your turn!",
    tag: data.tag ?? 'your-turn',
    renotify: true,
    icon: data.icon ?? '/ice-skate-chess/assets/icon-notification.svg',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  };

  // Only show the notification if the user isn't already looking at the game.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const gameIsVisible = windowClients.some(
        (c) => c.visibilityState === 'visible' && c.url === (data.url || '/')
      );
      if (gameIsVisible) return;
      return self.registration.showNotification(title, options);
    })
  );
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

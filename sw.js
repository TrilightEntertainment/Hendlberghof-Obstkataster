/* Abschied des alten Service Workers (Umzug nach www.hendlberghof.at/kataster, 11.11.2026).
   Auf installierten Geräten ersetzt er den bisherigen: löscht dessen Vorrat, meldet sich ab
   und schickt offene Fenster an die neue Adresse. */
const NEU = 'https://www.hendlberghof.at/kataster/';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const fenster = await self.clients.matchAll({type: 'window'});
    fenster.forEach((c) => { const u = new URL(c.url); c.navigate(NEU + u.search + u.hash).catch(() => {}); });
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    const u = new URL(event.request.url);
    event.respondWith(Response.redirect(NEU + u.search + u.hash, 301));
  }
});

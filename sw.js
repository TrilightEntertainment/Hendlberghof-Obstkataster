const CACHE_NAME = 'hendlberghof-v19';
const CORE_ASSETS = [
  './',
  './index.html',
  './assets/images/lageplan.jpg',
  './data/baum_data.json',
  './data/sorten_data.json',
  './data/seed_positions.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json',
  './arche_pdfs/berner_rosenapfel.pdf',
  './arche_pdfs/birnfoermigerapfel.pdf',
  './arche_pdfs/danziger_kantapfel_web.pdf',
  './arche_pdfs/galloway_pepping_foto_und_beschreibung.pdf',
  './arche_pdfs/geflammter_kardinal.pdf',
  './arche_pdfs/george_cave_01_1.pdf',
  './arche_pdfs/gruener_fuerstenapfel.pdf',
  './arche_pdfs/kleine_kasseler_renette_beschreibung_und_foto.pdf',
  './arche_pdfs/kronprinz_rudolf.pdf',
  './arche_pdfs/landsberger_renette.pdf',
  './arche_pdfs/oberoesterreichischer_bruennerling.pdf',
  './arche_pdfs/peasgoods_sondergleichen.pdf',
  './arche_pdfs/rodauner_goldapfel_beschreibung_und_foto.pdf',
  './arche_pdfs/roter_bellefleur.pdf',
  './arche_pdfs/schmidberger_renette.pdf',
  './arche_pdfs/schoener_von_wiltshire.pdf',
  './arche_pdfs/schweizer_glockenapfel_web.pdf',
  './arche_pdfs/siebenkant_beschreibung_und_foto.pdf',
  './arche_pdfs/steirischer_maschanzker.pdf',
  './arche_pdfs_birnen/abbe_fetel.pdf',
  './arche_pdfs_birnen/graefin_von_paris.pdf',
  './arche_pdfs_birnen/kiefers_saemling.pdf',
  './arche_pdfs_birnen/nordhauuser_forellenbirne.pdf',
  './arche_pdfs_birnen/williams_christbirne.pdf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});

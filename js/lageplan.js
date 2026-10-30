/* lageplan.js — Hendlberghof Obstdatenbank
   Lageplan: Bild- und Satellitenebene, GPS-Umrechnung, Stecknadeln, Zoom

   Aus einer einzelnen Datei herausgeloest (F6). Die Ladereihenfolge in
   index.html entspricht exakt der frueheren Reihenfolge im Script-Block und
   darf nicht veraendert werden: Ueber Dateigrenzen hinweg gibt es kein
   Hoisting mehr, und start.js setzt window.__dataReadyPromise, das berater.js
   beim Laden bereits liest. */

/* ---------- Lageplan ---------- */
let placeMode = false;
let selectedForPlacement = '';
let currentImage = 'lageplan';

const SECTION_PHOTOS = [
  // { id: 'swale', label: 'Swale', src: 'assets/images/swale.jpg', row: 'Swale' },
  // { id: 'weg1', label: 'Weg 1', src: 'assets/images/weg1.jpg', row: 'Weg1 Oben' },
];

/* ---------- Naive GPS → % Conversion ---------- */
const NAIVE_GPS_REF = { lat: 48.0696, lng: 15.844, xPct: 50, yPct: 50, scaleM: 120 };

function gpsToPercent(lat, lng) {
  const R = 6371000;
  const dLat = (lat - NAIVE_GPS_REF.lat) * Math.PI / 180;
  const dLng = (lng - NAIVE_GPS_REF.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(NAIVE_GPS_REF.lat*Math.PI/180) * Math.cos(lat*Math.PI/180) * Math.sin(dLng/2)**2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const bearing = Math.atan2(
    Math.sin(dLng) * Math.cos(lat*Math.PI/180),
    Math.cos(NAIVE_GPS_REF.lat*Math.PI/180) * Math.sin(lat*Math.PI/180) -
    Math.sin(NAIVE_GPS_REF.lat*Math.PI/180) * Math.cos(lat*Math.PI/180) * Math.cos(dLng)
  );
  const dx = dist * Math.sin(bearing);
  const dy = -dist * Math.cos(bearing);
  return { x: NAIVE_GPS_REF.xPct + (dx / NAIVE_GPS_REF.scaleM) * 100, y: NAIVE_GPS_REF.yPct + (dy / NAIVE_GPS_REF.scaleM) * 100 };
}

function percentToGps(xPct, yPct) {
  const dx = (xPct - NAIVE_GPS_REF.xPct) / 100 * NAIVE_GPS_REF.scaleM;
  const dy = (yPct - NAIVE_GPS_REF.yPct) / 100 * NAIVE_GPS_REF.scaleM;
  const lat = NAIVE_GPS_REF.lat - dy / 110540;
  const lng = NAIVE_GPS_REF.lng + dx / (111320 * Math.cos(NAIVE_GPS_REF.lat * Math.PI / 180));
  return { lat, lng };
}

/* ---------- Ansicht: Karte oder altes Foto (v122) ----------
   Seit v122 ist die Karte (Luftbild 2023 über basemap.at) die Hauptansicht.
   Das alte Drohnenfoto mit den Pflanzreihen bleibt eine Saison lang
   umschaltbar und fällt nach dem nächsten eigenen Flug weg (Volkmar 26.10.2026). */
function initFotoSelect() {
  mapLayer = (typeof L === 'undefined') ? 'foto' : 'sat';
  document.getElementById('map-wrap').style.display = mapLayer==='foto' ? '' : 'none';
  document.getElementById('sat-map').style.display = mapLayer==='sat' ? 'block' : 'none';
  lageAnsichtKnoepfe();
}

function lageAnsichtKnoepfe(){
  document.querySelectorAll('#lp-ansicht button').forEach(b => {
    const aktiv = b.dataset.ansicht === mapLayer;
    b.classList.toggle('aktiv', aktiv);
    b.setAttribute('aria-pressed', aktiv);
  });
  const kartenFilter = document.getElementById('lp-filter');
  if(kartenFilter) kartenFilter.style.display = mapLayer === 'sat' ? '' : 'none';
  const legende = document.getElementById('lp-legende');
  if(legende) legende.style.display = mapLayer === 'sat' ? '' : 'none';
  const pdf = document.getElementById('lp-pdf');
  if(pdf) pdf.style.display = mapLayer === 'foto' ? '' : 'none';
}

function switchToImage(imgId) {
  if (!imgId) return;
  if (imgId === 'sat') { setMapLayer('sat'); return; }
  currentImage = imgId;
  if (mapLayer === 'sat') setMapLayer('foto');
  const img = document.getElementById('map-img');
  const src = imgId === 'lageplan' ? 'assets/images/lageplan.jpg' : (SECTION_PHOTOS.find(s => s.id === imgId)?.src || 'assets/images/lageplan.jpg');
  if(img.getAttribute('src') === src){ renderPins(); return; }
  img.style.transition = 'opacity 0.15s';
  img.style.opacity = '0.3';
  setTimeout(() => { img.src = src; img.onload = () => { img.style.opacity = '1'; renderPins(); }; }, 150);
}
/* Baumwahl als Suchfeld (v124): Nummer oder Sorte tippen, der Baum wird
   vorgeschlagen. Zuerst Bäume ohne Lage, dann die mit „Lage ungefähr“ – auch
   sie lassen sich so per GPS oder Antippen genau setzen. */
function _wahlText(t, ungefaehr){ return `${t.id} — ${t.sorte || ''}${ungefaehr ? ' (ungefähr)' : ''}`; }
function renderUnplacedSelect(){
  const liste = document.getElementById('unplaced-liste');
  if(!liste) return;
  if(_setzListe){
    liste.innerHTML = _setzOffen().map(id => `<option value="${escAttr(_wahlText(getTree(id), false))}"></option>`).join('');
    return;
  }
  const isSat = mapLayer === 'sat';
  const nachId = (a, b) => a.id.localeCompare(b.id, 'de', {numeric: true});
  const offen = getAllTrees().filter(t => isSat ? !(state.satPositions||{})[t.id] : !state.positions[t.id]);
  const ungefaehr = t => isSat && typeof kartenPos === 'function' && !!kartenPos(t.id);
  const sortiert = offen.filter(t => !ungefaehr(t)).sort(nachId).concat(offen.filter(ungefaehr).sort(nachId));
  liste.innerHTML = sortiert.map(t => `<option value="${escAttr(_wahlText(t, ungefaehr(t)))}"></option>`).join('');
}
function _baumAusWahl(text){
  const id = String(text || '').split(' — ')[0].trim();
  return id && getTree(id) ? id : '';
}
var sel2 = document.getElementById('unplaced-select');
if(sel2) ['input', 'change'].forEach(ereignis => sel2.addEventListener(ereignis, e=>{
  const id = _baumAusWahl(e.target.value);
  if(id === selectedForPlacement && ereignis === 'change') return;
  selectedForPlacement = id;
  if(selectedForPlacement){
    placeMode = true;
    setzZoom(id);
    if(satMap) satMap.dragging.disable();
    document.getElementById('place-mode-label').textContent = 'Baum setzen';
    document.getElementById('place-status').textContent = 'Auf Karte klicken, um den Baum zu positionieren.';
  } else {
    placeMode = false;
    if(satMap) satMap.dragging.enable();
    document.getElementById('place-mode-label').textContent = 'Position setzen';
    document.getElementById('place-status').textContent = '';
  }
}));

/* ---------- Setzen aus der Liste „Ohne Standort“ (v137) ----------
   Die Stecknadel in der Liste (oder in der Baumkarte) öffnet den Lageplan mit
   dem Baum im Suchfeld. Aus der Liste zeigt das Suchfeld nur deren Bäume, und
   nach jedem Setzen steht schon der nächste drin. Ist der letzte gesetzt,
   geht es zurück zum Kataster (Volkmar 27.10.2026). */
const _mitFinger = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
function _setzOffen(){
  return (_setzListe || []).filter(id => { const t = getTree(id); return t && katOhneStandort(t); });
}
function setzKnopfZeigen(){
  const k = document.getElementById('btn-naechster');
  if(k) k.style.display = _setzListe && _setzOffen().length > 1 ? '' : 'none';
}
function setzListeBeenden(){ setzKnopfZeigen(); }

/* Zoom auf den Standort beim Setzen (v138, statt Zuordnungstabelle):
   gleichnamige Kartenfläche → schon gesetzte Bäume mit demselben Standort
   → ganzer Hof. Eine Fläche „Böschung 3“ einzeichnen genügt also. */
const _stdName = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
function setzZoom(id){
  if(typeof L === 'undefined' || mapLayer !== 'sat') return;
  ladeLageDaten().then(() => {
    initSatMap();
    if(!satMap) return;
    _satErstmals = false;
    const t = getTree(id);
    const name = _stdName(t && t.standort_zeile);
    const flaeche = name && kartenObjekte().find(o => o.geo && _stdName(o.name) === name);
    if(flaeche){ satMap.fitBounds(flaeche.geo, {padding: [24, 24], maxZoom: 20}); return; }
    const nachbarn = !name ? [] : getAllTrees()
      .filter(b => b.id !== id && _stdName(b.standort_zeile) === name)
      .map(b => kartenPos(b.id)).filter(Boolean);
    if(nachbarn.length){ satMap.fitBounds(nachbarn.map(p => [p.lat, p.lng]), {padding: [40, 40], maxZoom: 20}); return; }
    lageGanzerHof();
  });
}

function baumZumSetzen(id, vorweg, ohneZoom){
  const t = getTree(id);
  if(!t) return;
  if(!ohneZoom) setzZoom(id);
  selectedForPlacement = id;
  placeMode = true;
  if(satMap) satMap.dragging.disable();
  document.getElementById('unplaced-select').value = _wahlText(t, false);
  document.getElementById('place-mode-label').textContent = 'Baum setzen';
  const wie = _mitFinger() && mapLayer === 'sat' ? 'auf die Karte tippen oder „Per GPS setzen“.' : 'auf die Karte klicken.';
  document.getElementById('place-status').textContent = [vorweg, `${t.id} ${t.sorte || ''}: ${wie}`].filter(Boolean).join(' ');
  setzKnopfZeigen();
}
function positionSetzen(id, ausListe){
  const aktiv = document.querySelector('.tab-btn.active');
  const vorher = aktiv && aktiv.dataset.tab !== 'lageplan' ? aktiv.dataset.tab : 'baumkataster';
  const liste = ausListe ? getFilteredBaumRows().filter(katOhneStandort).map(t => t.id) : null;
  closeModal();
  activateTab('lageplan');
  _setzListe = liste;
  _lageplanZurueck = ausListe ? {liste: true, tab: vorher} : {id, tab: vorher};
  renderLageplanZurueck();
  if(mapLayer !== 'sat' && typeof L !== 'undefined') setMapLayer('sat');
  renderUnplacedSelect();
  baumZumSetzen(id);
}
function setzNaechster(){
  const offen = _setzOffen();
  if(!offen.length) return;
  baumZumSetzen(offen[(offen.indexOf(selectedForPlacement) + 1) % offen.length]);
}
/* Gemeinsamer Abschluss für Antippen (Karte, Foto) und GPS. */
function nachDemSetzen(gesetzt, meldung){
  placeMode = false;
  selectedForPlacement = '';
  if(satMap) satMap.dragging.enable();
  document.getElementById('unplaced-select').value = '';
  document.getElementById('place-mode-label').textContent = 'Position setzen';
  document.getElementById('place-status').textContent = meldung;
  renderUnplacedSelect();
  if(!_setzListe){ setzKnopfZeigen(); return; }
  const offen = _setzOffen();
  if(offen.length){
    /* der nächste nach dem gesetzten, in der Reihenfolge der Liste */
    const ab = _setzListe.indexOf(gesetzt);
    const reihe = _setzListe.slice(ab + 1).concat(_setzListe.slice(0, ab + 1));
    const naechster = reihe.find(x => offen.includes(x));
    /* gleicher Standort: Ausschnitt lassen, man hat vielleicht näher herangezoomt */
    const gleich = _stdName((getTree(gesetzt) || {}).standort_zeile) === _stdName((getTree(naechster) || {}).standort_zeile);
    baumZumSetzen(naechster, meldung, gleich);
    return;
  }
  const alleGesetzt = !getAllTrees().some(katOhneStandort);
  _setzListe = null;
  setzKnopfZeigen();
  _lageplanZurueck = null;
  renderLageplanZurueck();
  showToast(alleGesetzt ? 'Alle Bäume haben jetzt einen Standort.' : 'Alle Bäume dieser Liste haben jetzt einen Standort.', 'success', 4000);
  activateTab('baumkataster');
  katArtWaehlen(alleGesetzt ? '' : '__ohne');
}

document.getElementById('btn-place-mode').addEventListener('click', ()=>{
  placeMode = !placeMode;
  if(satMap) satMap.dragging.enable();
  document.getElementById('place-mode-label').textContent = placeMode? 'Modus aktiv – Klick auf Karte' : 'Position setzen';
  document.getElementById('place-status').textContent = placeMode? 'Baum auswählen, dann auf die Karte klicken.' : '';
  if(placeMode) renderUnplacedSelect();
  renderSatMarkers();
});

function mapAspect(){
  const img = document.getElementById('map-img');
  return (img && img.naturalWidth>0 && img.naturalHeight>0)? img.naturalWidth/img.naturalHeight : 1;
}

/* ---------- Karte: Luftbild 2023, Flächen, Bäume (v122) ----------
   Grundkarte basemap.at, darüber das eigene Luftbild der Vermessung 2023 als
   Kacheln (assets/ortho2023, Zoom 15–21, erzeugt mit tools/ortho_kacheln.py).
   Bäume stehen mit ihren Koordinaten in state.satPositions. Bäume, die bisher
   nur auf dem alten Foto standen, sind aus dem Foto umgerechnet
   (data/lage_ungefaehr.json) und tragen den Vermerk „Lage ungefähr“, bis jemand
   sie auf der Karte zurechtzieht. Die Flächen (data/flaechen.json) stammen aus
   dem Permakulturkonzept 2020 und sind ein Entwurf. */
let satMap = null;
let satMarkers = [];
let satMarkerById = {};
let mapLayer = 'foto';
let LAGE_UNGEFAEHR = {};
let FLAECHEN = null;        /* data/flaechen.json: {quelle, objekte} */
let _lageDatenPromise = null;
let _flaechenEbene = null;
let _flaecheAktiv = null;   /* ID des markierten Kartenobjekts */

const KARTEN_FARBEN = {apfel:'#dc2626', birne:'#22c55e', walnuss:'#b98e1a', zwetschke:'#6b21a8', kirsch:'#be185d', kirsche:'#be185d', weichsel:'#be185d', marille:'#f59e0b', quitte:'#84cc16', pflaume:'#7c3aed', sonstige:'#888'};
const FLAECHEN_FARBEN = {
  'Agroforst':'#E8A33D', 'Extensive Obstfläche / Grünland':'#E6D35A', 'Grünland':'#8FD16A',
  'Acker / Wechselwiese':'#D98A5F', 'Acker, Garten, terrassiert':'#C7835E', 'Bewirtschaftungsstreifen':'#D49AE6',
  'Hecke':'#6FCF7F', 'Böschung':'#7FE0D2', 'Swale':'#6FB7E8', 'Verdunstungsmulde':'#6FB7E8',
  'Feuchtwiese':'#7FB3C8', 'Bruchwald, Ökofläche':'#8CC2A4', 'Hausteich':'#7C93E8'
};

function ladeLageDaten(){
  if(!_lageDatenPromise){
    const json = url => fetch(url).then(r => { if(!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
    _lageDatenPromise = Promise.all([
      json('data/lage_ungefaehr.json').then(d => { LAGE_UNGEFAEHR = d.baeume || {}; }).catch(() => {}),
      json('data/flaechen.json').then(d => { FLAECHEN = d; }).catch(() => {})
    ]);
  }
  return _lageDatenPromise;
}

/* Lage eines Baums auf der Karte: gesetzt (satPositions) vor umgerechnet.
   Die Umrechnung gilt nur, solange der Baum auf dem alten Foto steht – wer dort
   die Stecknadel entfernt, nimmt ihn auch von der Karte. */
function kartenPos(id){
  const p = (state.satPositions || {})[id];
  if(p && p.lat && p.lng) return {lat: p.lat, lng: p.lng, ungefaehr: false};
  const u = LAGE_UNGEFAEHR[id];
  if(u && (state.positions || {})[id]) return {lat: u[0], lng: u[1], ungefaehr: true};
  return null;
}

function setMapLayer(layer){
  if(layer==='sat' && typeof L === 'undefined'){
    showToast('Die Karte braucht Internet – das Foto bleibt offen.', 'error');
    layer = 'foto';
  }
  mapLayer = layer;
  document.getElementById('map-wrap').style.display = layer==='foto'? '' : 'none';
  document.getElementById('sat-map').style.display = layer==='sat'? 'block' : 'none';
  lageAnsichtKnoepfe();
  if(layer==='sat'){
    initSatMap();
  } else {
    if(_kb) kbEnde();
    placeMode = false;
    if(satMap) satMap.dragging.enable();
    lageScale = 1; lageTx = 0; lageTy = 0; _lageApplyTransform();
    renderPins();
  }
  applyEditModeUI();
  renderUnplacedSelect();
}

/* ---------- Ebenen (v124) ----------
   Ein Knopf oben rechts in der Karte: Grundbild (eigenes Luftbild 2023 oder
   basemap.at) und Ebenen darüber (Foto mit Reihen samt Deckkraft, Wege &
   Swale, Konzeptplan, Bäume). Die Wahl merkt sich jedes Gerät selbst. */
const EBENEN_KEY = 'hendlberghof_kartenebenen';
const FOTO_GRENZEN = [[48.06945, 15.84287], [48.07116, 15.84452]];
let _ebenen = null;
let _ebenenOffen = false;
const _ebenenWahl = {grund: 'hof', foto: true, fotoDeckkraft: 85, bestand: true, planung: false, hoehen: false, baeume: true};
let _hoehenEbene = null;
let _hoehenPromise = null;
try { Object.assign(_ebenenWahl, JSON.parse(localStorage.getItem(EBENEN_KEY) || '{}')); } catch(e){}

function ebenenMerken(){ try { localStorage.setItem(EBENEN_KEY, JSON.stringify(_ebenenWahl)); } catch(e){} }

function ebenenAnwenden(){
  if(!_ebenen) return;
  const an = (l, ja) => { if(ja && !satMap.hasLayer(l)) l.addTo(satMap); if(!ja && satMap.hasLayer(l)) l.remove(); };
  an(_ebenen.hof, _ebenenWahl.grund === 'hof');
  an(_ebenen.foto, _ebenenWahl.foto);
  _ebenen.foto.setOpacity(_ebenenWahl.fotoDeckkraft / 100);
  if(_ebenen.foto._container) _ebenen.foto.bringToFront();
  if(_ebenenWahl.hoehen) hoehenZeigen();
  else if(_hoehenEbene) _hoehenEbene.remove();
}

/* Höhenlinien der Vermessung 2023 (data/hoehenlinien.json, tools/hoehenlinien.py):
   5-m-Abstand, jede 10-m-Linie kräftiger und einmal beschriftet. Geladen wird
   erst, wenn jemand die Ebene einschaltet. */
function hoehenZeigen(){
  if(_hoehenEbene){ if(!satMap.hasLayer(_hoehenEbene)) _hoehenEbene.addTo(satMap); return; }
  if(!_hoehenPromise){
    _hoehenPromise = fetch('data/hoehenlinien.json').then(r => { if(!r.ok) throw new Error(r.status); return r.json(); });
  }
  _hoehenPromise.then(d => {
    if(_hoehenEbene || !_ebenenWahl.hoehen) return;
    const renderer = L.canvas({padding: .5});
    _hoehenEbene = L.layerGroup();
    (d.linien || []).forEach(({h, geo}) => {
      const zehner = h % 10 === 0;
      let laengste = null, laenge = 0;
      geo.forEach(pts => {
        L.polyline(pts, {renderer, color: '#F1EDE2', weight: zehner ? 1.4 : .7, opacity: zehner ? .85 : .6, interactive: false}).addTo(_hoehenEbene);
        if(zehner && pts.length > laenge){ laenge = pts.length; laengste = pts; }
      });
      if(laengste){
        const mitte = laengste[Math.floor(laengste.length / 2)];
        L.tooltip({permanent: true, direction: 'center', className: 'lp-hoehe', interactive: false}).setLatLng(mitte).setContent(`${h} m`).addTo(_hoehenEbene);
      }
    });
    if(_ebenenWahl.hoehen) _hoehenEbene.addTo(satMap);
  }).catch(() => showToast('Höhenlinien nicht ladbar – Internet nötig.', 'error'));
}

function renderEbenenKnopf(){
  const box = document.getElementById('lp-ebenen');
  if(!box) return;
  const w = _ebenenWahl;
  const symbol = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 4 3 9l9 5 9-5z"/><path d="m3 14 9 5 9-5"/></svg>`;
  const kreuz = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`;
  if(!_ebenenOffen){
    box.innerHTML = `<button type="button" class="lp-ebenen-knopf" title="Ebenen" aria-label="Ebenen" aria-expanded="false" onclick="ebenenOeffnen(true)">${symbol}</button>`;
    return;
  }
  const radio = (wert, text) => `<label><input type="radio" name="lp-grund" value="${wert}"${w.grund === wert ? ' checked' : ''} onchange="ebeneSetzen('grund', '${wert}')"> ${text}</label>`;
  const haken = (key, text) => `<label><input type="checkbox"${w[key] ? ' checked' : ''} onchange="ebeneSetzen('${key}', this.checked)"> ${text}</label>`;
  box.innerHTML = `<div class="lp-ebenen-feld">
      <div class="lp-ebenen-kopf"><span>Ebenen</span><button type="button" class="lp-ebenen-zu" title="Schließen" aria-label="Schließen" onclick="ebenenOeffnen(false)">${kreuz}</button></div>
      <div class="lp-ebenen-titel">Grundbild</div>
      ${radio('hof', 'Luftbild Hof 2023')}
      ${radio('basis', 'Luftbild Österreich 2023')}
      <div class="lp-ebenen-titel">Darüber</div>
      ${haken('foto', 'Foto mit Reihen (ca. 2024)')}
      <label class="lp-ebenen-regler">Deckkraft<input type="range" min="0" max="100" step="5" value="${w.fotoDeckkraft}" oninput="ebeneSetzen('fotoDeckkraft', +this.value)"${w.foto ? '' : ' disabled'}></label>
      ${haken('bestand', 'Wege &amp; Swale')}
      ${haken('planung', 'Konzeptplan 2020')}
      ${haken('hoehen', 'Höhenlinien (5 m)')}
      ${haken('baeume', 'Bäume')}
    </div>`;
}

function ebenenOeffnen(offen){
  _ebenenOffen = !!offen;
  renderEbenenKnopf();
}

function ebeneSetzen(key, wert){
  _ebenenWahl[key] = wert;
  ebenenMerken();
  if(key === 'grund' || key === 'foto' || key === 'fotoDeckkraft' || key === 'hoehen') ebenenAnwenden();
  if(key === 'foto'){ const r = document.querySelector('.lp-ebenen-regler input'); if(r) r.disabled = !wert; }
  if(key === 'bestand' || key === 'planung'){
    if(_flaecheAktiv){ const o = kartenObjekt(_flaecheAktiv); if(o && !_ebenenWahl[o.ebene]) objektMarkieren(null); }
    zeichneKarte();
    renderLageFilter();
  }
  if(key === 'baeume') renderSatMarkers();
}

function initSatMap(){
  if(typeof L === 'undefined') return;
  if(!satMap){
    satMap = L.map('sat-map', {maxZoom: 22, zoomSnap: 0.5}).setView([48.0702, 15.8442], 18);
    _ebenen = {
      basis: L.tileLayer('https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg', {
        maxZoom: 22, maxNativeZoom: 19, attribution: 'basemap.at'
      }).addTo(satMap),
      hof: L.tileLayer('assets/ortho2023/{z}/{x}/{y}.webp', {
        maxZoom: 22, minNativeZoom: 15, maxNativeZoom: 21,
        bounds: [[48.06842, 15.84214], [48.07240, 15.84644]],
        attribution: 'Luftbild Hendlberghof 2023'
      }),
      foto: L.tileLayer('assets/foto2024/{z}/{x}/{y}.webp', {
        maxZoom: 22, minNativeZoom: 16, maxNativeZoom: 21,
        bounds: FOTO_GRENZEN, attribution: 'Foto mit Reihen ca. 2024'
      })
    };
    ebenenAnwenden();
    new (L.Control.extend({
      options: {position: 'topright'},
      onAdd(){
        const box = L.DomUtil.create('div', 'lp-ebenen');
        box.id = 'lp-ebenen';
        L.DomEvent.disableClickPropagation(box);
        L.DomEvent.disableScrollPropagation(box);
        return box;
      }
    }))().addTo(satMap);
    renderEbenenKnopf();
    /* Aus der Ferne kleinere Punkte, sonst decken sich die Reihen zu. */
    const fernKlasse = () => satMap.getContainer().classList.toggle('lp-fern', satMap.getZoom() < 19);
    satMap.on('zoomend', fernKlasse);
    fernKlasse();
    satMap.on('click', function(e){
      if(placeMode && selectedForPlacement){
        const {lat, lng} = e.latlng;
        if(!state.satPositions) state.satPositions = {};
        state.satPositions[selectedForPlacement] = {lat, lng};
        delete state.deletedSatPositions[selectedForPlacement];
        saveState();
        renderSatMarkers();
        nachDemSetzen(selectedForPlacement, 'Position auf der Karte gesetzt.');
        return;
      }
      if(_kb) return;
      flaecheMarkieren(null);
    });
    ladeLageDaten().then(() => {
      zeichneKarte();
      renderSatMarkers();
      renderLageFilter();
      renderUnplacedSelect();
    });
  }
  renderSatMarkers();
  setTimeout(()=>{ satMap.invalidateSize(); }, 100);
  setTimeout(()=>{ satMap.invalidateSize(); }, 500);
}

/* ---------- Kartenobjekte: Bestand und Planung (v123) ----------
   data/flaechen.json enthält Linien und Flächen mit Ebene „bestand“ (Wege
   aus dem Luftbild, Swale, Grundstücksgrenze) oder „planung“ (Konzeptplan
   2020). Änderungen aus der App liegen in state.karte, je Objekt-ID:
   {name, art, ebene, typ, geo} – geo als JSON-Text, weil Firestore keine
   Listen in Listen speichert. null heißt gelöscht. Der Stand in der App hat
   Vorrang vor der Datei. */
const KARTEN_ART_FARBEN = Object.assign({
  'Weg':'#F1EDE2', 'Grundstücksgrenze':'#D9B458', 'Waldgarten':'#7FBF6A', 'Baumschule':'#C9B26B',
  'Wiese':'#B8D97A', 'Teich':'#7C93E8', 'Beerenreihe':'#C77DA8', 'Sonstiges':'#FFFFFF',
  'Weg Bestand':'#C9C3D6', 'Weg, begrünt':'#B9C2AE', 'Weg, begrünt (optional)':'#8C8A82', 'Gebäude':'#E36A6C', 'Vorplatz':'#C77DB8'
}, FLAECHEN_FARBEN);

function kartenObjektAusState(id, u){
  if(!u || typeof u !== 'object') return null;
  try { return {id, name: u.name || 'Ohne Namen', art: u.art || 'Sonstiges', ebene: u.ebene === 'planung' ? 'planung' : 'bestand', typ: u.typ === 'linie' ? 'linie' : 'flaeche', geo: JSON.parse(u.geo)}; }
  catch(e){ return null; }
}

function kartenObjekte(){
  const ueber = state.karte || {};
  const liste = [];
  const gesehen = new Set();
  (FLAECHEN && FLAECHEN.objekte || []).forEach(o => {
    gesehen.add(o.id);
    if(Object.prototype.hasOwnProperty.call(ueber, o.id)){
      const u = kartenObjektAusState(o.id, ueber[o.id]);
      if(u) liste.push(u);
      return;
    }
    liste.push(o);
  });
  Object.keys(ueber).forEach(id => {
    if(gesehen.has(id)) return;
    const u = kartenObjektAusState(id, ueber[id]);
    if(u) liste.push(u);
  });
  return liste;
}
function kartenObjekt(id){ return kartenObjekte().find(o => o.id === id) || null; }

/* Fläche in m² und Länge in m, eben gerechnet – auf 4,5 ha genau genug. */
function _kMeter(p, lat0){ return [p[1] * 111320 * Math.cos(lat0 * Math.PI / 180), p[0] * 110540]; }
function objektGroesse(o){
  if(o.typ === 'linie'){
    const pts = o.geo; if(!pts || pts.length < 2) return '';
    let m = 0;
    for(let i = 1; i < pts.length; i++){ const a = _kMeter(pts[i-1], pts[0][0]), b = _kMeter(pts[i], pts[0][0]); m += Math.hypot(a[0]-b[0], a[1]-b[1]); }
    return `${Math.round(m).toLocaleString('de-AT')} m lang`;
  }
  const ringe = o.geo || [];
  let summe = 0;
  ringe.forEach((r, i) => {
    let f = 0;
    for(let k = 0; k < r.length; k++){ const a = _kMeter(r[k], r[0][0]), b = _kMeter(r[(k+1) % r.length], r[0][0]); f += a[0]*b[1] - b[0]*a[1]; }
    summe += (i === 0 ? 1 : -1) * Math.abs(f) / 2;
  });
  return `${Math.round(summe).toLocaleString('de-AT')} m²`;
}

function objektStil(o, aktiv){
  const farbe = KARTEN_ART_FARBEN[o.art] || '#FFFFFF';
  const plan = o.ebene === 'planung';
  if(o.typ === 'linie'){
    if(o.art === 'Grundstücksgrenze') return {color: farbe, weight: aktiv ? 3 : 1.5, opacity: 1, dashArray: '6 5', fill: false};
    return {color: farbe, weight: aktiv ? 6 : 3.5, opacity: plan ? .6 : .95, dashArray: plan ? '4 4' : null, lineCap: 'round', lineJoin: 'round', fill: false};
  }
  return {color: farbe, weight: aktiv ? 2.5 : (plan ? 1 : 1.6), opacity: plan ? .75 : .95, dashArray: plan ? '4 3' : null,
          fillColor: farbe, fillOpacity: aktiv ? .22 : (plan ? .04 : .1)};
}

let _kartenRenderer = null;
function zeichneKarte(){
  if(!satMap || !FLAECHEN) return;
  if(_flaechenEbene) _flaechenEbene.remove();
  if(!_kartenRenderer) _kartenRenderer = L.svg({padding: .5});
  _flaechenEbene = L.layerGroup().addTo(satMap);
  const objekte = kartenObjekte().filter(o => _ebenenWahl[o.ebene] || (_kb && _kb.id === o.id));
  /* Planung unten, Flächen vor Linien, damit Wege antippbar bleiben */
  const rang = o => (o.ebene === 'planung' ? 0 : 2) + (o.typ === 'linie' ? 1 : 0);
  objekte.sort((a, b) => rang(a) - rang(b)).forEach(o => {
    const stil = Object.assign({renderer: _kartenRenderer}, objektStil(o, o.id === _flaecheAktiv));
    const l = o.typ === 'linie' ? L.polyline(o.geo, stil) : L.polygon(o.geo, stil);
    l._objekt = o;
    if(o.ebene === 'bestand' && o.typ === 'linie' && o.art !== 'Grundstücksgrenze')
      l.bindTooltip(escHtml(o.name), {permanent: true, direction: 'center', className: 'lp-label', interactive: false});
    l.on('click', e => {
      L.DomEvent.stopPropagation(e);
      if(placeMode) return;
      if(_kb){ kbObjektGetippt(o.id); return; }
      objektMarkieren(o.id, e.latlng);
    });
    l.addTo(_flaechenEbene);
  });
}

function objektLayer(id){
  let treffer = null;
  if(_flaechenEbene) _flaechenEbene.eachLayer(l => { if(l._objekt && l._objekt.id === id) treffer = l; });
  return treffer;
}

function objektMarkieren(id, wo, zoomen){
  if(!_flaechenEbene) return;
  _flaecheAktiv = id || null;
  _flaechenEbene.eachLayer(l => { if(l._objekt) l.setStyle(objektStil(l._objekt, l._objekt.id === _flaecheAktiv)); });
  satMap.closePopup();
  const sel = document.getElementById('lp-bereich');
  if(sel) sel.value = _flaecheAktiv || '';
  const l = _flaecheAktiv && objektLayer(_flaecheAktiv);
  if(!l) return;
  if(l._objekt.typ !== 'linie') l.bringToFront();
  const o = l._objekt;
  if(zoomen) satMap.fitBounds(l.getBounds(), {padding: [24, 24], maxZoom: 21});
  const herkunft = o.ebene === 'planung' ? 'Konzeptplan 2020' : 'Bestand';
  L.popup({closeButton: false, className: 'lp-popup', autoPanPadding: [16, 16]})
    .setLatLng(wo || l.getBounds().getCenter())
    .setContent(`<div class="lp-fl-name">${escHtml(o.name)}</div><div class="lp-fl-info">${escHtml(o.art)} · ${objektGroesse(o)}</div><div class="lp-fl-info">${herkunft}</div>`)
    .openOn(satMap);
}
function flaecheMarkieren(id, wo, zoomen){ objektMarkieren(id, wo, zoomen); }

function lageBereichWaehlen(id){
  if(!satMap) return;
  if(!id){ objektMarkieren(null); lageGanzerHof(); return; }
  objektMarkieren(id, null, true);
}

function lageGanzerHof(){
  if(!satMap) return;
  const grenze = kartenObjekt('grenze');
  if(grenze) satMap.fitBounds(grenze.geo, {padding: [12, 12]});
}

function renderLageFilter(){
  const bereich = document.getElementById('lp-bereich');
  if(bereich && FLAECHEN){
    const sortiert = l => l.slice().sort((a, b) => a.name.localeCompare(b.name, 'de', {numeric: true}));
    const opt = o => `<option value="${escAttr(o.id)}">${escHtml(o.name)}</option>`;
    const alle = kartenObjekte().filter(o => o.art !== 'Grundstücksgrenze');
    const bestand = _ebenenWahl.bestand ? sortiert(alle.filter(o => o.ebene === 'bestand')) : [];
    const planung = _ebenenWahl.planung ? sortiert(alle.filter(o => o.ebene === 'planung')) : [];
    bereich.innerHTML = `<option value="">Ganzer Hof</option>
      ${bestand.length ? `<optgroup label="Bestand">${bestand.map(opt).join('')}</optgroup>` : ''}
      ${planung.length ? `<optgroup label="Konzeptplan 2020">${planung.map(opt).join('')}</optgroup>` : ''}`;
    bereich.value = _flaecheAktiv || '';
  }
  const art = document.getElementById('lp-obstart');
  if(art){
    const wert = art.value;
    const arten = [...new Set(getAllTrees().filter(t => kartenPos(t.id)).map(t => t.frucht).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    art.innerHTML = `<option value="">Alle Obstarten</option>${arten.map(a => `<option value="${escAttr(a)}">${escHtml(a)}</option>`).join('')}`;
    art.value = arten.includes(wert) ? wert : '';
  }
}

let _satErstmals = true;
function renderSatMarkers(){
  if(!satMap) return;
  satMap.invalidateSize();
  satMarkers.forEach(m=>{ m.remove() });
  satMarkers = [];
  satMarkerById = {};
  const filter = (document.getElementById('lp-obstart') || {}).value || '';
  const darfZiehen = isAdmin();
  let _dragMoved = false;
  const zeigen = _ebenenWahl.baeume || placeMode;
  getAllTrees().forEach(t => {
    if(!zeigen) return;
    const pos = kartenPos(t.id);
    if(!pos) return;
    if(filter && t.frucht !== filter) return;
    const id = t.id;
    const farbe = KARTEN_FARBEN[(t.frucht||'').toLowerCase()] || '#B2543A';
    const icon = L.divIcon({className: 'kp-huelle', html: `<span class="kp${pos.ungefaehr ? ' ungefaehr' : ''}" style="--kp:${farbe}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11]});
    const m = L.marker([pos.lat, pos.lng], {icon, draggable: darfZiehen, keyboard: false});
    m.bindTooltip(`${escHtml(id)} — ${escHtml(t.sorte || '')}${pos.ungefaehr ? ' · Lage ungefähr' : ''}`, {direction: 'top', offset: [0, -8]});
    m.on('dragstart', ()=>{ _dragMoved = true; });
    m.on('dragend', function(e){
      const {lat, lng} = e.target.getLatLng();
      if(!state.satPositions) state.satPositions = {};
      state.satPositions[id] = {lat, lng};
      delete state.deletedSatPositions[id];
      saveState();
      showToast(`${t.sorte || id} verschoben${pos.ungefaehr ? ' – Lage jetzt genau' : ''}`, 'success');
      renderSatMarkers();
    });
    m.on('click', function(){
      if(_dragMoved){ _dragMoved = false; return; }
      if(placeMode || _kb) return;
      lageMarkerWaehlen(id);
      openBaumModal(id);
    });
    m.addTo(satMap);
    satMarkers.push(m);
    satMarkerById[id] = m;
  });
  if(_satErstmals && FLAECHEN){
    _satErstmals = false;
    lageGanzerHof();
  }
}

function lageMarkerWaehlen(id, blinken){
  document.querySelectorAll('.kp.selected, .kp.blink').forEach(p => p.classList.remove('selected', 'blink'));
  const m = satMarkerById[id];
  const el = m && m.getElement() && m.getElement().querySelector('.kp');
  if(!el) return;
  m.setZIndexOffset(1000);
  if(!blinken){ el.classList.add('selected'); return; }
  el.classList.add('blink');
  el.addEventListener('animationend', () => { el.classList.remove('blink'); el.classList.add('selected'); }, {once: true});
}

/* Prüfung: eine Stelle aus dem Foto zeigen, an der noch kein Baum im Kataster steht. */
let _lagePunkt = null;
function lagePunktWeg(){ if(_lagePunkt){ _lagePunkt.remove(); _lagePunkt = null; } }
function lagePunktZeigen(lat, lng, text){
  if(typeof L === 'undefined'){ showToast('Die Karte braucht Internet.', 'error'); return; }
  ladeLageDaten().then(() => {
    if(mapLayer !== 'sat') setMapLayer('sat'); else initSatMap();
    _satErstmals = false;
    if(!_ebenenWahl.foto) ebeneSetzen('foto', true);
    lagePunktWeg();
    _lagePunkt = L.marker([lat, lng], {interactive: false, zIndexOffset: 2000, icon: L.divIcon({
      className: '', html: `<div class="lp-punkt">${escHtml(text)}</div>`, iconSize: [40, 40], iconAnchor: [20, 20]
    })}).addTo(satMap);
    satMap.setView([lat, lng], 20);
  });
}

/* Aus der Baumkarte: auf der Karte zeigen, sonst auf dem alten Foto. */
function lageZeigen(id){
  if(typeof L !== 'undefined'){
    ladeLageDaten().then(() => {
      const pos = kartenPos(id);
      if(pos){
        if(!_ebenenWahl.baeume) ebeneSetzen('baeume', true);
        const filter = document.getElementById('lp-obstart');
        const t = getTree(id);
        if(filter && filter.value && t && t.frucht !== filter.value) filter.value = '';
        if(mapLayer !== 'sat') setMapLayer('sat'); else initSatMap();
        _satErstmals = false;
        flaecheMarkieren(null);
        renderSatMarkers();
        satMap.setView([pos.lat, pos.lng], 20);
        setTimeout(() => lageMarkerWaehlen(id, true), 350);
        return;
      }
      lageFotoZeigen(id);
    });
    return;
  }
  lageFotoZeigen(id);
}

function lageFotoZeigen(id){
  if(mapLayer === 'sat') setMapLayer('foto');
  document.querySelectorAll('.pin.selected').forEach(p=>p.classList.remove('selected'));
  const pin = document.querySelector(`.pin[data-id="${id}"]`);
  if(pin){
    pin.scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
    pin.classList.add('blink');
    pin.addEventListener('animationend', ()=>{
      pin.classList.remove('blink');
      pin.classList.add('selected');
    }, {once:true});
  }
}
/* ---------- Karte bearbeiten (v123, nur Volkmar) ----------
   Zeichnen und Ecken verschieben mit Leaflet-Geoman (kostenlos, wird erst beim
   ersten „Karte bearbeiten“ nachgeladen). „Per GPS gehen“ sammelt Punkte am
   Standort des Handys, für Grenzen unter Bäumen, wo das Luftbild nichts zeigt. */
const GEOMAN_VERSION = '2.17.0';
let _kb = null;            /* null oder {modus, id, gps:[], watch, ...} */
let _geomanPromise = null;

function geomanLaden(){
  if(!_geomanPromise){
    _geomanPromise = new Promise((ok, fehler) => {
      const basis = `https://cdn.jsdelivr.net/npm/@geoman-io/leaflet-geoman-free@${GEOMAN_VERSION}/dist/`;
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = `${basis}leaflet-geoman.css`;
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = `${basis}leaflet-geoman.min.js`;
      js.onload = ok;
      js.onerror = () => { _geomanPromise = null; fehler(new Error('Geoman nicht ladbar')); };
      document.head.appendChild(js);
    });
  }
  return _geomanPromise;
}

function kbStart(){
  if(!isAdmin() || !satMap) return;
  if(_kb){ kbEnde(); return; }
  geomanLaden().then(() => {
    if(!satMap.pm) satMap.pm = new L.PM.Map(satMap);
    satMap.pm.setLang('de');
    satMap.pm.setGlobalOptions({snappable: true, snapDistance: 14, allowSelfIntersection: false});
    satMap.off('pm:create', kbErstellt);
    satMap.on('pm:create', kbErstellt);
    _kb = {modus: 'start', id: null, gps: []};
    satMap.getContainer().classList.add('lp-bearbeiten');   /* Bäume treten zurück, damit Ecken greifbar sind */
    satMap.closePopup();
    zeichneKarte();   /* neue Ebenen bekommen erst nach dem Laden ein .pm */
    kbLeiste();
  }).catch(() => showToast('Die Zeichenwerkzeuge brauchen Internet.', 'error'));
}

function kbEnde(){
  if(!_kb) return;
  if(_kb.modus === 'objekt') kbObjektAbbrechen(true);
  if(_kb.modus === 'zeichnen' && satMap.pm) satMap.pm.disableDraw();
  kbGpsStopp();
  _kb = null;
  satMap.getContainer().classList.remove('lp-bearbeiten');
  kbLeiste();
  zeichneKarte();
  renderLageFilter();
}

function kbLeiste(){
  const box = document.getElementById('lp-bearb');
  const knopf = document.getElementById('btn-karte-bearbeiten');
  if(knopf) knopf.textContent = _kb ? 'Bearbeiten beenden' : 'Karte bearbeiten';
  if(!box) return;
  if(!_kb){ box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = '';
  const k = _kb;
  if(k.modus === 'start'){
    box.innerHTML = `<div class="lp-bearb-zeile">
        <button type="button" class="btn secondary" onclick="kbNeu('flaeche')">Neue Fläche</button>
        <button type="button" class="btn secondary" onclick="kbNeu('linie')">Neue Linie</button>
        <button type="button" class="btn secondary" onclick="kbGpsStart()">Per GPS gehen</button>
        <button type="button" class="btn" onclick="kbEnde()">Fertig</button>
      </div>
      <div class="lp-bearb-hinweis">Fläche oder Linie antippen, um sie zu ändern. ${_ebenenWahl.planung ? '' : 'Den Konzeptplan blendest du über den Ebenen-Knopf ein.'}</div>`;
  } else if(k.modus === 'zeichnen'){
    box.innerHTML = `<div class="lp-bearb-hinweis">${k.typ === 'linie'
        ? 'Punkt für Punkt auf die Karte tippen. Zum Abschließen den letzten Punkt noch einmal antippen.'
        : 'Ecke für Ecke auf die Karte tippen. Zum Abschließen den ersten Punkt antippen.'}</div>
      <div class="lp-bearb-zeile"><button type="button" class="btn secondary" onclick="kbZeichnenAbbrechen()">Abbrechen</button></div>`;
  } else if(k.modus === 'gps'){
    const n = k.gps.length;
    const genau = k.genau ? `GPS ±${Math.round(k.genau)} m` : 'GPS wird gesucht …';
    box.innerHTML = `<div class="lp-bearb-hinweis">Zur nächsten Ecke gehen und „Punkt hier“ tippen. ${genau} · ${n} ${n === 1 ? 'Punkt' : 'Punkte'}</div>
      <div class="lp-bearb-zeile">
        <button type="button" class="btn" onclick="kbGpsPunkt()">Punkt hier</button>
        <button type="button" class="btn secondary" onclick="kbGpsFertig('flaeche')" ${n < 3 ? 'disabled' : ''}>Als Fläche</button>
        <button type="button" class="btn secondary" onclick="kbGpsFertig('linie')" ${n < 2 ? 'disabled' : ''}>Als Linie</button>
        <button type="button" class="btn secondary" onclick="kbGpsAbbrechen()">Abbrechen</button>
      </div>`;
  } else if(k.modus === 'objekt'){
    const o = kartenObjekt(k.id) || k.neu;
    const namen = [...new Set(kartenObjekte().map(x => x.name))].sort((a, b) => a.localeCompare(b, 'de'));
    const arten = [...new Set(Object.keys(KARTEN_ART_FARBEN).concat(kartenObjekte().map(x => x.art)))].sort((a, b) => a.localeCompare(b, 'de'));
    box.innerHTML = `<div class="lp-bearb-form">
        <label>Name<input type="text" id="kb-name" list="kb-namen" value="${escAttr(o.name)}" autocomplete="off"></label>
        <label>Art<input type="text" id="kb-art" list="kb-arten" value="${escAttr(o.art)}" autocomplete="off"></label>
        <label>Ebene<select id="kb-ebene"><option value="bestand"${o.ebene === 'bestand' ? ' selected' : ''}>Bestand</option><option value="planung"${o.ebene === 'planung' ? ' selected' : ''}>Planung</option></select></label>
        <datalist id="kb-namen">${namen.map(n => `<option value="${escAttr(n)}">`).join('')}</datalist>
        <datalist id="kb-arten">${arten.map(n => `<option value="${escAttr(n)}">`).join('')}</datalist>
      </div>
      <div class="lp-bearb-hinweis">Ecke ziehen = verschieben · Zwischenpunkt ziehen = neue Ecke · Ecke antippen = Ecke weg</div>
      <div class="lp-bearb-zeile">
        <button type="button" class="btn" onclick="kbObjektSpeichern()">Speichern</button>
        <button type="button" class="btn secondary" onclick="kbObjektAbbrechen()">Abbrechen</button>
        ${k.neu ? '' : `<button type="button" class="btn secondary loeschen" onclick="kbObjektLoeschen()">Löschen</button>`}
      </div>`;
  }
}

function kbNeu(typ){
  if(!_kb) return;
  _kb.modus = 'zeichnen'; _kb.typ = typ;
  const stil = objektStil({typ, art: typ === 'linie' ? 'Weg' : 'Sonstiges', ebene: 'bestand'}, true);
  satMap.pm.enableDraw(typ === 'linie' ? 'Line' : 'Polygon', {pathOptions: stil, templineStyle: {color: '#D9B458'}, hintlineStyle: {color: '#D9B458', dashArray: '4 4'}, finishOn: typ === 'linie' ? 'snap' : null});
  kbLeiste();
}
function kbZeichnenAbbrechen(){
  if(satMap.pm) satMap.pm.disableDraw();
  _kb.modus = 'start';
  kbLeiste();
}

function _kbGeoAusLayer(l, typ){
  const r = p => [Math.round(p.lat * 1e7) / 1e7, Math.round(p.lng * 1e7) / 1e7];
  const ll = l.getLatLngs();
  if(typ === 'linie') return (Array.isArray(ll[0]) ? ll[0] : ll).map(r);
  const ringe = Array.isArray(ll[0]) && Array.isArray(ll[0][0]) ? ll[0] : ll;   /* Mehrfachfläche: erste nehmen */
  return (Array.isArray(ringe[0]) ? ringe : [ringe]).map(ring => ring.map(r));
}

function kbErstellt(e){
  if(!_kb) return;
  const typ = e.shape === 'Line' ? 'linie' : 'flaeche';
  const geo = _kbGeoAusLayer(e.layer, typ);
  e.layer.remove();
  kbNeuesObjekt(typ, geo);
}

function kbNeuesObjekt(typ, geo){
  const id = `k${Date.now().toString(36)}`;
  _kb.modus = 'objekt'; _kb.id = id;
  _kb.neu = {id, name: typ === 'linie' ? 'Neue Linie' : 'Neue Fläche', art: typ === 'linie' ? 'Weg' : 'Sonstiges', ebene: 'bestand', typ, geo};
  /* Erst beim Speichern in den Zustand; bis dahin nur auf der Karte */
  const stil = Object.assign({renderer: _kartenRenderer}, objektStil(_kb.neu, true));
  const l = typ === 'linie' ? L.polyline(geo, stil) : L.polygon(geo, stil);
  l._objekt = _kb.neu;
  l.addTo(_flaechenEbene);
  kbBearbeitbar(l);
  kbLeiste();
  const feld = document.getElementById('kb-name');
  if(feld){ feld.focus(); feld.select(); }
}

function kbBearbeitbar(l){
  if(l && l.pm) l.pm.enable({allowSelfIntersection: true, removeVertexOn: 'click', snappable: true, draggable: false});
}

function kbObjektGetippt(id){
  if(!_kb || _kb.modus === 'zeichnen' || _kb.modus === 'gps') return;
  if(_kb.modus === 'objekt'){
    if(_kb.id === id) return;
    kbObjektAbbrechen(true);
  }
  _kb.modus = 'objekt'; _kb.id = id; _kb.neu = null;
  _flaecheAktiv = id;
  zeichneKarte();
  kbBearbeitbar(objektLayer(id));
  kbLeiste();
}

function kbObjektSpeichern(){
  const k = _kb; if(!k || k.modus !== 'objekt') return;
  const l = objektLayer(k.id) || (_flaechenEbene && (() => { let t = null; _flaechenEbene.eachLayer(x => { if(x._objekt === k.neu) t = x; }); return t; })());
  const alt = k.neu || kartenObjekt(k.id);
  if(!l || !alt) return;
  const name = (document.getElementById('kb-name').value || '').trim();
  const art = (document.getElementById('kb-art').value || '').trim();
  if(!name){ showToast('Bitte einen Namen eingeben.', 'error'); return; }
  const geo = _kbGeoAusLayer(l, alt.typ);
  if(alt.typ === 'linie' ? geo.length < 2 : (!geo[0] || geo[0].length < 3)){ showToast(alt.typ === 'linie' ? 'Eine Linie braucht mindestens 2 Punkte.' : 'Eine Fläche braucht mindestens 3 Ecken.', 'error'); return; }
  if(!state.karte) state.karte = {};
  state.karte[k.id] = {name, art: art || 'Sonstiges', ebene: document.getElementById('kb-ebene').value, typ: alt.typ, geo: JSON.stringify(geo), stand: new Date().toISOString().slice(0, 10)};
  saveState();
  if(l.pm) l.pm.disable();
  showToast(`${name} gespeichert`, 'success');
  _kb.modus = 'start'; _kb.id = null; _kb.neu = null;
  _flaecheAktiv = null;
  zeichneKarte(); renderLageFilter(); kbLeiste();
}

function kbObjektAbbrechen(still){
  const k = _kb; if(!k || k.modus !== 'objekt') return;
  const l = objektLayer(k.id);
  if(l && l.pm) l.pm.disable();
  k.modus = 'start'; k.id = null; k.neu = null;
  _flaecheAktiv = null;
  if(!still){ zeichneKarte(); kbLeiste(); }
}

function kbObjektLoeschen(){
  const k = _kb; if(!k || k.modus !== 'objekt' || k.neu) return;
  const o = kartenObjekt(k.id); if(!o) return;
  if(!state.karte) state.karte = {};
  const vorher = Object.prototype.hasOwnProperty.call(state.karte, k.id) ? state.karte[k.id] : undefined;
  state.karte[k.id] = null;
  saveState();
  setUndo('karte', {id: k.id, vorher});
  k.modus = 'start'; k.id = null;
  _flaecheAktiv = null;
  zeichneKarte(); renderLageFilter(); kbLeiste();
}

/* GPS: Punkte sammeln, während man die Grenze abgeht */
function kbGpsStart(){
  if(!navigator.geolocation){ showToast('Dieses Gerät kann keinen Standort liefern.', 'error'); return; }
  _kb.modus = 'gps'; _kb.gps = []; _kb.genau = null; _kb.letzte = null;
  _kb.spur = L.polyline([], {color: '#D9B458', weight: 3, dashArray: '4 4', renderer: _kartenRenderer}).addTo(satMap);
  _kb.watch = navigator.geolocation.watchPosition(p => {
    if(!_kb) return;
    _kb.letzte = [p.coords.latitude, p.coords.longitude];
    _kb.genau = p.coords.accuracy;
    if(!_kb.ich) _kb.ich = L.circleMarker(_kb.letzte, {radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1}).addTo(satMap);
    else _kb.ich.setLatLng(_kb.letzte);
    if(!_kb.kreis) _kb.kreis = L.circle(_kb.letzte, {radius: _kb.genau, color: '#2563eb', weight: 1, fillOpacity: .08, interactive: false}).addTo(satMap);
    else { _kb.kreis.setLatLng(_kb.letzte); _kb.kreis.setRadius(_kb.genau); }
    kbLeiste();
  }, err => showToast(`GPS: ${err.message}`, 'error'), {enableHighAccuracy: true, maximumAge: 0, timeout: 30000});
  kbLeiste();
}
function kbGpsPunkt(){
  const k = _kb; if(!k || !k.letzte){ showToast('Noch kein GPS-Standort – kurz warten.', 'error'); return; }
  if(k.genau > 15) showToast(`GPS ungenau (±${Math.round(k.genau)} m) – Punkt trotzdem gesetzt.`, 'info');
  k.gps.push(k.letzte.slice());
  k.spur.setLatLngs(k.gps);
  satMap.panTo(k.letzte);
  kbLeiste();
}
function kbGpsStopp(){
  const k = _kb; if(!k) return;
  if(k.watch != null) navigator.geolocation.clearWatch(k.watch);
  ['spur', 'ich', 'kreis'].forEach(n => { if(k[n]){ k[n].remove(); k[n] = null; } });
  k.watch = null;
}
function kbGpsFertig(typ){
  const pts = (_kb && _kb.gps || []).map(p => [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7]);
  kbGpsStopp();
  kbNeuesObjekt(typ, typ === 'linie' ? pts : [pts]);
}
function kbGpsAbbrechen(){
  kbGpsStopp();
  _kb.modus = 'start'; _kb.gps = [];
  kbLeiste();
}

/* ---------- GPS Place Button ---------- */
document.getElementById('btn-gps-place').addEventListener('click', ()=>{
  if(!navigator.geolocation){ alert('Dieses Gerät/Dieser Browser unterstützt keine GPS-Standortermittlung.'); return; }
  if(!selectedForPlacement){ alert('Bitte zuerst einen Baum aus der Liste auswählen.'); return; }
  const id = selectedForPlacement;   /* fest, auch wenn inzwischen „Nächster“ getippt wird */
  document.getElementById('place-status').textContent = 'GPS-Position wird ermittelt …';
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude, longitude, accuracy} = pos.coords;
    const genau = Math.round(accuracy);
    /* Unter Bäumen und am Hang liegt GPS oft 10–30 m daneben (v137) */
    if(genau > 15 && !confirm(`GPS ist nur auf ±${genau} m genau. Trotzdem setzen?\n\nAbbrechen = warten: ein paar Schritte ins Freie gehen und noch einmal „Per GPS setzen“ tippen.`)){
      document.getElementById('place-status').textContent = `GPS ±${genau} m – noch nicht gesetzt. Kurz warten und noch einmal versuchen.`;
      return;
    }
    if(!state.satPositions) state.satPositions = {};
    state.satPositions[id] = {lat:latitude, lng:longitude, gpsAccuracy:genau};
    delete state.deletedSatPositions[id];
    saveState();
    renderSatMarkers();
    nachDemSetzen(id, `GPS-Position gesetzt (±${genau} m).`);
  }, err=>{
    alert('GPS-Standort konnte nicht ermittelt werden: '+err.message);
    document.getElementById('place-status').textContent = '';
  }, {enableHighAccuracy:true, timeout:25000, maximumAge:0});
});

/* ---------- Map Click (Platzieren) ---------- */
document.getElementById('map-wrap').addEventListener('click', (e)=>{
  if(!placeMode) return;
  if(e.target.closest('.pin') || e.target.closest('#zoom-controls')) return;
  if(!selectedForPlacement){ alert('Bitte zuerst einen Baum aus der Liste auswählen.'); return; }
  const rect = e.currentTarget.getBoundingClientRect();
  let x = (e.clientX-rect.left)/rect.width*100;
  let y = (e.clientY-rect.top)/rect.height*100;
  if(lageScale > 1){
    x = (x - 50) / lageScale + 50 - (lageTx / rect.width * 100);
    y = (y - 50) / lageScale + 50 - (lageTy / rect.height * 100);
  }
  const imgPct = _toImg(x, y);
  x = Math.max(0, Math.min(100, parseFloat(imgPct.x.toFixed(2))));
  y = Math.max(0, Math.min(100, parseFloat(imgPct.y.toFixed(2))));
  state.positions[selectedForPlacement] = {x, y};
  saveState();
  renderPins();
  nachDemSetzen(selectedForPlacement, 'Position gespeichert.');
});

/* ---------- Lageplan Zoom & Pan ---------- */
let lageScale = 1, lageTx = 0, lageTy = 0;
function _lageApplyTransform(){
  const el = document.getElementById('lage-inner');
  if(el) el.style.transform = 'scale('+lageScale+') translate('+lageTx+'px,'+lageTy+'px)';
}
function lageZoom(dir){
  lageScale = Math.max(1, Math.min(4, lageScale + dir * 0.5));
  if(lageScale===1){ lageTx=0; lageTy=0; }
  _lageApplyTransform();
}
function lageZoomReset(){ lageScale=1; lageTx=0; lageTy=0; _lageApplyTransform(); }

(function(){
  const wrap = document.getElementById('map-wrap');
  if(!wrap) return;
  wrap.addEventListener('wheel', function(e){
    if(e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    lageZoom(e.deltaY<0 ? 1 : -1);
  }, {passive:false});

  let panning = false, panStart = null;
  wrap.addEventListener('mousedown', function(e){
    if(lageScale<=1) return;
    if(e.target.closest('.pin') || e.target.closest('#zoom-controls')) return;
    panning = true;
    panStart = {x: e.clientX - lageTx, y: e.clientY - lageTy};
    wrap.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', function(e){
    if(!panning) return;
    lageTx = e.clientX - panStart.x;
    lageTy = e.clientY - panStart.y;
    _lageApplyTransform();
  });
  window.addEventListener('mouseup', function(){
    if(panning){ panning = false; wrap.style.cursor = ''; }
  });

  let lastDist = 0, touchPan = null;
  wrap.addEventListener('touchstart', function(e){
    if(e.touches.length===1 && lageScale>1 && !e.target.closest('.pin')){
      const t=e.touches[0];
      touchPan={id:t.identifier, sx:t.clientX-lageTx, sy:t.clientY-lageTy};
    }
    if(e.touches.length===2){
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      lastDist=Math.sqrt(dx*dx+dy*dy);
      touchPan=null;
    }
  }, {passive:true});
  wrap.addEventListener('touchmove', function(e){
    if(e.touches.length===1 && touchPan){
      e.preventDefault();
      const t=e.touches[0];
      if(t.identifier===touchPan.id){
        lageTx=t.clientX-touchPan.sx; lageTy=t.clientY-touchPan.sy;
        _lageApplyTransform();
      }
      return;
    }
    if(e.touches.length===2){
      e.preventDefault();
      const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(lastDist>0){
        const ratio=dist/lastDist;
        lageScale = Math.max(1, Math.min(4, lageScale * ratio));
        if(lageScale===1){ lageTx=0; lageTy=0; }
        _lageApplyTransform();
      }
      lastDist=dist;
    }
  }, {passive:false});
  wrap.addEventListener('touchend', function(){ lastDist=0; touchPan=null; });
  wrap.addEventListener('touchcancel', function(){ touchPan=null; });
})();

/* ---------- Pins ---------- */
function _getMetrics(){
  const wrap = document.getElementById('map-wrap');
  const img = document.getElementById('map-img');
  const r = wrap.getBoundingClientRect();
  const cw = r.width, ch = r.height;
  const iw = img && img.naturalWidth ? img.naturalWidth : cw;
  const ih = img && img.naturalHeight ? img.naturalHeight : ch;
  const s = Math.min(cw/iw, ch/ih);
  return { cw, ch, dw: iw*s, dh: ih*s, ox: (cw-iw*s)/2, oy: (ch-ih*s)/2 };
}
function _toImg(cx, cy, m){
  if(!m) m = _getMetrics();
  return { x: (cx/100*m.cw - m.ox) / m.dw * 100, y: (cy/100*m.ch - m.oy) / m.dh * 100 };
}
function _toCtr(ix, iy, m){
  if(!m) m = _getMetrics();
  return { x: (m.ox + m.dw*ix/100) / m.cw * 100, y: (m.oy + m.dh*iy/100) / m.ch * 100 };
}
function _migratePins(){
  if(state._pinFmt === 'img') return;
  const img = document.getElementById('map-img');
  if(!img || !img.complete || !img.naturalWidth) return;
  const wrap = document.getElementById('map-wrap');
  const r = wrap.getBoundingClientRect();
  const cw = r.width, ch = r.height;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const imageH = cw * ih / iw;
  if(imageH <= 0 || !state.positions) return;
  let changed = false;
  Object.entries(state.positions).forEach(([id,pos])=>{
    const ny = Math.max(0, Math.min(100, Math.round(pos.y * ch / imageH * 100) / 100));
    if(ny !== pos.y){ state.positions[id] = {x: pos.x, y: ny}; changed = true; }
  });
  state._pinFmt = 'img';
  if(changed) saveState();
}
function renderPins(){
  document.querySelectorAll('.pin').forEach(p=>p.remove());
  const wrap = document.getElementById('lage-inner') || document.getElementById('map-wrap');
  _migratePins();
  const m = _getMetrics();
  const editing = isAdmin();
  Object.entries(state.positions).forEach(([id,pos])=>{
    const t = getTree(id);
    if(!t) return;
    if(currentImage !== 'lageplan') {
      const photo = SECTION_PHOTOS.find(s => s.id === currentImage);
      if(photo && t.standort_zeile && t.standort_zeile !== photo.row) return;
    }
    const c = _toCtr(pos.x, pos.y, m);
    const pin = document.createElement('div');
    pin.className = 'pin ' + (t? (t.frucht||'').toLowerCase():'') + (editing? '' : ' locked');
    pin.style.left = c.x+'%';
    pin.style.top = c.y+'%';
    pin.dataset.id = id;
    pin.title = t
      ? (editing ? `${id} — ${t.sorte} (ziehen zum Verschieben)` : `${id} — ${t.sorte} (zum Verschieben bitte einloggen)`)
      : id;
    makePinDraggable(pin, id, editing);
    wrap.appendChild(pin);
  });
}

function makePinDraggable(pin, id, editing){
  if(!editing){
    pin.addEventListener('pointerup', (e)=>{
      e.stopPropagation();
      if(!placeMode) selectPinAndOpen(pin, id);
    });
    return;
  }
  let dragging = false, moved = false;
  pin.addEventListener('pointerdown', (e)=>{
    e.stopPropagation();
    dragging = true; moved = false;
    pin.setPointerCapture(e.pointerId);
    pin.classList.add('dragging');
  });
  pin.addEventListener('dblclick', (e)=>{
    e.stopPropagation();
    removePosition(id);
  });
  pin.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    moved = true;
    const rect = document.getElementById('map-wrap').getBoundingClientRect();
    let x = (e.clientX-rect.left)/rect.width*100;
    let y = (e.clientY-rect.top)/rect.height*100;
    if(lageScale > 1){
      x = (x - 50) / lageScale + 50 - (lageTx / rect.width * 100);
      y = (y - 50) / lageScale + 50 - (lageTy / rect.height * 100);
    }
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    pin.style.left = x+'%';
    pin.style.top = y+'%';
    pin.dataset.x = x; pin.dataset.y = y;
  });
  pin.addEventListener('pointerup', (e)=>{
    e.stopPropagation();
    if(!dragging) return;
    dragging = false;
    pin.classList.remove('dragging');
    if(moved){
      const cx = parseFloat(pin.dataset.x), cy = parseFloat(pin.dataset.y);
      const ip = _toImg(cx, cy);
      const existing = state.positions[id] || {};
      state.positions[id] = Object.assign({}, existing, {x: Math.round(ip.x*100)/100, y: Math.round(ip.y*100)/100});
      saveState();
      document.getElementById('place-status').textContent = 'Position verschoben';
    } else if(!placeMode){
      selectPinAndOpen(pin, id);
    }
  });
}

function selectPinAndOpen(pin, id){
  document.querySelectorAll('.pin.selected').forEach(p=>p.classList.remove('selected'));
  pin.classList.add('selected');
  openBaumModal(id);
}

function removePosition(id){
  const hasLage = !!state.positions[id];
  const hasSat = !!(state.satPositions||{})[id];
  if(!hasLage && !hasSat) return;
  const t = getTree(id);
  const label = t? `${id} — ${t.sorte}` : id;
  const wo = hasLage && hasSat ? 'Lageplan UND Satellit' : hasLage ? 'Lageplan' : 'Satellit';
  if(!confirm(`Stecknadel für ${label} von ${wo} entfernen? Der Baum bleibt im Baumkataster erhalten.`)) return;
  if(hasLage) delete state.positions[id];
  if(hasSat){ delete state.satPositions[id]; state.deletedSatPositions[id] = true; }
  saveState();
  renderPins(); renderSatMarkers(); renderUnplacedSelect();
  document.getElementById('place-status').textContent = 'Position entfernt.';
  closeModal();
}



/* ---------- Export / Import / Reset ---------- */
document.getElementById('btn-export').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state, null, 1)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = new Date().toISOString().slice(0,10);
  a.download = `hendlberghof_obstdb_ergaenzungen_${d}.json`;
  a.click();
});
document.getElementById('file-import').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const imported = JSON.parse(ev.target.result);
      if(imported.positions && imported.sukzession && imported.ernten){
        if(imported.positions) Object.assign(state.positions, imported.positions);
        if(imported.sukzession) Object.assign(state.sukzession, imported.sukzession);
        if(imported.ernten) Object.assign(state.ernten, imported.ernten);
        if(imported.customTrees) state.customTrees = (state.customTrees||[]).concat(imported.customTrees.filter(c=>!state.customTrees.some(e=>e.id===c.id)));
        if(imported.baumEdits) Object.assign(state.baumEdits, imported.baumEdits);
        if(imported.sortenEdits) Object.assign(state.sortenEdits, imported.sortenEdits);
        if(imported.phaenologie) Object.assign(state.phaenologie, imported.phaenologie);
        saveState();
        alert('Import erfolgreich.');
        renderPins(); renderUnplacedSelect(); renderBaumTable();
      } else {
        alert('Diese Datei hat nicht das erwartete Format.');
      }
    }catch(err){ alert('Fehler beim Lesen der Datei: '+err.message); }
  };
  reader.readAsText(file);
});

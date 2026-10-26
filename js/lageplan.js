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
function renderUnplacedSelect(){
  const sel = document.getElementById('unplaced-select');
  sel.innerHTML = '<option value="">– Baum wählen –</option>';
  const isSat = mapLayer === 'sat';
  /* Auf der Karte stehen auch die Bäume mit „Lage ungefähr“ zur Wahl: Sie
     lassen sich so per GPS oder Antippen genau setzen. */
  getAllTrees().filter(t=> isSat ? !(state.satPositions||{})[t.id] : !state.positions[t.id]).sort((a,b)=>a.id.localeCompare(b.id,'de',{numeric:true}))
    .forEach(t=>{
      const o = document.createElement('option');
      const ungefaehr = isSat && typeof kartenPos === 'function' && kartenPos(t.id);
      o.value = t.id; o.textContent = `${t.id} — ${t.sorte}${ungefaehr ? ' (ungefähr)' : ''}`;
      sel.appendChild(o);
    });
  }
  var sel2 = document.getElementById('unplaced-select');
  if(sel2) sel2.addEventListener('change', e=>{
  selectedForPlacement = e.target.value;
  if(selectedForPlacement){
    placeMode = true;
    if(satMap) satMap.dragging.disable();
    document.getElementById('place-mode-label').textContent = 'Baum setzen';
    document.getElementById('place-status').textContent = 'Auf Karte klicken, um den Baum zu positionieren.';
  } else {
    placeMode = false;
    if(satMap) satMap.dragging.enable();
    document.getElementById('place-mode-label').textContent = 'Position setzen';
    document.getElementById('place-status').textContent = '';
  }
});
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
let FLAECHEN = null;
let _lageDatenPromise = null;
let _flaechenEbene = null;
let _flaecheAktiv = null;

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
    placeMode = false;
    if(satMap) satMap.dragging.enable();
    lageScale = 1; lageTx = 0; lageTy = 0; _lageApplyTransform();
    renderPins();
  }
  applyEditModeUI();
  renderUnplacedSelect();
}

function initSatMap(){
  if(typeof L === 'undefined') return;
  if(!satMap){
    satMap = L.map('sat-map', {maxZoom: 22, zoomSnap: 0.5}).setView([48.0702, 15.8442], 18);
    L.tileLayer('https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg', {
      maxZoom: 22, maxNativeZoom: 19,
      attribution: 'basemap.at'
    }).addTo(satMap);
    L.tileLayer('assets/ortho2023/{z}/{x}/{y}.webp', {
      maxZoom: 22, minNativeZoom: 15, maxNativeZoom: 21,
      bounds: [[48.06842, 15.84214], [48.07240, 15.84644]],
      attribution: 'Luftbild Hendlberghof 2023'
    }).addTo(satMap);
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
        placeMode = false;
        selectedForPlacement = null;
        if(satMap) satMap.dragging.enable();
        document.getElementById('place-mode-label').textContent = 'Position setzen';
        document.getElementById('place-status').textContent = 'Position auf der Karte gesetzt.';
        document.getElementById('unplaced-select').value = '';
        renderUnplacedSelect();
        return;
      }
      flaecheMarkieren(null);
    });
    ladeLageDaten().then(() => {
      zeichneFlaechen();
      renderSatMarkers();
      renderLageFilter();
    });
  }
  renderSatMarkers();
  setTimeout(()=>{ satMap.invalidateSize(); }, 100);
  setTimeout(()=>{ satMap.invalidateSize(); }, 500);
}

function flaechenStil(f, aktiv){
  const farbe = FLAECHEN_FARBEN[f.art] || '#ffffff';
  return {color: farbe, weight: aktiv ? 2.5 : 1.2, opacity: aktiv ? 1 : .85, fillColor: farbe, fillOpacity: aktiv ? .22 : .06};
}

function zeichneFlaechen(){
  if(!satMap || !FLAECHEN || _flaechenEbene) return;
  _flaechenEbene = L.layerGroup().addTo(satMap);
  if(FLAECHEN.grenze) L.polyline(FLAECHEN.grenze, {color: '#D9B458', weight: 1.5, dashArray: '6 5', interactive: false}).addTo(_flaechenEbene);
  (FLAECHEN.flaechen || []).forEach(f => {
    const poly = L.polygon(f.ringe, flaechenStil(f, false));
    poly._flaeche = f;
    poly.on('click', e => {
      if(placeMode) return;
      L.DomEvent.stopPropagation(e);
      flaecheMarkieren(f.id, e.latlng);
    });
    poly.addTo(_flaechenEbene);
  });
}

function flaecheMarkieren(id, wo, zoomen){
  if(!_flaechenEbene) return;
  _flaecheAktiv = id || null;
  let treffer = null;
  _flaechenEbene.eachLayer(l => {
    if(!l._flaeche) return;
    const aktiv = l._flaeche.id === _flaecheAktiv;
    l.setStyle(flaechenStil(l._flaeche, aktiv));
    if(aktiv){ treffer = l; l.bringToFront(); }
  });
  satMap.closePopup();
  const sel = document.getElementById('lp-bereich');
  if(sel) sel.value = _flaecheAktiv || '';
  if(!treffer) return;
  const f = treffer._flaeche;
  if(zoomen) satMap.fitBounds(treffer.getBounds(), {padding: [24, 24], maxZoom: 21});
  L.popup({closeButton: false, className: 'lp-popup', autoPanPadding: [16, 16]})
    .setLatLng(wo || treffer.getBounds().getCenter())
    .setContent(`<div class="lp-fl-name">${escHtml(f.name)}</div><div class="lp-fl-info">${escHtml(f.art)} · ${f.m2.toLocaleString('de-AT')} m²</div><div class="lp-fl-info">Entwurf aus dem Konzeptplan 2020</div>`)
    .openOn(satMap);
}

function lageBereichWaehlen(id){
  if(!satMap) return;
  if(!id){
    flaecheMarkieren(null);
    lageGanzerHof();
    return;
  }
  flaecheMarkieren(id, null, true);
}

function lageGanzerHof(){
  if(!satMap) return;
  if(FLAECHEN && FLAECHEN.grenze) satMap.fitBounds(FLAECHEN.grenze, {padding: [12, 12]});
}

function renderLageFilter(){
  const bereich = document.getElementById('lp-bereich');
  if(bereich && FLAECHEN){
    const liste = (FLAECHEN.flaechen || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'de', {numeric: true}));
    bereich.innerHTML = `<option value="">Ganzer Hof</option>${liste.map(f => `<option value="${escAttr(f.id)}">${escHtml(f.name)}</option>`).join('')}`;
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
  getAllTrees().forEach(t => {
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
      if(placeMode) return;
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

/* Aus der Baumkarte: auf der Karte zeigen, sonst auf dem alten Foto. */
function lageZeigen(id){
  if(typeof L !== 'undefined'){
    ladeLageDaten().then(() => {
      const pos = kartenPos(id);
      if(pos){
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
/* ---------- GPS Place Button ---------- */
document.getElementById('btn-gps-place').addEventListener('click', ()=>{
  if(!navigator.geolocation){ alert('Dieses Gerät/Dieser Browser unterstützt keine GPS-Standortermittlung.'); return; }
  if(!selectedForPlacement){ alert('Bitte zuerst einen Baum aus der Liste auswählen.'); return; }
  document.getElementById('place-status').textContent = 'GPS-Position wird ermittelt …';
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude, longitude, accuracy} = pos.coords;
    if(!state.satPositions) state.satPositions = {};
    state.satPositions[selectedForPlacement] = {lat:latitude, lng:longitude, gpsAccuracy:Math.round(accuracy)};
    delete state.deletedSatPositions[selectedForPlacement];
    saveState();
    renderSatMarkers(); renderUnplacedSelect();
    placeMode = false;
    if(satMap) satMap.dragging.enable();
    selectedForPlacement = '';
    document.getElementById('unplaced-select').value='';
    document.getElementById('place-mode-label').textContent = 'Position setzen';
    document.getElementById('place-status').textContent = `GPS-Position im Satellit gesetzt (±${Math.round(accuracy)} m)`;
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
  renderPins(); renderUnplacedSelect();
  placeMode = false;
  selectedForPlacement = '';
  document.getElementById('unplaced-select').value='';
  document.getElementById('place-mode-label').textContent = 'Position setzen';
  document.getElementById('place-status').textContent = 'Position gespeichert – nächsten Baum wählen.';
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

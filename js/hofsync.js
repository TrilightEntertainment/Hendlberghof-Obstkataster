/* hofsync.js — Hendlberghof Obstdatenbank
   Daten und Anmeldung über den eigenen Server (Hofbuch-Schnittstelle
   ../hofbuch/api.php) statt Firebase. Stufe B des Umzugs zu World4You
   (Volkmar 11.11.2026).

   Jede Angabe ist ein eigener Eintrag (Art + Kennung) mit Versionsnummer
   (rev): je Baum die Lage, die Baumangaben, ein eigener Baum, je
   Kartenobjekt, je Sorte, je Prüfergebnis … Geschickt wird nur, was sich
   geändert hat. Ändern zwei Geräte denselben Eintrag gleichzeitig, gilt die
   zuletzt gespeicherte Angabe, bei Prüfergebnissen die mit dem jüngeren
   Zeitstempel.

   Ablauf: erst die eigenen Änderungen schicken, dann Fremdes holen – nach
   jedem Speichern, alle 30 Sekunden und beim Zurückkehren in die App. Ohne
   Netz bleibt alles am Gerät und geht beim nächsten Mal mit.

   Basis = was dieses Gerät zuletzt vom Server kannte (rev und Prüfsumme je
   Eintrag, localStorage). Ein Eintrag weicht von seiner Basis ab → eigene
   Änderung. Ein Eintrag der Basis fehlt im Gerät → hier gelöscht.

   Die Anmeldung teilt sich das Kataster mit dem Hofbuch: gleiche Adresse,
   gleicher Schlüssel (localStorage „ansatzbuch.schluessel“, Cookie für
   /hofbuch/). Admin darf alles, Helfer nur die Arten in HOF_HELFER_SCHREIBEN
   (prüft der Server ebenso). */

const HOF_API = '../hofbuch/api.php';
const HOF_BASIS_KEY = 'hendlberghof_hofsync_v1';
const HOF_SCHLUESSEL_KEY = 'ansatzbuch.schluessel';
const HOF_NAME_KEY = 'hendlberghof_helfername';
const HOF_TAKT_MS = 30000;
const HOF_HELFER_SCHREIBEN = ['kataster_lage', 'kataster_lage_weg', 'kataster_fotolage', 'kataster_ernte',
  'kataster_sukzession', 'kataster_phaenologie', 'kataster_pruefergebnis', 'kataster_prueffund'];
const HOF_HELFER_LESEN_PRIVAT = ['kataster_pruefliste', 'kataster_pruefinfo', 'kataster_pruefergebnis', 'kataster_prueffund'];

/* Fächer: wo die Angabe im Gerät liegt und als welche Art sie am Server steht.
   form: 'map' = Objekt Schlüssel → Wert, 'liste' = Liste mit Kennungsfeld, 'wert' = ein einzelner Wert. */
const _hofState = (key, art, form, extra) => Object.assign({art, form,
  halter: () => state, key}, extra || {});
const _hofPruef = (key, art, form, extra) => Object.assign({art, form,
  halter: () => (typeof pruefung !== 'undefined' ? pruefung : null), key, pruef: true, privat: true}, extra || {});
const HOF_FAECHER = [
  _hofState('satPositions', 'kataster_lage', 'map'),
  _hofState('deletedSatPositions', 'kataster_lage_weg', 'map'),
  _hofState('positions', 'kataster_fotolage', 'map'),
  _hofState('baumEdits', 'kataster_baumangaben', 'map'),
  _hofState('customTrees', 'kataster_eigenbaum', 'liste', {feld: 'id'}),
  _hofState('sortenEdits', 'kataster_sortenangaben', 'map'),
  _hofState('karte', 'kataster_karte', 'map'),
  _hofState('ernten', 'kataster_ernte', 'map'),
  _hofState('phaenologie', 'kataster_phaenologie', 'map'),
  _hofState('sukzession', 'kataster_sukzession', 'map'),
  _hofState('verifiziert', 'kataster_verifiziert', 'map'),
  _hofState('fruehereBaeume', 'kataster_frueher', 'map'),
  _hofState('obstarten', 'kataster_obstart', 'map'),
  _hofState('sortenSichtbar', 'kataster_sichtbar', 'map'),
  _hofState('preislisten', 'kataster_preisliste', 'map'),
  _hofState('produktion', 'kataster_produktion', 'map'),
  _hofState('betrieb', 'kataster_betrieb', 'map'),
  _hofState('importLog', 'kataster_importlog', 'liste', {feld: 'id'}),
  _hofState('importSnapshots', 'kataster_importstand', 'liste', {feld: 'importId'}),
  _hofState('_pinFmt', 'kataster_einstellung', 'wert'),
  _hofState('merklisten', 'kataster_merkliste', 'map', {privat: true}),
  _hofState('bestellungen', 'kataster_bestellung', 'liste', {feld: 'id', privat: true}),
  _hofPruef('liste', 'kataster_pruefliste', 'map'),
  _hofPruef('ergebnisse', 'kataster_pruefergebnis', 'map', {zeit: true}),
  _hofPruef('funde', 'kataster_prueffund', 'map', {zeit: true}),
  _hofPruef('listeStand', 'kataster_pruefinfo', 'wert'),
  _hofPruef('listeQuelle', 'kataster_pruefinfo', 'wert')
];

let _hofRolle = '';            /* '' | 'admin' | 'helfer' */
let _hofBasis = {seit: '', eintraege: {}};
let _hofLaeuft = null;
let _hofNochmal = false;
let _hofTimer = null;
let _hofBereit = false;
let _hofHinweisGezeigt = {};

/* ---------- Kennung und Prüfsumme ---------- */
function _hofHash(text, saat){
  let h1 = 0xdeadbeef ^ (saat || 0), h2 = 0x41c6ce57 ^ (saat || 0);
  for(let i = 0; i < text.length; i++){
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
/* Sortennamen wie „Topaz®“ taugen nicht als Kennung – dann eine Prüfsumme; der Name steht im Eintrag. */
function hofId(k){ return /^[A-Za-z0-9_-]{1,64}$/.test(k) ? k : `x${_hofHash(k, 1)}${_hofHash(k, 2)}`; }

/* ---------- Einträge eines Fachs lesen und schreiben ---------- */
function _hofEintraege(f){
  const h = f.halter();
  if(!h) return [];
  const quelle = h[f.key];
  if(f.form === 'wert') return quelle === undefined ? [] : [{id: hofId(f.key), k: f.key, v: quelle}];
  if(f.form === 'liste') return (Array.isArray(quelle) ? quelle : [])
    .filter(x => x && x[f.feld] != null).map(x => ({id: hofId(String(x[f.feld])), k: String(x[f.feld]), v: x}));
  return Object.entries(quelle && typeof quelle === 'object' ? quelle : {}).map(([k, v]) => ({id: hofId(k), k, v}));
}
function _hofSetzen(f, k, v){
  const h = f.halter();
  if(!h) return;
  if(f.form === 'wert'){ h[f.key] = v; return; }
  if(f.form === 'liste'){
    if(!Array.isArray(h[f.key])) h[f.key] = [];
    const i = h[f.key].findIndex(x => x && String(x[f.feld]) === k);
    if(i >= 0) h[f.key][i] = v; else h[f.key].push(v);
    return;
  }
  if(!h[f.key] || typeof h[f.key] !== 'object') h[f.key] = {};
  h[f.key][k] = v;
}
function _hofEntfernen(f, k){
  const h = f.halter();
  if(!h) return;
  if(f.form === 'wert'){ delete h[f.key]; return; }
  if(f.form === 'liste'){ if(Array.isArray(h[f.key])) h[f.key] = h[f.key].filter(x => !(x && String(x[f.feld]) === k)); return; }
  if(h[f.key] && typeof h[f.key] === 'object') delete h[f.key][k];
}
function _hofFach(art, id){
  return HOF_FAECHER.find(f => f.art === art && (f.form !== 'wert' || hofId(f.key) === id)) || null;
}
function _hofSichtbar(f){
  if(!f.privat) return true;
  if(_hofRolle === 'admin') return true;
  return _hofRolle === 'helfer' && HOF_HELFER_LESEN_PRIVAT.includes(f.art);
}
function _hofDarfSchreiben(f){
  return _hofRolle === 'admin' || (_hofRolle === 'helfer' && HOF_HELFER_SCHREIBEN.includes(f.art));
}

/* ---------- Basis ---------- */
function _hofBasisLaden(){
  try { const b = JSON.parse(localStorage.getItem(HOF_BASIS_KEY) || 'null'); if(b && b.eintraege) _hofBasis = b; } catch(e){}
}
function _hofBasisMerken(){
  try { localStorage.setItem(HOF_BASIS_KEY, JSON.stringify(_hofBasis)); } catch(e){}
}

/* ---------- Verbindung ---------- */
async function _hofApi(aktion, inhalt, anhang){
  const o = {method: inhalt ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: {'X-Ansatzbuch': '1'}};
  let sk = null;
  try { sk = localStorage.getItem(HOF_SCHLUESSEL_KEY); } catch(e){}
  if(sk) o.headers['X-Ansatzbuch-Schluessel'] = sk;
  if(inhalt){ o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(inhalt); }
  const r = await fetch(`${HOF_API}?aktion=${aktion}${anhang || ''}`, o);
  const j = await r.json().catch(() => ({}));
  j.status = r.status;
  return j;
}

/* ---------- Schicken ---------- */
function _hofAenderungen(){
  const aus = [];
  HOF_FAECHER.forEach(f => {
    if(!_hofDarfSchreiben(f) || !_hofSichtbar(f)) return;
    const da = new Set();
    _hofEintraege(f).forEach(e => {
      const sk = `${f.art}|${e.id}`;
      da.add(sk);
      const daten = {k: e.k, v: e.v === undefined ? null : e.v};
      const h = _hofHash(JSON.stringify(daten));
      const b = _hofBasis.eintraege[sk];
      if(!b || b[1] !== h) aus.push({art: f.art, id: e.id, rev: b ? b[0] : 0, daten, _h: h});
    });
    /* Fehlt im Gerät, was die Basis kennt → hier gelöscht. Verschwindet aber ein großer Teil eines
       Fachs auf einmal, ist eher der Gerätespeicher verloren gegangen: dann nichts löschen, neu holen. */
    const weg = Object.keys(_hofBasis.eintraege).filter(sk => {
      if(da.has(sk)) return false;
      const [art, id] = sk.split('|');
      return _hofFach(art, id) === f && _hofBasis.eintraege[sk][1] !== null;
    });
    const bekannt = Object.keys(_hofBasis.eintraege).filter(sk => sk.startsWith(`${f.art}|`)).length;
    if(weg.length > 20 && weg.length > bekannt / 2){
      console.warn(`[hofsync] ${f.art}: ${weg.length} von ${bekannt} Einträgen fehlen im Gerät – nicht gelöscht, wird neu geholt`);
      weg.forEach(sk => { delete _hofBasis.eintraege[sk]; });
      _hofBasis.seit = '';
      return;
    }
    weg.forEach(sk => {
      const [art, id] = sk.split('|');
      aus.push({art, id, rev: _hofBasis.eintraege[sk][0], loeschen: true});
    });
  });
  return aus;
}

async function _hofSchicken(){
  for(let runde = 0; runde < 3; runde++){
    const liste = _hofAenderungen();
    if(!liste.length) return;
    let geaendertLokal = false;
    for(let i = 0; i < liste.length; i += 400){
      const teil = liste.slice(i, i + 400);
      const j = await _hofApi('kataster_speichern', {eintraege: teil.map(({_h, ...e}) => e)});
      if(j.status === 401){ _hofRolleSetzen(''); return; }
      if(j.status === 403){
        if(!_hofHinweisGezeigt.recht){ _hofHinweisGezeigt.recht = true; showToast(j.fehler || 'Das darf nur der Admin ändern.', 'error', 6000); }
        return;
      }
      if(j.status !== 200 || !Array.isArray(j.ergebnisse)) throw new Error(j.fehler || `Server ${j.status}`);
      j.ergebnisse.forEach((erg, n) => {
        const e = teil[n];
        const sk = `${e.art}|${e.id}`;
        if(!erg.konflikt){
          if(e.loeschen) delete _hofBasis.eintraege[sk];
          else _hofBasis.eintraege[sk] = [erg.rev, e._h];
          return;
        }
        /* Konflikt: anderswo inzwischen geändert. Prüfergebnisse nach Zeitstempel,
           sonst gilt die eigene, gerade gemachte Änderung (nächste Runde mit neuer rev). */
        const f = _hofFach(e.art, e.id);
        const fern = erg.geloescht ? null : erg.daten;
        _hofBasis.eintraege[sk] = [erg.rev, fern ? _hofHash(JSON.stringify(fern)) : null];
        const fernNeuer = f && f.zeit && fern && fern.v && e.daten && e.daten.v
          && (fern.v.zeit || '') > (e.daten.v.zeit || '');
        if(fernNeuer){ _hofSetzen(f, fern.k, fern.v); geaendertLokal = true; }
      });
    }
    _hofBasisMerken();
    if(geaendertLokal) _hofNachAenderung(true);
  }
}

/* ---------- Holen ---------- */
async function _hofHolen(){
  const voll = !_hofBasis.seit;
  const anhang = (_hofRolle ? '&privat=1' : '') + (voll ? '' : `&seit=${encodeURIComponent(_hofBasis.seit)}`);
  const j = await _hofApi('kataster_lesen', null, anhang);
  if(j.status === 401 && _hofRolle){ _hofRolleSetzen(''); return; }
  if(j.status !== 200 || !Array.isArray(j.eintraege)) throw new Error(j.fehler || `Server ${j.status}`);
  if(j.rolle !== undefined && j.rolle !== _hofRolle) _hofRolleSetzen(j.rolle || '', true);
  /* Der Server ist noch leer (vor dem Einspielen der Umzugsdatei): nichts anfassen und nichts
     schicken – sonst landet der zufällige Stand eines Geräts als Grundbestand am Server. */
  if(voll && !j.eintraege.length && !Object.keys(_hofBasis.eintraege).length){ _hofBasis = {seit: j.jetzt, eintraege: {}, leer: true}; _hofBasisMerken(); return; }
  /* War der Server beim letzten Mal leer, kommt jetzt der eingespielte Bestand: dann einmal
     vollständig holen, damit der alte Gerätestand ersetzt und nicht hochgeschickt wird. */
  if(_hofBasis.leer && j.eintraege.length && !voll){ _hofBasis = {seit: '', eintraege: {}}; return _hofHolen(); }
  if(j.eintraege.length) delete _hofBasis.leer;
  let geaendert = false, pruefGeaendert = false;
  const gesehen = new Set();
  const ohneBasis = !Object.keys(_hofBasis.eintraege).length;
  j.eintraege.forEach(e => {
    const f = _hofFach(e.art, e.id);
    if(!f || !_hofSichtbar(f)) return;
    const sk = `${e.art}|${e.id}`;
    gesehen.add(sk);
    const b = _hofBasis.eintraege[sk];
    if(b && b[0] >= e.rev) return;
    const lokal = _hofEintraege(f).find(x => x.id === e.id);
    const lokalH = lokal ? _hofHash(JSON.stringify({k: lokal.k, v: lokal.v === undefined ? null : lokal.v})) : null;
    /* Eigene, noch nicht geschickte Änderung bleibt (geht mit dem nächsten Schicken). Auf einem
       Gerät ohne Basis gilt beim ersten Holen der Server. */
    const eigeneAenderung = b && _hofDarfSchreiben(f) ? lokalH !== b[1] : false;   /* was man nicht schreiben darf, kommt vom Server */
    if(e.geloescht){
      if(!eigeneAenderung && lokal){ _hofEntfernen(f, lokal.k); geaendert = true; if(f.pruef) pruefGeaendert = true; }
      delete _hofBasis.eintraege[sk];
      return;
    }
    const h = _hofHash(JSON.stringify(e.daten));
    if(!eigeneAenderung && lokalH !== h){ _hofSetzen(f, e.daten.k, e.daten.v); geaendert = true; if(f.pruef) pruefGeaendert = true; }
    _hofBasis.eintraege[sk] = [e.rev, h];
  });
  /* Volles Holen: Was das Gerät hat, der Server aber nicht (mehr), ist anderswo gelöscht –
     oder ein alter Rest dieses Geräts. Beides gehört weg, außer es ist eine eigene neue Angabe. */
  if(voll){
    HOF_FAECHER.forEach(f => {
      if(!_hofSichtbar(f)) return;
      _hofEintraege(f).forEach(x => {
        const sk = `${f.art}|${x.id}`;
        if(gesehen.has(sk)) return;
        const b = _hofBasis.eintraege[sk];
        if(b){ _hofEntfernen(f, x.k); delete _hofBasis.eintraege[sk]; geaendert = true; if(f.pruef) pruefGeaendert = true; }
        else if(ohneBasis || !_hofDarfSchreiben(f)){ _hofEntfernen(f, x.k); geaendert = true; if(f.pruef) pruefGeaendert = true; }
      });
    });
  }
  _hofBasis.seit = j.jetzt;
  _hofBasisMerken();
  if(geaendert) _hofNachAenderung(pruefGeaendert);
}

/* Nach Änderungen vom Server: Zwischenspeicher verwerfen, im Gerät sichern, neu zeichnen. */
function _hofNachAenderung(pruefAuch){
  if(typeof zustandNachFernaenderung === 'function') zustandNachFernaenderung();
  if(pruefAuch && typeof pruefNachFernaenderung === 'function') pruefNachFernaenderung();
}

/* ---------- Abgleich ---------- */
async function hofAbgleich(){
  if(!_hofBereit) return;
  if(_hofLaeuft){ _hofNochmal = true; return _hofLaeuft; }
  _hofLaeuft = (async () => {
    try {
      if(_hofRolle && _hofBasis.seit && !_hofBasis.leer) await _hofSchicken();
      await _hofHolen();
      if(_hofRolle && !_hofBasis.leer) await _hofSchicken();
      hofStatus('');
    } catch(err){
      console.warn('[hofsync] Abgleich nicht möglich (offline?), bleibt am Gerät:', err);
      hofStatus('offline');
    }
  })();
  await _hofLaeuft;
  _hofLaeuft = null;
  if(_hofNochmal){ _hofNochmal = false; return hofAbgleich(); }
}
/* saveState() und pruefungSpeichern() rufen das; kurz warten, dann gesammelt schicken. */
function hofSyncBald(){
  clearTimeout(_hofTimer);
  _hofTimer = setTimeout(hofAbgleich, 600);
}
function hofStatus(was){
  document.documentElement.classList.toggle('hof-offline', was === 'offline');
}

/* ---------- Anmeldung ---------- */
function _hofRolleSetzen(rolle, still){
  const vorher = _hofRolle;
  _hofRolle = rolle || '';
  window.__anmeldung = _hofRolle ? {rolle: _hofRolle} : null;
  if(!_hofRolle){ try { localStorage.removeItem(HOF_SCHLUESSEL_KEY); } catch(e){} }
  if(vorher === _hofRolle) return;
  /* Admin meldet sich ab (oder ein Helfer an): Kundendaten und Merklisten des Hofes nicht am Gerät lassen. */
  if(vorher === 'admin' && typeof state !== 'undefined' && state){
    state.bestellungen = [];
    state.merklisten = {};
    Object.keys(_hofBasis.eintraege).forEach(sk => { if(/^kataster_(bestellung|merkliste)\|/.test(sk)) delete _hofBasis.eintraege[sk]; });
    _hofBasisMerken();
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e){}
  }
  if(typeof applyEditModeUI === 'function') applyEditModeUI();
  /* Private Teile kommen erst angemeldet – dafür einmal alles neu holen. */
  if(_hofRolle && !vorher){ _hofBasis.seit = ''; if(!still) closeModal(); hofSyncBald(); }
}
async function hofAnmelden(passwort){
  const j = await _hofApi('anmelden', {passwort});
  if(j.status !== 200) throw j;
  try { if(j.schluessel) localStorage.setItem(HOF_SCHLUESSEL_KEY, j.schluessel); } catch(e){}
  _hofRolleSetzen(j.rolle || 'admin');
  if(_hofRolle === 'helfer' && !hofHelferName()) setTimeout(hofHelferNameFragen, 300);
  return _hofRolle;
}
async function hofAbmelden(){
  try { await _hofApi('abmelden', {}); } catch(e){}
  _hofRolleSetzen('');
}
function hofRolle(){ return _hofRolle; }

/* Wer trägt ein? Admin heißt Volkmar; Helfer wählen ihren Namen einmal je Gerät. */
function hofHelferName(){ try { return localStorage.getItem(HOF_NAME_KEY) || ''; } catch(e){ return ''; } }
function hofWer(){ return _hofRolle === 'admin' ? 'Volkmar' : (hofHelferName() || 'Helfer'); }
function hofHelferNamen(){
  const namen = new Set();
  if(typeof pruefung !== 'undefined' && pruefung){
    Object.values(pruefung.ergebnisse || {}).concat(Object.values(pruefung.funde || {}))
      .forEach(e => { if(e && e.von && !e.von.includes('@') && e.von !== 'Volkmar') namen.add(e.von); });
  }
  return [...namen].sort((a, b) => a.localeCompare(b, 'de'));
}
function hofHelferNameFragen(){
  const namen = hofHelferNamen();
  document.getElementById('modal-content').innerHTML = `
    <h2>Wer bist du?</h2>
    <form class="login-form" onsubmit="event.preventDefault();hofHelferNameSetzen()">
      <label for="hof-name">Name</label>
      <input type="text" id="hof-name" list="hof-namen" value="${escAttr(hofHelferName())}" autocomplete="off" required>
      <datalist id="hof-namen">${namen.map(n => `<option value="${escAttr(n)}">`).join('')}</datalist>
      <button type="submit" class="login-senden">Weiter</button>
    </form>`;
  document.getElementById('overlay').classList.add('open');
  setTimeout(() => { const f = document.getElementById('hof-name'); if(f) f.focus(); }, 100);
}
function hofHelferNameSetzen(){
  const n = (document.getElementById('hof-name').value || '').trim();
  if(!n) return;
  try { localStorage.setItem(HOF_NAME_KEY, n); } catch(e){}
  closeModal();
}

/* Admin: neues Helfer-Passwort (z. B. wenn jemand abreist). Wer als Helfer angemeldet ist, muss sich neu anmelden. */
async function hofHelferPasswortSetzen(){
  const f = document.getElementById('helfer-pw');
  const aus = document.getElementById('helfer-pw-ergebnis');
  const pw = f ? f.value : '';
  if(pw.length < 8){ aus.textContent = 'Mindestens 8 Zeichen.'; return; }
  const j = await _hofApi('helfer_passwort', {passwort: pw}).catch(() => ({status: 0}));
  if(j.status === 200){ f.value = ''; aus.textContent = 'Neues Helfer-Passwort gilt. Bisherige Helfer-Anmeldungen sind beendet.'; }
  else aus.textContent = j.fehler || 'Nicht gespeichert – Verbindung prüfen.';
}

/* ---------- Umzug: Datei aus Firebase (v148, „Für den Umzug sichern“) einspielen ---------- */
async function hofUmzugEinspielen(datei){
  const aus = document.getElementById('umzug-ergebnis');
  if(_hofRolle !== 'admin'){ aus.textContent = 'Nur angemeldet als Admin.'; return; }
  let d;
  try { d = JSON.parse(await datei.text()); } catch(e){ aus.textContent = 'Die Datei ist kein gültiges JSON.'; return; }
  if(!d || d.quelle !== 'firebase' || !d.main){ aus.textContent = 'Das ist keine Umzugsdatei aus „Für den Umzug sichern“.'; return; }
  const leer = await _hofApi('kataster_lesen', null, '&privat=1');
  if(leer.status !== 200){ aus.textContent = `Server nicht erreichbar (${leer.status}).`; return; }
  if(leer.eintraege.length && !confirm(`Am Server liegen schon ${leer.eintraege.length} Kataster-Einträge. Trotzdem einspielen? Gleiche Einträge werden dabei durch die Datei ersetzt.`)) return;
  /* Gerät auf den Stand der Datei setzen, dann wie eine eigene Änderung schicken. */
  const main = d.main;
  Object.keys(main).forEach(k => { state[k] = main[k]; });
  state.bestellungen = (d.bestellungen && d.bestellungen.liste) || [];
  if(d.pruefung && typeof pruefung !== 'undefined'){
    const p = Object.assign(pruefungLeer(), d.pruefung);
    delete p.stand;
    pruefung = typeof pruefNormalisieren === 'function' ? pruefNormalisieren(p) : p;
  }
  _hofBasis = {seit: 'umzug', eintraege: {}};
  leer.eintraege.forEach(e => { _hofBasis.eintraege[`${e.art}|${e.id}`] = [e.rev, null]; });
  aus.textContent = 'Wird eingespielt …';
  _hofBereit = false;   /* kein Abgleich nebenher */
  if(_hofLaeuft) await _hofLaeuft;
  try {
    await _hofSchicken();
    _hofBasis.seit = '';
    await _hofHolen();
    zustandNachFernaenderung();
    if(typeof pruefNachFernaenderung === 'function') pruefNachFernaenderung();
    const n = Object.keys(_hofBasis.eintraege).length;
    const zahl = o => Array.isArray(o) ? o.length : Object.keys(o || {}).length;
    aus.textContent = `Eingespielt: ${n} Einträge am Server – ${zahl(state.customTrees)} eigene Bäume, ${zahl(state.satPositions)} Lagen, `
      + `${zahl(state.karte)} Kartenobjekte, ${zahl(pruefung.liste)} Einträge der Prüfliste, ${zahl(pruefung.ergebnisse)} Prüfergebnisse, `
      + `${zahl(state.bestellungen)} Bestellungen.`;
  } catch(err){
    aus.textContent = `Abgebrochen: ${(err && err.message) || err}. Nochmals versuchen – schon Eingespieltes wird nicht doppelt angelegt.`;
  } finally {
    _hofBereit = true;
  }
}

/* ---------- Start ---------- */
_hofBasisLaden();
(async () => {
  if(window.__dataReadyPromise){ try { await window.__dataReadyPromise; } catch(e){} }
  try {
    const j = await _hofApi('info');
    if(j.status === 200 && j.rolle) _hofRolleSetzen(j.rolle, true);
    else _hofRolleSetzen('', true);
  } catch(e){ hofStatus('offline'); }
  _hofBereit = true;
  hofAbgleich();
  setInterval(() => { if(document.visibilityState === 'visible') hofAbgleich(); }, HOF_TAKT_MS);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') hofAbgleich(); });
  window.addEventListener('online', hofAbgleich);
})();

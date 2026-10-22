/* =========================================================================
   Bestandsprüfung — Prüfmodus mit Scanfeld
   =========================================================================
   Volkmars Numbers-Buch kennt rund 370 Bäume außerhalb des Katasters, vor
   allem im Baumschulbeet. Was davon noch steht, weiß niemand sicher. Der
   Prüfmodus geht die Liste Gebiet für Gebiet durch: Etikettnummer scannen,
   Status antippen, bei ausgepflanzten Bäumen GPS übernehmen.

   Grundsatz: Ins Kataster kommt nur, was vor Ort bestätigt ist. Diese Datei
   schreibt deshalb NIE in state, BAUM_DATA oder das öffentliche Dokument —
   die Übernahme ist ein eigener, späterer Schritt.

   Daten
     pruefung.liste       P-Nr → Eintrag, aus pruefung/pruefliste.json geladen
     pruefung.ergebnisse  P-Nr → { status, ort, notiz, gps, zeit, durchgaenge }
     pruefung.funde       F-… → Bäume, die auf keiner Liste stehen

   Gespeichert lokal (eigener Schlüssel) und im privaten Firestore-Dokument
   app_state/pruefung — Lesen und Schreiben nur angemeldet. Die Liste ist
   Betriebsbestand, die Notizen sind frei getippt; beides gehört nicht in das
   öffentlich lesbare app_state/main.

   Zusammengeführt wird je Eintrag nach Zeitstempel: Prüfen zwei Geräte
   gleichzeitig, gewinnt die jüngere Angabe zum selben Baum, und keine geht
   verloren, die nur ein Gerät kennt.

   Scannen: Kein eigener Code. iOS erkennt Text in der Kamera selbst
   („Live Text“, ab iPhone XS). Das Nummernfeld ist bewusst ein normales
   Textfeld — dort bietet iOS „Text scannen“ an, und Etiketten tragen auch
   Buchstaben (K4, Z). Auf älteren Geräten tippt man die Nummer.
   ========================================================================= */

const PRUEF_LS_KEY = 'hendlberghof_pruefung_v1';
const PRUEF_FILTER_KEY = 'hendlberghof_pruefung_filter';
const PRUEF_SEITE = 40;

/* Reihenfolge = Häufigkeit im Feld: Die meisten Bäume stimmen oder fehlen. */
const PRUEF_STATUS = [
  { id:'stimmt',      label:'Stimmt',         kurz:'stimmt',         text:'Gefunden, Etikett passt zur Liste' },
  { id:'fehlt',       label:'Nicht gefunden', kurz:'nicht gefunden', text:'Nach zwei Durchgängen abgeschrieben' },
  { id:'tot',         label:'Tot',            kurz:'tot',            text:'Eingegangen oder abgebrochen' },
  { id:'abweichend',  label:'Abweichend',     kurz:'abweichend',     text:'Sorte, Nummer oder Ort weicht ab — Notiz dazu' },
  { id:'ohneEtikett', label:'Ohne Etikett',   kurz:'ohne Etikett',   text:'Baum steht da, Sorte unsicher' },
  { id:'weg',         label:'Weg',            kurz:'weg',            text:'Verkauft oder verschenkt, bestätigt' }
];
const PRUEF_NOTIZ_VORSCHLAEGE = [
  'Etikett unleserlich', 'Etikett erneuern', 'Veredelung nicht angewachsen',
  'Unterlage ausgetrieben', 'Wühlmausschaden', 'Wildverbiss', 'Kümmert',
  'Zum Auspflanzen bereit', 'Etikett zeigt andere Sorte', 'Etikett zeigt andere Nummer'
];
const PRUEF_BEET_GEBIETE = ['Baumschulbeet', 'Segment A', 'Segment B'];

let pruefung = pruefungLeer();
let pruefOffen = null;          /* P-Nr bzw. F-Id der aufgeklappten Karte */
let pruefSichtbar = PRUEF_SEITE;
let pruefFundForm = null;       /* null oder { etikett } — Formular „Fund ohne Eintrag“ */
let pruefGpsLaeuft = null;
let pruefSyncWarnung = false;

function pruefungLeer(){ return { liste:{}, listeStand:'', listeQuelle:'', ergebnisse:{}, funde:{} }; }

function pruefungLaden(){
  try{
    const roh = localStorage.getItem(PRUEF_LS_KEY);
    if(roh) pruefung = Object.assign(pruefungLeer(), JSON.parse(roh));
  }catch(e){ console.warn('[pruefung] lokaler Stand unlesbar:', e); }
}
pruefungLaden();

let _pruefTimer = null;
function pruefungSpeichern(){
  try{ localStorage.setItem(PRUEF_LS_KEY, JSON.stringify(pruefung)); }
  catch(e){ console.warn('[pruefung] lokal nicht speicherbar:', e); }
  clearTimeout(_pruefTimer);
  _pruefTimer = setTimeout(()=>{
    if(isEditMode() && window.__syncPruefung) window.__syncPruefung(pruefung);
  }, 600);
}

/* Für das Firebase-Modul: je Eintrag gewinnt der jüngere Zeitstempel. */
function pruefungZusammenfuehren(lokal, fern){
  const aus = Object.assign(pruefungLeer(), lokal);
  if(!fern) return aus;
  if((fern.listeStand || '') > (aus.listeStand || '')){
    aus.liste = fern.liste || {};
    aus.listeStand = fern.listeStand;
    aus.listeQuelle = fern.listeQuelle || '';
  }
  ['ergebnisse', 'funde'].forEach(teil=>{
    const ziel = Object.assign({}, aus[teil] || {});
    Object.entries(fern[teil] || {}).forEach(([k, v])=>{
      if(!ziel[k] || (v && (v.zeit || '') > (ziel[k].zeit || ''))) ziel[k] = v;
    });
    aus[teil] = ziel;
  });
  return aus;
}
function applyRemotePruefung(fern){
  pruefung = pruefungZusammenfuehren(pruefung, fern);
  try{ localStorage.setItem(PRUEF_LS_KEY, JSON.stringify(pruefung)); }catch(e){}
  const tab = document.getElementById('tab-pruefung');
  if(tab && tab.style.display !== 'none') renderPruefung();
}
function pruefSyncFehler(err){
  console.warn('[pruefung] nicht synchronisiert:', err);
  if(pruefSyncWarnung) return;
  pruefSyncWarnung = true;
  showToast('Prüfergebnisse bleiben vorerst nur auf diesem Gerät — die Firestore-Regel für app_state/pruefung fehlt noch.', 'error', 9000);
}
window.pruefungZusammenfuehren = pruefungZusammenfuehren;
window.applyRemotePruefung = applyRemotePruefung;
window.pruefSyncFehler = pruefSyncFehler;

/* ---------- Hilfen ---------- */
function pruefJetzt(){ return new Date().toISOString(); }
function pruefStatus(id){ return PRUEF_STATUS.find(s=>s.id===id); }
function pruefFilter(){
  try{ return Object.assign({ gebiet:'', status:'offen' }, JSON.parse(localStorage.getItem(PRUEF_FILTER_KEY) || '{}')); }
  catch(e){ return { gebiet:'', status:'offen' }; }
}
function pruefFilterSetzen(teil){
  const f = Object.assign(pruefFilter(), teil);
  try{ localStorage.setItem(PRUEF_FILTER_KEY, JSON.stringify(f)); }catch(e){}
}
/* Live Text liefert gern mehr als die Nummer („Nr. 715“, „715 MM106“).
   Gesucht wird nach jeder Ziffern- bzw. Buchstabengruppe darin. */
function pruefSuchbegriffe(text){
  const teile = String(text || '').toUpperCase().split(/[^0-9A-ZÄÖÜ]+/).filter(Boolean)
    .map(t => /^\d+$/.test(t) ? String(parseInt(t, 10)) : t);
  /* Steht eine Ziffer darin, ist das die Nummer — „NR“ davor ist nur Beiwerk. */
  const mitZiffer = teile.filter(t => /\d/.test(t));
  return mitZiffer.length ? mitZiffer : teile;
}
function pruefNummer(x){ return String(x || '').toUpperCase().replace(/^0+(?=\d)/, ''); }
function pruefDatum(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth()+1}. ${d.getFullYear()}`;
}
function pruefStandardOrt(e){ return PRUEF_BEET_GEBIETE.includes(e.gebiet) ? 'beet' : 'ausgepflanzt'; }

/* Alle Einträge samt Funden in Gehreihenfolge — Funde jeweils am Ende ihres Gebiets. */
function pruefAlleEintraege(){
  const liste = Object.values(pruefung.liste).slice().sort((a, b)=> (a.folge||0) - (b.folge||0));
  const funde = Object.values(pruefung.funde || {}).filter(f=> !f.geloescht)
    .map(f=> Object.assign({ fund:true, pnr:f.id, alt_id:f.etikett, warnungen:[], plan:[] }, f));
  const gebiete = pruefGebiete();
  const rang = g => { const i = gebiete.indexOf(g); return i < 0 ? 999 : i; };
  return liste.concat(funde).sort((a, b)=>
    rang(a.gebiet) - rang(b.gebiet) || (a.fund ? 1 : 0) - (b.fund ? 1 : 0) || (a.folge||0) - (b.folge||0));
}
function pruefGebiete(){
  const reihe = [];
  Object.values(pruefung.liste).slice().sort((a, b)=>(a.folge||0)-(b.folge||0)).forEach(e=>{
    if(e.gebiet && !reihe.includes(e.gebiet)) reihe.push(e.gebiet);
  });
  Object.values(pruefung.funde || {}).forEach(f=>{ if(f.gebiet && !reihe.includes(f.gebiet)) reihe.push(f.gebiet); });
  return reihe;
}
function pruefErgebnis(e){ return e.fund ? e : (pruefung.ergebnisse[e.pnr] || null); }
function pruefIstErledigt(e){
  const r = pruefErgebnis(e);
  if(!r || !r.status) return false;
  /* Nicht gefunden zählt erst nach dem zweiten Durchgang als erledigt. */
  return r.status !== 'fehlt' || (r.durchgaenge || 1) >= 2;
}

/* ---------- Darstellung ---------- */
/* Das Nummernfeld steht fest im Markup und wird nie neu gezeichnet: Ersetzte
   man es beim Tippen, schlösse iOS die Tastatur — und mit ihr „Text scannen“. */
function renderPruefung(){
  const wurzel = document.getElementById('pruefung-inhalt');
  const oben = document.getElementById('pr-oben');
  const scan = document.getElementById('pr-scan');
  const feld = document.getElementById('pr-nummer');
  if(!wurzel || !oben || !scan || !feld) return;
  if(!isEditMode()){ wurzel.innerHTML = ''; oben.innerHTML = ''; scan.style.display = 'none'; return; }
  const anzahl = Object.keys(pruefung.liste).length;
  scan.style.display = anzahl ? '' : 'none';
  if(!anzahl && !pruefFundForm){
    oben.innerHTML = '';
    wurzel.innerHTML = `
      <div class="pr-leer">
        <h3>Noch keine Prüfliste geladen</h3>
        <p>Die Prüfliste wird einmal am Mac aus der Numbers-Datei erzeugt
        (<code>pruefung/pruefliste.json</code>) und hier geladen. Danach steht sie
        auf allen angemeldeten Geräten bereit.</p>
        <button class="btn" data-pr="liste-laden">Prüfliste laden …</button>
      </div>`;
    return;
  }
  const filter = pruefFilter();
  const alle = pruefAlleEintraege();
  const erledigt = alle.filter(pruefIstErledigt).length;
  const anteil = alle.length ? Math.round(erledigt / alle.length * 100) : 0;

  const begriffe = pruefSuchbegriffe(feld.value);
  let treffer;
  if(begriffe.length){
    treffer = alle.filter(e=> e.alt_id && begriffe.includes(pruefNummer(e.alt_id)));
  } else {
    treffer = alle.filter(e=>{
      if(filter.gebiet && e.gebiet !== filter.gebiet) return false;
      const r = pruefErgebnis(e);
      if(filter.status === 'offen') return !pruefIstErledigt(e);
      if(filter.status === 'warnung') return (e.warnungen || []).length > 0;
      if(filter.status === 'alle') return true;
      return r && r.status === filter.status;
    });
  }

  const gebietOptionen = pruefGebiete().map(g=>{
    const teil = alle.filter(e=>e.gebiet===g);
    const fertig = teil.filter(pruefIstErledigt).length;
    return `<option value="${escAttr(g)}" ${g===filter.gebiet?'selected':''}>${escHtml(g)} (${fertig}/${teil.length})</option>`;
  }).join('');
  const statusOptionen = [['offen','Noch offen'], ['alle','Alle'], ['warnung','Mit Warnzeichen']]
    .concat(PRUEF_STATUS.map(s=>[s.id, s.label]))
    .map(([v, l])=> `<option value="${v}" ${v===filter.status?'selected':''}>${l}</option>`).join('');

  const zaehler = PRUEF_STATUS.map(s=>{
    const n = alle.filter(e=>{ const r = pruefErgebnis(e); return r && r.status===s.id; }).length;
    return n ? `<span class="pr-zahl pr-st-${s.id}">${n} ${s.kurz}</span>` : '';
  }).join('');

  let kopfTreffer = '';
  if(begriffe.length){
    kopfTreffer = treffer.length
      ? `<div class="pr-trefferkopf">${treffer.length===1 ? 'Ein Eintrag' : `${treffer.length} Einträge`} mit Nummer ${escHtml(begriffe.join(', '))} — in allen Gebieten gesucht${treffer.length>1 ? '. Nimm den, der zu Sorte und Standort passt.' : ''}</div>`
      : `<div class="pr-trefferkopf pr-keintreffer">Keine Nummer ${escHtml(begriffe.join(', '))} auf der Liste.
           <button class="btn" data-pr="fund-neu">Als Fund ohne Eintrag erfassen</button></div>`;
  }
  /* Ein einzelner Treffer klappt gleich auf — ein Tippen weniger pro Baum. */
  if(begriffe.length && treffer.length===1) pruefOffen = treffer[0].pnr;

  const sichtbar = begriffe.length ? treffer : treffer.slice(0, pruefSichtbar);
  const mehr = treffer.length - sichtbar.length;

  oben.innerHTML = `
    <div class="pr-fortschritt">
      <div class="pr-fortschritt-zeile"><div><b>${erledigt} von ${alle.length}</b> geprüft</div><span>${anteil} %</span></div>
      <div class="pr-balken"><div style="width:${anteil}%"></div></div>
      <div class="pr-zahlen">${zaehler}</div>
    </div>
    ${pruefFundForm ? renderPruefFundForm() : ''}`;
  wurzel.innerHTML = `
    ${begriffe.length ? '' : `
    <div class="pr-filter">
      <select id="pr-gebiet" aria-label="Suchgebiet"><option value="">Alle Gebiete</option>${gebietOptionen}</select>
      <select id="pr-status-filter" aria-label="Status">${statusOptionen}</select>
    </div>`}
    ${kopfTreffer}
    <div class="pr-liste">
      ${sichtbar.map(renderPruefKarte).join('') || (begriffe.length ? '' : '<div class="pr-nichts">Hier ist nichts mehr offen.</div>')}
    </div>
    ${mehr > 0 ? `<button class="btn secondary pr-mehr" data-pr="mehr">${Math.min(mehr, PRUEF_SEITE)} weitere anzeigen (${mehr} übrig)</button>` : ''}
    <div class="pr-fuss">
      <button class="btn secondary" data-pr="fund-neu">Fund ohne Eintrag</button>
      <button class="btn secondary" data-pr="export">Ergebnisse als Excel</button>
      ${isAdmin() ? '<button class="btn secondary" data-pr="liste-laden">Prüfliste neu laden …</button>' : ''}
      <div class="pr-quelle">Liste: ${escHtml(pruefung.listeQuelle || '–')}, Stand ${escHtml(pruefDatum(pruefung.listeStand))}</div>
    </div>
    <datalist id="pr-notizen">${pruefNotizVorschlaege().map(n=>`<option value="${escAttr(n)}">`).join('')}</datalist>`;
}

function pruefPlanText(e){
  return (e.plan || []).map(p=> `alter Plan ${p.block}, Reihe ${p.reihe}, Platz ${p.platz}`).join(' · ');
}

function renderPruefKarte(e){
  const r = pruefErgebnis(e);
  const st = r && r.status ? pruefStatus(r.status) : null;
  const offen = pruefOffen === e.pnr;
  const art = obstartSchluessel(e.frucht);
  const meta = [e.frucht, e.unterlage, e.veredelt ? `veredelt ${e.veredelt}` : '', e.fund ? 'Fund' : e.pnr]
    .filter(Boolean).map(escHtml).join(' · ');
  const hinweis = [e.gebiet, pruefPlanText(e), e.hinweis, e.wo && !e.gebiet.includes(e.wo) ? `Tabelle: ${e.wo}` : '']
    .filter(Boolean).map(escHtml).join(' · ');
  let chip = '';
  if(st){
    const zusatz = r.status==='fehlt' ? ((r.durchgaenge||1) >= 2 ? ' · abgeschrieben' : ' · 1. Durchgang') : '';
    chip = `<span class="pr-chip pr-st-${st.id}">${st.kurz}${zusatz}</span>`;
  }
  return `
    <div class="pr-karte${offen?' offen':''}${st?' geprueft':''}" data-art="${escAttr(art)}">
      <button type="button" class="pr-karte-kopf" data-pr="auf" data-pnr="${escAttr(e.pnr)}" aria-expanded="${offen}">
        <span class="pr-nr">${e.alt_id ? escHtml(e.alt_id) : '–'}</span>
        <span class="pr-sorte">${e.sorte ? escHtml(e.sorte) : '<i>Sorte fehlt</i>'}</span>
        ${chip}
      </button>
      <div class="pr-meta">${meta}</div>
      <div class="pr-hinweis">${hinweis}</div>
      ${(e.warnungen||[]).length ? `<div class="pr-warn">${e.warnungen.map(escHtml).join(' · ')}</div>` : ''}
      ${offen ? renderPruefDetail(e, r) : (r && r.notiz ? `<div class="pr-notiz-kurz">${escHtml(r.notiz)}</div>` : '')}
    </div>`;
}

function renderPruefDetail(e, r){
  const status = r ? r.status : '';
  const ort = (r && r.ort) || pruefStandardOrt(e);
  const pnr = escAttr(e.pnr);
  const gps = r && r.gps;
  return `
    <div class="pr-detail">
      <div class="pr-status-raster">
        ${PRUEF_STATUS.map(s=>`
          <button type="button" class="pr-status-btn pr-st-${s.id}${status===s.id?' aktiv':''}" data-pr="status" data-pnr="${pnr}" data-status="${s.id}" title="${escAttr(s.text)}">
            ${status===s.id ? '✓ ' : ''}${s.label}</button>`).join('')}
      </div>
      <div class="pr-zeile">
        <span class="pr-zeile-label">Wo steht er?</span>
        <div class="pr-segment">
          <button type="button" class="${ort==='beet'?'aktiv':''}" data-pr="ort" data-pnr="${pnr}" data-ort="beet">Baumschulbeet</button>
          <button type="button" class="${ort==='ausgepflanzt'?'aktiv':''}" data-pr="ort" data-pnr="${pnr}" data-ort="ausgepflanzt">Ausgepflanzt</button>
        </div>
      </div>
      ${ort==='ausgepflanzt' ? `
      <div class="pr-zeile">
        <button type="button" class="btn secondary" data-pr="gps" data-pnr="${pnr}" ${pruefGpsLaeuft===e.pnr?'disabled':''}>
          ${pruefGpsLaeuft===e.pnr ? 'GPS wird ermittelt …' : (gps ? 'GPS neu übernehmen' : 'GPS-Position übernehmen')}</button>
        ${gps ? `<span class="pr-gps">${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} · ±${gps.gpsAccuracy} m</span>` : ''}
      </div>` : ''}
      <div class="pr-zeile pr-notiz">
        <label for="pr-notiz-${pnr}" class="pr-zeile-label">Notiz</label>
        <input type="text" id="pr-notiz-${pnr}" list="pr-notizen" data-pr-notiz="${pnr}" value="${escAttr((r && r.notiz) || '')}"
               placeholder="${status==='abweichend' ? 'Was steht auf dem Etikett?' : 'optional'}" autocomplete="off">
      </div>
      <div class="pr-detail-fuss">
        <button type="button" class="btn" data-pr="naechster">Nächster Baum</button>
        ${r && r.zeit ? `<span class="pr-zeit">zuletzt ${escHtml(pruefDatum(r.zeit))}</span>` : ''}
        ${r && r.status && !e.fund ? `<button type="button" class="pr-link" data-pr="zuruecksetzen" data-pnr="${pnr}">zurücksetzen</button>` : ''}
        ${e.fund ? `<button type="button" class="pr-link" data-pr="fund-loeschen" data-pnr="${pnr}">Fund löschen</button>` : ''}
      </div>
    </div>`;
}

function renderPruefFundForm(){
  const f = pruefFundForm;
  const sorten = Array.from(new Set(Object.values(pruefung.liste).map(e=>e.sorte)
    .concat(getAllTrees().map(t=>t.sorte)).filter(Boolean))).sort((a, b)=>a.localeCompare(b, 'de'));
  const arten = Array.from(new Set(Object.values(pruefung.liste).map(e=>e.frucht).filter(Boolean))).sort();
  const filter = pruefFilter();
  const gebiete = pruefGebiete().filter(g=> g !== 'Laut Tabelle abgegeben');
  return `
    <div class="pr-fund">
      <h3>Fund ohne Eintrag</h3>
      <p class="pr-scan-hinweis">Ein Baum, der auf keiner Liste steht. Er wird mitgeprüft und später wie die anderen übernommen.</p>
      <div class="pr-fund-raster">
        <label>Etikett-Nr.<input type="text" id="pr-fund-etikett" value="${escAttr(f.etikett || '')}" autocomplete="off" autocapitalize="characters"></label>
        <label>Sorte<input type="text" id="pr-fund-sorte" list="pr-fund-sorten" autocomplete="off" placeholder="leer lassen, wenn unbekannt"></label>
        <label>Obstart<input type="text" id="pr-fund-art" list="pr-fund-arten" autocomplete="off"></label>
        <label>Gebiet<select id="pr-fund-gebiet">${gebiete.map(g=>`<option ${g===(filter.gebiet||'Baumschulbeet')?'selected':''}>${escHtml(g)}</option>`).join('')}</select></label>
      </div>
      <datalist id="pr-fund-sorten">${sorten.map(s=>`<option value="${escAttr(s)}">`).join('')}</datalist>
      <datalist id="pr-fund-arten">${arten.map(s=>`<option value="${escAttr(s)}">`).join('')}</datalist>
      <div class="pr-detail-fuss">
        <button type="button" class="btn" data-pr="fund-speichern">Fund anlegen</button>
        <button type="button" class="btn secondary" data-pr="fund-abbrechen">Abbrechen</button>
      </div>
    </div>`;
}

/* Bisher getippte Notizen zuerst, dann die festen Vorschläge. */
function pruefNotizVorschlaege(){
  const zahl = {};
  Object.values(pruefung.ergebnisse).concat(Object.values(pruefung.funde||{})).forEach(r=>{
    if(r && r.notiz) zahl[r.notiz] = (zahl[r.notiz]||0) + 1;
  });
  const eigene = Object.keys(zahl).sort((a, b)=> zahl[b] - zahl[a]);
  return eigene.concat(PRUEF_NOTIZ_VORSCHLAEGE.filter(n=> !eigene.includes(n)));
}

/* ---------- Ändern ---------- */
function pruefEintrag(pnr){
  if(pruefung.liste[pnr]) return pruefung.liste[pnr];
  const f = pruefung.funde && pruefung.funde[pnr];
  return f ? Object.assign({ fund:true, pnr:f.id, alt_id:f.etikett }, f) : null;
}
/* Ergebnisse von Listeneinträgen liegen getrennt, Funde tragen ihr Ergebnis selbst. */
function pruefSetze(pnr, aenderung){
  const e = pruefEintrag(pnr);
  if(!e) return;
  if(e.fund){
    pruefung.funde[pnr] = Object.assign({}, pruefung.funde[pnr], aenderung, { zeit:pruefJetzt() });
  } else {
    const alt = pruefung.ergebnisse[pnr] || { ort:pruefStandardOrt(e) };
    pruefung.ergebnisse[pnr] = Object.assign({}, alt, aenderung, { zeit:pruefJetzt(), von:(window.__firebaseUser||{}).email || '' });
  }
  pruefungSpeichern();
}

function pruefStatusSetzen(pnr, status){
  const e = pruefEintrag(pnr);
  const r = e && pruefErgebnis(e);
  const aenderung = { status };
  if(status === 'fehlt'){
    /* Wer „nicht gefunden“ ein zweites Mal antippt, war ein zweites Mal suchen. */
    aenderung.durchgaenge = r && r.status==='fehlt' ? Math.min((r.durchgaenge||1) + 1, 2) : 1;
    if(aenderung.durchgaenge === 2) showToast('Zweiter Durchgang: als abgeschrieben vermerkt.', 'info', 3000);
  }
  if(!r || !r.ort) aenderung.ort = pruefStandardOrt(e);
  pruefSetze(pnr, aenderung);
  renderPruefung();
}

function pruefGps(pnr){
  if(!navigator.geolocation){ showToast('Dieses Gerät kann keine GPS-Position ermitteln.', 'error', 5000); return; }
  pruefGpsLaeuft = pnr;
  renderPruefung();
  navigator.geolocation.getCurrentPosition(pos=>{
    const { latitude, longitude, accuracy } = pos.coords;
    pruefGpsLaeuft = null;
    pruefSetze(pnr, { gps:{ lat:latitude, lng:longitude, gpsAccuracy:Math.round(accuracy) }, ort:'ausgepflanzt' });
    if(accuracy > 15) showToast(`Ungenau (±${Math.round(accuracy)} m) — einen Moment warten und neu übernehmen.`, 'info', 5000);
    renderPruefung();
  }, err=>{
    pruefGpsLaeuft = null;
    showToast(`GPS nicht verfügbar: ${err.message}`, 'error', 6000);
    renderPruefung();
  }, { enableHighAccuracy:true, timeout:25000, maximumAge:0 });
}

function pruefNaechster(){
  pruefOffen = null;
  const feld = document.getElementById('pr-nummer');
  feld.value = '';
  renderPruefung();
  /* Fokus im selben Tippen — nur so öffnet iOS die Tastatur samt „Text scannen“. */
  feld.focus();
  feld.scrollIntoView({ block:'center' });
}

function pruefFundSpeichern(){
  const wert = id => (document.getElementById(id) || {}).value || '';
  const id = `F-${Date.now().toString(36)}`;
  if(!pruefung.funde) pruefung.funde = {};
  pruefung.funde[id] = {
    id, etikett:wert('pr-fund-etikett').trim(), sorte:wert('pr-fund-sorte').trim(),
    frucht:wert('pr-fund-art').trim(), gebiet:wert('pr-fund-gebiet'), unterlage:'', veredelt:'',
    status:'', ort:'', notiz:'', zeit:pruefJetzt(), von:(window.__firebaseUser||{}).email || ''
  };
  pruefung.funde[id].ort = PRUEF_BEET_GEBIETE.includes(pruefung.funde[id].gebiet) ? 'beet' : 'ausgepflanzt';
  pruefFundForm = null;
  pruefOffen = id;
  document.getElementById('pr-nummer').value = pruefung.funde[id].etikett;
  pruefungSpeichern();
  renderPruefung();
}

/* Gelöschte Funde bleiben als Grabstein stehen, sonst brächte das andere
   Gerät sie beim nächsten Abgleich zurück. */
function pruefFundLoeschen(pnr){
  if(!confirm('Diesen Fund löschen?')) return;
  pruefung.funde[pnr] = { id:pnr, geloescht:true, zeit:pruefJetzt() };
  pruefOffen = null;
  pruefungSpeichern();
  renderPruefung();
}

/* ---------- Liste laden ---------- */
function pruefListeWaehlen(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', ()=>{
    const datei = input.files && input.files[0];
    if(!datei) return;
    const leser = new FileReader();
    leser.onload = ()=>{
      let daten;
      try{ daten = JSON.parse(leser.result); }
      catch(e){ showToast('Die Datei ist kein gültiges JSON.', 'error', 5000); return; }
      if(!daten || daten.version !== 1 || !Array.isArray(daten.eintraege) || !daten.eintraege.every(e=>e && e.pnr)){
        showToast('Das ist keine Prüfliste (pruefliste.json).', 'error', 5000);
        return;
      }
      const ohneListe = Object.keys(pruefung.ergebnisse).filter(p=> !daten.eintraege.some(e=>e.pnr===p)).length;
      const frage = `${daten.eintraege.length} Einträge laden (Stand ${daten.stand})?\n\nBisherige Ergebnisse bleiben erhalten.`
        + (ohneListe ? `\n${ohneListe} Ergebnisse gehören zu Einträgen, die in der neuen Liste fehlen — sie bleiben gespeichert und erscheinen im Export.` : '');
      if(!confirm(frage)) return;
      const liste = {};
      daten.eintraege.forEach(e=>{ liste[e.pnr] = e; });
      pruefung.liste = liste;
      pruefung.listeStand = pruefJetzt();
      pruefung.listeQuelle = `${daten.quelle || 'pruefliste.json'} vom ${daten.stand}`;
      pruefungSpeichern();
      showToast(`Prüfliste geladen: ${daten.eintraege.length} Einträge.`, 'success', 4000);
      renderPruefung();
    };
    leser.readAsText(datei);
  });
  input.click();
}

/* ---------- Export ---------- */
function pruefExport(){
  if(typeof XLSX === 'undefined'){ showToast('Excel-Export braucht Internet (SheetJS wird nachgeladen).', 'error', 5000); return; }
  const status = id => (pruefStatus(id) || {}).label || '';
  const zeile = (e, r) => ({
    'P-Nr': e.fund ? '' : e.pnr, 'Fund-Id': e.fund ? e.pnr : '', 'Etikett-Nr.': e.alt_id || '', 'Sorte': e.sorte || '',
    'Obstart': e.frucht || '', 'Unterlage': e.unterlage || '', 'Veredelt': e.veredelt || '', 'Suchgebiet': e.gebiet || '',
    'Status': r ? status(r.status) : '', 'Durchgänge': r && r.status==='fehlt' ? (r.durchgaenge||1) : '',
    'Wo': r && r.status ? (r.ort==='beet' ? 'Baumschulbeet' : 'ausgepflanzt') : '', 'Notiz': (r && r.notiz) || '',
    'Breite': r && r.gps ? r.gps.lat : '', 'Länge': r && r.gps ? r.gps.lng : '', 'Genauigkeit (m)': r && r.gps ? r.gps.gpsAccuracy : '',
    'Geprüft am': r && r.status ? pruefDatum(r.zeit) : '', 'Warnzeichen': (e.warnungen||[]).join('; '), 'Tabellenblatt': e.blatt || ''
  });
  const zeilen = pruefAlleEintraege().map(e=> zeile(e, pruefErgebnis(e)));
  Object.keys(pruefung.ergebnisse).filter(p=> !pruefung.liste[p]).forEach(p=>{
    zeilen.push(zeile({ pnr:p, sorte:'(nicht mehr in der Liste)', warnungen:[] }, pruefung.ergebnisse[p]));
  });
  const mappe = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(mappe, XLSX.utils.json_to_sheet(zeilen), 'Prüfung');
  XLSX.writeFile(mappe, `Bestandspruefung_${new Date().toISOString().slice(0,10)}.xlsx`);
}

/* ---------- Ereignisse (ein Lauscher für den ganzen Reiter) ---------- */
(function pruefEreignisse(){
  const tab = document.getElementById('tab-pruefung');
  if(!tab) return;
  tab.addEventListener('click', ev=>{
    const el = ev.target.closest('[data-pr]');
    if(!el) return;
    const pnr = el.dataset.pnr;
    switch(el.dataset.pr){
      case 'auf': pruefOffen = pruefOffen===pnr ? null : pnr; renderPruefung(); break;
      case 'status': pruefStatusSetzen(pnr, el.dataset.status); break;
      case 'ort': pruefSetze(pnr, { ort:el.dataset.ort }); renderPruefung(); break;
      case 'gps': pruefGps(pnr); break;
      case 'naechster': pruefNaechster(); break;
      case 'zuruecksetzen':
        if(confirm('Ergebnis für diesen Baum löschen?')){ delete pruefung.ergebnisse[pnr]; pruefungSpeichern(); renderPruefung(); }
        break;
      case 'nummer-leeren': pruefNaechster(); break;
      case 'mehr': pruefSichtbar += PRUEF_SEITE; renderPruefung(); break;
      case 'fund-neu':
        pruefFundForm = { etikett:document.getElementById('pr-nummer').value.trim() };
        renderPruefung();
        document.querySelector('.pr-fund') && document.querySelector('.pr-fund').scrollIntoView({ block:'start' });
        break;
      case 'fund-speichern': pruefFundSpeichern(); break;
      case 'fund-abbrechen': pruefFundForm = null; renderPruefung(); break;
      case 'fund-loeschen': pruefFundLoeschen(pnr); break;
      case 'export': pruefExport(); break;
      case 'liste-laden': pruefListeWaehlen(); break;
    }
  });
  /* Bei jeder Eingabe neu suchen — Live Text setzt den Wert auf einmal ein. */
  tab.addEventListener('input', ev=>{
    if(ev.target.id !== 'pr-nummer') return;
    pruefOffen = null;
    renderPruefung();
  });
  tab.addEventListener('change', ev=>{
    const t = ev.target;
    if(t.id === 'pr-gebiet'){ pruefFilterSetzen({ gebiet:t.value }); pruefSichtbar = PRUEF_SEITE; pruefOffen = null; renderPruefung(); }
    else if(t.id === 'pr-status-filter'){ pruefFilterSetzen({ status:t.value }); pruefSichtbar = PRUEF_SEITE; pruefOffen = null; renderPruefung(); }
    else if(t.dataset.prNotiz){
      /* Notiz ohne Neuzeichnen speichern, sonst springt der Fokus weg. */
      pruefSetze(t.dataset.prNotiz, { notiz:t.value.trim() });
    }
  });
})();

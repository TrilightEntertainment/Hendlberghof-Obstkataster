/* =========================================================================
   Bestandsprüfung — Prüfmodus mit Scanfeld
   =========================================================================
   Volkmars Numbers-Buch kennt rund 370 Bäume außerhalb des Katasters, vor
   allem im Waldgarten (früher Baumschulbeet). Was davon noch steht, weiß niemand sicher. Der
   Prüfmodus geht die Liste Gebiet für Gebiet durch: Etikettnummer scannen,
   Status antippen, bei ausgepflanzten Bäumen GPS übernehmen.

   Grundsatz: Ins Kataster kommt nur, was vor Ort bestätigt ist. Prüfen
   schreibt deshalb nie in state oder das öffentliche Dokument — nur die
   ausdrückliche Übernahme (unten) tut das.

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

   Angaben korrigieren: Was vor Ort anders ist als in der Tabelle (Unterlage,
   Veredelungs- und Pflanzjahr, Standort, Sorte, Obstart), liegt als
   ergebnis.korrektur neben dem Original. Die Liste bleibt unverändert; wirksam
   ist pruefWert(), und mit ihm geht der Baum ins Kataster.

   Übernahme: Bestätigte, ausgepflanzte Bäume legt der Admin nach einer
   Vorschau als Overlay an (customTrees, quelle:'pruefung'), mit der
   Etikettnummer als ID und — bei genügend genauem GPS — einer Stecknadel in
   satPositions. Das ist die einzige Stelle, die in state schreibt.

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
const PRUEF_BEET_GEBIETE = ['Waldgarten', 'Segment A', 'Segment B'];
/* Umbenennungen (Volkmar 27.10.2026): Das frühere Baumschulbeet heißt
   Waldgarten. Gilt für Liste und Funde, egal von welchem Gerät sie kommen. */
const PRUEF_GEBIET_NEU = { 'Baumschulbeet':'Waldgarten' };
/* Wo steht er? Intern bleibt „beet“ für den Topf, damit ältere Ergebnisse
   gültig bleiben. Eingewurzelt = Topf durchgewurzelt, bleibt stehen, wird
   als Waldgarten-Baum geführt und kann ins Kataster. */
const PRUEF_ORTE = [
  { id:'beet', label:'Im Topf' },
  { id:'eingewurzelt', label:'Eingewurzelt' },
  { id:'ausgepflanzt', label:'Ausgepflanzt' }
];
const PRUEF_ORTE_KATASTER = ['ausgepflanzt', 'eingewurzelt'];
const PRUEF_VERMEHRUNG = ['Veredelung', 'Steckling', 'Sämling', 'Ableger', 'Zukauf'];
function pruefOrtLabel(id){ return (PRUEF_ORTE.find(o=> o.id === id) || {}).label || ''; }
function pruefNormalisieren(p){
  if(!p) return p;
  Object.values(p.liste || {}).concat(Object.values(p.funde || {})).forEach(e=>{
    if(e && PRUEF_GEBIET_NEU[e.gebiet]) e.gebiet = PRUEF_GEBIET_NEU[e.gebiet];
  });
  return p;
}

/* Unterlagen in einer Schreibweise, nach Häufigkeit im Bestand geordnet.
   Die Tabelle kennt dieselbe Unterlage teils dreifach („BA 29“, „Q BA 29“,
   „Quitte BA29“) — vorgeschlagen und übernommen wird nur noch die eine. */
const PRUEF_UNTERLAGEN = ['MM106', 'Pyrodwarf', 'QBA', 'St. Julien Inra 2', 'M26', 'St. Julien A',
  'Kirchensaller', 'Quitte BA29', 'Baumhasel', 'Colt', 'Bittenfeld', 'Gisela 5', 'Sämling',
  'wurzelecht (Wurzelläufer)', 'unbekannt'];
const PRUEF_UNTERLAGE_SCHREIBWEISEN = {
  'ba 29':'Quitte BA29', 'q ba 29':'Quitte BA29', 'quitte ba29':'Quitte BA29', 'ba29':'Quitte BA29',
  'st jul a':'St. Julien A', 'st. jul a':'St. Julien A', 'st julien a':'St. Julien A',
  'gisela5':'Gisela 5', 'wurzelläufer':'wurzelecht (Wurzelläufer)', '?':'unbekannt'
};
const PRUEF_JAHRE = (()=>{ const a = []; for(let j = new Date().getFullYear(); j >= 2010; j--) a.push(String(j)); return a; })();
/* GPS: ab dieser Genauigkeit wird sofort übernommen, darüber nachgefragt,
   und für eine Stecknadel im Kataster muss sie mindestens STECKNADEL sein. */
const PRUEF_GPS_GUT = 10, PRUEF_GPS_STECKNADEL = 25, PRUEF_GPS_WARTEN_S = 30;

/* Prüfrunde (v140, Volkmar 30.10.2026): Nummern, die auf dem Foto von ca. 2024
   (assets/images/lageplan.jpg) stehen, aber nicht im Kataster — in der Reihenfolge,
   in der man sie abgeht. Die Lage ist die Kreismitte im Foto, umgerechnet mit dem
   Gummituch aus tools/foto_entzerren.py. In den Reihen ist sie genauer als GPS
   (Restfehler Median 0,7 m) und taugt als Stecknadel. Beim Haus und auf der Wiese
   gibt es kaum Passpunkte (Probe am Baum 22: rund 6 m daneben) — dort nur Suchhilfe.
   Hier stehen bewusst nur Nummern und Lage, beides sieht man auf dem öffentlichen
   Foto. Die Sorten kommen aus der privaten Prüfliste.
   Standort = Vorbelegung beim Bestätigen, in der Karte änderbar. */
const PRUEF_RUNDE = [
  { titel:'Weg 1, untere Reihe', standort:'Weg1 Unten', stecknadel:true, baeume:[['704',48.0701,15.843932], ['727',48.070133,15.843982], ['719',48.070167,15.844017], ['720',48.070198,15.844057], ['726',48.070232,15.844104], ['709',48.070268,15.844155], ['875',48.070307,15.844207], ['874',48.070338,15.844261]] },
  { titel:'Weg 2, Westende', standort:'Weg2 Oben', stecknadel:true, baeume:[['705',48.070524,15.843259], ['745',48.070547,15.843414], ['732',48.070593,15.843422], ['623',48.070583,15.843348]] },
  { titel:'Garten beim Haus', standort:'', stecknadel:false, baeume:[['2',48.069516,15.844203], ['955',48.069571,15.844301], ['953',48.069582,15.844328], ['945',48.06955,15.844366], ['921',48.069562,15.844402], ['939',48.069607,15.844389], ['940',48.069594,15.844397], ['957',48.069623,15.844398], ['920',48.069571,15.844435], ['923',48.069583,15.844472], ['922',48.069596,15.84451], ['846',48.069644,15.844554], ['845',48.069648,15.844608], ['8',48.069606,15.844559], ['9',48.069615,15.844614]] },
  { titel:'Böschung unter dem Garten', standort:'Böschung 3', stecknadel:false, baeume:[['16',48.069527,15.844674], ['18',48.069456,15.844502], ['1008',48.069396,15.844302]] },
  { titel:'Wiese', standort:'Böschung 1', stecknadel:false, baeume:[['1009',48.069618,15.844869], ['1010',48.069635,15.844921], ['1004',48.069537,15.844907], ['1003',48.069453,15.844972], ['1002',48.069276,15.845047], ['1005',48.069249,15.845268], ['1001',48.06928,15.844796], ['1006',48.069373,15.84472], ['1007',48.06927,15.844629]] }
];
const PRUEF_RUNDE_NUMMERN = new Map(PRUEF_RUNDE.flatMap(gruppe=> gruppe.baeume.map(([nr, lat, lng])=>
  [pruefNummer(nr), { nr, lat, lng, gruppe }])));
function pruefRundeNummer(e){ return e && e.alt_id ? PRUEF_RUNDE_NUMMERN.get(pruefNummer(e.alt_id)) || null : null; }

let pruefung = pruefungLeer();
let pruefOffen = null;          /* P-Nr bzw. F-Id der aufgeklappten Karte */
let pruefSichtbar = PRUEF_SEITE;
let pruefFundForm = null;       /* null oder { etikett } — Formular „Fund ohne Eintrag“ */
let pruefGpsLaeuft = null;       /* { pnr, watch, timer, bestes, start } während der Messung */
let pruefSyncWarnung = false;
let pruefEinzeln = null;        /* P-Nr, die aus „Im Topf“ heraus allein gezeigt wird */
let pruefRundeAlle = false;     /* Prüfrunde: alle offenen Nummern statt der ersten 10 */

function pruefungLeer(){ return { liste:{}, listeStand:'', listeQuelle:'', ergebnisse:{}, funde:{} }; }

function pruefungLaden(){
  try{
    const roh = localStorage.getItem(PRUEF_LS_KEY);
    if(roh) pruefung = pruefNormalisieren(Object.assign(pruefungLeer(), JSON.parse(roh)));
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
  return pruefNormalisieren(aus);
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
  const vorgabe = { gebiet:'', status:'offen', ansicht:'pruefen', topfBereich:'', topfVerkauf:false };
  try{ return Object.assign(vorgabe, JSON.parse(localStorage.getItem(PRUEF_FILTER_KEY) || '{}')); }
  catch(e){ return vorgabe; }
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
function pruefStandardOrt(e){ return !pruefRundeNummer(e) && PRUEF_BEET_GEBIETE.includes(e.gebiet) ? 'beet' : 'ausgepflanzt'; }

function pruefUnterlageNorm(v){
  const t = String(v || '').trim();
  return PRUEF_UNTERLAGE_SCHREIBWEISEN[t.toLowerCase()] || t;
}
/* Originalwert aus der Liste, so aufbereitet, wie er ins Kataster ginge.
   Jahresfelder nur, wenn dort wirklich ein Jahr steht — „SEGMANT A“ oder
   „Verschenkt“ in der Spalte Ausgepflanzt sind Hinweise, keine Jahre. */
function pruefOriginal(e, feld){
  if(feld === 'unterlage') return pruefUnterlageNorm(e.unterlage);
  if(feld === 'veredelt') return /^\d{4}$/.test(e.veredelt || '') ? e.veredelt : '';
  if(feld === 'ausgepflanzt') return /^\d{4}$/.test(e.ausgepflanzt || '') ? e.ausgepflanzt : '';
  if(feld === 'standort') return e.standort || '';
  return e[feld] || '';
}
function pruefWert(e, r, feld){
  const k = r && r.korrektur;
  return k && Object.prototype.hasOwnProperty.call(k, feld) ? k[feld] : pruefOriginal(e, feld);
}
function pruefGeaendert(e, r, feld){
  const k = r && r.korrektur;
  return !!(k && Object.prototype.hasOwnProperty.call(k, feld));
}
/* Häufigkeiten zählen, Häufigstes zuerst — für alle Vorschlagslisten. */
function pruefNachHaeufigkeit(werte, vorne){
  const zahl = {};
  werte.filter(Boolean).forEach(w=>{ zahl[w] = (zahl[w]||0) + 1; });
  const sortiert = Object.keys(zahl).sort((a, b)=> zahl[b] - zahl[a] || a.localeCompare(b, 'de'));
  return (vorne || []).concat(sortiert.filter(w=> !(vorne || []).includes(w)));
}
function pruefAlleKorrekturen(){
  return Object.values(pruefung.ergebnisse).concat(Object.values(pruefung.funde||{}))
    .map(r=> (r && r.korrektur) || {});
}

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
/* Bereiche zum Eintippen: was es beim Prüfen schon gibt, dazu die Namen der
   Kartenobjekte im Lageplan – dieselben Namen für Karte und Prüfung. */
function pruefBereiche(){
  const karte = typeof kartenObjekte === 'function' && typeof FLAECHEN !== 'undefined' && FLAECHEN
    ? kartenObjekte().filter(o=> o.ebene === 'bestand' && o.art !== 'Grundstücksgrenze').map(o=> o.name) : [];
  return Array.from(new Set(pruefGebiete().filter(g=> g !== 'Laut Tabelle abgegeben').concat(['Waldgarten'], karte)));
}
/* Mutterbaum nachschlagen: zuerst im Kataster, dann in der Prüfliste. */
function pruefHerkunft(nr){
  const n = pruefNummer(String(nr || '').trim());
  if(!n) return null;
  const t = getTree(n);
  if(t) return { quelle:'Kataster', sorte:t.sorte || '', frucht:t.frucht || '' };
  const e = Object.values(pruefung.liste).find(x=> pruefNummer(x.alt_id) === n);
  if(e){ const r = pruefung.ergebnisse[e.pnr]; return { quelle:'Prüfliste', sorte:pruefWert(e, r, 'sorte'), frucht:pruefWert(e, r, 'frucht') }; }
  return null;
}
function pruefHerkunftAusfuellen(){
  const info = document.getElementById('pr-fund-herkunft-info');
  const nr = (document.getElementById('pr-fund-herkunft') || {}).value || '';
  const verm = (document.getElementById('pr-fund-vermehrung') || {}).value || '';
  if(!info) return;
  const h = pruefHerkunft(nr);
  if(!nr.trim()){ info.textContent = ''; return; }
  if(!h){ info.textContent = `Baum ${nr.trim()} ist weder im Kataster noch in der Prüfliste.`; return; }
  const setze = (id, wert) => {
    const el = document.getElementById(id);
    if(el && (!el.value || el.dataset.auto === '1')){ el.value = wert; el.dataset.auto = '1'; }
  };
  setze('pr-fund-art', h.frucht);
  /* Ein Sämling ist nicht sortenecht – da bleibt die Sorte offen. */
  if(verm === 'Sämling'){ const s = document.getElementById('pr-fund-sorte'); if(s && s.dataset.auto === '1'){ s.value = ''; } }
  else setze('pr-fund-sorte', h.sorte);
  info.textContent = `Baum ${nr.trim()} (${h.quelle}): ${[h.frucht, h.sorte].filter(Boolean).join(' · ') || 'ohne Angaben'}${verm === 'Sämling' ? ' – Sämling, Sorte bleibt offen' : ''}`;
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
  const umschalter = `<div class="pr-segment pr-ansicht" role="group" aria-label="Ansicht">
      ${[['pruefen', 'Prüfen'], ['runde', 'Prüfrunde'], ['topf', 'Im Topf']].map(([v, l])=>
        `<button type="button" class="${filter.ansicht===v?'aktiv':''}" data-pr="ansicht" data-ansicht="${v}">${l}</button>`).join('')}
    </div>`;
  if(filter.ansicht === 'topf'){
    scan.style.display = 'none';
    oben.innerHTML = umschalter;
    wurzel.innerHTML = renderPruefTopf();
    return;
  }
  if(filter.ansicht === 'runde' && !pruefEinzeln && !pruefSuchbegriffe(feld.value).length){
    const zeilen = pruefRundeZeilen();
    oben.innerHTML = `${umschalter}${renderPruefRundeKopf(zeilen)}${pruefFundForm ? renderPruefFundForm() : ''}`;
    wurzel.innerHTML = renderPruefRunde(zeilen);
    return;
  }
  const alle = pruefAlleEintraege();
  const erledigt = alle.filter(pruefIstErledigt).length;
  const anteil = alle.length ? Math.round(erledigt / alle.length * 100) : 0;

  const begriffe = pruefSuchbegriffe(feld.value);
  let treffer;
  if(pruefEinzeln){
    treffer = alle.filter(e=> e.pnr === pruefEinzeln);
    pruefOffen = pruefEinzeln;
  } else if(begriffe.length){
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
           <button class="btn" data-pr="fund-neu">Neu erfassen</button></div>`;
  }
  /* Ein einzelner Treffer klappt gleich auf — ein Tippen weniger pro Baum. */
  if(begriffe.length && treffer.length===1) pruefOffen = treffer[0].pnr;

  const bereitZahl = pruefUebernahmeBereit().length;
  const sichtbar = begriffe.length ? treffer : treffer.slice(0, pruefSichtbar);
  const mehr = treffer.length - sichtbar.length;

  if(pruefEinzeln) kopfTreffer = `<div class="pr-trefferkopf">Aus der Liste „Im Topf“ <button type="button" class="pr-link" data-pr="einzeln-aus">alle zeigen</button></div>`;
  oben.innerHTML = `${umschalter}
    <div class="pr-fortschritt">
      <div class="pr-fortschritt-zeile"><div><b>${erledigt} von ${alle.length}</b> geprüft</div><span>${anteil} %</span></div>
      <div class="pr-balken"><div style="width:${anteil}%"></div></div>
      <div class="pr-zahlen">${zaehler}</div>
    </div>
    ${pruefFundForm ? renderPruefFundForm() : ''}`;
  wurzel.innerHTML = `
    ${begriffe.length || pruefEinzeln ? '' : `
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
      <button class="btn secondary" data-pr="fund-neu">Neu erfassen</button>
      ${isAdmin() && bereitZahl ? `<button class="btn" data-pr="uebernahme">Ins Kataster übernehmen (${bereitZahl})</button>` : ''}
      <button class="btn secondary" data-pr="export">Ergebnisse als Excel</button>
      ${isAdmin() ? '<button class="btn secondary" data-pr="liste-laden">Prüfliste neu laden …</button>' : ''}
      <div class="pr-quelle">Liste: ${escHtml(pruefung.listeQuelle || '–')}, Stand ${escHtml(pruefDatum(pruefung.listeStand))}</div>
    </div>
    <datalist id="pr-notizen">${pruefNotizVorschlaege().map(n=>`<option value="${escAttr(n)}">`).join('')}</datalist>
    ${renderPruefVorschlaege()}`;
}

/* ---------- Prüfrunde ----------
   Eine Nummer gilt als erledigt, sobald einer ihrer Einträge geprüft ist (719,
   2 und 9 stehen doppelt in der Tabelle). Die gerade offene Karte bleibt an ihrem
   Platz, sonst spränge sie beim Antippen von „Stimmt“ weg, bevor GPS und Standort
   erledigt sind. */
function pruefRundeZeilen(){
  const alle = pruefAlleEintraege();
  const zeilen = [];
  PRUEF_RUNDE_NUMMERN.forEach((z, n)=>{
    const eintraege = alle.filter(e=> e.alt_id && pruefNummer(e.alt_id) === n);
    const imKataster = !!getTree(n);
    zeilen.push(Object.assign({}, z, { eintraege, imKataster, erledigt:imKataster || eintraege.some(pruefIstErledigt) }));
  });
  return zeilen;
}
function renderPruefRundeKopf(zeilen){
  const fertig = zeilen.filter(z=> z.erledigt).length;
  const anteil = Math.round(fertig / zeilen.length * 100);
  return `
    <div class="pr-fortschritt">
      <div class="pr-fortschritt-zeile"><div><b>${fertig} von ${zeilen.length}</b> Nummern geprüft</div><span>${anteil} %</span></div>
      <div class="pr-balken"><div style="width:${anteil}%"></div></div>
      <div class="pr-scan-hinweis">Diese Nummern stehen auf dem Foto, aber nicht im Kataster. Der Reihe nach abgehen, Etikett vergleichen, Status antippen.</div>
    </div>`;
}
function pruefRundeKartenknopf(nr, pnr){
  return `<button type="button" class="btn secondary" data-pr="runde-karte" data-nr="${escAttr(nr)}" data-pnr="${escAttr(pnr || '')}">Auf der Karte zeigen</button>`;
}
function renderPruefRundeNummer(z){
  if(z.eintraege.length){
    return `<div class="pr-runde-nr" data-runde-nr="${escAttr(z.nr)}">${z.eintraege.map(renderPruefKarte).join('')}</div>`;
  }
  const kopf = z.imKataster ? 'Steht schon im Kataster' : 'Steht nicht im Numbers-Buch';
  return `
    <div class="pr-runde-nr" data-runde-nr="${escAttr(z.nr)}">
      <div class="pr-karte${z.erledigt ? ' geprueft' : ''}">
        <div class="pr-karte-kopf"><span class="pr-nr">${escHtml(z.nr)}</span><span class="pr-sorte"><i>${kopf}</i></span></div>
        ${z.imKataster ? '' : `
        <div class="pr-hinweis">Nur auf dem Foto: ${escHtml(z.gruppe.titel)}. Steht er dort, neu erfassen.</div>
        <div class="pr-detail-fuss">
          <button type="button" class="btn" data-pr="fund-neu" data-etikett="${escAttr(z.nr)}" data-gebiet="${escAttr(z.gruppe.standort)}">Neu erfassen</button>
          ${pruefRundeKartenknopf(z.nr)}
        </div>`}
      </div>
    </div>`;
}
function renderPruefRunde(zeilen){
  const offen = zeilen.filter(z=> !z.erledigt || z.eintraege.some(e=> e.pnr === pruefOffen));
  const fertig = zeilen.filter(z=> !offen.includes(z));
  const sichtbar = pruefRundeAlle ? offen : offen.slice(0, 10);
  const mehr = offen.length - sichtbar.length;
  let gruppe = null;
  const liste = sichtbar.map(z=>{
    const titel = z.gruppe !== gruppe ? `<h3 class="pr-runde-titel">${escHtml(z.gruppe.titel)}</h3>` : '';
    gruppe = z.gruppe;
    return `${titel}${renderPruefRundeNummer(z)}`;
  }).join('');
  const bereitZahl = pruefUebernahmeBereit().length;
  return `
    <div class="pr-liste">${liste || '<div class="pr-nichts">Die Prüfrunde ist fertig.</div>'}</div>
    ${mehr > 0 ? `<button class="btn secondary pr-mehr" data-pr="runde-mehr">Alle zeigen (${mehr} weitere)</button>` : ''}
    ${fertig.length ? `<details class="pr-runde-fertig"><summary>Schon geprüft (${fertig.length})</summary><div class="pr-liste">${fertig.map(renderPruefRundeNummer).join('')}</div></details>` : ''}
    ${isAdmin() && bereitZahl ? `<div class="pr-fuss"><button class="btn" data-pr="uebernahme">Ins Kataster übernehmen (${bereitZahl})</button></div>` : ''}
    <datalist id="pr-notizen">${pruefNotizVorschlaege().map(n=>`<option value="${escAttr(n)}">`).join('')}</datalist>
    ${renderPruefVorschlaege()}`;
}
function pruefRundeZeigen(nr){
  const el = document.querySelector(`[data-runde-nr="${CSS.escape(nr)}"]`);
  if(el) el.scrollIntoView({ block:'start' });
}
/* Nächste offene Nummer nach der aktuellen, am Ende von vorn. */
function pruefRundeNaechster(){
  const zeilen = pruefRundeZeilen();
  const i = zeilen.findIndex(z=> z.eintraege.some(e=> e.pnr === pruefOffen));
  const z = zeilen.slice(i + 1).concat(zeilen.slice(0, Math.max(i + 1, 0))).find(x=> !x.erledigt);
  pruefOffen = z && z.eintraege.length ? z.eintraege[0].pnr : null;
  pruefRundeAlle = true;
  renderPruefung();
  if(z) pruefRundeZeigen(z.nr);
  else showToast('Die Prüfrunde ist fertig.', 'success', 4000);
}
function pruefRundeKarte(nr, pnr){
  const z = PRUEF_RUNDE_NUMMERN.get(pruefNummer(nr));
  if(!z) return;
  activateTab('lageplan');
  _lageplanZurueck = { runde:true, nr:z.nr, pnr, tab:'pruefung' };
  renderLageplanZurueck();
  lagePunktZeigen(z.lat, z.lng, z.nr);
}
function pruefRundeZurueck(pnr, nr){
  if(pnr) pruefOffen = pnr;
  renderPruefung();
  pruefRundeZeigen(nr);
}

/* Vorschlagslisten für „Angaben korrigieren“ — bereits Korrigiertes und
   Häufiges zuerst, wie überall im Hof (feedback: Meistgenutztes zuerst). */
/* ---------- Im Topf ----------
   Alles, was beim Prüfen „im Topf“ bestätigt oder neu erfasst wurde, nach
   Obstart und Sorte, mit Stückzahl. Ein Eintrag kann mehrere gleiche Töpfe
   meinen (Anzahl), etwa 12 Stecklinge vom selben Mutterbaum. */
function pruefStueck(e){ return e.fund ? Math.max(1, parseInt(e.anzahl, 10) || 1) : 1; }
function pruefTopfEintraege(){
  return pruefAlleEintraege().filter(e=>{
    const r = pruefErgebnis(e);
    return r && r.ort === 'beet' && PRUEF_UEBERNAHME_STATUS.includes(r.status);
  });
}
function renderPruefTopf(){
  const filter = pruefFilter();
  const alle = pruefTopfEintraege();
  const summe = l => l.reduce((n, e)=> n + pruefStueck(e), 0);
  const bereiche = Array.from(new Set(alle.map(e=> e.gebiet).filter(Boolean))).sort((a, b)=> a.localeCompare(b, 'de'));
  const liste = alle.filter(e=> (!filter.topfBereich || e.gebiet === filter.topfBereich)
    && (!filter.topfVerkauf || (pruefErgebnis(e) || {}).verkaufsfertig));
  const gruppen = {};
  liste.forEach(e=>{
    const r = pruefErgebnis(e);
    const art = pruefWert(e, r, 'frucht') || 'Ohne Obstart';
    const sorte = pruefWert(e, r, 'sorte') || 'Sorte offen';
    gruppen[art] = gruppen[art] || {};
    (gruppen[art][sorte] = gruppen[art][sorte] || []).push(e);
  });
  const nachName = (a, b, letzter) => (a === letzter) - (b === letzter) || a.localeCompare(b, 'de');
  const ungeprueft = pruefAlleEintraege().filter(e=> PRUEF_BEET_GEBIETE.includes(e.gebiet) && !(pruefErgebnis(e) || {}).status).length;
  const verkauf = summe(alle.filter(e=> (pruefErgebnis(e) || {}).verkaufsfertig));
  const zeile = e => {
    const r = pruefErgebnis(e);
    const w = feld => pruefWert(e, r, feld);
    const teile = [e.alt_id ? `Nr. ${e.alt_id}` : 'ohne Nr.', w('unterlage'), /^\d{4}$/.test(w('veredelt')) ? w('veredelt') : '',
      e.fund ? e.vermehrung : '', e.fund && e.herkunft ? `von ${e.herkunft}` : '', e.gebiet,
      pruefStueck(e) > 1 ? `${pruefStueck(e)} Stück` : ''].filter(Boolean).map(escHtml).join(' · ');
    return `<li class="pr-topf-eintrag">
        <button type="button" class="pr-topf-text" data-pr="topf-oeffnen" data-pnr="${escAttr(e.pnr)}">${teile}</button>
        <label class="pr-verkauf"><input type="checkbox" data-pr-verkauf="${escAttr(e.pnr)}"${r.verkaufsfertig ? ' checked' : ''}> verkaufsfertig</label>
      </li>`;
  };
  const inhalt = Object.keys(gruppen).sort((a, b)=> nachName(a, b, 'Ohne Obstart')).map(art=>{
    const sorten = gruppen[art];
    return `<div class="pr-topf-art">
        <h3>${escHtml(art)} <span>${summe(Object.values(sorten).flat())}</span></h3>
        ${Object.keys(sorten).sort((a, b)=> nachName(a, b, 'Sorte offen')).map(sorte=> `
          <div class="pr-topf-sorte">
            <div class="pr-topf-sortenkopf"><span>${escHtml(sorte)}</span><span>${summe(sorten[sorte])}</span></div>
            <ul>${sorten[sorte].map(zeile).join('')}</ul>
          </div>`).join('')}
      </div>`;
  }).join('');
  return `
    <div class="pr-topf-kopf"><b>${summe(liste)} ${summe(liste) === 1 ? 'Pflanze' : 'Pflanzen'}</b> im Topf${filter.topfBereich || filter.topfVerkauf ? ' (Auswahl)' : ''} · ${verkauf} verkaufsfertig</div>
    <div class="pr-filter">
      <select id="pr-topf-bereich" aria-label="Bereich"><option value="">Alle Bereiche</option>
        ${bereiche.map(b=>`<option value="${escAttr(b)}"${b===filter.topfBereich?' selected':''}>${escHtml(b)}</option>`).join('')}</select>
      <label class="pr-verkauf"><input type="checkbox" id="pr-topf-verkauf"${filter.topfVerkauf ? ' checked' : ''}> nur verkaufsfertig</label>
    </div>
    ${inhalt || '<div class="pr-nichts">Noch nichts im Topf bestätigt oder erfasst.</div>'}
    <p class="pr-scan-hinweis">Hier steht, was beim Prüfen „im Topf“ bestätigt oder neu erfasst wurde.${ungeprueft ? ` Im Waldgarten sind noch ${ungeprueft} Einträge der Liste ungeprüft.` : ''}</p>
    <div class="pr-fuss">
      <button class="btn secondary" data-pr="fund-neu">Neu erfassen</button>
      <button class="btn secondary" data-pr="topf-export">Liste als Excel</button>
    </div>`;
}
function pruefTopfExport(){
  if(typeof XLSX === 'undefined'){ showToast('Excel-Export braucht Internet (SheetJS wird nachgeladen).', 'error', 5000); return; }
  const zeilen = pruefTopfEintraege().map(e=>{
    const r = pruefErgebnis(e);
    const w = feld => pruefWert(e, r, feld);
    return { 'Obstart': w('frucht'), 'Sorte': w('sorte'), 'Anzahl': pruefStueck(e), 'Etikett-Nr.': e.alt_id || '',
      'Vermehrung': e.fund ? (e.vermehrung || '') : '', 'Herkunft': e.fund ? (e.herkunft || '') : '', 'Unterlage': w('unterlage'),
      'Veredelt': w('veredelt'), 'Bereich': e.gebiet || '', 'Verkaufsfertig': r.verkaufsfertig ? 'ja' : '', 'Notiz': r.notiz || '',
      'Geprüft am': pruefDatum(r.zeit) };
  });
  const mappe = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(mappe, XLSX.utils.json_to_sheet(zeilen), 'Im Topf');
  XLSX.writeFile(mappe, `Im_Topf_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function renderPruefVorschlaege(){
  const korr = pruefAlleKorrekturen();
  const liste = Object.values(pruefung.liste);
  const baeume = getAllTrees();
  const dl = (id, werte)=> `<datalist id="${id}">${werte.map(w=>`<option value="${escAttr(w)}">`).join('')}</datalist>`;
  return dl('pr-dl-sorten', pruefNachHaeufigkeit(korr.map(k=>k.sorte).concat(liste.map(e=>e.sorte), baeume.map(t=>t.sorte))))
    + dl('pr-dl-arten', pruefNachHaeufigkeit(korr.map(k=>k.frucht).concat(liste.map(e=>e.frucht), baeume.map(t=>t.frucht))))
    + dl('pr-dl-unterlagen', pruefNachHaeufigkeit(korr.map(k=>k.unterlage), PRUEF_UNTERLAGEN))
    + dl('pr-dl-standorte', pruefNachHaeufigkeit(korr.map(k=>k.standort).concat(baeume.map(t=>t.standort_zeile))));
}

function pruefPlanText(e){
  return (e.plan || []).map(p=> `alter Plan ${p.block}, Reihe ${p.reihe}, Platz ${p.platz}`).join(' · ');
}

function renderPruefKarte(e){
  const r = pruefErgebnis(e);
  const st = r && r.status ? pruefStatus(r.status) : null;
  const offen = pruefOffen === e.pnr;
  const w = feld => pruefWert(e, r, feld);
  const art = obstartSchluessel(w('frucht'));
  const veredelt = w('veredelt');
  const meta = [w('frucht'), w('unterlage'),
    veredelt ? (/^\d{4}$/.test(veredelt) ? `veredelt ${veredelt}` : veredelt) : '',
    w('ausgepflanzt') ? `gepflanzt ${w('ausgepflanzt')}` : '', w('standort'),
    e.fund && (e.anzahl || 1) > 1 ? `${e.anzahl} Stück` : '',
    e.fund && e.vermehrung ? e.vermehrung : '', e.fund && e.herkunft ? `von ${e.herkunft}` : '',
    r && r.status && r.ort ? pruefOrtLabel(r.ort) : '', r && r.verkaufsfertig ? 'verkaufsfertig' : '',
    e.fund ? 'neu erfasst' : e.pnr]
    .filter(Boolean).map(escHtml).join(' · ');
  const korrigiert = ['sorte','frucht','unterlage','veredelt','ausgepflanzt','standort'].some(f=> pruefGeaendert(e, r, f));
  const foto = pruefRundeNummer(e);
  const hinweis = [foto ? `auf dem Foto: ${foto.gruppe.titel}` : '', e.gebiet, pruefPlanText(e), e.hinweis, e.wo && !e.gebiet.includes(e.wo) ? `Tabelle: ${e.wo}` : '']
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
        <span class="pr-sorte">${w('sorte') ? escHtml(w('sorte')) : '<i>Sorte fehlt</i>'}</span>
        ${chip}
      </button>
      <div class="pr-meta">${meta}${korrigiert ? ' <span class="pr-geaendert">korrigiert</span>' : ''}</div>
      ${r && r.uebernommen ? `<div class="pr-kataster">Im Kataster als ${escHtml(r.uebernommen.id)}${r.uebernommen.stecknadel ? ' mit Stecknadel' : ' — Stecknadel im Lageplan setzen'}</div>` : ''}
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
          ${PRUEF_ORTE.map(o=>`<button type="button" class="${ort===o.id?'aktiv':''}" data-pr="ort" data-pnr="${pnr}" data-ort="${o.id}">${o.label}</button>`).join('')}
        </div>
      </div>
      ${ort!=='beet' ? renderPruefStandort(e, r) : ''}
      ${ort!=='beet' ? renderPruefGps(e, gps) : ''}
      ${ort==='beet' ? `
      <label class="pr-verkauf"><input type="checkbox" data-pr-verkauf="${pnr}"${r && r.verkaufsfertig ? ' checked' : ''}> verkaufsfertig</label>` : ''}
      ${e.fund ? renderPruefFundAngaben(e) : ''}
      ${renderPruefAngaben(e, r, ort!=='beet')}
      <div class="pr-zeile pr-notiz">
        <label for="pr-notiz-${pnr}" class="pr-zeile-label">Notiz</label>
        <input type="text" id="pr-notiz-${pnr}" list="pr-notizen" data-pr-notiz="${pnr}" value="${escAttr((r && r.notiz) || '')}"
               placeholder="${status==='abweichend' ? 'Was steht auf dem Etikett?' : 'optional'}" autocomplete="off">
      </div>
      <div class="pr-detail-fuss">
        <button type="button" class="btn" data-pr="naechster">Nächster Baum</button>
        ${pruefRundeNummer(e) ? pruefRundeKartenknopf(pruefRundeNummer(e).nr, e.pnr) : ''}
        ${r && r.zeit ? `<span class="pr-zeit">zuletzt ${escHtml(pruefDatum(r.zeit))}</span>` : ''}
        ${r && r.status && !e.fund ? `<button type="button" class="pr-link" data-pr="zuruecksetzen" data-pnr="${pnr}">zurücksetzen</button>` : ''}
        ${e.fund ? `<button type="button" class="pr-link" data-pr="fund-loeschen" data-pnr="${pnr}">Fund löschen</button>` : ''}
      </div>
    </div>`;
}

/* Standort offen statt im zugeklappten „Angaben korrigieren“ (v131, Volkmar
   27.10.2026): Er wurde dort nicht gefunden und landete deshalb in der Notiz.
   Gleiches Feld (data-pr-korr="standort"), nur an anderer Stelle. */
function renderPruefStandort(e, r){
  const pnr = escAttr(e.pnr);
  const geaendert = pruefGeaendert(e, r, 'standort');
  const o = geaendert ? pruefOriginal(e, 'standort') : '';
  return `
      <div class="pr-zeile pr-standort${geaendert ? ' geaendert' : ''}">
        <label for="pr-standort-${pnr}" class="pr-zeile-label">Standort</label>
        <input type="text" id="pr-standort-${pnr}" list="pr-dl-standorte" data-pr-korr="standort" data-pnr="${pnr}"
               value="${escAttr(pruefWert(e, r, 'standort'))}" placeholder="z. B. Böschung 2, Waldgarten" autocomplete="off">
        ${geaendert ? `<span class="pr-orig">Liste: ${o ? escHtml(o) : '–'}</span>` : ''}
      </div>`;
}

function renderPruefFundAngaben(e){
  const pnr = escAttr(e.pnr);
  return `
      <div class="pr-fund-angaben">
        <label class="pr-feld">Anzahl<input type="number" min="1" step="1" inputmode="numeric" data-pr-anzahl="${pnr}" value="${escAttr(String(e.anzahl || 1))}"></label>
        <label class="pr-feld">Vermehrung<select data-pr-vermehrung="${pnr}">
          ${[''].concat(PRUEF_VERMEHRUNG).map(v=>`<option value="${escAttr(v)}"${(e.vermehrung||'')===v?' selected':''}>${v ? escHtml(v) : '–'}</option>`).join('')}</select></label>
        <label class="pr-feld">Herkunft (Baum-Nr.)<input type="text" data-pr-herkunft="${pnr}" value="${escAttr(e.herkunft || '')}" autocomplete="off" autocapitalize="characters"></label>
      </div>`;
}

function renderPruefGps(e, gps){
  const pnr = escAttr(e.pnr);
  const laeuft = pruefGpsLaeuft && pruefGpsLaeuft.pnr === e.pnr;
  if(laeuft) return `
      <div class="pr-zeile">
        <span class="pr-gps-live" id="pr-gps-live">GPS wird gesucht …</span>
        <button type="button" class="btn secondary" data-pr="gps-stopp">Abbrechen</button>
      </div>`;
  const grob = gps && gps.gpsAccuracy > PRUEF_GPS_STECKNADEL;
  return `
      <div class="pr-zeile">
        <button type="button" class="btn secondary" data-pr="gps" data-pnr="${pnr}">${gps ? 'GPS neu aufnehmen' : 'GPS-Position aufnehmen'}</button>
        ${gps ? `<span class="pr-gps${grob ? ' grob' : ''}">±${gps.gpsAccuracy} m${grob ? ' — zu ungenau für eine Stecknadel' : ''}</span>` : ''}
      </div>`;
}

/* Jahr als Auswahl statt Freitext: Auf dem Feld tippt sich „2017“ schneller
   als falsch. Ein Wert, der nicht in der Liste steht, bleibt wählbar. */
function pruefJahrOptionen(wert, extras){
  const werte = [''].concat(extras || [], PRUEF_JAHRE);
  if(wert && !werte.includes(wert)) werte.splice(1, 0, wert);
  return werte.map(v=> `<option value="${escAttr(v)}" ${v===wert?'selected':''}>${v ? escHtml(v) : '–'}</option>`).join('');
}

function renderPruefAngaben(e, r, ohneStandort){
  const pnr = escAttr(e.pnr);
  const w = feld => pruefWert(e, r, feld);
  const orig = feld => {
    if(!pruefGeaendert(e, r, feld)) return '';
    const o = pruefOriginal(e, feld);
    return `<span class="pr-orig">Liste: ${o ? escHtml(o) : '–'}</span>`;
  };
  const text = (feld, label, liste, platzhalter) => `
        <label class="pr-feld${pruefGeaendert(e, r, feld) ? ' geaendert' : ''}">${label}
          <input type="text" list="${liste}" data-pr-korr="${feld}" data-pnr="${pnr}" value="${escAttr(w(feld))}"
                 placeholder="${escAttr(platzhalter || '')}" autocomplete="off">${orig(feld)}</label>`;
  /* Pflanzjahr: Jahr plus Jahreszeit — „2024 f“ aus der Tabelle heißt Frühjahr. */
  const pj = w('ausgepflanzt');
  const pjTeile = pj.match(/^(Frühjahr|Herbst)\s+(\d{4})$/);
  const pjJahr = pjTeile ? pjTeile[2] : pj, pjZeit = pjTeile ? pjTeile[1] : '';
  const anzahl = ['sorte','frucht','unterlage','veredelt','ausgepflanzt'].concat(ohneStandort ? [] : ['standort'])
    .filter(f=> pruefGeaendert(e, r, f)).length;
  return `
      <details class="pr-angaben"${anzahl ? ' open' : ''}>
        <summary>Angaben korrigieren${anzahl ? ` <span class="pr-geaendert">${anzahl} geändert</span>` : ''}</summary>
        <div class="pr-angaben-raster">
          ${text('unterlage', 'Unterlage', 'pr-dl-unterlagen', 'z. B. MM106')}
          <label class="pr-feld${pruefGeaendert(e, r, 'veredelt') ? ' geaendert' : ''}">Veredelt
            <select data-pr-korr="veredelt" data-pnr="${pnr}">${pruefJahrOptionen(w('veredelt'), ['nicht veredelt', 'unbekannt'])}</select>${orig('veredelt')}</label>
          <label class="pr-feld${pruefGeaendert(e, r, 'ausgepflanzt') ? ' geaendert' : ''}">Gepflanzt
            <span class="pr-doppel">
              <select data-pr-korr="ausgepflanzt" data-pr-teil="jahr" data-pnr="${pnr}">${pruefJahrOptionen(pjJahr)}</select>
              <select data-pr-korr="ausgepflanzt" data-pr-teil="zeit" data-pnr="${pnr}">
                ${['', 'Frühjahr', 'Herbst'].map(z=>`<option value="${z}" ${z===pjZeit?'selected':''}>${z || 'Jahreszeit'}</option>`).join('')}
              </select>
            </span>${orig('ausgepflanzt')}</label>
          ${ohneStandort ? '' : text('standort', 'Standort', 'pr-dl-standorte', 'z. B. Böschung 2, Weg1 Oben')}
          ${text('sorte', 'Sorte', 'pr-dl-sorten')}
          ${text('frucht', 'Obstart', 'pr-dl-arten')}
        </div>
      </details>`;
}

function renderPruefFundForm(){
  const f = pruefFundForm;
  const sorten = Array.from(new Set(Object.values(pruefung.liste).map(e=>e.sorte)
    .concat(getAllTrees().map(t=>t.sorte)).filter(Boolean))).sort((a, b)=>a.localeCompare(b, 'de'));
  const arten = Array.from(new Set(Object.values(pruefung.liste).map(e=>e.frucht)
    .concat(getAllTrees().map(t=>t.frucht)).filter(Boolean))).sort((a, b)=>a.localeCompare(b, 'de'));
  const filter = pruefFilter();
  const gebietVorgabe = f.gebiet || filter.gebiet || 'Waldgarten';
  return `
    <div class="pr-fund">
      <h3>Neu erfassen</h3>
      <p class="pr-scan-hinweis">Ein Baum oder mehrere gleiche Töpfe, die auf keiner Liste stehen. Bei Stecklingen,
        Ablegern und Veredelungen die Nummer des Mutterbaums eintragen – Obstart und Sorte füllen sich dann selbst.</p>
      <div class="pr-fund-raster">
        <label>Etikett-Nr.<input type="text" id="pr-fund-etikett" value="${escAttr(f.etikett || '')}" autocomplete="off" autocapitalize="characters" placeholder="falls vorhanden"></label>
        <label>Vermehrung<select id="pr-fund-vermehrung">${[''].concat(PRUEF_VERMEHRUNG).map(v=>`<option value="${escAttr(v)}">${v ? escHtml(v) : '–'}</option>`).join('')}</select></label>
        <label>Herkunft (Baum-Nr.)<input type="text" id="pr-fund-herkunft" autocomplete="off" autocapitalize="characters" placeholder="z. B. 922"></label>
        <label>Anzahl<input type="number" id="pr-fund-anzahl" min="1" step="1" inputmode="numeric" value="1"></label>
        <label>Obstart<input type="text" id="pr-fund-art" list="pr-fund-arten" autocomplete="off"></label>
        <label>Sorte<input type="text" id="pr-fund-sorte" list="pr-fund-sorten" autocomplete="off" placeholder="leer lassen, wenn unbekannt"></label>
        <label>Bereich<input type="text" id="pr-fund-gebiet" list="pr-dl-bereiche" value="${escAttr(gebietVorgabe)}" autocomplete="off" placeholder="vorhandenen wählen oder neu eintippen"></label>
        <label>Wo steht er?<select id="pr-fund-ort">${PRUEF_ORTE.map(o=>`<option value="${o.id}"${o.id === (PRUEF_BEET_GEBIETE.includes(gebietVorgabe) ? 'beet' : 'ausgepflanzt') ? ' selected' : ''}>${o.label}</option>`).join('')}</select></label>
      </div>
      <div class="pr-herkunft-info" id="pr-fund-herkunft-info"></div>
      <datalist id="pr-fund-sorten">${sorten.map(s=>`<option value="${escAttr(s)}">`).join('')}</datalist>
      <datalist id="pr-fund-arten">${arten.map(s=>`<option value="${escAttr(s)}">`).join('')}</datalist>
      <datalist id="pr-dl-bereiche">${pruefBereiche().map(s=>`<option value="${escAttr(s)}">`).join('')}</datalist>
      <div class="pr-detail-fuss">
        <button type="button" class="btn" data-pr="fund-speichern">Speichern</button>
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
  pruefSofortVeroeffentlichen();
}

/* „Sofort verfügbar“ im Baumfinder (v132): Die Prüfliste ist privat, Kunden
   sehen nur, was verkaufsfertig im Topf steht – Obstart, Sorte, Unterlage und
   Stückzahl, ohne Bereich oder Notiz. Geschrieben wird nur bei einer Änderung,
   als Zeichenkette in state.produktion (öffentlich lesbar, nur Admin schreibt). */
function pruefSofortVeroeffentlichen(){
  if(typeof isAdmin !== 'function' || !isAdmin()) return;
  const summe = {};
  pruefTopfEintraege().forEach(e=>{
    const r = pruefErgebnis(e);
    if(!r || !r.verkaufsfertig) return;
    const frucht = pruefWert(e, r, 'frucht'), sorte = pruefWert(e, r, 'sorte'), unterlage = pruefWert(e, r, 'unterlage');
    if(!frucht) return;
    const k = `${frucht}|${sorte}|${unterlage}`;
    if(!summe[k]) summe[k] = { frucht, sorte, unterlage, anzahl:0 };
    summe[k].anzahl += pruefStueck(e);
  });
  const liste = Object.values(summe).sort((a, b)=> `${a.frucht}${a.sorte}`.localeCompare(`${b.frucht}${b.sorte}`, 'de'));
  const alt = (state.produktion && state.produktion.sofort) || '';
  let altListe = '[]';
  try { altListe = JSON.stringify((JSON.parse(alt || '{}').liste) || []); } catch(err){ /* alter Stand unlesbar – neu schreiben */ }
  if(altListe === JSON.stringify(liste)) return;
  if(!state.produktion) state.produktion = {};
  state.produktion.sofort = JSON.stringify({ stand:new Date().toISOString(), liste });
  saveState();
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
  /* Prüfrunde: Wer ihn draußen bestätigt, bekommt den Standort der Reihe vorbelegt. */
  const foto = pruefRundeNummer(e);
  if(foto && foto.gruppe.standort && ['stimmt', 'abweichend', 'ohneEtikett'].includes(status) && !pruefWert(e, r, 'standort')){
    aenderung.korrektur = Object.assign({}, r && r.korrektur, { standort:foto.gruppe.standort });
  }
  pruefSetze(pnr, aenderung);
  renderPruefung();
}

/* GPS: beobachten statt einmal fragen. iOS liefert zuerst oft eine alte,
   grobe Position aus dem Zwischenspeicher — vier Bäume mit exakt demselben
   Punkt (±59 m) waren die Folge. Jetzt läuft die Messung, bis sie besser als
   PRUEF_GPS_GUT ist oder die Wartezeit um ist; Positionen von vor dem Start
   zählen nicht. Ist das Beste danach gröber als PRUEF_GPS_STECKNADEL, wird
   gefragt statt still übernommen. */
function pruefGps(pnr){
  if(!navigator.geolocation){ showToast('Dieses Gerät kann keine GPS-Position ermitteln.', 'error', 5000); return; }
  pruefGpsStopp();
  const lauf = { pnr, bestes:null, start:Date.now() };
  pruefGpsLaeuft = lauf;
  renderPruefung();
  const anzeigen = text => { const el = document.getElementById('pr-gps-live'); if(el) el.textContent = text; };
  const fertig = ()=>{
    if(pruefGpsLaeuft !== lauf) return;
    pruefGpsStopp();
    const b = lauf.bestes;
    if(!b){ showToast('Keine GPS-Position erhalten. Ortungsdienste für Safari prüfen.', 'error', 6000); renderPruefung(); return; }
    const genau = Math.round(b.accuracy);
    if(genau > PRUEF_GPS_STECKNADEL
       && !confirm(`Nur ±${genau} m erreicht — für eine Stecknadel zu ungenau.\n\nTrotzdem speichern? (Im Kataster kommt der Baum dann ohne Stecknadel an.)`)){
      renderPruefung(); return;
    }
    pruefSetze(pnr, { gps:{ lat:b.latitude, lng:b.longitude, gpsAccuracy:genau }, ort:'ausgepflanzt' });
    showToast(`GPS übernommen (±${genau} m).`, genau <= PRUEF_GPS_STECKNADEL ? 'success' : 'info', 3000);
    renderPruefung();
  };
  lauf.watch = navigator.geolocation.watchPosition(pos=>{
    if(pruefGpsLaeuft !== lauf) return;
    if(pos.timestamp && pos.timestamp < lauf.start - 1000) return;   /* alte Position aus dem Speicher */
    if(!lauf.bestes || pos.coords.accuracy < lauf.bestes.accuracy) lauf.bestes = pos.coords;
    const sek = Math.max(0, PRUEF_GPS_WARTEN_S - Math.round((Date.now() - lauf.start) / 1000));
    anzeigen(`±${Math.round(pos.coords.accuracy)} m (bestes ±${Math.round(lauf.bestes.accuracy)} m) — warte auf ±${PRUEF_GPS_GUT} m, noch ${sek} s`);
    if(lauf.bestes.accuracy <= PRUEF_GPS_GUT) fertig();
  }, err=>{
    if(pruefGpsLaeuft !== lauf) return;
    pruefGpsStopp();
    showToast(`GPS nicht verfügbar: ${err.message}`, 'error', 6000);
    renderPruefung();
  }, { enableHighAccuracy:true, maximumAge:0, timeout:PRUEF_GPS_WARTEN_S * 1000 });
  lauf.timer = setTimeout(fertig, PRUEF_GPS_WARTEN_S * 1000);
}
function pruefGpsStopp(){
  const lauf = pruefGpsLaeuft;
  if(!lauf) return;
  if(lauf.watch != null) navigator.geolocation.clearWatch(lauf.watch);
  clearTimeout(lauf.timer);
  pruefGpsLaeuft = null;
}

/* Korrektur eines Feldes. Gleich dem Original → Korrektur entfällt wieder. */
function pruefKorrektur(pnr, feld, wert){
  const e = pruefEintrag(pnr);
  if(!e) return;
  const r = pruefErgebnis(e) || {};
  const korrektur = Object.assign({}, r.korrektur || {});
  const v = feld === 'unterlage' ? pruefUnterlageNorm(wert) : String(wert || '').trim();
  if(v === pruefOriginal(e, feld)) delete korrektur[feld]; else korrektur[feld] = v;
  pruefSetze(pnr, { korrektur });
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
  const gebiet = wert('pr-fund-gebiet').trim() || 'Waldgarten';
  const anzahl = Math.max(1, parseInt(wert('pr-fund-anzahl'), 10) || 1);
  const herkunft = pruefNummer(wert('pr-fund-herkunft').trim());
  const foto = pruefRundeNummer({ alt_id:wert('pr-fund-etikett').trim() });
  pruefung.funde[id] = {
    id, etikett:wert('pr-fund-etikett').trim(), standort:(foto && foto.gruppe.standort) || '', sorte:wert('pr-fund-sorte').trim(),
    frucht:wert('pr-fund-art').trim(), gebiet, unterlage:'', veredelt:'',
    vermehrung:wert('pr-fund-vermehrung'), herkunft, anzahl,
    /* Wer vor Ort neu erfasst, hat ihn gesehen: gilt als vorhanden. */
    status:'stimmt', ort:wert('pr-fund-ort') || (PRUEF_BEET_GEBIETE.includes(gebiet) ? 'beet' : 'ausgepflanzt'),
    notiz:'', zeit:pruefJetzt(), von:(window.__firebaseUser||{}).email || ''
  };
  pruefFundForm = null;
  pruefOffen = id;
  /* In der Prüfrunde bleibt die Liste stehen, sonst wäre man in der Nummernsuche. */
  if(pruefFilter().ansicht !== 'runde') document.getElementById('pr-nummer').value = pruefung.funde[id].etikett;
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
      pruefNormalisieren(pruefung);
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

/* ---------- Übernahme ins Kataster ---------- */
const PRUEF_UEBERNAHME_STATUS = ['stimmt', 'abweichend', 'ohneEtikett'];

function pruefUebernahmeBereit(){
  return pruefAlleEintraege().filter(e=>{
    const r = pruefErgebnis(e);
    return r && PRUEF_UEBERNAHME_STATUS.includes(r.status) && PRUEF_ORTE_KATASTER.includes(r.ort) && !r.uebernommen
      && !(e.fund && (e.anzahl || 1) > 1);   /* Gruppen mehrerer Töpfe sind keine Einzelbäume */
  });
}
/* ID-Vorschlag: die Etikettnummer, denn die hängt am Baum. Ist sie vergeben —
   im Kataster oder schon in dieser Übernahme —, kommt ein Zusatz dazu. Ohne
   Nummer (Zukauf 2015) gibt es eine NEU-Nummer wie bei jeder Neuanlage. */
/* Stecknadel beim Übernehmen: GPS, wenn es genau genug ist. Ein in der Reihe
   bestätigter Baum der Prüfrunde bekommt sonst die Lage aus dem Foto — die ist
   dort genauer als die meisten Messungen; nur sehr gutes GPS geht ihr vor. */
function pruefNadel(e, r){
  const gps = r.gps;
  const foto = pruefRundeNummer(e);
  const ausFoto = !!(foto && foto.gruppe.stecknadel && r.status === 'stimmt');
  if(gps && gps.gpsAccuracy <= (ausFoto ? 5 : PRUEF_GPS_STECKNADEL)){
    return { pos:{ lat:gps.lat, lng:gps.lng, gpsAccuracy:gps.gpsAccuracy }, text:`Stecknadel aus GPS (±${gps.gpsAccuracy} m)` };
  }
  return ausFoto ? { pos:{ lat:foto.lat, lng:foto.lng }, text:'Stecknadel aus dem Foto' } : null;
}
function pruefIdVorschlag(e, vergeben){
  let basis = pruefNummer(e.alt_id || '').replace(/\s+/g, '');
  if(!basis || basis === '0' || !/^[0-9A-Z-]+$/.test(basis)){
    let n = 1;
    while(vergeben.has(`NEU-${n}`)) n++;
    vergeben.add(`NEU-${n}`);
    return `NEU-${n}`;
  }
  let id = basis, n = 2;
  while(vergeben.has(id)) id = `${basis}-${n++}`;
  vergeben.add(id);
  return id;
}

function pruefUebernahmeOeffnen(){
  if(!isAdmin()){ showToast('Übernehmen darf nur der Admin.', 'error', 4000); return; }
  const bereit = pruefUebernahmeBereit();
  if(!bereit.length){ showToast('Nichts zu übernehmen — es fehlen bestätigte, ausgepflanzte oder eingewurzelte Bäume.', 'info', 4000); return; }
  const vergeben = new Set(getAllTrees().map(t=> t.id));
  const zeilen = bereit.map(e=>{
    const r = pruefErgebnis(e);
    const w = feld => pruefWert(e, r, feld);
    const id = pruefIdVorschlag(e, vergeben);
    const gps = r.gps;
    const nadel = pruefNadel(e, r);
    const angaben = [w('frucht'), w('unterlage'), w('veredelt') && `veredelt ${w('veredelt')}`,
      w('ausgepflanzt') && `gepflanzt ${w('ausgepflanzt')}`, w('standort')].filter(Boolean).map(escHtml).join(' · ');
    const hinweise = [r.status !== 'stimmt' ? (pruefStatus(r.status) || {}).label : '', r.notiz]
      .concat(e.warnungen || []).filter(Boolean).map(escHtml).join(' · ');
    return `
      <div class="pu-zeile">
        <label class="pu-wahl"><input type="checkbox" data-pu-pnr="${escAttr(e.pnr)}" checked> übernehmen</label>
        <div class="pu-kopf">
          <input type="text" class="pu-id" data-pu-id="${escAttr(e.pnr)}" value="${escAttr(id)}" aria-label="ID im Kataster" autocapitalize="characters">
          <span class="pu-sorte">${w('sorte') ? escHtml(w('sorte')) : '<i>Sorte fehlt</i>'}</span>
        </div>
        <div class="pu-angaben">${angaben || '<i>keine Angaben</i>'}</div>
        <div class="pu-nadel${nadel ? '' : ' fehlt'}">${nadel ? nadel.text : (gps ? `GPS ±${gps.gpsAccuracy} m zu ungenau — ohne Stecknadel` : 'kein GPS — ohne Stecknadel')}</div>
        ${hinweise ? `<div class="pu-hinweis">${hinweise}</div>` : ''}
      </div>`;
  }).join('');
  const html = `
    <button class="close" onclick="closeModal()" aria-label="Schließen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    <h2>Ins Kataster übernehmen</h2>
    <p class="snippet">${bereit.length === 1 ? 'Ein bestätigter, ausgepflanzter oder eingewurzelter Baum' : `${bereit.length} bestätigte, ausgepflanzte oder eingewurzelte Bäume`}.
      Die ID ist die Etikettnummer und lässt sich hier noch ändern. Angaben korrigierst du vorher in der Prüfkarte.</p>
    <div class="pu-liste">${zeilen}</div>
    <div id="pu-fehler" class="login-meldung fehler" style="display:none;"></div>
    <div class="pu-fuss">
      <button type="button" class="btn" onclick="pruefUebernahmeAusfuehren()">Übernehmen</button>
      <button type="button" class="btn secondary" onclick="closeModal()">Abbrechen</button>
    </div>`;
  const modal = document.getElementById('modal-content');
  modal.innerHTML = html;
  modal.dataset.modalType = 'uebernahme';
  document.getElementById('overlay').classList.add('open');
}

function pruefUebernahmeAusfuehren(){
  const fehler = text => { const el = document.getElementById('pu-fehler'); el.textContent = text; el.style.display = 'block'; };
  const gewaehlt = Array.from(document.querySelectorAll('[data-pu-pnr]')).filter(c=> c.checked).map(c=> c.dataset.puPnr);
  if(!gewaehlt.length){ fehler('Kein Baum ausgewählt.'); return; }
  const vorhanden = new Set(getAllTrees().map(t=> t.id));
  const neueIds = new Set();
  const plan = [];
  for(const pnr of gewaehlt){
    const feld = document.querySelector(`[data-pu-id="${CSS.escape(pnr)}"]`);
    const id = (feld ? feld.value : '').trim().toUpperCase();
    if(!id){ fehler('Jeder Baum braucht eine ID.'); return; }
    if(vorhanden.has(id) || neueIds.has(id)){ fehler(`Die ID ${id} ist schon vergeben.`); return; }
    neueIds.add(id);
    plan.push({ pnr, id });
  }
  if(!confirm(`${plan.length} Baum/Bäume ins Kataster übernehmen?\n\n${plan.map(x=> x.id).join(', ')}`)) return;

  if(!state.customTrees) state.customTrees = [];
  if(!state.satPositions) state.satPositions = {};
  const jetzt = pruefJetzt();
  let mitNadel = 0;
  plan.forEach(({ pnr, id })=>{
    const e = pruefEintrag(pnr);
    const r = pruefErgebnis(e);
    const w = feld => pruefWert(e, r, feld);
    const veredelt = w('veredelt');
    state.customTrees.push({
      id, sorte:w('sorte'), frucht:w('frucht'), unterlage:w('unterlage'),
      veredelt: veredelt === 'unbekannt' ? '' : veredelt,
      ausgepflanzt:w('ausgepflanzt'),
      /* Eingewurzelte Töpfe werden als Waldgarten-Bäume geführt (Volkmar 27.10.2026). */
      standort_zeile:w('standort') || (r.ort === 'eingewurzelt' ? 'Waldgarten' : ''),
      sukzession:[], ernten:[], position:null,
      quelle:'pruefung', pruefung:{ pnr, etikett:e.alt_id || '', datum:jetzt.slice(0, 10) }
    });
    const nadelWahl = pruefNadel(e, r);
    const nadel = !!nadelWahl;
    if(nadel){
      state.satPositions[id] = nadelWahl.pos;
      if(state.deletedSatPositions) delete state.deletedSatPositions[id];
      mitNadel++;
    }
    pruefSetze(pnr, { uebernommen:{ id, zeit:jetzt, stecknadel:nadel } });
  });
  invalidateTreeCache();
  saveState();
  closeModal();
  refreshFilterOptions();
  renderBaumTable();
  if(typeof renderSatMarkers === 'function') renderSatMarkers();
  renderPruefung();
  const ohne = plan.length - mitNadel;
  showToast(`${plan.length} Baum/Bäume im Kataster${ohne ? ` — ${ohne} ohne Stecknadel, bitte im Lageplan setzen` : ''}.`, 'success', 6000);
}

/* ---------- Export ---------- */
function pruefExport(){
  if(typeof XLSX === 'undefined'){ showToast('Excel-Export braucht Internet (SheetJS wird nachgeladen).', 'error', 5000); return; }
  const status = id => (pruefStatus(id) || {}).label || '';
  const zeile = (e, r) => ({
    'P-Nr': e.fund ? '' : e.pnr, 'Fund-Id': e.fund ? e.pnr : '', 'Etikett-Nr.': e.alt_id || '', 'Sorte': pruefWert(e, r, 'sorte'),
    'Obstart': pruefWert(e, r, 'frucht'), 'Unterlage': pruefWert(e, r, 'unterlage'), 'Veredelt': pruefWert(e, r, 'veredelt'),
    'Gepflanzt': pruefWert(e, r, 'ausgepflanzt'), 'Standort': pruefWert(e, r, 'standort'),
    'Korrigiert': Object.keys((r && r.korrektur) || {}).join(', '), 'Suchgebiet': e.gebiet || '',
    'Status': r ? status(r.status) : '', 'Durchgänge': r && r.status==='fehlt' ? (r.durchgaenge||1) : '',
    'Wo': r && r.status ? pruefOrtLabel(r.ort) : '', 'Verkaufsfertig': r && r.verkaufsfertig ? 'ja' : '',
    'Anzahl': e.fund ? (e.anzahl || 1) : 1, 'Vermehrung': e.fund ? (e.vermehrung || '') : '', 'Herkunft': e.fund ? (e.herkunft || '') : '',
    'Notiz': (r && r.notiz) || '',
    'Breite': r && r.gps ? r.gps.lat : '', 'Länge': r && r.gps ? r.gps.lng : '', 'Genauigkeit (m)': r && r.gps ? r.gps.gpsAccuracy : '',
    'Geprüft am': r && r.status ? pruefDatum(r.zeit) : '', 'Im Kataster als': r && r.uebernommen ? r.uebernommen.id : '',
    'Warnzeichen': (e.warnungen||[]).join('; '), 'Tabellenblatt': e.blatt || ''
  });
  const zeilen = pruefAlleEintraege().map(e=> zeile(e, pruefErgebnis(e)));
  Object.keys(pruefung.ergebnisse).filter(p=> !pruefung.liste[p]).forEach(p=>{
    zeilen.push(zeile({ pnr:p, sorte:'(nicht mehr in der Liste)', warnungen:[] }, Object.assign({}, pruefung.ergebnisse[p], { korrektur:null })));
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
      case 'gps-stopp': pruefGpsStopp(); renderPruefung(); break;
      case 'uebernahme': pruefUebernahmeOeffnen(); break;
      case 'naechster':
        pruefEinzeln = null;
        if(pruefFilter().ansicht === 'runde' && !document.getElementById('pr-nummer').value.trim()) pruefRundeNaechster();
        else pruefNaechster();
        break;
      case 'runde-mehr': pruefRundeAlle = true; renderPruefung(); break;
      case 'runde-karte': pruefRundeKarte(el.dataset.nr, pnr); break;
      case 'zuruecksetzen':
        if(confirm('Ergebnis für diesen Baum löschen?')){ delete pruefung.ergebnisse[pnr]; pruefungSpeichern(); renderPruefung(); }
        break;
      case 'nummer-leeren': pruefNaechster(); break;
      case 'mehr': pruefSichtbar += PRUEF_SEITE; renderPruefung(); break;
      case 'ansicht':
        pruefFilterSetzen({ ansicht:el.dataset.ansicht }); pruefEinzeln = null; pruefFundForm = null; renderPruefung(); break;
      case 'topf-oeffnen':
        pruefFilterSetzen({ ansicht:'pruefen' }); pruefEinzeln = pnr; pruefOffen = pnr;
        renderPruefung(); document.getElementById('tab-pruefung').scrollIntoView({ block:'start' }); break;
      case 'einzeln-aus': pruefEinzeln = null; pruefOffen = null; renderPruefung(); break;
      case 'topf-export': pruefTopfExport(); break;
      case 'fund-neu':
        if(pruefFilter().ansicht !== 'runde') pruefFilterSetzen({ ansicht:'pruefen' });
        pruefEinzeln = null;
        pruefFundForm = { etikett:el.dataset.etikett || document.getElementById('pr-nummer').value.trim(), gebiet:el.dataset.gebiet || '' };
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
    const t = ev.target;
    if(t.id === 'pr-fund-herkunft'){ pruefHerkunftAusfuellen(); return; }
    if(t.id === 'pr-fund-art' || t.id === 'pr-fund-sorte'){ delete t.dataset.auto; return; }
    if(t.id !== 'pr-nummer') return;
    pruefOffen = null;
    pruefEinzeln = null;
    renderPruefung();
  });
  tab.addEventListener('change', ev=>{
    const t = ev.target;
    if(t.id === 'pr-gebiet'){ pruefFilterSetzen({ gebiet:t.value }); pruefSichtbar = PRUEF_SEITE; pruefOffen = null; renderPruefung(); }
    else if(t.id === 'pr-status-filter'){ pruefFilterSetzen({ status:t.value }); pruefSichtbar = PRUEF_SEITE; pruefOffen = null; renderPruefung(); }
    else if(t.id === 'pr-topf-bereich'){ pruefFilterSetzen({ topfBereich:t.value }); renderPruefung(); }
    else if(t.id === 'pr-topf-verkauf'){ pruefFilterSetzen({ topfVerkauf:t.checked }); renderPruefung(); }
    else if(t.id === 'pr-fund-vermehrung'){ pruefHerkunftAusfuellen(); }
    else if(t.id === 'pr-fund-gebiet'){
      const ort = document.getElementById('pr-fund-ort');
      if(ort) ort.value = PRUEF_BEET_GEBIETE.includes(t.value.trim()) ? 'beet' : ort.value;
    }
    else if(t.dataset.prVerkauf){
      pruefSetze(t.dataset.prVerkauf, { verkaufsfertig:t.checked });
      if(pruefFilter().ansicht === 'topf') renderPruefung();
    }
    else if(t.dataset.prAnzahl){
      pruefSetze(t.dataset.prAnzahl, { anzahl:Math.max(1, parseInt(t.value, 10) || 1) });
    }
    else if(t.dataset.prVermehrung !== undefined && t.tagName === 'SELECT'){
      pruefSetze(t.dataset.prVermehrung, { vermehrung:t.value });
    }
    else if(t.dataset.prHerkunft !== undefined){
      const pnr = t.dataset.prHerkunft;
      const herkunft = pruefNummer(t.value.trim());
      const aenderung = { herkunft };
      const e = pruefEintrag(pnr);
      const h = pruefHerkunft(herkunft);
      if(h && e){
        if(!e.frucht) aenderung.frucht = h.frucht;
        if(!e.sorte && e.vermehrung !== 'Sämling') aenderung.sorte = h.sorte;
      }
      pruefSetze(pnr, aenderung);
      renderPruefung();
    }
    else if(t.dataset.prKorr === 'ausgepflanzt'){
      /* Pflanzjahr aus zwei Auswahlfeldern: Jahr und Jahreszeit */
      const block = t.closest('.pr-doppel');
      const jahr = block.querySelector('[data-pr-teil="jahr"]').value;
      const zeit = block.querySelector('[data-pr-teil="zeit"]').value;
      pruefKorrektur(t.dataset.pnr, 'ausgepflanzt', jahr && zeit ? `${zeit} ${jahr}` : jahr);
      renderPruefung();
    }
    else if(t.dataset.prKorr){
      /* Auswahlfelder zeichnen neu (Kennzeichnung „geändert“), Textfelder nicht —
         sonst wäre der Fokus weg, bevor man ins nächste Feld tippt. */
      pruefKorrektur(t.dataset.pnr, t.dataset.prKorr, t.value);
      if(t.tagName === 'SELECT') renderPruefung();
    }
    else if(t.dataset.prNotiz){
      /* Notiz ohne Neuzeichnen speichern, sonst springt der Fokus weg. */
      pruefSetze(t.dataset.prNotiz, { notiz:t.value.trim() });
    }
  });
})();

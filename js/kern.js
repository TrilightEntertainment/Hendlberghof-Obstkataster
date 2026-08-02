/* kern.js — Hendlberghof Obstdatenbank
   Grundlagen: Konstanten, Toast, Zustand, Obstart-Regeln, Baum-Zwischenspeicher, Anmeldung, Reiter, Filter

   Aus einer einzelnen Datei herausgeloest (F6). Die Ladereihenfolge in
   index.html entspricht exakt der frueheren Reihenfolge im Script-Block und
   darf nicht veraendert werden: Ueber Dateigrenzen hinweg gibt es kein
   Hoisting mehr, und start.js setzt window.__dataReadyPromise, das berater.js
   beim Laden bereits liest. */

let BAUM_DATA = [];
let SORTEN_DATA = [];
/* Nie existierende Platzhalter-IDs, die aus alten Importen stammen und
   ausgeblendet bleiben. W20 wurde entfernt: Die ID ist seit August 2026 an
   die Walnuss "Fernor" vergeben, die dadurch unsichtbar war. */
const BLACKLIST = new Set(['W21','W22']);
function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){return (s||'').replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\(/g,'&#40;').replace(/\)/g,'&#41;');}

function showToast(msg, type, duration){
  type = type || 'info';
  duration = duration || 3000;
  const container = document.getElementById('toast-container');
  if(!container) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  t.addEventListener('click', ()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 250); });
  container.appendChild(t);
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ t.classList.add('show'); }); });
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 250); }, duration);
}

function debounce(fn, ms){ let t; return function(){ clearTimeout(t); t = setTimeout(()=>fn.apply(this, arguments), ms); }; }

let _undoBuf = null;
let _undoTimer = null;
let _undoEl = null;
function setUndo(type, data){
  if(_undoEl && _undoEl.parentElement) _undoEl.remove();
  clearTimeout(_undoTimer);
  _undoBuf = {type, data};
  const c=document.getElementById('toast-container');
  if(!c) return;
  const el=document.createElement('div');
  el.className='toast info';
  el.style.cssText='display:flex;gap:8px;align-items:center;cursor:pointer;min-width:0;';
  const txt=document.createElement('span'); txt.textContent='Gelöscht — '; el.appendChild(txt);
  const btn=document.createElement('span'); btn.textContent='Rückgängig (30s)'; btn.style.cssText='color:var(--dachziegel,#B2543A);font-weight:600;white-space:nowrap;'; el.appendChild(btn);
  el.onclick=()=>{ doUndo(); if(el.parentElement) el.remove(); };
  c.appendChild(el);
  _undoEl=el;
  _undoTimer=setTimeout(()=>{ _undoBuf=null; _undoEl=null; if(el.parentElement){ el.style.opacity='0'; setTimeout(()=>{ el.remove(); }, 300); } }, 30000);
}
function doUndo(){
  if(!_undoBuf) return;
  const {type, data} = _undoBuf;
  _undoBuf = null;
  clearTimeout(_undoTimer);
  if(type==='sukz'){
    if(!state.sukzession[data.id]) state.sukzession[data.id]=[];
    state.sukzession[data.id].splice(data.idx, 0, data.item);
    saveState(); renderSukzList(data.id);
  } else if(type==='ernte'){
    if(!state.ernten[data.id]) state.ernten[data.id]=[];
    state.ernten[data.id].splice(data.idx, 0, data.item);
    _mittelCache=null;
    saveState(); renderErnteList(data.id);
  } else if(type==='baum'){
    state.customTrees.push(data.tree);
    if(data.pos) state.positions[data.id] = data.pos;
    if(data.satPos) state.satPositions[data.id] = data.satPos;
    if(data.edit) state.baumEdits[data.id] = data.edit;
    saveState(); renderBaumTable(); renderPins(); renderSatMarkers();
  }
  showToast('Rückgängig gemacht.','success');
}

function _shareText(title, text){
  if(navigator.share){ navigator.share({title, text}).catch(()=>{}); }
  else if(navigator.clipboard){ navigator.clipboard.writeText(text).then(()=>showToast('In Zwischenablage kopiert.','success')); }
  else { showToast('Teilen nicht verfügbar.','error'); }
}
function shareBaum(id){
  const t = getTree(id); if(!t) return;
  const lines = ['🌳 '+(t.sorte||'Unbekannt')+' (ID: '+t.id+')'];
  if(t.frucht) lines.push('Obstart: '+t.frucht);
  if(t.pflueckzeitpunkt||t.pflueck_reifezeit) lines.push('Pflückzeit: '+(t.pflueckzeitpunkt||t.pflueck_reifezeit));
  if(t.standort_zeile) lines.push('Standort: '+t.standort_zeile);
  if(t.genussreife) lines.push('Genussreife: '+t.genussreife);
  _shareText('Baum '+t.id, lines.join('\n'));
}
function shareSorte(name){
  const s = getSorte(name); if(!s) return;
  const lines = ['🍎 '+s.sorte];
  if(s.frucht) lines.push('Obstart: '+s.frucht);
  if(s.pflueckzeitpunkt||s.pflueck_reifezeit) lines.push('Pflückzeit: '+(s.pflueckzeitpunkt||s.pflueck_reifezeit||'–'));
  if(s.genussreife) lines.push('Genussreife: '+s.genussreife);
  if(s.geschmack) lines.push('Geschmack: '+s.geschmack);
  if(s.befruchtungspartner) lines.push('Befruchtung: '+s.befruchtungspartner);
  if(s.ertrag) lines.push('Ertrag: '+s.ertrag);
  if(s.herkunft_jahr||s.herkunft) lines.push('Herkunft: '+(s.herkunft_jahr||s.herkunft));
  if(s.frucht_beschreibung) lines.push('Frucht: '+s.frucht_beschreibung);
  if(s.eigenschaften) lines.push('Eigenschaften: '+s.eigenschaften);
  if(s.standort_anspruch) lines.push('Standortansprüche: '+s.standort_anspruch);
  const mittel = calcPfluckMittel(s.sorte);
  if(mittel) lines.push('Pflückreife ermittelt: → '+mittel.wert+' ('+mittel.anzahl+' Ernten)');
  if(s.baum_ids&&s.baum_ids.length) lines.push('Bäume: '+s.baum_ids.join(', '));
  _shareText('Sorte '+s.sorte, lines.join('\n'));
}

const LS_KEY = "hendlberghof_obstdb_v1";

let SEED_POSITIONS = {};
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      // Seed-Positionen nur ergänzen, falls noch keine eigenen Positionen gesetzt wurden
      if(!parsed.positions) parsed.positions = {};
      if(Object.keys(parsed.positions).length === 0){
        parsed.positions = Object.assign({}, SEED_POSITIONS);
      }
      return parsed;
    }
  }catch(e){ console.error('State corrupted, resetting:', e); setTimeout(()=>showToast('Gespeicherte Daten beschädigt — Zurückgesetzt.','error',5000),500); }
  return { positions: Object.assign({}, SEED_POSITIONS), sukzession:{}, ernten:{}, verifiziert:{}, customTrees:[], baumEdits:{}, sortenEdits:{}, importLog:[], importSnapshots:[], phaenologie:{}, sortenSichtbar:{}, preislisten:{}, bestellungen:[], satPositions:{}, deletedSatPositions:{}, obstarten:{}, merklisten:{} };
}
let _saveTimer = null;
function saveState(){
  _sortenCache = null;
  _mittelCache = null;
  invalidateTreeCache();
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(()=>{
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    if(window.__syncToFirestore) window.__syncToFirestore(state);
  }, 300);
}
let state;
function initState(){
  state = loadState();
  if(!state.verifiziert) state.verifiziert = {};
  if(!state.customTrees) state.customTrees = [];
  if(!state.baumEdits) state.baumEdits = {};
  if(!state.sortenEdits) state.sortenEdits = {};
  if(!state.importLog) state.importLog = [];
  if(!state.importSnapshots) state.importSnapshots = [];
  if(!state.phaenologie) state.phaenologie = {};
  if(!state.sortenSichtbar) state.sortenSichtbar = {};
  if(!state.preislisten) state.preislisten = {};
  if(!state.bestellungen) state.bestellungen = [];
  if(!state.sukzession) state.sukzession = {};
  if(!state.ernten) state.ernten = {};
  if(!state.satPositions) state.satPositions = {};
  if(!state.deletedSatPositions) state.deletedSatPositions = {};
  if(!state.obstarten) state.obstarten = {};   /* Abwandlungen zu OBSTARTEN_STANDARD */
  if(!state.merklisten) state.merklisten = {};
  invalidateTreeCache();
}

function toggleVerifiziert(sorteName, context){
  if(state.verifiziert[sorteName]){
    delete state.verifiziert[sorteName];
  } else {
    state.verifiziert[sorteName] = new Date().toISOString().slice(0,10);
  }
  saveState();
  renderResults();
  if(context && context.baumId) openBaumModal(context.baumId);
  else openSortenModal(sorteName);
}

/* ---------- Editierbarkeit (Login-geschützt via Firebase Authentication) ---------- */
function isEditMode(){ return !!window.__firebaseUser; }
function getCurrentState(){ return state; }
function applyRemoteState(remote){
  if(!remote) return;
  const localKeys = Object.keys(state.satPositions||{});
  const remoteKeys = remote.satPositions ? Object.keys(remote.satPositions) : [];
  console.log('[sync] local satPositions:', localKeys, 'remote:', remoteKeys);
  /* Stale customTrees/Edits/Positions DES REMOTE bereinigen BEVOR merge */
  const baumIds = new Set(BAUM_DATA.map(b=>b.id));
  const isAlive = (id)=> !BLACKLIST.has(id) && (baumIds.has(id) || id.startsWith('NEU-'));
  if(remote.customTrees && Array.isArray(remote.customTrees)){
    remote.customTrees = remote.customTrees.filter(c=> isAlive(c.id));
  }
  if(remote.baumEdits && typeof remote.baumEdits === 'object'){
    for(const k of Object.keys(remote.baumEdits)){ if(!isAlive(k)) delete remote.baumEdits[k]; }
  }
  if(remote.positions && typeof remote.positions === 'object'){
    for(const k of Object.keys(remote.positions)){ if(!isAlive(k)) delete remote.positions[k]; }
  }
  /* Deep merge: Nested-Objekte Einträge beider Seiten zusammenführen */
  const _mergeObj=(local, remote)=>{
    const out=Object.assign({}, local||{});
    if(remote && typeof remote==='object' && !Array.isArray(remote)){
      Object.keys(remote).forEach(k=>{ out[k]=remote[k]; });
    }
    return out;
  };
  const _mergeArr=(local, remote, key='id')=>{
    if(!Array.isArray(remote)) return local||[];
    if(!Array.isArray(local)) return remote;
    const ids=new Set(local.map(x=>x[key]));
    return local.concat(remote.filter(x=>!ids.has(x[key])));
  };
  state.verifiziert = _mergeObj(state.verifiziert, remote.verifiziert);
  state.baumEdits = _mergeObj(state.baumEdits, remote.baumEdits);
  state.sortenEdits = _mergeObj(state.sortenEdits, remote.sortenEdits);
  state.positions = _mergeObj(state.positions, remote.positions);
  state._pinFmt = remote._pinFmt || state._pinFmt;
  state.phaenologie = _mergeObj(state.phaenologie, remote.phaenologie);
  state.sortenSichtbar = _mergeObj(state.sortenSichtbar, remote.sortenSichtbar);
  state.obstarten = _mergeObj(state.obstarten, remote.obstarten);
  state.merklisten = _mergeObj(state.merklisten, remote.merklisten);
  state.preislisten = _mergeObj(state.preislisten, remote.preislisten);
  state.sukzession = _mergeObj(state.sukzession, remote.sukzession);
  state.ernten = _mergeObj(state.ernten, remote.ernten);
  state.deletedSatPositions = _mergeObj(state.deletedSatPositions, remote.deletedSatPositions);
  state.satPositions = _mergeObj(state.satPositions, remote.satPositions);
  if(state.deletedSatPositions){
    const remSat = remote.satPositions||{};
    Object.keys(state.deletedSatPositions).forEach(id=>{
      if(id in remSat){ delete state.deletedSatPositions[id]; }
      else { delete state.satPositions[id]; }
    });
  }
  state.bestellungen = _mergeArr(state.bestellungen, remote.bestellungen);
  state.importLog = _mergeArr(state.importLog, remote.importLog);
  state.importSnapshots = _mergeArr(state.importSnapshots, remote.importSnapshots, 'importId');
  state.customTrees = _mergeArr(state.customTrees, remote.customTrees);
  _mittelCache=null;
  _sortenCache=null;
  invalidateTreeCache();
  if(!state.verifiziert) state.verifiziert = {};
  if(!state.customTrees) state.customTrees = [];
  if(!state.baumEdits) state.baumEdits = {};
  if(!state.sortenEdits) state.sortenEdits = {};
  if(!state.importLog) state.importLog = [];
  if(!state.importSnapshots) state.importSnapshots = [];
  if(!state.phaenologie) state.phaenologie = {};
  if(!state.sortenSichtbar) state.sortenSichtbar = {};
  if(!state.preislisten) state.preislisten = {};
  if(!state.bestellungen) state.bestellungen = [];
  if(!state.sukzession) state.sukzession = {};
  if(!state.ernten) state.ernten = {};
  if(!state.satPositions) state.satPositions = {};
  if(!state.deletedSatPositions) state.deletedSatPositions = {};
  if(!state.obstarten) state.obstarten = {};
  if(!state.merklisten) state.merklisten = {};
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  /* Arbeitskopie der Merklisten nachziehen, sonst zeigt dieses Gerät weiter den
     Stand von vor der Synchronisierung. */
  if(typeof ladeMerklisten === 'function') ladeMerklisten();
  refreshFilterOptions();
  renderBaumTable();
  renderResults();
  renderUnplacedSelect();
  if(document.getElementById('tab-lageplan').style.display!=='none') renderPins();
  if(satMap) renderSatMarkers();
}

/* ---------- Obstart-Regeln ----------
   Bestimmt, was je Obstart angeboten wird. Gesteuert über Daten statt über
   Sonderfälle im Code: Eine neue Obstart braucht eine Zeile, keinen Eingriff in
   die Logik. Ohne das würde der Konfigurator auf Apfel und Birne verdrahtet und
   beim ersten Zwetschken-Import wieder geöffnet.

     veredelung   Wird diese Obstart überhaupt veredelt angeboten?
     mehrsorten   Dürfen mehrere Sorten auf einen Baum?
     max_sorten   Obergrenze; nur bei mehrsorten von Belang.

   Walnuss steht bewusst auf veredelung:false — vorerst kein Angebot. Die Sorten
   bleiben in Kataster, Übersicht und Berater voll sichtbar; sie sind lediglich
   nicht bestellbar. Nicht anbieten heißt nicht verstecken.

   Schlüssel sind kleingeschrieben, nachgeschlagen wird ebenso. Die Daten führen
   „Apfel", ZIELE_DEF führt „apfel" — diese Uneinheitlichkeit soll hier nicht
   noch einmal zur Falle werden.

   Unbekannte Obstarten gelten als nicht veredelbar und nicht mehrsortenfähig.
   Bewusst vorsichtig: lieber eine zu wenig anbieten als eine zu viel. */
const OBSTARTEN_STANDARD = {
  'apfel':     { veredelung:true,  mehrsorten:true,  max_sorten:4 },
  'birne':     { veredelung:true,  mehrsorten:true,  max_sorten:4 },
  'walnuss':   { veredelung:false, mehrsorten:false, max_sorten:1 },
  'zwetschke': { veredelung:true,  mehrsorten:false, max_sorten:1 },
  'kirsche':   { veredelung:true,  mehrsorten:false, max_sorten:1 },
  'paw paw':   { veredelung:false, mehrsorten:false, max_sorten:1 }
};
const OBSTART_UNBEKANNT = { veredelung:false, mehrsorten:false, max_sorten:1 };

function obstartSchluessel(frucht){ return String(frucht || '').trim().toLowerCase(); }

/* Liefert immer ein vollständiges Regelobjekt, nie undefined.
   `bekannt` unterscheidet „bewusst gesperrt" von „nie hinterlegt". */
function getObstartRegel(frucht){
  const k = obstartSchluessel(frucht);
  /* state.obstarten erlaubt es, Regeln später über die Verwaltung zu ergänzen
     oder abzuwandeln, ohne den Code anzufassen. */
  const eigen = (typeof state !== 'undefined' && state && state.obstarten
                 && state.obstarten[k]) || null;
  const standard = OBSTARTEN_STANDARD[k] || null;
  if(!k || (!standard && !eigen)) return Object.assign({bekannt:false}, OBSTART_UNBEKANNT);
  return Object.assign({bekannt:true}, OBSTART_UNBEKANNT, standard || {}, eigen || {});
}

function istVeredelbar(frucht){ return getObstartRegel(frucht).veredelung === true; }

function maxSortenProBaum(frucht){
  const r = getObstartRegel(frucht);
  return r.mehrsorten ? Math.max(1, parseInt(r.max_sorten, 10) || 1) : 1;
}

function istMehrsortenfaehig(frucht){ return maxSortenProBaum(frucht) > 1; }

/* Alle hinterlegten Obstarten — Standard plus eigene. Für Auswahlfelder. */
function bekannteObstarten(){
  const menge = new Set(Object.keys(OBSTARTEN_STANDARD));
  Object.keys((typeof state !== 'undefined' && state && state.obstarten) || {})
    .forEach(k => menge.add(k));
  return Array.from(menge).sort();
}

/* ---------- Zusammengeführte Baumliste (zwischengespeichert) ----------
   getTree() war als getAllTrees().find() gebaut, und getAllTrees() setzte die Liste
   bei jedem Aufruf neu zusammen. Gemessen am Standort-Berater: 503 Aufrufe für zwölf
   Karten, davon 502 aus getTree() — rund 93 % der Renderzeit reine Wiederholung, mit
   quadratischem Wachstum bei mehr Bäumen.

   Der Zwischenspeicher wird überall dort verworfen, wo auch _sortenCache und
   _mittelCache verworfen werden — also bei jeder Zustandsänderung.

   ACHTUNG: Aufrufer erhalten jetzt dieselbe Liste und dieselben Baumobjekte.
   Beides darf nicht verändert werden. Alle elf Aufrufstellen wurden geprüft, sie
   lesen ausschließlich (filter/map/forEach/find liefern neue Objekte bzw. lesen nur).
   Wer künftig ein Ergebnis verändern will, arbeitet auf einer Kopie. */
let _treeMap = null, _treeList = null;
function invalidateTreeCache(){ _treeMap = null; _treeList = null; }

function getTreeMap(){
  if(_treeMap) return _treeMap;
  const custom = state.customTrees || [];
  /* Nach wirksamer ID zusammenführen: Ein in der App angelegter Baum kann per
     baumEdit die ID eines Katalogbaums erhalten (NEU-1 -> W20). Ohne diesen
     Schritt stünde er doppelt in der Liste, sobald er auch im Katalog steht.
     Das Overlay gewinnt, weil es den neueren Stand trägt. */
  const nachId = new Map();
  BAUM_DATA.concat(custom).forEach(t=>{
    if(BLACKLIST.has(t.id)) return;
    const edit = (state.baumEdits && state.baumEdits[t.id]) || {};
    const merged = Object.assign({}, t, edit);
    if(BLACKLIST.has(merged.id)) return;
    nachId.set(merged.id, merged);
  });
  _treeMap = nachId;
  return nachId;
}
function getAllTrees(){
  if(!_treeList) _treeList = Array.from(getTreeMap().values());
  return _treeList;
}
function getTree(id){ return getTreeMap().get(id); }

/* ---------- Tabs ---------- */
function activateTab(tabName){
  if(tabName==='daten' && !isAdmin()) return;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tabName));
  document.querySelectorAll('main > section').forEach(s=>s.style.display='none');
  document.getElementById('tab-'+tabName).style.display='block';
  if(tabName==='lageplan'){
    renderPins();
    if(typeof mapLayer!=='undefined' && mapLayer==='sat' && satMap){
      renderSatMarkers();
      setTimeout(()=>{ satMap.invalidateSize(); }, 50);
    }
  }
  if(tabName==='daten'){
    renderPreislistenAdmin();
    renderBestellhistorie();
    renderOverlayPruefung();
    renderSortenlistenSichtbar();
    renderImportLog();
  }
}
document.querySelectorAll('.tab-btn[data-tab]').forEach(btn=>{
  btn.addEventListener('click', ()=> activateTab(btn.dataset.tab));
});

function showOnLageplan(id){
  closeModal();
  activateTab('lageplan');
  if(typeof mapLayer!=='undefined' && mapLayer==='sat') setMapLayer('foto');
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

/* ---------- Filter-Optionen füllen ---------- */
function fillSelect(sel, values){
  const current = sel.value;
  const first = sel.querySelector('option[value=""]');
  sel.innerHTML = '';
  if(first) sel.appendChild(first);
  values.forEach(v=>{
    const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o);
  });
  if(values.includes(current)) sel.value = current;
}

/* ---------- Overlays aufräumen ----------
   Änderungen aus der App liegen als Overlay (customTrees/baumEdits/sortenEdits)
   über dem Katalog aus data/*.json und gewinnen zur Laufzeit immer. Sind sie
   einmal in den Katalog übernommen, sind sie nicht nur überflüssig, sondern
   schädlich: Sie verdecken jede spätere Korrektur am Katalog, die dann
   wirkungslos bleibt. Die Analyse meldet ausschließlich beweisbar Entbehrliches
   — Felder, die mit dem Katalog übereinstimmen, und Verwaistes ohne Bezug.
   Alles, was noch eigene Daten trägt, bleibt unangetastet. */

function overlayWertGleich(a, b){
  const norm = v => (v === undefined || v === null) ? ''
                  : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  return norm(a) === norm(b);
}

function analysiereOverlays(){
  const katBaum = {};  BAUM_DATA.forEach(b=> katBaum[b.id] = b);
  const katSorte = {}; SORTEN_DATA.forEach(s=> katSorte[s.sorte] = s);
  const funde = [];
  const erledigteBaumEdits = new Set();

  /* 1. In der App angelegte Bäume, die inzwischen im Katalog stehen.
        Die wirksame ID zählt: ein baumEdit kann sie geändert haben (NEU-1 -> W20). */
  (state.customTrees || []).forEach(c=>{
    const edit = (state.baumEdits || {})[c.id] || {};
    const wirkId = edit.id || c.id;
    if(!katBaum[wirkId]) return;
    erledigteBaumEdits.add(c.id);
    funde.push({
      art: 'baum', id: c.id, wirkId,
      titel: (c.sorte || c.id) + (wirkId !== c.id ? ' (' + c.id + ' → ' + wirkId + ')' : ''),
      grund: 'steht jetzt im Katalog'
    });
  });

  /* 2. Feldbearbeitungen an Katalogbäumen, die mit dem Katalog übereinstimmen */
  Object.keys(state.baumEdits || {}).forEach(id=>{
    if(erledigteBaumEdits.has(id)) return;
    const kat = katBaum[id];
    const edit = state.baumEdits[id] || {};
    if(!kat){
      /* weder Katalogbaum noch zugehöriger customTree — verwaist */
      const gehoert = (state.customTrees || []).some(c=> c.id === id);
      if(!gehoert) funde.push({ art:'baumEditWaise', id, titel:id, grund:'kein Baum mit dieser ID' });
      return;
    }
    const gleiche = Object.keys(edit).filter(f=> overlayWertGleich(kat[f], edit[f]));
    if(!gleiche.length) return;
    const rest = Object.keys(edit).length - gleiche.length;
    funde.push({
      art: 'baumFelder', id, felder: gleiche,
      titel: (kat.sorte || id) + ' (' + id + ')',
      grund: gleiche.length + ' Feld' + (gleiche.length===1?'':'er') + ' wie im Katalog'
             + (rest ? ' — ' + rest + ' abweichende bleiben' : '')
    });
  });

  /* 3. Sortenbearbeitungen: verwaist oder deckungsgleich */
  Object.keys(state.sortenEdits || {}).forEach(name=>{
    const kat = katSorte[name];
    const edit = state.sortenEdits[name] || {};
    if(!kat){
      funde.push({ art:'sorteWaise', name, titel:name, grund:'Sorte gibt es im Katalog nicht' });
      return;
    }
    const gleiche = Object.keys(edit).filter(f=> overlayWertGleich(kat[f], edit[f]));
    if(!gleiche.length) return;
    const rest = Object.keys(edit).length - gleiche.length;
    funde.push({
      art: 'sorteFelder', name, felder: gleiche, titel: name,
      grund: gleiche.length + ' Feld' + (gleiche.length===1?'':'er') + ' wie im Katalog'
             + (rest ? ' — ' + rest + ' abweichende bleiben' : '')
    });
  });

  return funde;
}

function renderOverlayPruefung(){
  const karte = document.getElementById('card-overlays');
  const el = document.getElementById('overlay-pruefung');
  if(!karte || !el) return;
  if(!isAdmin()){ karte.style.display = 'none'; return; }
  karte.style.display = '';

  const funde = analysiereOverlays();
  if(!funde.length){
    el.innerHTML = '<p class="snippet" style="margin:0;">Nichts aufzuräumen — jedes Overlay trägt eigene Daten.</p>';
    return;
  }
  const zeilen = funde.map(f=>
    '<li style="margin-bottom:6px;"><b>' + escHtml(f.titel) + '</b>'
    + '<span style="color:var(--muted);"> — ' + escHtml(f.grund) + '</span></li>'
  ).join('');
  el.innerHTML =
    '<p class="snippet" style="margin:0 0 8px;">' + funde.length + ' überflüssige oder verwaiste Overlays:</p>'
    + '<ul style="margin:0 0 12px;padding-left:20px;font-size:.88rem;">' + zeilen + '</ul>'
    + '<button class="btn" onclick="overlaysAufraeumen()">' + funde.length + ' Overlays entfernen</button>';
}

function overlaysAufraeumen(){
  if(!isAdmin()) return;
  const funde = analysiereOverlays();
  if(!funde.length) return;
  if(!confirm(funde.length + ' überflüssige Overlays entfernen?\n\n'
    + 'Die Daten selbst bleiben erhalten — sie stehen im Katalog. Entfernt wird nur '
    + 'die Überlagerung, die den Katalog bisher verdeckt hat.')) return;

  funde.forEach(f=>{
    if(f.art === 'baum'){
      state.customTrees = (state.customTrees || []).filter(c=> c.id !== f.id);
      if(state.baumEdits) delete state.baumEdits[f.id];
      /* Positionen an die im Katalog gültige ID übergeben, sonst gingen sie verloren */
      if(f.wirkId !== f.id){
        ['positions','satPositions'].forEach(topf=>{
          const m = state[topf];
          if(m && m[f.id] !== undefined){
            if(m[f.wirkId] === undefined) m[f.wirkId] = m[f.id];
            delete m[f.id];
          }
        });
      }
    } else if(f.art === 'baumEditWaise'){
      if(state.baumEdits) delete state.baumEdits[f.id];
    } else if(f.art === 'baumFelder'){
      const e = state.baumEdits[f.id];
      f.felder.forEach(k=> delete e[k]);
      if(!Object.keys(e).length) delete state.baumEdits[f.id];
    } else if(f.art === 'sorteWaise'){
      if(state.sortenEdits) delete state.sortenEdits[f.name];
    } else if(f.art === 'sorteFelder'){
      const e = state.sortenEdits[f.name];
      f.felder.forEach(k=> delete e[k]);
      if(!Object.keys(e).length) delete state.sortenEdits[f.name];
    }
  });

  saveState();
  refreshFilterOptions();
  renderBaumTable();
  renderResults();
  renderUnplacedSelect();
  renderOverlayPruefung();
  showToast(funde.length + ' Overlays entfernt — Katalog und App sind jetzt deckungsgleich.', 'success', 4000);
}

function renderSortenlistenSichtbar(){
  const el=document.getElementById('sortenlisten-sichtbar-ctrl');
  if(!el) return;
  if(!isAdmin()){
    document.getElementById('card-sortenlisten-sichtbar').style.display='none';
    return;
  }
  document.getElementById('card-sortenlisten-sichtbar').style.display='';
  const quellen=[
    {key:'arche',label:'Arche Noah'},
    {key:'hof',label:'Hofsorten'}
  ];
  // Zähle Sorten pro Quelle
  const counts={arche:0,hof:0};
  if(window.__dataReady && state){
    const all=getAllSorten();
    all.forEach(s=>{ if(s.quelle==='arche') counts.arche++; else if(s.quelle==='hof') counts.hof++; });
  }
  el.innerHTML=quellen.map(q=>{
    const visible=state.sortenSichtbar[q.key]!==false;
    const count=counts[q.key]||0;
    return '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;font-size:.9rem;">'+
      '<input type="checkbox" '+(visible?'checked':'')+' onchange="toggleSortenSichtbar(\''+q.key+'\',this.checked)" style="width:18px;height:18px;">'+
      '<span><b>'+q.label+'</b> — '+count+' Sorten</span>'+
      '<span style="font-size:.78rem;color:var(--muted);margin-left:auto;">Sortenblätter (PDF) bleiben immer verfügbar</span>'+
    '</label>';
  }).join('');
}

function toggleSortenSichtbar(key, visible){
  if(!state.sortenSichtbar) state.sortenSichtbar={};
  state.sortenSichtbar[key]=visible;
  saveState();
  renderSortenlistenSichtbar();
  renderResults();
  renderSbArten();
}

function refreshFilterOptions(){
  const alle = getAllTrees();
  const fruchtArten = [...new Set(alle.map(t=>t.frucht).filter(Boolean))].sort();
  fillSelect(document.getElementById('baum-filter-frucht'), fruchtArten);
}

/* start.js — Hendlberghof Obstdatenbank
   Anmeldung, Bearbeitungsmodus und Start: laedt die Grunddaten und ruft startApp()

   Aus einer einzelnen Datei herausgeloest (F6). Die Ladereihenfolge in
   index.html entspricht exakt der frueheren Reihenfolge im Script-Block und
   darf nicht veraendert werden: Ueber Dateigrenzen hinweg gibt es kein
   Hoisting mehr, und start.js setzt window.__dataReadyPromise, das berater.js
   beim Laden bereits liest. */

/* ---------- Login & Edit-Modus ---------- */
function applyEditModeUI(){
  const on = isEditMode();
  const admin = isAdmin();
  document.querySelectorAll('.btn-login-toggle').forEach(b=>{
    b.textContent = on ? (admin ? 'Admin abmelden' : 'Abmelden') : 'Anmelden';
  });
  document.getElementById('btn-add-baum').style.display = admin ? '' : 'none';
  document.getElementById('edit-banner').style.display = on ? '' : 'none';
  document.getElementById('tab-btn-daten').style.display = admin ? '' : 'none';
  const cardPl = document.getElementById('card-preislisten');
  if(cardPl) cardPl.style.display = admin ? '' : 'none';
  const cardBh = document.getElementById('card-bestellhistorie');
  if(cardBh) cardBh.style.display = admin ? '' : 'none';
  const banner = document.getElementById('edit-banner');
  if(on) banner.innerHTML = (admin ? 'Bearbeitungsmodus (Admin)' : 'Bearbeitungsmodus (Mitarbeiter:in)') + ' — Änderungen werden lokal gespeichert &nbsp;';
  if(!on && document.getElementById('tab-daten').style.display!=='none'){
    activateTab('baumkataster');
  }
  renderBaumTable();
  renderPins();
  const zeigeEdit = on;
  const placeBtn = document.getElementById('btn-place-mode');
  const unplacedSel = document.getElementById('unplaced-select');
  if(placeBtn) placeBtn.style.display = zeigeEdit ? '' : 'none';
  if(unplacedSel) unplacedSel.style.display = zeigeEdit ? '' : 'none';
  const gpsPlaceBtn = document.getElementById('btn-gps-place');
  if(gpsPlaceBtn) gpsPlaceBtn.style.display = zeigeEdit && mapLayer==='sat' ? '' : 'none';
  const hint = document.getElementById('lageplan-hint');
  if(hint) hint.style.display = on ? '' : 'none';
  if(!on){
    placeMode = false;
    if(satMap) satMap.dragging.enable();
    const placeLabel = document.getElementById('place-mode-label');
    if(placeLabel) placeLabel.textContent = 'Position setzen';
    const st = document.getElementById('place-status');
    if(st) st.textContent = '';
    closeModal();
  }
}

const LOGIN_ACCOUNTS = {
  admin: 'mail@trilight.eu',
  mitarbeiter: 'mail@trilight.eu' // separater Account nötig
};
let pendingLoginRole = '';

function isAdmin(){ const u = window.__firebaseUser; return u && u.email === LOGIN_ACCOUNTS.admin; }
function isMitarbeiter(){ return isEditMode() && !isAdmin(); }

function handleLoginToggle(){
  if(isEditMode()){
    if(window.__firebaseSignOut) window.__firebaseSignOut();
    return;
  }
  showLoginDialog();
}

function showLoginDialog(){
  const html = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h2>Anmeldung</h2>
    <p style="margin:12px 0 16px;color:var(--muted);font-size:.9rem;">Rolle wählen:</p>
    <div style="display:flex;flex-direction:column;gap:10px;max-width:280px;">
      <button class="btn" onclick="loginAsRole('admin')" style="text-align:left;padding:14px 18px;">
        <b>Admin</b><br><span style="font-size:.82rem;color:var(--muted);">Voller Zugriff auf alle Funktionen</span>
      </button>
      <button class="btn" onclick="loginAsRole('mitarbeiter')" style="text-align:left;padding:14px 18px;">
        <b>Mitarbeiter:in</b><br><span style="font-size:.82rem;color:var(--muted);">Ernte- und Sukzessionsdokumentation, Phänologie</span>
      </button>
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
}

function loginAsRole(role){
  pendingLoginRole = role;
  const email = LOGIN_ACCOUNTS[role];
  closeModal();
  const html = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h2>Anmeldung — ${role==='admin'?'Admin':'Mitarbeiter:in'}</h2>
    <div style="max-width:320px;margin-top:16px;">
      <input type="hidden" id="login-email" value="${escAttr(email)}">
      <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px;">Angemeldet als: <b>${escHtml(email)}</b></p>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:.82rem;color:var(--muted);margin-bottom:4px;">Passwort</label>
        <div style="position:relative;">
          <input type="password" id="login-pw" placeholder="Passwort eingeben"
            style="width:100%;padding:10px 12px;padding-right:40px;border:1px solid var(--border);border-radius:8px;font-size:1rem;font-family:inherit;"
            onkeydown="if(event.key==='Enter')submitLogin()">
          <button type="button" onclick="var p=document.getElementById('login-pw');p.type=p.type==='password'?'text':'password';this.textContent=p.type==='password'?'👁️':'🙈'"
            style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:1.1rem;cursor:pointer;padding:4px;">👁️</button>
        </div>
      </div>
      <button type="button" onclick="submitLogin()" style="width:100%;padding:10px;background:var(--dachziegel);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;">Anmelden</button>
      <div id="login-error" style="color:var(--dachziegel);font-size:.82rem;margin-top:12px;display:none;"></div>
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
  setTimeout(()=>{ const pw=document.getElementById('login-pw'); if(pw) pw.focus(); }, 100);
}
function submitLogin(){
  const email = (document.getElementById('login-email').value||'').trim();
  const pw = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');
  if(!email || !pw){ if(errEl){ errEl.textContent='Bitte E-Mail und Passwort eingeben.'; errEl.style.display='block'; } return; }
  if(!window.__firebaseSignIn){ if(errEl){ errEl.textContent='Anmeldung ist noch nicht bereit, bitte kurz warten und erneut versuchen.'; errEl.style.display='block'; } return; }
  window.__firebaseSignIn(email, pw).catch(err=>{
    if(errEl){ errEl.textContent='Anmeldung fehlgeschlagen: '+(err && err.message ? err.message : err); errEl.style.display='block'; }
  });
}

function editBaumWithLogin(id){
  if(isAdmin()){
    openBaumEditForm(id);
    return;
  }
  if(isEditMode()){
    openBaumEditForm(id);
    return;
  }
  showLoginDialog();
}
function editSorteWithLogin(sorteName){
  if(isAdmin()){
    openSortenEditForm(sorteName);
    return;
  }
  if(isEditMode()){
    openSortenEditForm(sorteName);
    return;
  }
  showLoginDialog();
}

const FELDER = [
  {key:'id',         label:'ID-Nummer',          full:false},
  {key:'sorte',      label:'Sorte',               full:false},
  {key:'frucht',     label:'Obstart',             full:false, type:'select', opts:['Apfel','Birne','Walnuss','Quitte','Kirsche','Pflaume','Marille','Sonstiges']},
  {key:'verwendung', label:'Verwendung',          full:true,  type:'checkboxgroup', opts:VERWENDUNG_OPTIONEN},
  {key:'unterlage',  label:'Wurzelunterlage',     full:false},
  {key:'veredelt',   label:'Veredelungsjahr',     full:false},
  {key:'ausgepflanzt',label:'Pflanzjahr',         full:false},
  {key:'standort_zeile',label:'Standortzeile',    full:false},
  {key:'pflueckzeitpunkt',label:'Pflückzeitpunkt',full:false},
  {key:'genussreife',label:'Genussreife',         full:false},
  {key:'lagerfaehig',label:'Lagerfähigkeit',      full:false},
  {key:'ertrag',     label:'Ertrag',              full:false},
  {key:'befruchtungspartner',label:'Befruchtungspartner', full:false},
  {key:'geschmack',  label:'Geschmack / Nutzung', full:true,  type:'textarea'},
  {key:'eigenschaften',label:'Eigenschaften / Standortansprüche', full:true, type:'textarea'},
  {key:'herkunft_jahr',label:'Herkunft & Jahr',   full:true},
  {key:'synonyme',   label:'Synonyme',            full:false},
];

function buildEditForm(t, isNew, isSort){
  const felder = isSort
    ? FELDER.filter(f => SORTEN_EDIT_KEYS.includes(f.key))
    : FELDER;
  return `
    <div class="edit-form">
      ${felder.map(f=>{
        const val = (t && t[f.key]) ? t[f.key] : '';
        const cls = f.full ? ' full' : '';
        if(f.type==='textarea'){
          return `<div class="${cls}"><label>${f.label}</label><textarea name="${f.key}">${escHtml(String(val))}</textarea></div>`;
        } else if(f.type==='select'){
          const opts = f.opts.map(o=>`<option${o===val?' selected':''}>${o}</option>`).join('');
          return `<div class="${cls}"><label>${f.label}</label><select name="${f.key}"><option value="">– wählen –</option>${opts}</select></div>`;
        } else if(f.type==='checkboxgroup'){
          const current = (t && t[f.key]) || [];
          const boxes = f.opts.map(o=>`<label style="margin-right:12px;font-weight:400;display:inline-block;">
            <input type="checkbox" name="${f.key}" value="${o}" ${current.includes(o)?'checked':''}> ${o}
          </label>`).join('');
          return `<div class="${cls}"><label>${f.label}</label><div>${boxes}</div></div>`;
        } else {
          return `<div class="${cls}"><label>${f.label}</label><input type="text" name="${f.key}" value="${escAttr(String(val))}"></div>`;
        }
      }).join('')}
    </div>`;
}

function formValues(formEl, isSort){
  const felder = isSort
    ? FELDER.filter(f => SORTEN_EDIT_KEYS.includes(f.key))
    : FELDER;
  const out = {};
  felder.forEach(f=>{
    if(f.type==='checkboxgroup'){
      const boxes = formEl.querySelectorAll(`[name="${f.key}"]:checked`);
      out[f.key] = Array.from(boxes).map(b=>b.value);
      return;
    }
    const el = formEl.querySelector(`[name="${f.key}"]`);
    if(el) out[f.key] = el.value.trim();
  });
  return out;
}

function openBaumEditForm(id){
  const t = getTree(id);
  if(!t) return;
  const tForForm = Object.assign({}, t, { verwendung: getVerwendung(t) });
  const html = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h2>✏️ Baum bearbeiten <span class="idbadge">${t.id_placeholder? 'ID noch offen' : 'ID '+t.id}</span></h2>
    <p style="font-size:.82rem;color:var(--muted);">Änderungen werden lokal gespeichert — Original-Importdaten bleiben erhalten.</p>
    <form id="baum-edit-form">${buildEditForm(tForForm, false)}</form>
    <div class="edit-actions">
      <button class="btn" onclick="saveBaumEdit('${id}')">💾 Speichern</button>
      <button class="btn secondary" onclick="closeModal()">Abbrechen</button>
      ${t.id_placeholder ? '' : `<button class="btn danger" onclick="confirmDeleteBaum('${id}')">🗑 Baum löschen</button>`}
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
}

function openBaumAddForm(){
  const html = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h2><img src="icons/seedling.svg" width="20" height="20" style="vertical-align:-4px;margin-right:4px;" alt="">Neuen Baum hinzufügen</h2>
    <p style="font-size:.82rem;color:var(--muted);">Der neue Baum wird lokal gespeichert und erscheint sofort im Kataster. Bei Eingabe einer bekannten Sorte werden die Felder automatisch ausgefüllt.</p>
    <form id="baum-edit-form">${buildEditForm(null, true)}</form>
    <div class="edit-actions">
      <button class="btn" onclick="saveNewBaum()"><img src="icons/tree.svg" width="13" height="13" style="vertical-align:-2px;margin-right:4px;" alt="">Baum anlegen</button>
      <button class="btn secondary" onclick="closeModal()">Abbrechen</button>
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
  initSorteAutocomplete();
}

const SORTEN_EDIT_KEYS = ['frucht','verwendung','pflueckzeitpunkt','genussreife','lagerfaehig','ertrag','befruchtungspartner','geschmack','eigenschaften','herkunft_jahr','synonyme','frucht_beschreibung','standort_anspruch','unterlage','veredelt','ausgepflanzt'];
function openSortenEditForm(sorteName){
  const s = getSorte(sorteName);
  if(!s) return;
  const editData = Object.assign({}, s, state.sortenEdits[sorteName]||{});
  const html = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h2>✏️ Sorte bearbeiten <span style="font-size:.82rem;color:var(--muted);font-weight:400;">${escHtml(sorteName)}</span></h2>
    <p style="font-size:.82rem;color:var(--muted);">Änderungen werden lokal gespeichert — Original-Importdaten bleiben erhalten.</p>
    <form id="sorten-edit-form">${buildEditForm(editData, false, true)}</form>
    <div class="edit-actions">
      <button class="btn" onclick="saveSortenEdit('${escAttr(sorteName)}')">💾 Speichern</button>
      <button class="btn secondary" onclick="closeModal()">Abbrechen</button>
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
}
function saveSortenEdit(sorteName){
  const form = document.getElementById('sorten-edit-form');
  if(!form) return;
  const vals = formValues(form, true);
  if(!state.sortenEdits) state.sortenEdits = {};
  state.sortenEdits[sorteName] = Object.assign({}, state.sortenEdits[sorteName]||{}, vals);
  saveState();
  closeModal();
  openSortenModal(sorteName);
}

const BAUM_INDIVIDUAL_KEYS = ['id','sorte','unterlage','veredelt','ausgepflanzt','standort_zeile'];

function initSorteAutocomplete(){
  const form = document.getElementById('baum-edit-form');
  if(!form) return;
  const sorteEl = form.querySelector('[name="sorte"]');
  if(!sorteEl) return;
  const wrap = document.createElement('div');
  wrap.className = 'sorte-ac-wrap';
  sorteEl.parentNode.insertBefore(wrap, sorteEl);
  wrap.appendChild(sorteEl);
  const list = document.createElement('div');
  list.className = 'sorte-ac-list';
  wrap.appendChild(list);
  sorteEl.addEventListener('input', function(){
    const q = this.value.trim().toLowerCase();
    if(q.length < 2){ list.classList.remove('open'); list.innerHTML=''; return; }
    const matches = SORTEN_DATA.filter(s => s.sorte && s.sorte.toLowerCase().includes(q)).slice(0,8);
    if(!matches.length){ list.classList.remove('open'); list.innerHTML=''; return; }
    list.innerHTML = matches.map((s,i) =>
      '<div class="sorte-ac-item" data-idx="'+i+'">'+s.sorte+(s.frucht?' <small>'+s.frucht+'</small>':'')+'</div>'
    ).join('');
    list.classList.add('open');
    list._matches = matches;
  });
  list.addEventListener('click', function(e){
    const item = e.target.closest('.sorte-ac-item');
    if(!item) return;
    const match = list._matches[parseInt(item.dataset.idx)];
    if(!match) return;
    sorteEl.value = match.sorte;
    list.classList.remove('open');
    list.innerHTML='';
    applySortToForm(form, match);
  });
  sorteEl.addEventListener('blur', function(){
    setTimeout(()=>{ list.classList.remove('open'); }, 150);
  });
}

function applySortToForm(form, match){
  FELDER.forEach(f => {
    if(BAUM_INDIVIDUAL_KEYS.includes(f.key)) return;
    if(f.type === 'checkboxgroup'){
      const boxes = form.querySelectorAll('[name="'+f.key+'"]');
      const val = match[f.key];
      boxes.forEach(cb => { cb.checked = Array.isArray(val) && val.includes(cb.value); });
    } else {
      const el = form.querySelector('[name="'+f.key+'"]');
      if(el && match[f.key]) el.value = match[f.key];
    }
  });
}

function saveBaumEdit(id){
  const form = document.getElementById('baum-edit-form');
  if(!form) return;
  const vals = formValues(form);
  if(!state.baumEdits) state.baumEdits = {};
  state.baumEdits[id] = Object.assign({}, state.baumEdits[id] || {}, vals);
  if(vals.sorte && vals.verwendung){
    if(!state.sortenEdits) state.sortenEdits = {};
    if(!state.sortenEdits[vals.sorte]) state.sortenEdits[vals.sorte] = {};
    state.sortenEdits[vals.sorte].verwendung = vals.verwendung;
  }
  saveState();
  closeModal();
  refreshFilterOptions();
  renderBaumTable();
}

function saveNewBaum(){
  const form = document.getElementById('baum-edit-form');
  if(!form) return;
  const vals = formValues(form);
  if(!vals.sorte){ alert('Bitte zumindest eine Sortenbezeichnung eingeben.'); return; }
  // Eigene ID verwenden, oder NEU-n generieren
  if(!vals.id || vals.id.trim()===''){
    const existing = getAllTrees().map(t=>t.id);
    let n = 1;
    while(existing.includes('NEU-'+n)) n++;
    vals.id = 'NEU-'+n;
  }
  vals.id_placeholder = false;
  if(!state.customTrees) state.customTrees = [];
  state.customTrees.push(vals);
  if(vals.sorte && vals.verwendung){
    if(!state.sortenEdits) state.sortenEdits = {};
    if(!state.sortenEdits[vals.sorte]) state.sortenEdits[vals.sorte] = {};
    state.sortenEdits[vals.sorte].verwendung = vals.verwendung;
  }
  saveState();
  closeModal();
  refreshFilterOptions();
  renderBaumTable();
}

function confirmDeleteBaum(id){
  const t = getTree(id);
  const inBaumData = BAUM_DATA.some(b=>b.id===id);
  const isCustom = (state.customTrees||[]).find(c=>c.id===id);
  const fullRemove = isCustom || !inBaumData;
  if(!confirm(`Baum "${t? t.sorte : id}" wirklich löschen?${fullRemove? '' : '\n\nBei importierten Bäumen werden nur die lokalen Bearbeitungen zurückgesetzt.'}`)) return;
  const savedTree = isCustom ? JSON.parse(JSON.stringify(isCustom)) : null;
  const savedPos = state.positions?.[id] ? Object.assign({}, state.positions[id]) : null;
  const savedSatPos = state.satPositions?.[id] ? Object.assign({}, state.satPositions[id]) : null;
  const savedEdit = state.baumEdits?.[id] ? Object.assign({}, state.baumEdits[id]) : null;
  if(isCustom){
    state.customTrees = state.customTrees.filter(c=>c.id!==id);
  }
  if(state.baumEdits && state.baumEdits[id]) delete state.baumEdits[id];
  if(state.positions && state.positions[id]) delete state.positions[id];
  if(state.satPositions && state.satPositions[id]) delete state.satPositions[id];
  saveState();
  closeModal();
  refreshFilterOptions();
  renderBaumTable();
  if(savedTree){
    setUndo('baum', {id, tree: savedTree, pos: savedPos, satPos: savedSatPos, edit: savedEdit});
  }
}

/* ---------- Init (nach Laden der externen Grunddaten) ---------- */
function startApp(){
  initState();
  /* State aufräumen: nicht mehr existierende Baum-IDs entfernen */
  const baumIds = new Set(BAUM_DATA.map(b=>b.id));
  let changed = false;
  /* customTrees die nicht mehr in BAUM_DATA stehen oder blacklisted sind */
  if(state.customTrees && state.customTrees.length){
    const before = state.customTrees.length;
    state.customTrees = state.customTrees.filter(c=>!BLACKLIST.has(c.id) && (baumIds.has(c.id) || c.id.startsWith('NEU-')));
    if(state.customTrees.length !== before) changed = true;
  }
  /* baumEdits für nicht mehr existierende IDs */
  if(state.baumEdits){
    for(const k of Object.keys(state.baumEdits)){
      if(BLACKLIST.has(k) || (!baumIds.has(k) && !k.startsWith('NEU-'))){ delete state.baumEdits[k]; changed = true; }
    }
  }
  /* Positionen für nicht mehr existierende IDs */
  if(state.positions){
    for(const k of Object.keys(state.positions)){
      if(BLACKLIST.has(k) || (!baumIds.has(k) && !k.startsWith('NEU-'))){ delete state.positions[k]; changed = true; }
    }
  }
  if(state.satPositions){
    for(const k of Object.keys(state.satPositions)){
      if(BLACKLIST.has(k) || (!baumIds.has(k) && !k.startsWith('NEU-'))){ delete state.satPositions[k]; changed = true; }
    }
  }
  if(changed) saveState();
  /* Alten, gerätelokalen Warenkorb übernehmen — läuft nur beim ersten Mal je Gerät
     etwas, danach ist der Schlüssel weg. Vor dem Aufbau der Arbeitskopie. */
  migriereAltenWarenkorb();
  ladeMerklisten();
  refreshFilterOptions();
  applyEditModeUI();
  renderBaumTable();
  renderResults();
  renderUnplacedSelect();
  renderImportTemplates();
  renderSortenlistenSichtbar();
  if(window.__pendingRemoteState){ const r = window.__pendingRemoteState; window.__pendingRemoteState = null; applyRemoteState(r); }
  showWelcomeBannerIfNeeded();
  const lo=document.getElementById('loading-overlay');
  if(lo){ lo.style.opacity='0'; setTimeout(()=>lo.remove(), 400); }
}

function showWelcomeBannerIfNeeded(){
  const trees=getAllTrees();
  if(trees.length>0) return;
  
  const banner=document.createElement('div');
  banner.className='welcome-banner';
  banner.innerHTML=`
    <h2>Willkommen bei der Obstdatenbank!</h2>
    <p>Diese App hilft dir, deine Obstbäume zu verwalten.</p>
    <div class="welcome-actions">
      <button class="btn" onclick="activateTab('sortenberater')">Sortenberater öffnen</button>
      <button class="btn secondary" onclick="activateTab('hilfe')">Hilfe anzeigen</button>
    </div>
  `;
  
  const main=document.querySelector('main');
  if(main) main.prepend(banner);
}
/* Warten, bis alle Skriptdateien geladen und ausgewertet sind.

   Solange alles in einem einzigen Script-Block lag, war beim Eintreffen der
   Grunddaten zwangsläufig jede Funktion vorhanden. Seit der Trennung in Dateien
   (F6) ist das ein Wettlauf: berater.js und shop.js werden noch geholt, während
   die Grunddaten schon da sein können. startApp() ruft ladeMerklisten() aus
   shop.js — ohne dieses Warten scheitert der Start mit „ladeMerklisten is not
   defined", je nach Netzgeschwindigkeit mal so, mal so.

   DOMContentLoaded tritt erst ein, wenn alle klassischen <script src> ausgewertet
   sind; danach ist alles definiert. */
function _alleSkripteGeladen(){
  return document.readyState === 'loading'
    ? new Promise(fertig => document.addEventListener('DOMContentLoaded', fertig, {once:true}))
    : Promise.resolve();
}

window.__dataReady = false;
window.__dataReadyPromise = Promise.all([
  fetch('data/baum_data.json').then(r=>{ if(!r.ok) throw new Error('baum_data.json '+r.status); return r.json(); }),
  fetch('data/sorten_data.json').then(r=>{ if(!r.ok) throw new Error('sorten_data.json '+r.status); return r.json(); }),
  fetch('data/seed_positions.json').then(r=>{ if(!r.ok) throw new Error('seed_positions.json '+r.status); return r.json(); })
]).then(([baum, sorten, seed])=>{
  BAUM_DATA = baum; SORTEN_DATA = sorten; SEED_POSITIONS = seed;
  invalidateTreeCache();   /* Katalog ist erst jetzt da */
  window.__dataReady = true;
  return _alleSkripteGeladen();
}).then(()=>{
  startApp();
}).catch(err=>{
  console.error('Grunddaten konnten nicht geladen werden:', err);
  alert('Die Grunddaten (data/baum_data.json, sorten_data.json, seed_positions.json) konnten nicht geladen werden. Bitte Internetverbindung prüfen und die Seite neu laden.\n\nDetails: '+err.message);
});

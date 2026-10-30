/* start.js — Hendlberghof Obstdatenbank
   Anmeldung, Bearbeitungsmodus und Start: laedt die Grunddaten und ruft startApp()

   Aus einer einzelnen Datei herausgeloest (F6). Die Ladereihenfolge in
   index.html entspricht exakt der frueheren Reihenfolge im Script-Block und
   darf nicht veraendert werden: Ueber Dateigrenzen hinweg gibt es kein
   Hoisting mehr, und start.js setzt window.__dataReadyPromise, das berater.js
   beim Laden bereits liest. */

/* ---------- Tiefe Verweise (A2) ----------
   Ein QR-Code am Baum soll dessen Karte öffnen, nicht die Gesamtliste. Der
   Besucher steht vor genau diesem Baum — ihn erst suchen zu lassen, verschenkt
   den Moment, in dem das Interesse entsteht.

     ?baum=W20        öffnet die Baumkarte
     ?sorte=Rubinette öffnet die Sortenkarte

   Gross- und Kleinschreibung sind gleichgültig: QR-Codes werden im
   alphanumerischen Modus dichter und damit auf kleinen Etiketten besser
   lesbar, wenn sie durchgehend gross geschrieben sind.

   Unbekannte Werte führen nicht ins Leere, sondern melden sich — ein Etikett
   an einem umgesetzten oder umbenannten Baum darf keine stumme Seite zeigen. */
function tiefenVerweisOeffnen(){
  let p;
  try { p = new URLSearchParams(window.location.search); } catch(e){ return; }
  const baum = (p.get('baum') || p.get('BAUM') || '').trim();
  const sorte = (p.get('sorte') || p.get('SORTE') || '').trim();
  if(!baum && !sorte) return;

  if(baum){
    const t = getAllTrees().find(x => String(x.id).toLowerCase() === baum.toLowerCase());
    if(t){ activateTab('baumkataster'); openBaumModal(t.id); return; }
    showToast(`Baum „${baum}“ ist im Kataster nicht (mehr) verzeichnet.`, 'error', 5000);
    return;
  }
  const treffer = SORTEN_DATA.find(s => s.sorte.toLowerCase() === sorte.toLowerCase())
    || (typeof AN_SORTEN !== 'undefined'
        && AN_SORTEN.find(a => a.name.toLowerCase() === sorte.toLowerCase()));
  if(treffer){ openSortenModal(treffer.sorte || treffer.name); return; }
  showToast(`Sorte „${sorte}“ ist nicht hinterlegt.`, 'error', 5000);
}

/* ---------- Login & Edit-Modus ---------- */
function applyEditModeUI(){
  const on = isEditMode();
  const admin = isAdmin();
  /* Anmelden ist ein Symbol (v127); angemeldet zeigt ein goldener Punkt das an –
     der grüne Balken darüber ist weggefallen. */
  document.querySelectorAll('.btn-login-toggle').forEach(b=>{
    const text = on ? (admin ? 'Angemeldet als Admin – abmelden' : 'Angemeldet – abmelden') : 'Anmelden';
    b.title = text; b.setAttribute('aria-label', text);
    b.classList.toggle('angemeldet', on);
  });
  document.getElementById('btn-add-baum').style.display = admin ? '' : 'none';
  document.getElementById('tab-btn-daten').style.display = admin ? '' : 'none';
  document.getElementById('tab-btn-pruefung').style.display = on ? '' : 'none';
  if(typeof renderPruefung === 'function') renderPruefung();   /* leert den Reiter beim Abmelden */
  /* Arche-Noah-Sorten und der Quellen-Filter nur für den Admin (v132). */
  if(typeof _sortenCache !== 'undefined') _sortenCache = null;
  const qSel = document.getElementById('sb-filter-quelle');
  if(qSel){ qSel.hidden = !admin; if(!admin) qSel.value = ''; }
  if(typeof renderBaumfinder === 'function') renderBaumfinder();
  const cardPl = document.getElementById('card-preislisten');
  if(cardPl) cardPl.style.display = admin ? '' : 'none';
  const cardBh = document.getElementById('card-bestellhistorie');
  if(cardBh) cardBh.style.display = admin ? '' : 'none';
  /* Frühstart: Firebase meldet die Anmeldung oft, bevor die Grunddaten geladen
     sind und initState() gelaufen ist. Ohne state brach renderBaumTable() hier
     mit „reading 'customTrees'“ ab — und alles danach blieb ungetan. Knöpfe und
     Banner oben sind gesetzt; den Rest holt startApp() mit seinem eigenen
     Aufruf von applyEditModeUI() nach, sobald die Daten da sind. */
  if(!state) return;
  if(!on && (document.getElementById('tab-daten').style.display!=='none'
             || document.getElementById('tab-pruefung').style.display!=='none')){
    activateTab('baumkataster');
  }
  renderBaumTable();
  renderPins();
  if(typeof renderPhaenoBox === 'function') renderPhaenoBox();
  const zeigeEdit = on;
  const placeBtn = document.getElementById('btn-place-mode');
  const unplacedSel = document.getElementById('unplaced-select');
  if(placeBtn) placeBtn.style.display = zeigeEdit ? '' : 'none';
  if(unplacedSel) unplacedSel.parentElement.style.display = zeigeEdit ? '' : 'none';   /* Suchfeld samt „Nächster“ (v137) */
  const gpsPlaceBtn = document.getElementById('btn-gps-place');
  /* GPS nur auf Geräten mit Finger-Bedienung (Handy, Tablet) – am Rechner setzt man per Klick */
  const mitFinger = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if(gpsPlaceBtn) gpsPlaceBtn.style.display = zeigeEdit && mapLayer==='sat' && mitFinger ? '' : 'none';
  const karteBtn = document.getElementById('btn-karte-bearbeiten');
  if(karteBtn) karteBtn.style.display = isAdmin() && mapLayer==='sat' ? '' : 'none';
  if(typeof _kb !== 'undefined' && _kb && !isAdmin()) kbEnde();
  const hint = document.getElementById('lageplan-hint');
  if(hint) hint.style.display = on ? '' : 'none';
  if(!on){
    placeMode = false;
    if(satMap) satMap.dragging.enable();
    const placeLabel = document.getElementById('place-mode-label');
    if(placeLabel) placeLabel.textContent = 'Position setzen';
    const st = document.getElementById('place-status');
    if(st) st.textContent = '';
    /* Nur Bearbeitungsmasken schliessen. Baum- und Sortenkarten sind reine
       Ansicht — sie wegzunehmen, weil die Anmeldung sich meldet, wuerde
       ausgerechnet den QR-Besucher treffen: Seine Karte oeffnet beim Start und
       das Firebase-Ereignis kaeme Sekundenbruchteile spaeter. */
    const mt = (document.getElementById('modal-content') || {}).dataset || {};
    if(mt.modalType !== 'baum' && mt.modalType !== 'sorte') closeModal();
  }
  /* Beim An- und Abmelden wechselt die Merkliste den Topf (A3) — die Ansicht
     muss dem folgen, sonst zeigt sie die Liste des anderen Zustands. */
  if(typeof merklistenNeuLaden === 'function') merklistenNeuLaden();
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
    <button class="close" onclick="closeModal()" aria-label="Schließen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    <h2>Anmeldung</h2>
    <p style="margin:12px 0 16px;color:var(--muted);font-size:.9rem;">Rolle wählen:</p>
    <div style="display:flex;flex-direction:column;gap:10px;max-width:280px;">
      <button class="btn" onclick="loginAsRole('admin')" style="text-align:left;padding:14px 18px;">
        <b>Admin</b><br><span style="font-size:.82rem;color:var(--muted);">Voller Zugriff auf alle Funktionen</span>
      </button>
      <button class="btn" onclick="loginAsRole('mitarbeiter')" style="text-align:left;padding:14px 18px;">
        <b>Mitarbeiter:in</b><br><span style="font-size:.82rem;color:var(--muted);">Ernte, Beobachtungen, Phänologie</span>
      </button>
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
}

/* Echtes <form> mit Benutzername- und Passwortfeld: Nur so bietet Safari an,
   das Passwort im Schlüsselbund zu sichern, und füllt es beim nächsten Mal per
   Face ID / Touch ID ein. Ein verstecktes Feld (type=hidden) erkennt Safari
   nicht als Benutzernamen — deshalb steht die Adresse sichtbar, aber gesperrt. */
function loginAsRole(role){
  pendingLoginRole = role;
  const email = LOGIN_ACCOUNTS[role];
  closeModal();
  const html = `
    <button class="close" onclick="closeModal()" aria-label="Schließen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    <h2>Anmeldung — ${role==='admin'?'Admin':'Mitarbeiter:in'}</h2>
    <form id="login-form" class="login-form" autocomplete="on" onsubmit="event.preventDefault();submitLogin();">
      <label for="login-email">Konto</label>
      <input type="email" id="login-email" name="username" autocomplete="username" value="${escAttr(email)}" readonly>
      <label for="login-pw">Passwort</label>
      <div class="login-pw-wrap">
        <input type="password" id="login-pw" name="password" autocomplete="current-password" placeholder="Passwort eingeben" required>
        <button type="button" class="login-pw-zeigen" onclick="loginPasswortZeigen(this)" aria-label="Passwort zeigen">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <button type="submit" class="login-senden">Anmelden</button>
      <div id="login-error" class="login-meldung fehler" style="display:none;"></div>
      <button type="button" class="login-vergessen" onclick="passwortVergessen()">Passwort vergessen?</button>
      <div id="login-info" class="login-meldung" style="display:none;"></div>
    </form>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
  setTimeout(()=>{ const pw=document.getElementById('login-pw'); if(pw) pw.focus(); }, 100);
}
function loginPasswortZeigen(btn){
  const pw = document.getElementById('login-pw');
  const zeigen = pw.type === 'password';
  pw.type = zeigen ? 'text' : 'password';
  btn.setAttribute('aria-label', zeigen ? 'Passwort verbergen' : 'Passwort zeigen');
  btn.classList.toggle('aktiv', zeigen);
}
/* Firebase-Fehlercodes in Sätze, mit denen man etwas anfangen kann. */
function loginFehlertext(err){
  const code = (err && err.code) || '';
  if(code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-login-credentials')
    return 'Passwort stimmt nicht. Unten „Passwort vergessen?“ schickt einen Link zum Neusetzen.';
  if(code === 'auth/too-many-requests') return 'Zu viele Versuche — bitte ein paar Minuten warten.';
  if(code === 'auth/network-request-failed') return 'Keine Verbindung. Anmelden geht nur mit Internet.';
  if(code === 'auth/user-not-found') return 'Dieses Konto gibt es nicht.';
  return `Anmeldung fehlgeschlagen: ${(err && err.message) || err}`;
}
function submitLogin(){
  const email = (document.getElementById('login-email').value||'').trim();
  const pw = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');
  const zeige = text => { if(errEl){ errEl.textContent = text; errEl.style.display = 'block'; } };
  if(!email || !pw){ zeige('Bitte das Passwort eingeben.'); return; }
  if(!window.__firebaseSignIn){ zeige('Anmeldung ist noch nicht bereit, bitte kurz warten und erneut versuchen.'); return; }
  window.__firebaseSignIn(email, pw).catch(err=> zeige(loginFehlertext(err)));
}
/* Schickt den Link zum Neusetzen an die Konto-Adresse. Firebase stellt die
   Seite dafür selbst bereit — hier muss nichts gehostet werden. Ob die Adresse
   existiert, verrät Firebase absichtlich nicht; die Meldung bleibt daher neutral. */
function passwortVergessen(){
  const email = (document.getElementById('login-email').value||'').trim();
  const info = document.getElementById('login-info');
  const errEl = document.getElementById('login-error');
  if(errEl) errEl.style.display = 'none';
  if(!window.__firebasePasswortReset){ showToast('Anmeldung ist noch nicht bereit — bitte kurz warten.', 'error', 4000); return; }
  if(!confirm(`Link zum Neusetzen des Passworts an ${email} schicken?`)) return;
  window.__firebasePasswortReset(email).then(()=>{
    info.textContent = `E-Mail an ${email} ist unterwegs. Den Link darin öffnen, neues Passwort festlegen und hier anmelden. Nichts angekommen? Spam-Ordner prüfen.`;
    info.style.display = 'block';
  }).catch(err=>{
    if(errEl){ errEl.textContent = loginFehlertext(err); errEl.style.display = 'block'; }
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
  {key:'frucht',     label:'Obstart',             full:false, type:'vorschlag', vorschlaege:()=>obstartVorschlaege()},
  {key:'verwendung', label:'Verwendung',          full:true,  type:'checkboxgroup', opts:VERWENDUNG_OPTIONEN},
  {key:'unterlage',  label:'Wurzelunterlage',     full:false},
  {key:'veredelt',   label:'Veredelungsjahr',     full:false},
  {key:'ausgepflanzt',label:'Pflanzjahr',         full:false},
  {key:'standort_zeile',label:'Standortzeile',    full:false},
  {key:'pflueckzeitpunkt',label:'Pflückzeitpunkt',full:false},
  {key:'genussreife',label:'Genussreife',         full:false},
  {key:'lagerfaehig',label:'Lagerfähigkeit',      full:false},
  {key:'ertrag',     label:'Ertrag',              full:false},
  {key:'befruchtungspartner',label:'Befruchtungspartner', full:true},
  {key:'geschmack',  label:'Geschmack',           full:true,  type:'textarea'},
  /* nurSorte: gehört zur Sorte, nicht zum einzelnen Baum (v136) */
  {key:'eignung',    label:'Eignung',             full:true,  type:'textarea', nurSorte:true},
  {key:'eigenschaften',label:'Eigenschaften / Standortansprüche', full:true, type:'textarea'},
  {key:'herkunft_jahr',label:'Herkunft & Jahr',   full:true},
  {key:'synonyme',   label:'Synonyme',            full:true},
];

/* Obstart als Eingabe mit Vorschlägen statt fester Liste (v129): Die Liste
   kannte nur acht Arten, Che, Zwetschke, Mispel usw. ließen sich nicht wählen.
   Vorschläge = Arten der vorhandenen Bäume (häufigste zuerst), dann die aus
   OBSTART_GRUPPE; gleiche Art in anderer Schreibweise nur einmal. */
function obstartVorschlaege(){
  const zahl = {};
  getAllTrees().forEach(b=>{ const f = String(b.frucht || '').trim(); if(f) zahl[f] = (zahl[f] || 0) + 1; });
  const liste = Object.keys(zahl).sort((a, b)=> zahl[b] - zahl[a] || a.localeCompare(b, 'de'));
  const gross = k => k.split(' ').map(w=> w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  Object.keys(OBSTART_GRUPPE).filter(k=> !k.includes('-')).sort((a, b)=> a.localeCompare(b, 'de')).forEach(k=> liste.push(gross(k)));
  const gesehen = new Set();
  return liste.filter(f=>{ const k = obstartSchluessel(f); if(gesehen.has(k)) return false; gesehen.add(k); return true; });
}

/* Vorschläge für die Felder im Formular (v140, Volkmar 30.10.2026): was bei
   Bäumen und Sorten schon steht, Häufigstes zuerst, gleiche Schreibweise nur einmal. */
function feldZaehlen(werte){
  const zahl = new Map();
  werte.forEach(wert=>{
    const w = String(wert == null ? '' : wert).trim();
    if(!w) return;
    const k = w.toLowerCase();
    const z = zahl.get(k) || {w, n:0};
    z.n++;
    zahl.set(k, z);
  });
  return Array.from(zahl.values()).sort((a, b)=> b.n - a.n || a.w.localeCompare(b.w, 'de')).map(z=> z.w);
}
function feldWerte(key){
  return getAllTrees().map(t=> t[key])
    .concat(SORTEN_DATA.map(s=> s[key]))
    .concat(Object.values(state.sortenEdits || {}).map(s=> s && s[key]));
}
function feldVorschlaege(key){
  if(key === 'standort_zeile') return katStdVorschlaege();
  const werte = feldWerte(key);
  return feldZaehlen(key === 'unterlage' ? werte.concat(PRUEF_UNTERLAGEN) : werte).slice(0, 300);
}
/* Lange Textfelder: eine <datalist> gibt es dort nicht, und ganze Beschreibungen
   helfen nicht weiter. Vorgeschlagen werden die einzelnen Begriffe, passend zum
   gerade getippten Wortanfang; tolerant gegenüber Umlauten und Mehrzahl. */
const _feldSuchform = s => String(s).toLowerCase().replace(/ä|ae/g, 'a').replace(/ö|oe/g, 'o').replace(/ü|ue/g, 'u').replace(/ß/g, 'ss');
function feldBegriffe(key){
  const teile = [];
  feldWerte(key).forEach(w=> String(w == null ? '' : w).split(/[,;]|\.\s/).forEach(t=>{
    const b = t.trim().replace(/\.$/, '');
    if(b.length >= 3 && b.length <= 40 && !/\s{2}/.test(b)) teile.push(b);
  }));
  return feldZaehlen(teile);
}
function initFeldBegriffe(){
  const form = document.getElementById('baum-edit-form');
  if(!form) return;
  form.querySelectorAll('textarea').forEach(feld=>{
    const begriffe = feldBegriffe(feld.name);
    const wrap = document.createElement('div');
    wrap.className = 'sorte-ac-wrap';
    feld.parentNode.insertBefore(wrap, feld);
    wrap.appendChild(feld);
    const list = document.createElement('div');
    list.className = 'sorte-ac-list';
    wrap.appendChild(list);
    const zu = () => { list.classList.remove('open'); list.innerHTML = ''; };
    const anfang = () => feld.value.slice(0, feld.selectionStart).match(/[^,;]*$/)[0];
    feld.addEventListener('input', ()=>{
      const roh = anfang().trim();
      if(roh.length < 2){ zu(); return; }
      const q = _feldSuchform(roh).replace(/(en|e|n|s)$/, '');
      const passend = begriffe.filter(b=> _feldSuchform(b).includes(q) && b.toLowerCase() !== roh.toLowerCase());
      /* Was so anfängt wie das Getippte, kommt zuerst. */
      const treffer = passend.filter(b=> _feldSuchform(b).startsWith(q)).concat(passend.filter(b=> !_feldSuchform(b).startsWith(q))).slice(0, 8);
      if(!treffer.length){ zu(); return; }
      list.innerHTML = treffer.map(b=> `<div class="sorte-ac-item">${escHtml(b)}</div>`).join('');
      list.classList.add('open');
    });
    /* mousedown statt click: Der Fokus bleibt im Feld, die Tastatur bleibt offen. */
    list.addEventListener('mousedown', ev=>{
      const item = ev.target.closest('.sorte-ac-item');
      if(!item) return;
      ev.preventDefault();
      const pos = feld.selectionStart;
      const vorn = feld.value.slice(0, pos - anfang().length);
      const luecke = vorn && !/\s$/.test(vorn) ? ' ' : '';
      const neu = `${vorn}${luecke}${item.textContent}, `;
      feld.value = neu + feld.value.slice(pos);
      feld.setSelectionRange(neu.length, neu.length);
      zu();
    });
    feld.addEventListener('blur', ()=> setTimeout(zu, 150));
  });
}

function buildEditForm(t, isNew, isSort){
  const felder = isSort
    ? FELDER.filter(f => SORTEN_EDIT_KEYS.includes(f.key))
    : FELDER.filter(f => !f.nurSorte);
  return `
    <div class="edit-form">
      ${felder.map(f=>{
        const val = (t && t[f.key]) ? t[f.key] : '';
        const cls = f.full ? ' full' : '';
        if(f.type==='textarea'){
          return `<div class="${cls}"><label>${f.label}</label><textarea name="${f.key}">${escHtml(String(val))}</textarea></div>`;
        } else if(f.type==='select'){
          /* Ein Wert außerhalb der Liste (Zwetschke, Mispel …) bleibt wählbar —
             sonst stünde die erste Option da, und Speichern machte Apfel daraus. */
          const optListe = val && !f.opts.includes(val) ? [val].concat(f.opts) : f.opts;
          const opts = optListe.map(o=>`<option${o===val?' selected':''}>${escHtml(o)}</option>`).join('');
          return `<div class="${cls}"><label>${f.label}</label><select name="${f.key}"><option value="">– wählen –</option>${opts}</select></div>`;
        } else if(f.type==='vorschlag'){
          const dl = `dl-edit-${f.key}`;
          return `<div class="${cls}"><label>${f.label}</label><input type="text" name="${f.key}" list="${dl}" autocomplete="off" value="${escAttr(String(val))}" placeholder="z. B. Apfel"><datalist id="${dl}">${f.vorschlaege().map(o=>`<option value="${escAttr(o)}">`).join('')}</datalist></div>`;
        } else if(f.type==='checkboxgroup'){
          const current = (t && t[f.key]) || [];
          const boxes = f.opts.map(o=>`<label style="margin-right:12px;font-weight:400;display:inline-block;">
            <input type="checkbox" name="${f.key}" value="${o}" ${current.includes(o)?'checked':''}> ${o}
          </label>`).join('');
          return `<div class="${cls}"><label>${f.label}</label><div>${boxes}</div></div>`;
        } else {
          /* Nicht bei der ID (sie muss neu sein) und nicht bei der Sorte im
             Neu-Formular: Dort füllt die eigene Liste auch die übrigen Felder. */
          const ohneListe = f.key === 'id' || (f.key === 'sorte' && isNew);
          const dl = `dl-edit-${f.key}`;
          return `<div class="${cls}"><label>${f.label}</label><input type="text" name="${f.key}"${ohneListe ? '' : ` list="${dl}" autocomplete="off"`} value="${escAttr(String(val))}">${ohneListe ? '' : `<datalist id="${dl}">${feldVorschlaege(f.key).map(o=>`<option value="${escAttr(o)}">`).join('')}</datalist>`}</div>`;
        }
      }).join('')}
    </div>`;
}

function formValues(formEl, isSort){
  const felder = isSort
    ? FELDER.filter(f => SORTEN_EDIT_KEYS.includes(f.key))
    : FELDER.filter(f => !f.nurSorte);
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
    <button class="close" onclick="closeModal()" aria-label="Schließen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    <h2>Baum bearbeiten <span class="idbadge">${t.id_placeholder? 'ID noch offen' : 'ID '+t.id}</span></h2>
    <p style="font-size:.82rem;color:var(--muted);">Änderungen werden lokal gespeichert — Original-Importdaten bleiben erhalten.</p>
    <form id="baum-edit-form">${buildEditForm(tForForm, false)}</form>
    <div class="edit-actions">
      <button class="btn" onclick="saveBaumEdit('${id}')">Speichern</button>
      <button class="btn secondary" onclick="closeModal()">Abbrechen</button>
      ${t.id_placeholder ? '' : `<button class="btn secondary" onclick="baumAbsterbenForm('${id}')">Baum ist abgestorben</button>`}
      ${t.id_placeholder ? '' : `<button class="btn danger" onclick="confirmDeleteBaum('${id}')">Baum löschen</button>`}
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
  initFeldBegriffe();
}

/* platzId: Nachpflanzen auf einem freien Platz. Nummer und Standort stehen schon fest,
   die Stecknadel bleibt, deshalb entfällt dort das Setzen. */
function openBaumAddForm(platzId){
  const frueher = platzId ? ((state.fruehereBaeume[platzId] || [])[0] || {}).baum || {} : null;
  const vorgabe = platzId ? { id:platzId, standort_zeile:frueher.standort_zeile || '' } : null;
  const hatLage = platzId && kartenPos(platzId);
  const html = `
    <button class="close" onclick="closeModal()" aria-label="Schließen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    <h2>${platzId ? `Platz ${escHtml(platzId)} neu bepflanzen` : 'Neuen Baum hinzufügen'}</h2>
    <p style="font-size:.82rem;color:var(--muted);">Der neue Baum wird lokal gespeichert und erscheint sofort im Kataster. Bei Eingabe einer bekannten Sorte werden die Felder automatisch ausgefüllt.</p>
    <form id="baum-edit-form">${buildEditForm(vorgabe, true)}</form>
    <div class="edit-actions">
      ${hatLage ? `<button class="btn" onclick="saveNewBaum()">Baum anlegen</button>` : `<button class="btn btn-breit" onclick="saveNewBaum(true)">Anlegen und <span class="nur-finger">per GPS</span><span class="nur-maus">auf der Karte</span> setzen</button>
      <button class="btn secondary" onclick="saveNewBaum()">Nur anlegen</button>`}
      <button class="btn secondary" onclick="closeModal()">Abbrechen</button>
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
  initSorteAutocomplete();
  initFeldBegriffe();
}

const SORTEN_EDIT_KEYS = ['frucht','verwendung','pflueckzeitpunkt','genussreife','lagerfaehig','ertrag','befruchtungspartner','geschmack','eignung','eigenschaften','herkunft_jahr','synonyme','frucht_beschreibung','standort_anspruch','unterlage','veredelt','ausgepflanzt'];
function openSortenEditForm(sorteName){
  const s = getSorte(sorteName);
  if(!s) return;
  const editData = Object.assign({}, s, state.sortenEdits[sorteName]||{});
  const html = `
    <button class="close" onclick="closeModal()" aria-label="Schließen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    <h2>Sorte bearbeiten <span style="font-size:.82rem;color:var(--muted);font-weight:400;">${escHtml(sorteName)}</span></h2>
    <p style="font-size:.82rem;color:var(--muted);">Änderungen werden lokal gespeichert — Original-Importdaten bleiben erhalten.</p>
    <form id="sorten-edit-form">${buildEditForm(editData, false, true)}</form>
    <div class="edit-actions">
      <button class="btn" onclick="saveSortenEdit('${escAttr(sorteName)}')">Speichern</button>
      <button class="btn secondary" onclick="closeModal()">Abbrechen</button>
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
  initFeldBegriffe();
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

/* mitSetzen: gleich danach in den Lageplan — am Handy mit GPS-Messung, die bei
   mehr als ±15 m nachfragt, am Rechner zum Klicken auf die Karte (v140). */
function saveNewBaum(mitSetzen){
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
  if(getTree(vals.id)){ alert(`Die Nummer ${vals.id} ist schon vergeben (${getTree(vals.id).sorte || 'ohne Sorte'}).`); return; }
  vals.id_placeholder = false;
  vals.quelle = 'app';
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
  if(!mitSetzen) return;
  positionSetzen(vals.id, false);
  if(_mitFinger()) document.getElementById('btn-gps-place').click();
}

/* ---------- Baum ist abgestorben (v142) ---------- */
function baumAbsterbenForm(id){
  const t = getTree(id);
  if(!t) return;
  const gruende = feldZaehlen(Object.values(state.fruehereBaeume || {}).flat().map(f=> f.grund)
    .concat(['Wühlmäuse', 'Frost', 'Trockenheit', 'Wildverbiss', 'Krankheit', 'Sturm']));
  document.getElementById('modal-content').innerHTML = `
    <button class="close" onclick="closeModal()" aria-label="Schließen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
    <h2>${escHtml(t.sorte || 'Baum')} · ${escHtml(id)} ist abgestorben</h2>
    <p style="font-size:.82rem;color:var(--muted);">Die Nummer und die Stecknadel bleiben am Ort, der Platz wird frei. Der Baum wandert mit Ernten und Beobachtungen in „Früher an diesem Platz“.</p>
    <div class="edit-form">
      <div><label>Jahr</label><input type="text" id="tot-jahr" inputmode="numeric" value="${new Date().getFullYear()}"></div>
      <div><label>Grund (optional)</label><input type="text" id="tot-grund" list="tot-gruende" autocomplete="off"><datalist id="tot-gruende">${gruende.map(g=>`<option value="${escAttr(g)}">`).join('')}</datalist></div>
    </div>
    <div class="edit-actions">
      <button class="btn" onclick="baumAbsterben('${escAttr(id)}')">Platz freigeben</button>
      <button class="btn secondary" onclick="openBaumEditForm('${escAttr(id)}')">Abbrechen</button>
    </div>`;
}
function baumAbsterben(id){
  const t = getTree(id);
  if(!t) return;
  const schluessel = katBaumEditSchluessel(id);
  const custom = (state.customTrees || []).find(c=> c.id === schluessel) || null;
  const edit = (state.baumEdits || {})[schluessel] || null;
  const ernten = state.ernten[id] || [], sukzession = state.sukzession[id] || [];
  if(!state.fruehereBaeume) state.fruehereBaeume = {};
  state.fruehereBaeume[id] = [{
    baum:JSON.parse(JSON.stringify(t)), schluessel,
    jahr:document.getElementById('tot-jahr').value.trim(), grund:document.getElementById('tot-grund').value.trim(),
    ernten, sukzession, zeit:new Date().toISOString()
  }].concat(state.fruehereBaeume[id] || []);
  state.customTrees = (state.customTrees || []).filter(c=> c.id !== schluessel);
  if(edit) delete state.baumEdits[schluessel];
  /* leere Liste statt löschen: Sonst brächte der Abgleich die alten Einträge zurück */
  state.ernten[id] = [];
  state.sukzession[id] = [];
  _mittelCache = null;
  saveState();
  refreshFilterOptions();
  renderBaumTable();
  renderSatMarkers();
  openPlatzModal(id);
  setUndo('baumTot', { id, schluessel, custom, edit, ernten, sukzession }, `Platz ${id} ist frei — `);
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
  /* customTrees die nicht mehr in BAUM_DATA stehen oder blacklisted sind —
     in der App angelegte Bäume und Übernahmen ausgenommen (siehe istEigenerBaum). */
  if(state.customTrees && state.customTrees.length){
    const before = state.customTrees.length;
    state.customTrees = state.customTrees.filter(c=>!BLACKLIST.has(c.id) && (baumIds.has(c.id) || c.id.startsWith('NEU-') || istEigenerBaum(c)));
    if(state.customTrees.length !== before) changed = true;
  }
  (state.customTrees || []).filter(istEigenerBaum).forEach(c=> baumIds.add(c.id));
  Object.keys(state.fruehereBaeume || {}).forEach(id=> baumIds.add(id));   /* freie Plätze behalten ihre Stecknadel */
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
  tiefenVerweisOeffnen();   /* nach applyEditModeUI — das schliesst sonst das Modal */
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

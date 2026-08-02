/* konfigurator.js — Hendlberghof Obstdatenbank
   Baum zusammenstellen: Unterlage, Stammform, 1–4 Sorten, Beratung, Preis.

   Neu angelegt mit S3. Laedt nach shop.js und greift auf kern (Obstart-Regeln),
   kataster (Bestellbarkeit, Merklisten) und berater (pfluckWertToText) zu — alle
   vorher geladen. Ueber Dateigrenzen hinweg gibt es kein Hoisting; die
   Reihenfolge in index.html ist bindend.

   Das Kernprodukt des Hofes ist nicht "eine Sorte", sondern ein Baum: eine frei
   waehlbare Unterlage mit bis zu vier aufveredelten Sorten. Deshalb wandert eine
   Konfiguration in die Merkliste, keine Sortenzeile. */

/* ---------- Produktionsdaten ----------
   Vorbelegt mit den Unterlagen, die am Hof tatsaechlich im Einsatz sind (aus
   baum_data: MM 106, M 26, Pyrodwarf, Quitte BA 29). Ueber state.produktion
   aenderbar, ohne den Code anzufassen — Grundlage fuer die Verwaltung (A1).

   Preise stehen bewusst auf null statt auf 0. Null heisst "noch nicht
   hinterlegt", und die Oberflaeche schreibt dann "Preis mit dem Angebot" statt
   "0,00 EUR". Eine erfundene Null waere eine Preisauskunft, die niemand gegeben
   hat. */
const PRODUKTION_STANDARD = {
  unterlagen: [
    { id:'saemling',   name:'Sämling',       frucht:'Apfel', wuchs:'stark',
      beschreibung:'Hochstamm, langlebig, standfest — für Streuobstwiese und Weide.' },
    { id:'mm106',      name:'MM 106',        frucht:'Apfel', wuchs:'mittelstark',
      beschreibung:'Halb- bis Hochstamm, gut standfest — die Unterlage der meisten Hofbäume.' },
    { id:'m26',        name:'M 26',          frucht:'Apfel', wuchs:'schwach',
      beschreibung:'Kleinkronig, trägt früh, braucht einen Pfahl — für kleine Gärten.' },
    { id:'birnensaemling', name:'Birnensämling', frucht:'Birne', wuchs:'stark',
      beschreibung:'Hochstamm, langlebig, tiefwurzelnd.' },
    { id:'pyrodwarf',  name:'Pyrodwarf',     frucht:'Birne', wuchs:'mittelstark',
      beschreibung:'Mittelstark, gut verträglich mit allen Birnensorten.' },
    { id:'quitteba29', name:'Quitte BA 29',  frucht:'Birne', wuchs:'schwach',
      beschreibung:'Schwachwachsend, trägt früh — nicht mit jeder Sorte verträglich.' }
  ],
  stammformen: [
    { id:'busch', name:'Buschbaum',  aufpreis:null, beschreibung:'Krone ab ca. 60 cm' },
    { id:'halb',  name:'Halbstamm',  aufpreis:null, beschreibung:'Krone ab ca. 120 cm' },
    { id:'hoch',  name:'Hochstamm',  aufpreis:null, beschreibung:'Krone ab ca. 180 cm — für Wiese und Weide' }
  ],
  grundpreis: null,
  aufpreis_je_veredelung: null,
  saison: { bestellschluss:'12-31', lieferjahr_offset:2 }
};

function getProduktion(){
  const eigen = (typeof state !== 'undefined' && state && state.produktion) || {};
  return Object.assign({}, PRODUKTION_STANDARD, eigen);
}

/* Lieferjahr: Edelreiser werden im Winter geschnitten, im Fruehjahr veredelt,
   danach ein bis zwei Jahre angezogen. Wer nach dem Bestellschluss bestellt,
   faellt in den naechsten Durchgang. */
function konfigLieferjahr(){
  const p = getProduktion();
  const heute = new Date();
  const teile = String((p.saison || {}).bestellschluss || '12-31').split('-').map(Number);
  const nachSchluss = (heute.getMonth() + 1 > teile[0])
    || (heute.getMonth() + 1 === teile[0] && heute.getDate() > teile[1]);
  return heute.getFullYear() + ((p.saison || {}).lieferjahr_offset || 2) + (nachSchluss ? 1 : 0);
}

/* ---------- Laufende Zusammenstellung ---------- */
let _konfig = null;

function konfiguratorOeffnen(sorteName, vorhandeneId){
  const s = getSorte(sorteName);
  const frucht = (s && s.frucht) || '';
  const regel = getObstartRegel(frucht);

  if(!regel.veredelung){
    showToast(regel.bekannt
      ? `Für ${frucht} wird derzeit keine Veredelung angeboten.`
      : `Obstart „${frucht}“ ist nicht hinterlegt.`, 'error', 4000);
    return;
  }
  if(!getBestellbarkeit(sorteName).eigenproduktion){
    showToast(getBestellbarkeit(sorteName).grund, 'error', 4000);
    return;
  }

  const unterlagen = getProduktion().unterlagen.filter(u => u.frucht === frucht);
  _konfig = {
    id: vorhandeneId || `K${Date.now().toString(36)}`,
    frucht,
    unterlage: unterlagen.length ? unterlagen[0].id : '',
    stammform: getProduktion().stammformen[0].id,
    sorten: [sorteName],
    menge: 1,
    notiz: ''
  };

  /* Beim Ändern den vorhandenen Stand laden. Ohne das begönne der Konfigurator
     bei der Basissorte und verwürfe die übrigen Sorten stillschweigend — der
     Kunde klickt „Ändern", will die Menge anpassen und verliert drei Sorten. */
  if(vorhandeneId){
    const alt = (getMerkliste(MERKLISTE_EIGEN).konfigurationen || [])
      .find(k => k.id === vorhandeneId);
    if(alt && alt.konfiguriert){
      const gueltig = (alt.sorten || [])
        .map(x => x.sorte)
        .filter(n => getBestellbarkeit(n).eigenproduktion);   /* zwischenzeitlich Gesperrtes fällt weg */
      if(gueltig.length) _konfig.sorten = gueltig;
      if(alt.unterlage_id && unterlagen.some(u => u.id === alt.unterlage_id))
        _konfig.unterlage = alt.unterlage_id;
      if(alt.stammform_id) _konfig.stammform = alt.stammform_id;
      _konfig.menge = alt.menge || 1;
      _konfig.notiz = alt.notiz || '';
    }
  }
  renderKonfigurator();
  document.getElementById('overlay').classList.add('open');
}

/* Sorten, die zusaetzlich auf diesen Baum duerfen: gleiche Obstart, selbst
   veredelbar, noch nicht gewaehlt. Die Obstart-Sperre ist hart — Apfel und Birne
   lassen sich nicht aufeinander veredeln. */
function konfigWaehlbareSorten(){
  if(!_konfig) return [];
  return SORTEN_DATA
    .filter(s => s.frucht === _konfig.frucht)
    .filter(s => _konfig.sorten.indexOf(s.sorte) < 0)
    .filter(s => getBestellbarkeit(s.sorte).eigenproduktion)
    .map(s => s.sorte)
    .sort((a, b) => a.localeCompare(b, 'de'));
}

/* ---------- Beratung ---------- */

/* Reifestaffel: Der staerkste Verkaufshebel und er kostet nichts, die Daten
   liegen vor. Ein Baum, der von August bis November traegt, ist etwas anderes
   als vier Sorten, die alle im Oktober gleichzeitig reif sind. */
const KONFIG_MONATE = ['', 'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function konfigReifestaffel(){
  const monate = [];
  (_konfig.sorten || []).forEach(n=>{
    const s = getSorte(n);
    const wert = s && (s.pflueckzeitpunkt || s.pflueck_reifezeit);
    const m = wert ? parseInt(String(wert).split(',')[0], 10) : 0;
    if(!m) return;
    /* pfluckWertToText braucht die Form „10,5" (Monat, Dekade). Sorten mit
       blosser Monatsangabe („8") liefern dort leeren Text — dann steht im
       Hinweis „von  bis  ". Deshalb der Rueckfall auf den Monatsnamen. */
    let text = (typeof pfluckWertToText === 'function') ? pfluckWertToText(wert) : '';
    if(!text || !text.trim()) text = KONFIG_MONATE[m] || String(wert);
    monate.push({ sorte:n, monat:m, text });
  });
  monate.sort((a, b) => a.monat - b.monat);
  const verschieden = new Set(monate.map(m => m.monat)).size;
  return { eintraege: monate, verschieden };
}

/* Befruchtung: Nennt eine Sorte die andere als Befruchter, ist das ein echter
   Vorteil des Mehrsortenbaums — die Bestaeubung passiert im selben Baum.
   Das Feld ist Freitext, deshalb wird nur auf Namensnennung geprueft. */
function konfigBefruchtung(){
  const paare = [];
  const namen = _konfig.sorten || [];
  for(let i = 0; i < namen.length; i++){
    for(let j = i + 1; j < namen.length; j++){
      const a = getSorte(namen[i]), b = getSorte(namen[j]);
      const nennt = (x, name) => x && x.befruchtungspartner
        && String(x.befruchtungspartner).toLowerCase().indexOf(String(name).toLowerCase().split(' ')[0]) >= 0;
      if(nennt(a, namen[j]) || nennt(b, namen[i])) paare.push([namen[i], namen[j]]);
    }
  }
  return paare;
}

/* Wuchsstaerke: Eine schwachwachsende Sorte auf demselben Baum wie eine starke
   wird ueberwachsen. Das Feld ist selten gefuellt — deshalb Hinweis, keine
   Sperre. */
function konfigWuchsWarnung(){
  const staerken = (_konfig.sorten || [])
    .map(n => (getSorte(n) || {}).wuchsstaerke)
    .filter(Boolean);
  const menge = new Set(staerken);
  return (menge.has('schwach') && menge.has('stark'))
    ? 'Eine schwach- und eine starkwachsende Sorte auf einem Baum: Die schwächere wird mit den Jahren überwachsen und muss beim Schnitt bevorzugt werden.'
    : '';
}

function konfigPreis(){
  const p = getProduktion();
  if(p.grundpreis == null) return null;
  const u = p.unterlagen.find(x => x.id === _konfig.unterlage) || {};
  const st = p.stammformen.find(x => x.id === _konfig.stammform) || {};
  const zusatz = Math.max(0, (_konfig.sorten || []).length - 1) * (p.aufpreis_je_veredelung || 0);
  return (p.grundpreis + (u.preis || 0) + (st.aufpreis || 0) + zusatz) * (_konfig.menge || 1);
}

/* ---------- Darstellung ---------- */
function renderKonfigurator(){
  if(!_konfig) return;
  const p = getProduktion();
  const max = maxSortenProBaum(_konfig.frucht);
  const unterlagen = p.unterlagen.filter(u => u.frucht === _konfig.frucht);
  const gewaehlteUnterlage = unterlagen.find(u => u.id === _konfig.unterlage) || {};
  const gewaehlteForm = p.stammformen.find(f => f.id === _konfig.stammform) || {};
  const waehlbar = konfigWaehlbareSorten();
  const staffel = konfigReifestaffel();
  const befruchtung = konfigBefruchtung();
  const wuchs = konfigWuchsWarnung();
  const preis = konfigPreis();

  const sortenZeilen = _konfig.sorten.map((n, i) => `
    <div class="kf-sorte">
      <span class="kf-sorte-name">${escHtml(n)}</span>
      ${staffel.eintraege.filter(e => e.sorte === n).map(e =>
        `<span class="kf-reife">${escHtml(e.text)}</span>`).join('')}
      ${i === 0
        ? '<span class="kf-basis">Basis</span>'
        : `<button class="kf-weg" title="Entfernen" onclick="konfigSorteEntfernen(${i})">&times;</button>`}
    </div>`).join('');

  const hinweise = [];
  if(staffel.verschieden >= 3){
    const erste = staffel.eintraege[0], letzte = staffel.eintraege[staffel.eintraege.length - 1];
    hinweise.push(`<div class="kf-gut">Durchgehende Ernte von ${escHtml(erste.text)} bis ${escHtml(letzte.text)} — ein Baum, der über Wochen trägt.</div>`);
  } else if(_konfig.sorten.length > 1 && staffel.verschieden === 1){
    hinweise.push(`<div class="kf-warn">Alle gewählten Sorten reifen im selben Monat. Sorten aus verschiedenen Monaten ergeben eine längere Ernte.</div>`);
  }
  befruchtung.forEach(([a, b]) => hinweise.push(
    `<div class="kf-gut">${escHtml(a)} und ${escHtml(b)} befruchten einander — die Bestäubung geschieht im selben Baum.</div>`));
  if(wuchs) hinweise.push(`<div class="kf-warn">${escHtml(wuchs)}</div>`);

  const html = `
    <div style="max-width:560px;">
      <button class="close" onclick="konfigAbbrechen()">&times;</button>
      <h2 style="font-family:var(--font-heading);color:var(--dark);margin:0 0 4px;">Baum zusammenstellen</h2>
      <p class="kf-unter">${escHtml(_konfig.frucht)} · Lieferung Herbst ${konfigLieferjahr()}</p>

      <div class="section-title">Unterlage</div>
      <select class="kf-feld" onchange="konfigSetzen('unterlage', this.value)">
        ${unterlagen.map(u => `<option value="${escAttr(u.id)}"${u.id === _konfig.unterlage ? ' selected' : ''}>${escHtml(u.name)} — ${escHtml(u.wuchs)}</option>`).join('')}
      </select>
      ${gewaehlteUnterlage.beschreibung ? `<div class="kf-erklaerung">${escHtml(gewaehlteUnterlage.beschreibung)}</div>` : ''}

      <div class="section-title">Stammform</div>
      <select class="kf-feld" onchange="konfigSetzen('stammform', this.value)">
        ${p.stammformen.map(f => `<option value="${escAttr(f.id)}"${f.id === _konfig.stammform ? ' selected' : ''}>${escHtml(f.name)}</option>`).join('')}
      </select>
      ${gewaehlteForm.beschreibung ? `<div class="kf-erklaerung">${escHtml(gewaehlteForm.beschreibung)}</div>` : ''}

      <div class="section-title">Sorten auf diesem Baum (${_konfig.sorten.length} von ${max})</div>
      ${sortenZeilen}
      ${_konfig.sorten.length < max
        ? (waehlbar.length
            ? `<select class="kf-feld" onchange="konfigSorteHinzu(this.value); this.selectedIndex=0;">
                 <option value="">+ Sorte ergänzen …</option>
                 ${waehlbar.map(n => `<option value="${escAttr(n)}">${escHtml(n)}</option>`).join('')}
               </select>`
            : `<div class="kf-erklaerung">Keine weitere Sorte verfügbar.</div>`)
        : `<div class="kf-erklaerung">Mehr als ${max} Sorten werden auf einem Baum nicht veredelt.</div>`}

      ${hinweise.length ? `<div class="kf-hinweise">${hinweise.join('')}</div>` : ''}

      <div class="section-title">Menge und Anmerkung</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="number" min="1" value="${_konfig.menge}" class="kf-feld" style="width:70px;"
               onchange="konfigSetzen('menge', this.value)">
        <input type="text" class="kf-feld" style="flex:1;" placeholder="Anmerkung (freiwillig)"
               value="${escAttr(_konfig.notiz || '')}" onchange="konfigSetzen('notiz', this.value)">
      </div>

      <div class="kf-preis">
        ${preis == null
          ? 'Preis wird mit dem Angebot bekanntgegeben.'
          : `${preis.toFixed(2)} EUR`}
      </div>

      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <button class="btn" onclick="konfigUebernehmen()">Zur Liste hinzufügen</button>
        <button class="btn secondary" onclick="konfigAbbrechen()">Abbrechen</button>
      </div>
    </div>`;

  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-content').dataset.modalType = 'konfigurator';
}

/* ---------- Bedienung ---------- */
function konfigSetzen(feld, wert){
  if(!_konfig) return;
  if(feld === 'menge') _konfig.menge = Math.max(1, parseInt(wert, 10) || 1);
  else _konfig[feld] = wert;
  renderKonfigurator();
}

function konfigSorteHinzu(name){
  if(!_konfig || !name) return;
  if(_konfig.sorten.length >= maxSortenProBaum(_konfig.frucht)) return;
  if(_konfig.sorten.indexOf(name) >= 0) return;
  _konfig.sorten.push(name);
  renderKonfigurator();
}

function konfigSorteEntfernen(i){
  if(!_konfig || i <= 0) return;          /* die Basissorte bleibt */
  _konfig.sorten.splice(i, 1);
  renderKonfigurator();
}

function konfigAbbrechen(){
  _konfig = null;
  closeModal();
}

function konfigUebernehmen(){
  if(!_konfig) return;
  const p = getProduktion();
  const u = p.unterlagen.find(x => x.id === _konfig.unterlage) || {};
  const f = p.stammformen.find(x => x.id === _konfig.stammform) || {};
  const liste = getMerkliste(MERKLISTE_EIGEN);

  /* Ersetzt einen unfertigen Wunsch derselben Sorte: Wer ueber die Merkliste in
     den Konfigurator geht, will den Eintrag zusammenstellen, nicht verdoppeln. */
  const vorhanden = liste.konfigurationen.findIndex(k =>
    k.id === _konfig.id || (!k.konfiguriert && k.sorte === _konfig.sorten[0]));

  const eintrag = {
    id: _konfig.id,
    konfiguriert: true,
    frucht: _konfig.frucht,
    sorte: _konfig.sorten[0],              /* fuer die kurze Anzeige */
    sorten: _konfig.sorten.map(n => ({ sorte:n })),
    unterlage: u.name || '',
    unterlage_id: _konfig.unterlage,
    stammform: f.name || '',
    stammform_id: _konfig.stammform,
    menge: _konfig.menge,
    notiz: _konfig.notiz || '',
    preis_berechnet: konfigPreis(),
    lieferjahr: konfigLieferjahr(),
    angelegt: new Date().toISOString()
  };

  if(vorhanden >= 0) liste.konfigurationen[vorhanden] = eintrag;
  else liste.konfigurationen.push(eintrag);
  liste.geaendert = new Date().toISOString();

  saveState();
  updateCartBadge();
  _konfig = null;
  showToast(`Baum mit ${eintrag.sorten.length} Sorte(n) zur Liste hinzugefügt.`, 'success');
  openBestelllisteModal();
}

/* shop.js — Hendlberghof Obstdatenbank
   Bestellliste, Bestellhistorie, PDF-Ausgabe, Offline-Hinweis

   Aus einer einzelnen Datei herausgeloest (F6). Die Ladereihenfolge in
   index.html entspricht exakt der frueheren Reihenfolge im Script-Block und
   darf nicht veraendert werden: Ueber Dateigrenzen hinweg gibt es kein
   Hoisting mehr, und start.js setzt window.__dataReadyPromise, das berater.js
   beim Laden bereits liest. */

/* ─── BESTELLLISTE ──────────────────────────────────────────────────────────── */

/* Arbeitskopie der Lieferanten-Merklisten in der flachen Form, mit der die
   Bestelloberfläche seit jeher arbeitet. Die Wahrheit steht in state.merklisten;
   diese Liste wird daraus aufgebaut und von saveCart() zurückgeschrieben.

   Damit hat der Warenkorb dieselbe Reichweite wie alles andere: Er liegt in state,
   geht über Firestore auf alle Geräte und steckt im Monatsbackup. Vorher lag er
   allein im localStorage dieses einen Browsers.

   REGEL: Jede Änderung an bestellListe MUSS von saveCart() gefolgt werden — sonst
   bleibt sie in der Arbeitskopie hängen und ist beim nächsten Laden weg. */
let bestellListe = [];

function ladeMerklisten(){
  bestellListe = merkPositionenFlach();
  updateCartBadge();
}

function saveCart(){
  schreibeMerklistenZurueck(bestellListe);
  saveState();
}

function updateCartBadge(){
  const badge=document.getElementById('cart-badge');
  if(!badge) return;
  /* Zaehlt beide Merklisten-Arten: Lieferantenpositionen und die Wuensche zur
     Eigenproduktion. Vorher nur bestellListe.length — seit S1 koennen Eintraege
     auch im Fach `eigen` landen und blieben sonst ungezaehlt.

     Bewusst NICHT ueber merkAnzahl(): Das liest state.merklisten, und drei
     Aufrufer aktualisieren das Abzeichen vor saveCart(). Dann zeigte es einen
     Eintrag zu wenig. Hier zaehlt die Arbeitskopie, die immer aktuell ist —
     damit ist die Reihenfolge der Aufrufe gleichgueltig. */
  const eigen = ((state.merklisten || {})[MERKLISTE_EIGEN] || {}).konfigurationen || [];
  const n = (Array.isArray(bestellListe) ? bestellListe.length : 0) + eigen.length;
  badge.textContent=n;
  badge.style.display=n>0?'inline':'none';
}

function addToBestellliste(sorteName, preisInfo) {
  const existing = bestellListe.find(e => e.sorte === sorteName && e.qid === preisInfo.qid);
  if(existing) { existing.menge += 1; }
  else {
    bestellListe.push({
      sorte: sorteName,
      qid: preisInfo.qid,
      quelle: preisInfo.quelle,
      email: preisInfo.email,
      unterlage: preisInfo.unterlage||'',
      alter: preisInfo.alter||'',
      preis: preisInfo.preis,
      mwst_satz: 13,
      menge: 1
    });
  }
  openBestelllisteModal();
  updateCartBadge();
  saveCart();
}

function removeFromBestellliste(idx) {
  const kf = _bestellFeldWerte();
  bestellListe.splice(idx, 1);
  renderBestellModalContent();
  _restoreBestellFelder(kf);
  updateCartBadge();
  saveCart();
}

function updateBestellMenge(idx, menge) {
  menge = parseInt(menge) || 0;
  const kf = _bestellFeldWerte();
  if(menge <= 0) { bestellListe.splice(idx, 1); }
  else { bestellListe[idx].menge = menge; }
  renderBestellModalContent();
  _restoreBestellFelder(kf);
  updateCartBadge();
  saveCart();
}

function openBestelllisteModal() {
  renderBestellModalContent();
  document.getElementById('overlay').classList.add('open');
}

function renderBestellModalContent() {
  const grouped = {};
  bestellListe.forEach((e,i)=>{
    if(!grouped[e.qid]) grouped[e.qid] = { quelle: e.quelle, email: e.email, items:[] };
    grouped[e.qid].items.push({...e, idx:i});
  });
  const today = new Date().toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'});
  let html = '<div style="max-width:560px;">';
  html += '<button class="close" onclick="closeModal()">&times;</button>';
  html += '<h2 style="font-family:var(--font-heading);color:var(--dark);margin:0 0 12px;">Meine Listen &mdash; '+today+'</h2>';

  html += '<div class="section-title">Kontakt</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">';
  html += '<input id="bk-vname" placeholder="Vorname*" style="font-size:.82rem;padding:5px 8px;border:1px solid var(--border);border-radius:4px;">';
  html += '<input id="bk-nname" placeholder="Nachname*" style="font-size:.82rem;padding:5px 8px;border:1px solid var(--border);border-radius:4px;">';
  html += '<input id="bk-strasse" placeholder="Strasse + Nr.*" style="font-size:.82rem;padding:5px 8px;border:1px solid var(--border);border-radius:4px;">';
  html += '<div style="display:flex;gap:4px;"><input id="bk-plz" placeholder="PLZ*" style="font-size:.82rem;padding:5px 8px;border:1px solid var(--border);border-radius:4px;width:80px;"><input id="bk-ort" placeholder="Ort*" style="font-size:.82rem;padding:5px 8px;border:1px solid var(--border);border-radius:4px;flex:1;"></div>';
  html += '<input id="bk-email" type="email" placeholder="Email*" style="font-size:.82rem;padding:5px 8px;border:1px solid var(--border);border-radius:4px;">';
  html += '<input id="bk-telefon" placeholder="Telefon*" style="font-size:.82rem;padding:5px 8px;border:1px solid var(--border);border-radius:4px;">';
  html += '</div>';

  /* ---- Eigenproduktion (S2) --------------------------------------------
     Das Fach `eigen` fuehrt keine Positionen mit Preis, sondern Baeume, die
     erst hergestellt werden. Bis der Konfigurator steht (S3), stehen dort
     einfache Wuensche (konfiguriert:false).

     Bewusst NICHT in der Geldsumme: Der Preis ergibt sich aus Unterlage,
     Stammform und Zahl der Veredelungen und steht erst nach der Konfiguration
     fest. Eine Summe, die stillschweigend nur die zugekaufte Ware enthaelt,
     waere irrefuehrend - deshalb steht der Grund sichtbar dabei. */
  const eigen = ((state.merklisten || {})[MERKLISTE_EIGEN] || {}).konfigurationen || [];
  if(eigen.length){
    html += `<div style="margin-bottom:10px;padding:8px;border:1px solid var(--gruen);border-radius:6px;background:var(--gruen-hell);">
      <div style="font-weight:600;font-size:.85rem;margin-bottom:4px;">Eigenproduktion Hendlberghof</div>`;
    eigen.forEach(k=>{
      const beschriftung = k.konfiguriert
        ? `<b>${escHtml((k.sorten || []).map(x => x.sorte).join(' · '))}</b>`
          + `<br><span style="color:var(--muted);font-size:.76rem;">`
          + `${escHtml(k.stammform || '')}${k.stammform && k.unterlage ? ' auf ' : ''}${escHtml(k.unterlage || '')}`
          + `${k.lieferjahr ? ` · Lieferung Herbst ${k.lieferjahr}` : ''}`
          + `${k.notiz ? ` · ${escHtml(k.notiz)}` : ''}</span>`
        : `${escHtml(k.sorte || '')}${k.frucht ? ` · ${escHtml(k.frucht)}` : ''}`;
      /* Unfertige Wuensche bekommen den Weg in den Konfigurator angeboten,
         fertige einen zum Aendern — beides fuehrt in dieselbe Maske, die den
         Eintrag ersetzt statt ihn zu verdoppeln. */
      const konfigKnopf = typeof konfiguratorOeffnen === 'function' && k.sorte
        ? `<button class="btn secondary" style="font-size:.7rem;padding:1px 6px;"
                   onclick="konfiguratorOeffnen('${escAttr(k.sorte)}', '${escAttr(k.id)}')"
           >${k.konfiguriert ? 'Ändern' : 'Zusammenstellen'}</button>`
        : '';
      html += `<div style="display:flex;align-items:center;gap:6px;font-size:.82rem;margin:3px 0;">
        <span style="flex:1;">${beschriftung}${k.konfiguriert ? '' : ' <span style="color:var(--muted);">— noch nicht zusammengestellt</span>'}</span>
        ${konfigKnopf}
        <input type="number" min="1" value="${k.menge || 1}"
               style="width:45px;font-size:.8rem;text-align:center;padding:2px;border:1px solid var(--border);border-radius:3px;"
               onchange="merkEigenMenge('${escAttr(k.id)}', this.value)">
        <button style="background:none;border:none;color:var(--dachziegel);cursor:pointer;font-size:.8rem;"
                onclick="merkEigenEntfernen('${escAttr(k.id)}')" title="Entfernen">&times;</button>
      </div>`;
    });
    html += `<div style="font-size:.76rem;color:var(--muted);margin-top:4px;border-top:1px solid var(--border);padding-top:4px;">
      Preis steht erst nach der Zusammenstellung fest — nicht in der Summe unten enthalten.
    </div>
    <button class="btn secondary" style="font-size:.76rem;padding:3px 10px;margin-top:6px;"
            onclick="anfrageSenden('${MERKLISTE_EIGEN}')">Anfrage an den Hof senden</button>
    </div>`;
  }


  if(!bestellListe.length && !eigen.length) {
    html += '<p style="font-size:.85rem;color:var(--muted);text-align:center;padding:16px 0;">Noch keine Sorten ausgewaehlt. Fuege Sorten im Sortenberater hinzu.</p>';
  } else {
    let gesamt = 0;
    Object.entries(grouped).forEach(([qid, g])=>{
      let qSumme = 0;
      html += '<div style="margin-bottom:10px;padding:8px;border:1px solid var(--border);border-radius:6px;">';
      html += '<div style="font-weight:600;font-size:.85rem;margin-bottom:4px;">'+g.quelle+(g.email?' ('+g.email+')':'')+'</div>';
      g.items.forEach(item=>{
        const zeilenPreis = item.preis * item.menge;
        qSumme += zeilenPreis;
        html += '<div style="display:flex;align-items:center;gap:6px;font-size:.82rem;margin:3px 0;">';
        html += '<span style="flex:1;">'+item.sorte+(item.unterlage?' '+item.unterlage:'')+(item.alter?' '+item.alter:'')+' &mdash; '+item.preis.toFixed(2)+' EUR <span style="font-size:.72rem;color:var(--muted);">(inkl. 13% MwSt)</span></span>';
        html += '<input type="number" min="1" value="'+item.menge+'" style="width:45px;font-size:.8rem;text-align:center;padding:2px;border:1px solid var(--border);border-radius:3px;" onchange="updateBestellMenge('+item.idx+',this.value)">';
        html += '<span style="width:55px;text-align:right;">'+zeilenPreis.toFixed(2)+' EUR</span>';
        html += '<button style="background:none;border:none;color:var(--dachziegel);cursor:pointer;font-size:.8rem;" onclick="removeFromBestellliste('+item.idx+')">x</button>';
        html += '</div>';
      });
      html += '<div style="text-align:right;font-size:.82rem;font-weight:600;margin-top:4px;border-top:1px solid var(--border);padding-top:4px;">Gesamt '+g.quelle+': '+qSumme.toFixed(2)+' EUR</div>';
      /* Je Lieferant ein eigener Sendeknopf — die Anfrage enthaelt nur dessen
         Positionen. Ein gemeinsamer Knopf war der Grund fuer die Sammelmail. */
      html += `<button class="btn secondary" style="font-size:.76rem;padding:3px 10px;margin-top:6px;"
                       onclick="anfrageSenden('${qid}')">Anfrage an ${escHtml(g.quelle || qid)} senden</button>`;
      html += '</div>';
      gesamt += qSumme;
    });
    /* Nur zeigen, wenn zugekaufte Ware dabei ist. Bei reiner Eigenproduktion
       stuende hier sonst „Gesamt: 0,00 EUR" - der Preis ist nicht null,
       er steht nur noch nicht fest. */
    if(bestellListe.length)
  html += '<div style="text-align:right;font-size:.95rem;font-weight:700;padding:8px 0;border-top:2px solid var(--dark);">Gesamtsumme: '+gesamt.toFixed(2)+' EUR</div>';
  }

  html += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">';
  html += '<button class="btn secondary" onclick="bestellungDrucken()">Drucken</button>';
  html += '<button class="btn secondary" onclick="bestellungPdf()">PDF erstellen</button>';
  html += '<button class="btn secondary" onclick="bestellungSpeichern()">Anfragen speichern</button>';
  html += '</div>';
  html += '</div>';
  document.getElementById('modal-content').innerHTML = html;
}

function _validateBestellfelder(){
  const required = ['bk-vname','bk-nname','bk-strasse','bk-plz','bk-ort','bk-email','bk-telefon'];
  let ok = true;
  for(const id of required){
    const el = document.getElementById(id);
    if(!el) continue;
    if(!el.value.trim()){
      el.style.borderColor = 'var(--dachziegel)';
      ok = false;
    } else {
      el.style.borderColor = '';
    }
  }
  return ok;
}
function _bestellFeldWerte(){
  return {
    vname: (document.getElementById('bk-vname')||{}).value || '',
    nname: (document.getElementById('bk-nname')||{}).value || '',
    strasse: (document.getElementById('bk-strasse')||{}).value || '',
    plz: (document.getElementById('bk-plz')||{}).value || '',
    ort: (document.getElementById('bk-ort')||{}).value || '',
    email: (document.getElementById('bk-email')||{}).value || '',
    telefon: (document.getElementById('bk-telefon')||{}).value || ''
  };
}
function _restoreBestellFelder(kf){
  if(!kf) return;
  const ids=['bk-vname','bk-nname','bk-strasse','bk-plz','bk-ort','bk-email','bk-telefon'];
  const keys=Object.keys(kf);
  ids.forEach((id,i)=>{ const el=document.getElementById(id); if(el&&keys[i]) el.value=kf[keys[i]]; });
}
function bestellungDrucken() {
  if(!_validateBestellfelder()){ showToast('Bitte alle Pflichtfelder ausfüllen.','error'); return; }
  window.print();
}

/* ---------- Anfragen je Empfänger (S4) ----------
   Vorher ging EINE Sammelmail an alle Lieferanten gleichzeitig: `to` sammelte
   sämtliche Adressen, der Text enthielt sämtliche Positionen. Jede Baumschule
   hätte gesehen, was die Mitbewerber anbieten und zu welchem Preis — und wer
   sonst noch angefragt wurde. Das ist nicht bloß unhöflich, es gibt
   Geschäftsdaten Dritter preis.

   Jetzt wird nach Empfänger zerlegt: je Anfrage eine Mail, ein PDF, ein
   Eintrag in der Historie. Die Eigenproduktion ist dabei ein Empfänger wie
   jeder andere — sie geht an den Hof selbst. */

const HOF_EMAIL_STANDARD = 'mail@hendlberghof.at';

function anfragenAufteilen(){
  const raus = [];

  const eigen = ((state.merklisten || {})[MERKLISTE_EIGEN] || {}).konfigurationen || [];
  if(eigen.length){
    raus.push({
      typ: 'eigen', qid: MERKLISTE_EIGEN,
      name: 'Eigenproduktion Hendlberghof',
      email: (getProduktion().email || HOF_EMAIL_STANDARD),
      konfigurationen: eigen, positionen: [], summe: null
    });
  }

  const nachQuelle = {};
  bestellListe.forEach(e=>{
    if(!nachQuelle[e.qid]){
      nachQuelle[e.qid] = { typ:'lieferant', qid:e.qid, name:e.quelle || e.qid,
                            email:e.email || '', positionen:[], konfigurationen:[] };
    }
    nachQuelle[e.qid].positionen.push(e);
  });
  Object.keys(nachQuelle).forEach(qid=>{
    const a = nachQuelle[qid];
    a.summe = a.positionen.reduce((s, p) => s + (p.preis || 0) * (p.menge || 1), 0);
    raus.push(a);
  });
  return raus;
}

/* Text einer einzelnen Anfrage. Enthaelt ausschliesslich, was diesen Empfaenger
   angeht - keine Zeile ueber andere Lieferanten. */
function anfrageText(a, kf){
  const zeilen = [
    a.typ === 'eigen' ? 'Anfrage Eigenproduktion Hendlberghof' : `Anfrage an ${a.name}`,
    '',
    `Kontakt: ${kf.vname} ${kf.nname}`,
    `Adresse: ${kf.strasse}, ${kf.plz} ${kf.ort}`,
    `E-Mail: ${kf.email}`,
    `Telefon: ${kf.telefon}`,
    ''
  ];

  if(a.konfigurationen.length){
    zeilen.push('Gewünschte Bäume:');
    a.konfigurationen.forEach(k=>{
      const sorten = k.konfiguriert
        ? (k.sorten || []).map(x => x.sorte).join(', ')
        : `${k.sorte} (noch nicht zusammengestellt)`;
      const teile = [`  ${k.menge || 1} x ${sorten}`];
      if(k.stammform || k.unterlage)
        teile.push(`      ${k.stammform || ''}${k.stammform && k.unterlage ? ' auf ' : ''}${k.unterlage || ''}`);
      if(k.lieferjahr) teile.push(`      Lieferung Herbst ${k.lieferjahr}`);
      if(k.notiz) teile.push(`      Anmerkung: ${k.notiz}`);
      zeilen.push(...teile);
    });
    zeilen.push('', 'Preis nach Angebot.');
  }

  if(a.positionen.length){
    zeilen.push('Sorten:');
    a.positionen.forEach(p=>{
      const zusatz = [p.unterlage, p.alter].filter(Boolean).join(' ');
      zeilen.push(`  ${p.sorte}${zusatz ? ` (${zusatz})` : ''} x${p.menge}`
        + ` = ${((p.preis || 0) * (p.menge || 1)).toFixed(2)} EUR (inkl. ${p.mwst_satz || 13}% MwSt)`);
    });
    zeilen.push('', `Summe: ${a.summe.toFixed(2)} EUR`);
  }
  return zeilen.join('\r\n');
}

function anfrageSenden(qid){
  if(!_validateBestellfelder()){ showToast('Bitte alle Pflichtfelder ausfüllen.','error'); return; }
  const a = anfragenAufteilen().find(x => x.qid === qid);
  if(!a){ showToast('Diese Liste ist leer.','error'); return; }
  if(!a.email){
    showToast(`Für „${a.name}" ist keine E-Mail-Adresse hinterlegt.`, 'error', 4500);
    return;
  }
  const kf = _bestellFeldWerte();
  const betreff = a.typ === 'eigen'
    ? `Anfrage Baumbestellung — ${kf.vname} ${kf.nname}`
    : `Anfrage Hendlberghof — ${kf.vname} ${kf.nname}`;
  window.location.href = `mailto:${encodeURIComponent(a.email)}`
    + `?subject=${encodeURIComponent(betreff)}`
    + `&body=${encodeURIComponent(anfrageText(a, kf))}`;
}

function bestellungPdf(){
  if(!window.jspdf){ showToast('PDF-Bibliothek nicht geladen – Internet nötig.','error'); return; }
  if(!_validateBestellfelder()){ showToast('Bitte alle Pflichtfelder ausfüllen.','error'); return; }
  if(!bestellListe.length){ showToast('Keine Sorten in der Bestellliste.','error'); return; }
  const kf = _bestellFeldWerte();
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'});
  doc.setFontSize(16);
  doc.text('Bestellung Hendlberghof', 20, 22);
  doc.setFontSize(10);
  doc.text('Datum: '+today, 20, 30);
  doc.setFontSize(11);
  doc.text('Kontakt', 20, 42);
  doc.setFontSize(10);
  doc.text(kf.vname+' '+kf.nname, 20, 49);
  doc.text(kf.strasse, 20, 55);
  doc.text(kf.plz+' '+kf.ort, 20, 61);
  doc.text('Email: '+kf.email, 20, 67);
  doc.text('Tel: '+kf.telefon, 20, 73);
  doc.setDrawColor(40,54,42);
  doc.line(20, 77, 190, 77);
  doc.setFontSize(11);
  doc.text('Sorten', 20, 85);
  let y = 92;
  const grouped = {};
  bestellListe.forEach((e,i)=>{
    if(!grouped[e.qid]) grouped[e.qid] = { quelle: e.quelle, items:[] };
    grouped[e.qid].items.push(e);
  });
  let gesamt = 0;
  Object.values(grouped).forEach(g=>{
    doc.setFontSize(10);
    doc.setFont(undefined,'bold');
    doc.text(g.quelle, 20, y); y += 6;
    doc.setFont(undefined,'normal');
    g.items.forEach(item=>{
      const lp = (item.preis*item.menge).toFixed(2);
      doc.text(item.sorte+(item.unterlage?' '+item.unterlage:'')+(item.alter?' '+item.alter:'')+'  x'+item.menge+'  '+lp+' EUR', 24, y);
      gesamt += item.preis*item.menge;
      y += 5;
    });
    y += 2;
  });
  doc.line(20, y, 190, y); y += 6;
  doc.setFont(undefined,'bold');
  doc.text('Gesamt: '+gesamt.toFixed(2)+' EUR (inkl. 13% MwSt)', 20, y);
  doc.save('Bestellung_Hendlberghof_'+today.replace(/\./g,'-')+'.pdf');
}

function bestellungSpeichern() {
  const anfragen = anfragenAufteilen();
  if(!anfragen.length) { showToast('Beide Listen sind leer.','error'); return; }
  if(!_validateBestellfelder()){ showToast('Bitte alle Pflichtfelder ausfüllen.','error'); return; }
  const kf = _bestellFeldWerte();
  const kontakt = {
    vorname: kf.vname, nachname: kf.nname, strasse: kf.strasse,
    plz: kf.plz, ort: kf.ort, email: kf.email, telefon: kf.telefon
  };

  /* Je Empfaenger ein eigener Eintrag in der Historie. Vorher lag alles in
     einer Sammelbestellung - der Hof konnte den eigenen Auftrag nicht getrennt
     verfolgen von dem, was bei einer Baumschule bestellt wurde, und ein
     Storno haette immer beides betroffen. */
  const stempel = Date.now();
  anfragen.forEach((a, i)=>{
    state.bestellungen.push({
      id: `best_${stempel}_${i}`,
      datum: new Date().toISOString(),
      status: 'offen',
      typ: a.typ,                       /* eigen | lieferant */
      empfaenger: a.name,
      empfaenger_email: a.email,
      qid: a.qid,
      kontakt,
      items: JSON.parse(JSON.stringify(a.positionen)),
      konfigurationen: JSON.parse(JSON.stringify(a.konfigurationen)),
      gesamt: a.summe
    });
  });

  /* Beide Merklisten leeren - was gespeichert ist, steht in der Historie. */
  bestellListe = [];
  const eigenFach = getMerkliste(MERKLISTE_EIGEN);
  eigenFach.konfigurationen = [];
  eigenFach.geaendert = new Date().toISOString();
  saveCart();
  updateCartBadge();

  showToast(anfragen.length === 1
    ? 'Anfrage gespeichert.'
    : `${anfragen.length} Anfragen gespeichert — je Empfänger eine.`, 'success');
  closeModal();
  renderBestellhistorie();
}

/* ─── BESTELLHISTORIE ───────────────────────────────────────────────────────── */

function renderBestellhistorie() {
  if(!isAdmin()) { document.getElementById('bestellhistorie-list').innerHTML=''; return; }
  const orders = state.bestellungen || [];
  if(!orders.length) {
    document.getElementById('bestellhistorie-list').innerHTML = '<p style="font-size:.85rem;color:var(--muted);">Noch keine Bestellungen vorhanden.</p>';
    return;
  }
  const statusCfg = {
    offen: {label:'Offen', color:'#D97706', bg:'#FEF3C7'},
    bestaetigt: {label:'Bestätigt', color:'#059669', bg:'#D1FAE5'},
    versendet: {label:'Versendet', color:'#6366F1', bg:'#E0E7FF'}
  };
  let html = '';
  orders.slice().reverse().forEach(o => {
    const d = new Date(o.datum).toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'});
    const name = (o.kontakt?.vorname||'')+' '+(o.kontakt?.nachname||'');
    const st = statusCfg[o.status] || statusCfg.offen;
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem;flex-wrap:wrap;">';
    html += '<span style="color:var(--muted);width:80px;">'+d+'</span>';
    html += '<span style="flex:1;min-width:100px;">'+name.trim()+'</span>';
    html += '<span style="font-weight:600;">'+(o.gesamt||0).toFixed(2)+' EUR</span>';
    html += '<span style="font-size:.72rem;padding:2px 8px;border-radius:10px;background:'+st.bg+';color:'+st.color+';font-weight:600;">'+st.label+'</span>';
    if(o.status==='offen') html += '<button class="btn secondary" style="font-size:.72rem;padding:2px 8px;color:#059669;" onclick="setOrderStatus(\''+o.id+'\',\'bestaetigt\')">Bestätigen</button>';
    else if(o.status==='bestaetigt') html += '<button class="btn secondary" style="font-size:.72rem;padding:2px 8px;color:#6366F1;" onclick="setOrderStatus(\''+o.id+'\',\'versendet\')">Versendet</button>';
    html += '<button class="btn secondary" style="font-size:.75rem;padding:2px 8px;" onclick="showBestellDetails(\''+o.id+'\')">Details</button>';
    html += '<button class="btn secondary" style="font-size:.75rem;padding:2px 8px;color:var(--dachziegel);" onclick="storniereBestellung(\''+o.id+'\')">Stornieren</button>';
    html += '</div>';
  });
  document.getElementById('bestellhistorie-list').innerHTML = html;
}

function setOrderStatus(orderId, status) {
  const o = (state.bestellungen||[]).find(x => x.id === orderId);
  if(!o) return;
  o.status = status;
  saveState();
  renderBestellhistorie();
}

function showBestellDetails(orderId) {
  const o = (state.bestellungen||[]).find(x => x.id === orderId);
  if(!o) return;
  const d = new Date(o.datum).toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'});
  let html = '<div style="max-width:480px;">';
  html += '<button class="close" onclick="closeModal()">&times;</button>';
  html += '<h2 style="font-family:var(--font-heading);margin:0 0 10px;">Bestellung '+d+'</h2>';
  html += '<div class="section-title">Kontakt</div>';
  html += '<div style="font-size:.85rem;margin-bottom:10px;">';
  ['vorname','nachname','strasse','plz','ort','email','telefon'].forEach(k=>{
    if(o.kontakt && o.kontakt[k]) html += '<div>'+k.charAt(0).toUpperCase()+k.slice(1)+': '+o.kontakt[k]+'</div>';
  });
  html += '</div>';
  html += '<div class="section-title">Sorten</div>';
  (o.items||[]).forEach(e=>{
    html += '<div style="font-size:.82rem;margin:3px 0;">'+e.sorte+(e.unterlage?' '+e.unterlage:'')+(e.alter?' '+e.alter:'')+' &mdash; '+e.preis.toFixed(2)+' EUR x '+e.menge+' = '+(e.preis*e.menge).toFixed(2)+' EUR</div>';
  });
  html += '<div style="text-align:right;font-weight:700;margin-top:8px;">Gesamt: '+(o.gesamt||0).toFixed(2)+' EUR</div>';
  html += '</div>';
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
}

function storniereBestellung(orderId) {
  if(!confirm('Bestellung wirklich stornieren?')) return;
  state.bestellungen = (state.bestellungen||[]).filter(x => x.id !== orderId);
  saveState();
  renderBestellhistorie();
}

// Dropzone Event Listener
document.addEventListener('DOMContentLoaded',function(){
  initFotoSelect();
  renderPreislistenAdmin();
  renderBestellhistorie();
  const dropzones=['import-dropzone','import-dropzone-modal'];
  dropzones.forEach(id=>{
    const dz=document.getElementById(id);
    if(!dz) return;
    
    dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover');});
    dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
    dz.addEventListener('drop',e=>{
      e.preventDefault();
      dz.classList.remove('dragover');
      const file=e.dataTransfer.files[0];
      if(file) handleImportFile(file);
    });
    dz.addEventListener('click',()=>{
      const input=dz.querySelector('input[type=file]')||document.getElementById('file-excel-import');
      if(input) input.click();
    });
  });
  
  const fileInputs=['file-excel-import','file-import-excel'];
  fileInputs.forEach(id=>{
    const input=document.getElementById(id);
    if(!input) return;
    input.addEventListener('change',e=>{
      if(e.target.files[0]) handleImportFile(e.target.files[0]);
    });
  });
});

document.addEventListener('keydown', function(e){
  if(e.key==='Escape' || e.key==='Esc'){
    const pdfOv=document.getElementById('pdf-overlay');
    if(pdfOv && pdfOv.classList.contains('open')){ closeArcheViewer(); return; }
    const impOv=document.getElementById('import-overlay');
    if(impOv && impOv.style.display!=='none'){ closeImportModal(); return; }
    const ov=document.getElementById('overlay');
    if(ov && ov.classList.contains('open')){ closeModal(); }
  }
});

function handleImportFile(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['xlsx','xls','csv','tsv'].includes(ext)){
    alert('Nicht unterstütztes Dateiformat. Bitte Excel (.xlsx, .xls) oder CSV (.csv, .tsv) verwenden.');
    return;
  }
  importState.file=file;
  
  const info=document.getElementById('import-file-info');
  if(info){
    info.style.display='block';
    info.innerHTML='<strong>'+file.name+'</strong> ('+Math.round(file.size/1024)+' KB)';
  }
  
  if(document.getElementById('import-overlay').style.display==='none'){
    openImportModal();
  } else {
    document.getElementById('import-next-btn').disabled=false;
  }
}

(function(){
  const b=document.getElementById('offline-banner');
  if(!b) return;
  function show(){ b.style.display='block'; }
  function hide(){ b.style.display='none'; }
  if(!navigator.onLine) show();
  window.addEventListener('offline', show);
  window.addEventListener('online', ()=>{ hide(); showToast('Internetverbindung wiederhergestellt.','success'); });
})();

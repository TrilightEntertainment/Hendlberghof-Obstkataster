/* kataster.js — Hendlberghof Obstdatenbank
   Baumkataster: Tabelle, Ex- und Import, Baum- und Sorten-Modal, Merklisten, Bestellbarkeit

   Aus einer einzelnen Datei herausgeloest (F6). Die Ladereihenfolge in
   index.html entspricht exakt der frueheren Reihenfolge im Script-Block und
   darf nicht veraendert werden: Ueber Dateigrenzen hinweg gibt es kein
   Hoisting mehr, und start.js setzt window.__dataReadyPromise, das berater.js
   beim Laden bereits liest. */

/* ---------- Baumkataster Tabelle ---------- */
let baumSort = { key:'sorte', type:'text', dir:1 };

function sortRows(rows, sort){
  const {key, type, dir} = sort;
  return rows.slice().sort((a,b)=>{
    let va = a[key], vb = b[key];
    if(type==='num'){
      va = parseFloat(String(va).replace(',','.')) ; vb = parseFloat(String(vb).replace(',','.'));
      const va_ok = !isNaN(va), vb_ok = !isNaN(vb);
      if(!va_ok && !vb_ok) return 0;
      if(!va_ok) return 1;   // leere Werte ans Ende, egal welche Richtung
      if(!vb_ok) return -1;
      return (va-vb)*dir;
    }
    va = (va||'').toString(); vb = (vb||'').toString();
    if(!va && vb) return 1;
    if(va && !vb) return -1;
    return va.localeCompare(vb,'de')*dir;
  });
}

function updateSortHeaders(){
  document.querySelectorAll('#baum-thead-row th[data-key]').forEach(th=>{
    th.classList.toggle('sorted', th.dataset.key===baumSort.key);
    let arrow = th.querySelector('.arrow');
    if(!arrow){ arrow = document.createElement('span'); arrow.className='arrow'; th.appendChild(arrow); }
    if(th.dataset.key===baumSort.key){
      arrow.textContent = baumSort.dir===1 ? '▲' : '▼';
    } else {
      arrow.textContent = '↕';
    }
  });
}

document.querySelectorAll('#baum-thead-row th[data-key]').forEach(th=>{
  th.addEventListener('click', ()=>{
    const key = th.dataset.key, type = th.dataset.type;
    if(baumSort.key===key){ baumSort.dir *= -1; }
    else { baumSort = {key, type, dir:1}; }
    renderBaumTable();
  });
});

function getVerwendung(t){
  if(t.verwendung && t.verwendung.length) return t.verwendung;
  const s = getSorte(t.sorte);
  return s? (s.verwendung||[]) : [];
}

function getFilteredBaumRows(){
  const q = document.getElementById('baum-search').value.toLowerCase();
  const fFrucht = document.getElementById('baum-filter-frucht').value;
  const fVerwendung = document.getElementById('baum-filter-verwendung').value;
  let rows = getAllTrees().filter(t=>{
    if(fFrucht && t.frucht!==fFrucht) return false;
    if(fVerwendung && !getVerwendung(t).includes(fVerwendung)) return false;
    const hay = (t.id+' '+(t.sorte||'')+' '+(t.standort_zeile||'')).toLowerCase();
    return !q || hay.includes(q);
  });
  return sortRows(rows, baumSort);
}

function baumMerged(t){ return Object.assign({}, getSorte(t.sorte)||{}, t); }

function getFilteredSortenExportRows(){
  let pool = getAllSorten();
  const qVal=document.getElementById('sb-filter-quelle')?.value||'';
  const verwVal=document.getElementById('sb-filter-verwendung')?.value||'';
  const fruchtVal=(document.getElementById('sb-filter-frucht')?.value||'').toLowerCase();
  if(qVal) pool = pool.filter(s=>s.quelle===qVal);
  if(fruchtVal) pool = pool.filter(s=>(s.frucht||'').toLowerCase()===fruchtVal);
  if(verwVal){const vk={tafel:['tafel','tafelobst'],most:['most','wirtschaft','saft'],lager:['lager'],frueh:['früh','frueh'],robust:['robust'],wild:['wild']};const kw=vk[verwVal]||[verwVal];pool=pool.filter(s=>(s.verwendung||[]).some(v=>{const vl=v.toLowerCase();return kw.some(k=>vl.includes(k));}));}
  const q = (document.getElementById('sl-search')?.value||'').toLowerCase();
  if(q) pool = pool.filter(s=>s.name.toLowerCase().includes(q)||(s.beschreibung||'').toLowerCase().includes(q)||(s.tags||[]).some(t=>t.toLowerCase().includes(q)));
  pool.sort((a,b)=>a.name.localeCompare(b.name,'de'));
  return pool.map(s=>{
    const full = getSorte(s.name) || {};
    return Object.assign({}, full, {sorte:s.name, frucht:s.frucht, verwendung:s.verwendung, baum_ids:full.baum_ids||[]});
  });
}

const EXPORT_SPALTEN = {
  baum: [
    {key:'ID', get:t=> t.id_placeholder? '(offen)' : t.id},
    {key:'Sorte', get:t=> t.sorte||''},
    {key:'Obstart', get:t=> t.frucht||''},
    {key:'Verwendung', get:t=> getVerwendung(t).join(', ')},
    {key:'Pflückzeit', get:t=> t.pflueckzeitpunkt||t.pflueck_reifezeit||''},
    {key:'Standort', get:t=> t.standort_zeile||''},
    {key:'Gepflanzt', get:t=> t.ausgepflanzt||''},
    {key:'Veredelt', get:t=> t.veredelt||''},
    {key:'Unterlage', get:t=> t.unterlage||''},
    {key:'Erstmals tragend', def:false, get:t=> t.erstmals_tragend||''},
    {key:'Genussreife', def:false, get:t=>{const m=baumMerged(t); return formatGenuss(m.genuss_von,m.genuss_bis,m.genussreife,m.genuss);}},
    {key:'Lagerfähigkeit', def:false, get:t=> baumMerged(t).lagerfaehig||''},
    {key:'Befruchtungspartner', def:false, get:t=> baumMerged(t).befruchtungspartner||''},
    {key:'Geschmack', def:false, get:t=> baumMerged(t).geschmack||''},
    {key:'Eigenschaften', def:false, get:t=> baumMerged(t).eigenschaften||''},
    {key:'Herkunft', def:false, get:t=>{const m=baumMerged(t); return m.herkunft_jahr||m.herkunft||'';}}
  ],
  sorten: [
    {key:'Sorte', get:s=> s.sorte},
    {key:'Obstart', get:s=> s.frucht},
    {key:'Verwendung', get:s=> ((getSorte(s.sorte)||s).verwendung||[]).join(', ')},
    {key:'Anzahl Bäume', get:s=> (s.baum_ids||[]).length},
    {key:'Pflückzeit', get:s=> s.pflueckzeitpunkt||s.pflueck_reifezeit||''},
    {key:'Genussreife', get:s=> formatGenuss(s.genuss_von,s.genuss_bis,s.genussreife,s.genuss)},
    {key:'Lagerfähigkeit', get:s=> s.lagerfaehig||''},
    {key:'Ertrag', get:s=> s.ertrag||''},
    {key:'Herkunft', get:s=> s.herkunft_jahr||s.herkunft||''},
    {key:'Synonyme', get:s=> s.synonyme||''},
    {key:'Geschmack', def:false, get:s=> s.geschmack||''},
    {key:'Eigenschaften', def:false, get:s=> s.eigenschaften||''},
    {key:'Frucht-Beschreibung', def:false, get:s=> s.frucht_beschreibung||''},
    {key:'Befruchtungspartner', def:false, get:s=> s.befruchtungspartner||''}
  ]
};

let exportContext = null;

function exportBaumCSV(){
  const rows = getFilteredBaumRows();
  if(!rows.length){ showToast('Keine Daten zum Exportieren.','error'); return; }
  const headers = ['ID','Sorte','Art','Pflückzeit','Standort'];
  const csvRows = [headers.join(';')];
  rows.forEach(t=>{
    csvRows.push([t.id, t.sorte||'', t.frucht||'', t.pflueckzeitpunkt||t.pflueck_reifezeit||'', t.standort_zeile||''].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';'));
  });
  const blob = new Blob(['\uFEFF'+csvRows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hendlberghof_baumkataster_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  showToast(rows.length+' Bäume als CSV exportiert.','success');
}

function openExportDialog(typ, format){
  exportContext = {typ, format};
  let gespeichert = null;
  try{ gespeichert = JSON.parse(localStorage.getItem('hendlberghof_export_cols_'+typ)||'null'); }catch(e){}
  const boxes = EXPORT_SPALTEN[typ].map(c=>{
    const checked = gespeichert? gespeichert.includes(c.key) : c.def!==false;
    return `<label style="display:block;font-weight:400;margin:4px 0;font-size:.87rem;">
      <input type="checkbox" name="export-col" value="${c.key.replace(/"/g,'&quot;')}" ${checked?'checked':''}> ${c.key}
    </label>`;
  }).join('');
  const html = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h2>Spalten für ${format==='excel'?'Excel':'PDF'}-Export</h2>
    <p style="font-size:.82rem;color:var(--muted);">Exportiert wird die aktuell gefilterte Auswahl. Die Spaltenauswahl wird für das nächste Mal gemerkt.</p>
    <div style="columns:2;column-gap:24px;margin:14px 0;">${boxes}</div>
    <div class="edit-actions">
      <button class="btn" onclick="runExport()">⬇ Exportieren</button>
      <button class="btn secondary" onclick="closeModal()">Abbrechen</button>
    </div>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-content').dataset.modalType = 'export';
  document.getElementById('overlay').classList.add('open');
}

function runExport(){
  if(!exportContext) return;
  const selected = Array.from(document.querySelectorAll('input[name="export-col"]:checked')).map(b=>b.value);
  if(selected.length===0){ alert('Bitte mindestens eine Spalte auswählen.'); return; }
  localStorage.setItem('hendlberghof_export_cols_'+exportContext.typ, JSON.stringify(selected));
  const spalten = EXPORT_SPALTEN[exportContext.typ].filter(c=>selected.includes(c.key));
  const rows = exportContext.typ==='baum'? getFilteredBaumRows() : getFilteredSortenExportRows();
  const data = rows.map(r=>{ const o={}; spalten.forEach(c=>o[c.key]=c.get(r)); return o; });
  const stem = exportContext.typ==='baum'? 'Baumkataster' : 'Sortenuebersicht';
  const titel = exportContext.typ==='baum'? 'Hendlberghof – Baumkataster' : 'Hendlberghof – Sortenübersicht';
  const datum = new Date().toISOString().slice(0,10);
  if(exportContext.format==='excel'){
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, exportContext.typ==='baum'? 'Baumkataster' : 'Sorten');
    XLSX.writeFile(wb, `${stem}_${datum}.xlsx`);
  } else {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({orientation:'landscape'});
    doc.setFontSize(14);
    doc.text(titel, 14, 15);
    doc.autoTable({
      startY: 22,
      head: [spalten.map(c=>c.key)],
      body: data.map(r=>spalten.map(c=>r[c.key])),
      styles:{fontSize:8}
    });
    doc.save(`${stem}_${datum}.pdf`);
  }
  closeModal();
  exportContext = null;
}

function renderBaumTable(){
  const tbody = document.getElementById('baum-tbody');
  const editing = isEditMode();
  tbody.innerHTML = '';
  updateSortHeaders();
  const rows = getFilteredBaumRows();
  if(rows.length===0){
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Keine Treffer.</td></tr>`;
    return;
  }
  rows.forEach(t=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><b>${t.id_placeholder? '<span style="color:var(--muted);font-weight:400;font-style:italic;">noch offen</span>' : escHtml(t.id)}</b></td><td>${escHtml(t.sorte)||'–'}</td>
      <td><span class="pill ${(t.frucht||'sonstige').toLowerCase()}">${escHtml(t.frucht)||'–'}</span></td>
      <td>${escHtml(t.pflueckzeitpunkt||t.pflueck_reifezeit||'–')}</td>
      <td>${escHtml(t.standort_zeile||'–')}</td>`;
    tr.addEventListener('click', ()=>openBaumModal(t.id));
    tbody.appendChild(tr);
  });
}
['baum-search','baum-filter-frucht','baum-filter-verwendung'].forEach(id=>{
  document.getElementById(id).addEventListener('input', debounce(renderBaumTable, 200));
  document.getElementById(id).addEventListener('change', renderBaumTable);
});
document.getElementById('btn-baum-search-reset').addEventListener('click', ()=>{
  document.getElementById('baum-search').value = '';
  document.getElementById('baum-filter-frucht').value = '';
  document.getElementById('baum-filter-verwendung').value = '';
  renderBaumTable();
});

/* ---------- Export / Import / Reset ---------- */
function neuePdfKarte(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const colW = (W - 2*M - 10) / 2;
  const k = { doc, W, H, M, colW, y: 22 };

  k.ensure = function(h){ if(k.y + h > H - 15){ doc.addPage(); k.y = 20; } };

  k.kopf = function(titel, rechts, hinweis, hinweisFarbe){
    doc.setFont('times','bold'); doc.setFontSize(19); doc.setTextColor(62,43,34);
    doc.text(titel, M, k.y);
    if(rechts){
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(122,113,104);
      doc.text(rechts, W - M, k.y, {align:'right'});
    }
    k.y += 3;
    if(hinweis){
      doc.setFont('helvetica','normal'); doc.setFontSize(8);
      doc.setTextColor(hinweisFarbe[0], hinweisFarbe[1], hinweisFarbe[2]);
      doc.text(hinweis, M, k.y+3); k.y += 5;
    }
    doc.setDrawColor(217,180,88); doc.setLineWidth(0.4);
    doc.line(M, k.y+1, W - M, k.y+1);
    k.y += 9;
  };

  k.feldPaar = function(l1, v1, l2, v2){
    v1 = v1? String(v1) : ''; v2 = v2? String(v2) : '';
    if(!v1 && !v2) return;
    doc.setFontSize(9.5);
    const lines1 = v1? doc.splitTextToSize(v1, colW) : [];
    const lines2 = v2? doc.splitTextToSize(v2, colW) : [];
    const h = 4 + Math.max(lines1.length, lines2.length)*4.3 + 3;
    k.ensure(h);
    const x2 = M + colW + 10;
    doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(122,113,104);
    if(v1) doc.text(l1.toUpperCase(), M, k.y);
    if(v2) doc.text(l2.toUpperCase(), x2, k.y);
    doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(42,35,29);
    if(v1) doc.text(lines1, M, k.y+4);
    if(v2) doc.text(lines2, x2, k.y+4);
    k.y += h;
  };

  k.feldDrei = function(l1, v1, l2, v2, l3, v3){
    v1 = v1? String(v1) : ''; v2 = v2? String(v2) : ''; v3 = v3? String(v3) : '';
    if(!v1 && !v2 && !v3) return;
    const cw3 = (W - 2*M - 20) / 3;
    doc.setFontSize(9.5);
    const lines1 = v1? doc.splitTextToSize(v1, cw3) : [];
    const lines2 = v2? doc.splitTextToSize(v2, cw3) : [];
    const lines3 = v3? doc.splitTextToSize(v3, cw3) : [];
    const h = 4 + Math.max(lines1.length, lines2.length, lines3.length)*4.3 + 3;
    k.ensure(h);
    const x2 = M + cw3 + 10;
    const x3 = M + 2*(cw3 + 10);
    doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(122,113,104);
    if(v1) doc.text(l1.toUpperCase(), M, k.y);
    if(v2) doc.text(l2.toUpperCase(), x2, k.y);
    if(v3) doc.text(l3.toUpperCase(), x3, k.y);
    doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(42,35,29);
    if(v1) doc.text(lines1, M, k.y+4);
    if(v2) doc.text(lines2, x2, k.y+4);
    if(v3) doc.text(lines3, x3, k.y+4);
    k.y += h;
  };

  k.abschnitt = function(titel){
    k.ensure(16);
    k.y += 4;
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(46,63,42);
    doc.text(titel.toUpperCase(), M, k.y);
    doc.setDrawColor(217,180,88); doc.setLineWidth(0.3);
    doc.line(M, k.y+1.5, W - M, k.y+1.5);
    k.y += 7;
  };

  k.absatz = function(txt, punkt){
    if(!txt) return;
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(42,35,29);
    const lines = doc.splitTextToSize((punkt? '• ' : '')+String(txt), W - 2*M);
    lines.forEach(ln=>{ k.ensure(5); doc.text(ln, M, k.y); k.y += 4.5; });
    if(!punkt) k.y += 2;
  };

  return k;
}

function exportBaumKartePDF(id){
  if(!window.jspdf){ alert('PDF-Bibliothek konnte nicht geladen werden – Internetverbindung nötig.'); return; }
  const t = getTree(id);
  if(!t) return;
  const sorteInfo = getSorte(t.sorte);
  const merged = Object.assign({}, sorteInfo||{}, t);
  const k = neuePdfKarte();
  const {doc} = k;
  const feldPaar = k.feldPaar, feldDrei = k.feldDrei, abschnitt = k.abschnitt, absatz = k.absatz;

  let hinweis = null, hinweisFarbe = null;
  if(state.verifiziert[t.sorte]){ hinweis = 'Verifiziert am '+state.verifiziert[t.sorte]; hinweisFarbe = [46,63,42]; }
  else if(sorteInfo && sorteInfo.recherchiert){ hinweis = 'Sortenangaben web-recherchiert – bitte prüfen'; hinweisFarbe = [138,90,0]; }
  k.kopf(t.sorte || 'Unbekannte Sorte', t.id_placeholder? 'ID noch offen' : 'ID '+t.id, hinweis, hinweisFarbe);

  const mittel = t.sorte ? calcPfluckMittel(t.sorte) : null;
  const mittelText = mittel ? ' → '+mittel.wert+' ('+mittel.anzahl+' Ernten, '+mittel.jahre.join(', ')+')' : '';
  const pflBeschreibung = merged.pflueckzeitpunkt||merged.pflueck_reifezeit||'';

  feldDrei('Obstart', t.frucht, 'Pflückreife lt. Beschreibung', pflBeschreibung, 'Pflückreife ermittelt', mittelText||'–');
  feldPaar('Verwendung', (merged.verwendung||[]).join(', ')||'–', 'Genussreife', formatGenuss(merged.genuss_von,merged.genuss_bis,merged.genussreife,merged.genuss));
  feldDrei('Gepflanzt', t.ausgepflanzt, 'Veredelt', t.veredelt, 'Unterlage', t.unterlage);
  feldPaar('Ertrag', merged.ertrag, 'Befruchtungspartner', merged.befruchtungspartner);
  feldPaar('Erstmals tragend', t.erstmals_tragend, 'Lagerfähigkeit', merged.lagerfaehig);
  feldPaar('Herkunft', merged.herkunft_jahr||merged.herkunft, '', '');

  if(merged.geschmack){ abschnitt('Geschmack / Nutzung'); absatz(merged.geschmack); }
  if(merged.frucht_beschreibung){ abschnitt('Frucht'); absatz(merged.frucht_beschreibung); }
  if(merged.eigenschaften || merged.standort_anspruch){
    abschnitt('Eigenschaften / Standortansprüche');
    absatz(((merged.eigenschaften||'')+' '+(merged.standort_anspruch||'')).trim());
  }
  if(merged.frucht){
    abschnitt('Begleitpflanzungen & Gilden');
    const g=getGuildRecommendations(merged.frucht);
    const cats=[{key:'naehrstoff',label:'Naehrstoff-Akkumulatoren'},{key:'boden',label:'Bodenverbesserer'},{key:'schaedling',label:'Schaedlingsabwehr'},{key:'bestaeuber',label:'Bestaeuber-Anziehung'}];
    cats.forEach(c=>{ const items=g[c.key]; if(items&&items.length) absatz(c.label+': '+items.join(', ')); });
    if(g.warnung&&g.warnung.length) absatz(g.warnung.join(' '));
  }

  abschnitt('Lageplan');
  absatz(state.positions[id] ? 'Position im Lageplan gesetzt.' : (state.satPositions||{})[id] ? 'Position im Satellit gesetzt.' : 'Noch keine Position gesetzt.');

  const sukz = (state.sukzession[id]||[]).slice().sort((a,b)=>b.jahr-a.jahr);
  if(sukz.length){
    abschnitt('Sukzessions-Dokumentation');
    sukz.forEach(it=> absatz(`${it.jahr} — ${it.text}`, true));
    k.y += 2;
  }
  const ernten = (state.ernten[id]||[]).slice().sort((a,b)=> (b.datum||'').localeCompare(a.datum||''));
  if(ernten.length){
    abschnitt('Ernte-Dokumentation');
    ernten.forEach(it=> absatz(`${it.datum||'–'} — ${it.menge||''}${it.bemerkung? ' ('+it.bemerkung+')':''}`, true));
  }

  const safeSorte = (t.sorte||'Baum').replace(/[^A-Za-z0-9ÄÖÜäöüß]+/g,'_').replace(/^_+|_+$/g,'');
  doc.save(`Baumkarte_${t.id_placeholder? 'neu' : t.id}_${safeSorte}.pdf`);
}

function exportSortenKartePDF(sorteName){
  if(!window.jspdf){ alert('PDF-Bibliothek konnte nicht geladen werden – Internetverbindung nötig.'); return; }
  const s = getSorte(sorteName);
  if(!s) return;
  const k = neuePdfKarte();
  const {doc} = k;
  const feldPaar = k.feldPaar, abschnitt = k.abschnitt, absatz = k.absatz;

  let hinweis = null, hinweisFarbe = null;
  if(state.verifiziert[s.sorte]){ hinweis = 'Verifiziert am '+state.verifiziert[s.sorte]; hinweisFarbe = [46,63,42]; }
  else if(s.recherchiert){ hinweis = 'Web-recherchiert – bitte prüfen'; hinweisFarbe = [138,90,0]; }
  k.kopf(s.sorte, null, hinweis, hinweisFarbe);

  const mittel = calcPfluckMittel(s.sorte);
  const mittelText = mittel ? ' → '+mittel.wert+' ('+mittel.anzahl+' Ernten, '+mittel.jahre.join(', ')+')' : '';

  feldPaar('Obstart', s.frucht, 'Pflückreife', s.pflueckzeitpunkt||s.pflueck_reifezeit);
  if(mittelText){ feldPaar('Pflückreife ermittelt', mittel.wert+' ('+mittel.anzahl+' Ernten, '+mittel.jahre.join(', ')+')', '', ''); }
  feldPaar('Verwendung', (s.verwendung||[]).join(', '), 'Genussreife', formatGenuss(s.genuss_von,s.genuss_bis,s.genussreife,s.genuss));
  feldPaar('Pflanzjahr', s.ausgepflanzt, 'Ertrag', s.ertrag);
  feldPaar('Veredelungsjahr', s.veredelt, 'Unterlage', s.unterlage);
  feldPaar('Erstmals tragend', s.erstmals_tragend, 'Lagerfähigkeit', s.lagerfaehig);
  feldPaar('Befruchtungspartner', s.befruchtungspartner, 'Herkunft', s.herkunft_jahr||s.herkunft);
  feldPaar('Anzahl Bäume', (s.baum_ids||[]).length + ' (' + (s.baum_ids||[]).join(', ') + ')', 'Synonyme', s.synonyme);

  if(s.frucht_beschreibung){ abschnitt('Frucht'); absatz(s.frucht_beschreibung); }
  if(s.geschmack){ abschnitt('Geschmack / Nutzung'); absatz(s.geschmack); }
  if(s.eigenschaften || s.standort_anspruch){
    abschnitt('Eigenschaften / Standortansprüche');
    absatz(((s.eigenschaften||'')+' '+(s.standort_anspruch||'')).trim());
  }
  if(s.recherchiert && s.quelle){ abschnitt('Quelle(n)'); absatz(s.quelle); }

  const safeSorte = (s.sorte||'Sorte').replace(/[^A-Za-z0-9ÄÖÜäöüß]+/g,'_').replace(/^_+|_+$/g,'');
  doc.save(`Sortenkarte_${safeSorte}.pdf`);
}

function exportSortenbeschreibungenPDF(){
  if(!window.jspdf){ alert('PDF-Bibliothek konnte nicht geladen werden – Internetverbindung nötig.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const maxWidth = pageWidth - margin*2;
  let y = 20;
  const suche=(document.getElementById('sl-search').value||'').toLowerCase();
  const qVal=document.getElementById('sb-filter-quelle')?.value||'';
  const verwVal=document.getElementById('sb-filter-verwendung')?.value||'';
  const fruchtVal=(document.getElementById('sb-filter-frucht')?.value||'').toLowerCase();
  let pool=getAllSorten();
  if(qVal) pool=pool.filter(s=>s.quelle===qVal);
  if(fruchtVal) pool=pool.filter(s=>(s.frucht||'').toLowerCase()===fruchtVal);
  if(verwVal) pool=pool.filter(s=>(s.verwendung||[]).includes(verwVal));
  if(suche) pool=pool.filter(s=>s.name.toLowerCase().includes(suche)||(s.beschreibung||'').toLowerCase().includes(suche)||(s.tags||[]).some(t=>t.toLowerCase().includes(suche)));
  pool.sort((a,b)=>a.name.localeCompare(b.name,'de'));
  if(!pool.length){ alert('Keine Sorten zum Exportieren gefunden.'); return; }
  doc.setFontSize(16);
  doc.text('Hendlberghof – Sortenbeschreibungen', margin, y); y+=10;
  doc.setFontSize(9);
  doc.text(pool.length+' Sorten · '+new Date().toLocaleDateString('de-AT'), margin, y); y+=8;
  const ensureSpace = (needed)=>{
    if(y + needed > pageHeight - margin){ doc.addPage(); y = 20; }
  };
  const addParagraph = (label, text)=>{
    if(!text) return;
    ensureSpace(10);
    doc.setFont(undefined,'bold');
    doc.setFontSize(9);
    doc.text(label+':', margin, y); y+=5;
    doc.setFont(undefined,'normal');
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach(line=>{ ensureSpace(5); doc.text(line, margin, y); y+=5; });
    y+=2;
  };
  pool.forEach(s=>{
    ensureSpace(16);
    doc.setFont(undefined,'bold');
    doc.setFontSize(13);
    doc.text(s.name, margin, y); y+=6;
    doc.setFont(undefined,'normal');
    doc.setFontSize(9);
    const metaLine = s.frucht + ((s.verwendung&&s.verwendung.length)? ' · '+s.verwendung.join(', ') : '');
    doc.text(metaLine, margin, y); y+=6;
    addParagraph('Geschmack', s.geschmack);
    addParagraph('Eigenschaften', s.eigenschaften);
    addParagraph('Frucht', s.beschreibung||s.frucht_beschreibung);
    y += 6;
  });
  doc.save(`Sortenbeschreibungen_${new Date().toISOString().slice(0,10)}.pdf`);
}

function exportLageplanPDF(){
  if(!window.jspdf){ alert('PDF-Bibliothek konnte nicht geladen werden – Internetverbindung nötig.'); return; }
  const img = document.getElementById('map-img');
  if(!img || !img.naturalWidth){ alert('Die Lagekarte ist noch nicht geladen.'); return; }
  const cw = 1600;
  const ch = Math.round(cw * img.naturalHeight / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, cw, ch);
  const farben = {apfel:'#dc2626', birne:'#22c55e', walnuss:'#b98e1a', zwetschke:'#6b21a8', kirsch:'#be185d', marille:'#f59e0b', quitte:'#84cc16', pflaume:'#7c3aed', sonne:'#f97316'};
  const r = cw * 0.008;
  Object.entries(state.positions).forEach(([id,pos])=>{
    const t = getTree(id);
    const farbe = t? (farben[(t.frucht||'').toLowerCase()]||'#B2543A') : '#B2543A';
    const px = pos.x/100*cw, py = pos.y/100*ch;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2);
    ctx.fillStyle = farbe; ctx.fill();
    ctx.lineWidth = r*0.3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  });
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  doc.setFont('times','bold'); doc.setFontSize(16); doc.setTextColor(62,43,34);
  doc.text('Hendlberghof – Lageplan', M, 16);
  doc.setDrawColor(217,180,88); doc.setLineWidth(0.4);
  doc.line(M, 19, W - M, 19);
  const availW = W - 2*M, availH = H - 23 - 16;
  let iw = availW, ih = iw * ch/cw;
  if(ih > availH){ ih = availH; iw = ih * cw/ch; }
  doc.addImage(dataUrl, 'JPEG', (W - iw)/2, 23, iw, ih);
  let ly = 23 + ih + 6;
  if(ly < H - 6){
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const legende = [['Apfel',220,38,38],['Birne',34,197,94],['Walnuss',185,142,26]];
    let lx = M;
    legende.forEach(([name,rr,gg,bb])=>{
      doc.setFillColor(rr,gg,bb);
      doc.circle(lx+1.5, ly-1.2, 1.5, 'F');
      doc.setTextColor(42,35,29);
      doc.text(String(name), lx+5, ly);
      lx += 26;
    });
  }
  doc.save(`Lageplan_${new Date().toISOString().slice(0,10)}.pdf`);
}

/* Legacy removed - renderResults() is the canonical function */

/* ---------- Modal: Baum-Detail ---------- */
function fieldRow(label, val){
  if(val === undefined || val === null || val === '') return `<div class="field"><b>${label}</b>–</div>`;
  return `<div class="field"><b>${label}</b>${escHtml(String(val))}</div>`;
}
function fieldGrid(fields){
  const present = fields.filter(([_,v])=>v !== undefined && v !== null && v !== '');
  if(!present.length) return '';
  const cols = present.length >= 3 ? 3 : present.length >= 2 ? 2 : 1;
  const cells = present.map(([l,v])=>`<div class="field"><b>${l}</b>${escHtml(String(v))}</div>`).join('');
  return `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:0;border:1px solid var(--rand);border-radius:10px;overflow:hidden;margin-bottom:8px;">${cells}</div>`;
}

function archeNoahLink(obj){
  const pdf = obj && (obj.arche_pdf || obj.pdf);
  if(!pdf) return '';
  const sorte = escAttr(obj.sorte||obj.name||'');
  return `<button type="button" class="arche-link" onclick="openArcheViewer('${escAttr(pdf)}','${sorte}')" title="Arche-Noah-Sortenblatt (PDF) anzeigen">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="margin-right:6px;">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    Sortenblatt: Arche Noah</button>`;
}

function openArcheViewer(url, sorte){
  document.getElementById('pdf-title').textContent = (sorte? sorte+' · ' : '') + 'Sortenblatt Arche Noah';
  const dl = document.getElementById('pdf-download');
  dl.href = url;
  const stem = (sorte||'Sortenblatt').replace(/[^A-Za-z0-9ÄÖÜäöüß]+/g,'_').replace(/^_+|_+$/g,'');
  dl.setAttribute('download', 'Arche-Noah_'+stem+'.pdf');
  document.getElementById('pdf-overlay').classList.add('open');
  const container = document.getElementById('pdf-frame');
  container.innerHTML = '<p style="text-align:center;padding:2rem;color:#7a7a7a;">Lade Vorschau …</p>';
  if(typeof pdfjsLib!=='undefined'){
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfjsLib.getDocument(url).promise.then(function(pdf){
      container.innerHTML='';
      var renderPage=function(pageNum){
        pdf.getPage(pageNum).then(function(page){
          var scale=(container.clientWidth-20)/page.getViewport({scale:1}).width;
          var viewport=page.getViewport({scale:scale});
          var canvas=document.createElement('canvas');
          canvas.width=viewport.width;canvas.height=viewport.height;
          canvas.style.display='block';canvas.style.margin='10px auto';
          container.appendChild(canvas);
          page.render({canvasContext:canvas.getContext('2d'),viewport:viewport});
        });
      };
      for(var i=1;i<=pdf.numPages;i++) renderPage(i);
    }).catch(function(){
      container.innerHTML='<p style="text-align:center;padding:2rem;">Vorschau nicht verfügbar. <a href="'+url+'" target="_blank" rel="noopener">PDF öffnen</a></p>';
    });
  } else {
    container.innerHTML='<iframe src="'+url+'" style="width:100%;height:100%;border:none;"></iframe>';
  }
}
function closeArcheViewer(){
  document.getElementById('pdf-overlay').classList.remove('open');
  document.getElementById('pdf-frame').innerHTML='';
}

const VERWENDUNG_OPTIONEN = ['Tafelobst','Wirtschaftsobst','Saft/Most','Sonstiges'];

function getSorte(sorteName){
  const s = SORTEN_DATA.find(x=>x.sorte===sorteName);
  if(!s) return null;
  const edit = (state.sortenEdits && state.sortenEdits[sorteName]) || {};
  return Object.assign({}, s, edit);
}

/* ---------- Merklisten ----------
   Ersetzt den früheren Warenkorb, der als flache Liste im localStorage lag
   ('hendlberghof_cart') und deshalb nur auf einem Gerät existierte.

   Zwei Formen unter einem Dach:
     merklisten.eigen     { konfigurationen: [Baumkonfiguration], geaendert }
     merklisten[<qid>]    { positionen: [{sorte, unterlage, alter, preis, …}], geaendert }

   Getrennt nach Lieferant, weil jede Bestellung an einen anderen Empfänger geht —
   eine gemeinsame Liste müsste vor dem Absenden ohnehin wieder aufgeteilt werden.
   Die Eigenproduktion führt konfigurierte Bäume statt Positionen; der Konfigurator
   füllt `konfigurationen` später (S3), das Fach steht schon bereit.

   Liegt in `state` und wandert damit über Firestore auf alle Geräte: am Handy im
   Garten merken, am Rechner bestellen. Genau das konnte der alte Warenkorb nicht. */

const MERKLISTE_EIGEN = 'eigen';

function getMerkliste(qid){
  if(!state.merklisten) state.merklisten = {};
  if(!state.merklisten[qid]){
    state.merklisten[qid] = (qid === MERKLISTE_EIGEN)
      ? { konfigurationen: [], geaendert: '' }
      : { positionen: [], geaendert: '' };
  }
  return state.merklisten[qid];
}

/* Flache Sicht über alle Lieferantenlisten — die Form, in der die vorhandene
   Bestelloberfläche arbeitet. `qid` wird je Eintrag mitgeführt. */
function merkPositionenFlach(){
  const raus = [];
  const m = (typeof state !== 'undefined' && state && state.merklisten) || {};
  Object.keys(m).forEach(qid=>{
    if(qid === MERKLISTE_EIGEN) return;
    ((m[qid] || {}).positionen || []).forEach(p => raus.push(Object.assign({}, p, {qid})));
  });
  return raus;
}

/* Gegenstück: schreibt die flache Liste zurück in die Fächer je Lieferant.
   Lieferantenlisten werden dabei neu aufgebaut, `eigen` bleibt unberührt. */
function schreibeMerklistenZurueck(positionen){
  if(!state.merklisten) state.merklisten = {};
  Object.keys(state.merklisten).forEach(qid=>{
    if(qid !== MERKLISTE_EIGEN) delete state.merklisten[qid];
  });
  const jetzt = new Date().toISOString();
  (positionen || []).forEach(p=>{
    const qid = p.qid || 'unbekannt';
    const liste = getMerkliste(qid);
    const kopie = Object.assign({}, p);
    delete kopie.qid;                    /* steckt schon im Schlüssel */
    liste.positionen.push(kopie);
    liste.geaendert = jetzt;
  });
}

function merkAnzahl(){
  const eigen = ((state.merklisten || {})[MERKLISTE_EIGEN] || {}).konfigurationen || [];
  return merkPositionenFlach().length + eigen.length;
}

/* Einmalige Übernahme des alten Warenkorbs. Mehrfach aufrufbar: Positionen mit
   gleicher Sorte, Unterlage und Alter werden nicht doppelt angelegt — nötig, weil
   jedes Gerät seinen eigenen alten Warenkorb mitbringt.
   Der alte Schlüssel wird NICHT gelöscht, sondern umbenannt: Die neue Ablage geht
   in die Cloud, und wenn dabei etwas schiefginge, wäre der alte Stand sonst
   unwiederbringlich. Aufräumen kann man ihn später von Hand. */
function migriereAltenWarenkorb(){
  const ALT = 'hendlberghof_cart';
  let roh = null;
  try { roh = localStorage.getItem(ALT); } catch(e){ return 0; }
  if(!roh) return 0;

  let alt = null;
  try { alt = JSON.parse(roh); } catch(e){ alt = null; }

  let uebernommen = 0;
  if(Array.isArray(alt)){
    alt.forEach(e=>{
      if(!e || !e.sorte) return;
      const liste = getMerkliste(e.qid || 'unbekannt');
      const schonDa = liste.positionen.some(p =>
        p.sorte === e.sorte
        && (p.unterlage || '') === (e.unterlage || '')
        && (p.alter || '') === (e.alter || ''));
      if(schonDa) return;
      liste.positionen.push({
        sorte: e.sorte, quelle: e.quelle || '', email: e.email || '',
        unterlage: e.unterlage || '', alter: e.alter || '',
        preis: e.preis, mwst_satz: e.mwst_satz || 13, menge: e.menge || 1
      });
      liste.geaendert = new Date().toISOString();
      uebernommen++;
    });
  }
  try {
    localStorage.setItem(`${ALT}_migriert_${new Date().toISOString().slice(0,10)}`, roh);
    localStorage.removeItem(ALT);
  }catch(e){ /* Speicher voll oder gesperrt — die Übernahme selbst steht schon */ }
  if(uebernommen) saveState();
  return uebernommen;
}

/* ---------- Bestellbarkeit einer Sorte ----------
   Liefert genau einen Zustand, damit die Arche-Noah-Regel und die Sortenschutz-
   Sperre an einer Stelle stehen statt verstreut in den Karten-Renderern.

   Zustände (Abschnitt 4 des Plans):
     nur_beratung      Arche-Noah-Sorte — grundsätzlich nicht käuflich
     eigenproduktion   selbst veredelbar, Vorbestellung möglich
     fremdlieferant    bei einer aktiven Preisquelle gelistet
     gesperrt          Sortenschutz, und kein anderer Weg vorhanden
     nicht_verfuegbar  sonst — mit Angabe des Grundes

   Zwei Feinheiten, die man leicht falsch macht:

   1. Der Sortenschutz sperrt NUR die Eigenveredelung. Eine Baumschule hat ihre
      Lizenzen; ist die Sorte dort gelistet, gilt fremdlieferant, nicht gesperrt.
      So steht es in Abschnitt 8, Maßnahme 3.
   2. Beide Kaufwege können gleichzeitig gelten. Deshalb liefert die Funktion
      neben `zustand` auch `eigenproduktion` und `lieferanten` — die Oberfläche
      kann daraus eine Auswahl bauen. `zustand` nennt nur den vorrangigen Weg.

   `vermehrung` gilt als 'unklar', solange nichts Belastbares hinterlegt ist, und
   sperrt dann die Eigenveredelung. Bewusst so: lieber eine Sorte zu wenig
   anbieten als eine zu viel. Geklärt wird das ausschließlich über CPVO Variety
   Finder und AGES — die Triage in Abschnitt 8 ist Vorarbeit, keine Rechtsauskunft.

   `als_reiser_verfuegbar` ist dagegen betrieblich, nicht rechtlich gemeint: Ist
   der Musterbaum zu jung oder krank, wird das Feld auf false gesetzt. Fehlt es,
   gilt es als erfüllt — die vorsichtige Sperre leistet bereits `vermehrung`, und
   zwei Sperren mit demselben Standard würden nur verschleiern, welche greift. */

const VERMEHRUNG_FREI = 'frei';
const VERMEHRUNG_GESCHUETZT = 'geschuetzt';
const VERMEHRUNG_UNKLAR = 'unklar';

function getVermehrung(sorteName){
  const s = getSorte(sorteName);
  const wert = String((s && s.vermehrung) || '').trim().toLowerCase();
  return (wert === VERMEHRUNG_FREI || wert === VERMEHRUNG_GESCHUETZT)
    ? wert : VERMEHRUNG_UNKLAR;
}

/* Aktive Preisquellen, die diese Sorte führen. Fehlendes `aktiv` gilt als aktiv,
   damit bestehende Quellen ohne das Feld weiter funktionieren.

   Der Abgleich ist bewusst unscharf. Preislisten kommen von Baumschulen und
   führen Kurzformen: „Peasgood" gegen „Peasgoods Sondergleichen" im Katalog.
   Ein exakter Vergleich fände solche Einträge nicht — genau das war beim ersten
   Bau dieser Funktion der Fall und blieb unbemerkt, weil derselbe Eintrag über
   den älteren, unscharfen Weg sehr wohl angezeigt wurde. */
function _sortenSchluessel(s){
  return String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
}

function getFremdlieferanten(sorteName){
  const gesucht = _sortenSchluessel(sorteName);
  if(!gesucht) return [];
  const listen = (typeof state !== 'undefined' && state && state.preislisten) || {};
  const treffer = [];
  Object.keys(listen).forEach(qid=>{
    const q = listen[qid] || {};
    if(q.aktiv === false) return;
    (q.preise || []).forEach(p=>{
      if(!p.sorte) return;
      const ps = _sortenSchluessel(p.sorte);
      const passt = ps === gesucht || ps.includes(gesucht) || gesucht.includes(ps)
                    || (typeof levenshtein === 'function' && levenshtein(ps, gesucht) <= 2);
      if(passt){
        treffer.push({
          qid, name: q.name || qid, email: q.email || '', eintrag: p,
          preis: p.preis, unterlage: p.unterlage || '', alter: p.alter || '',
          vorbestellbar: !!p.vorbestellbar, mwst_satz: p.mwst_satz || 13,
          quelle: q.name || qid
        });
      }
    });
  });
  return treffer;
}

function getBestellbarkeit(sorteName, info){
  const name = String(sorteName || '').trim();
  const katalog = getSorte(name);
  /* Ohne Angabe abgeleitet: Was im Katalog steht, wächst am Hof; sonst zählt, ob
     die Sorte im Arche-Noah-Bestand geführt wird. Ein unbekannter Name darf NICHT
     als Arche-Noah-Sorte durchgehen — „nicht gefunden" ist etwas anderes als
     „nur zur Beratung", und die falsche Auskunft wäre die beruhigendere. */
  const quelle = (info && info.quelle)
    || (katalog ? 'hof'
        : (typeof AN_SORTEN !== 'undefined' && AN_SORTEN.some(a=>a.name===name)) ? 'arche'
        : 'unbekannt');
  const frucht = (info && info.frucht) || (katalog && katalog.frucht) || '';
  const vermehrung = getVermehrung(name);

  const erg = {
    sorte: name, quelle, frucht, vermehrung,
    hinweis: (katalog && katalog.vermehrung_hinweis) || '',
    sortenschutz: vermehrung === VERMEHRUNG_GESCHUETZT,
    eigenproduktion: false,
    lieferanten: [],
    zustand: 'nicht_verfuegbar',
    grund: ''
  };

  /* 0. Name führt nirgendwohin — eigener Zustand, damit ein Tippfehler in einer
        Preisliste sichtbar wird, statt als harmlose Beratungssorte zu erscheinen. */
  if(quelle === 'unbekannt'){
    erg.zustand = 'nicht_verfuegbar';
    erg.grund = name ? `Sorte „${name}“ ist weder im Katalog noch bei Arche Noah hinterlegt.`
                     : 'Keine Sorte angegeben.';
    return erg;
  }

  /* 1. Arche Noah steht vor allem anderen — nie käuflich, reine Beratung. */
  if(quelle === 'arche'){
    erg.zustand = 'nur_beratung';
    erg.grund = 'Arche-Noah-Sorte — nur zur Beratung, nicht im Verkauf.';
    return erg;
  }

  erg.lieferanten = getFremdlieferanten(name);

  const regel = getObstartRegel(frucht);
  const reiserDa = katalog ? katalog.als_reiser_verfuegbar !== false : false;
  erg.eigenproduktion = regel.veredelung && vermehrung === VERMEHRUNG_FREI && reiserDa;

  /* 2. Eigenveredelung hat Vorrang — das ist das Kernprodukt. */
  if(erg.eigenproduktion){
    erg.zustand = 'eigenproduktion';
    erg.grund = 'Vorbestellung — wird auf Wunsch veredelt.';
    return erg;
  }

  /* 3. Sonst über eine Preisquelle. Gilt auch bei Sortenschutz: Die Baumschule
        hat ihre Lizenzen, gesperrt ist nur die eigene Vermehrung. */
  if(erg.lieferanten.length){
    erg.zustand = 'fremdlieferant';
    erg.grund = erg.lieferanten.length === 1
      ? `Lieferbar über ${erg.lieferanten[0].name}.`
      : `Lieferbar über ${erg.lieferanten.length} Quellen.`;
    return erg;
  }

  /* 4. Sortenschutz ohne anderen Weg. */
  if(erg.sortenschutz){
    erg.zustand = 'gesperrt';
    erg.grund = 'Sortenschutz — eigene Vermehrung nicht zulässig.';
    return erg;
  }

  /* 5. Sonst: Grund benennen, statt nur „nicht verfügbar" zu zeigen. */
  if(!frucht) erg.grund = 'Obstart nicht hinterlegt.';
  else if(!regel.veredelung)
    erg.grund = regel.bekannt
      ? `Für ${frucht} wird derzeit keine Veredelung angeboten.`
      : `Obstart ${frucht} ist nicht hinterlegt — bitte in den Obstart-Regeln ergänzen.`;
  else if(vermehrung === VERMEHRUNG_UNKLAR)
    erg.grund = 'Vermehrungsrecht noch nicht geklärt — bis dahin gesperrt.';
  else if(!reiserDa) erg.grund = 'Derzeit kein Reiserholz verfügbar.';
  else erg.grund = 'Derzeit nicht verfügbar.';
  return erg;
}

/* ---------- Kaufblock — eine Stelle für alle Karten ----------
   Bisher lag der Preisblock zweimal wortgleich im Sortenberater, in Sorten- und
   Baum-Modal fehlte er ganz. Jede Regeländerung hätte an mehreren Stellen
   nachgezogen werden müssen — genau so entstehen Abweichungen wie die eben
   behobene doppelte Preiszuordnung.

   Verwendet in vier Karten: Sortenübersicht, Berater-Empfehlung, Sorten-Modal,
   Baum-Modal. Der Einstieg in den Konfigurator (S3) wird später hier eingehängt,
   dann an einer Stelle statt an vier.

   kontext: { quelle, frucht, kompakt } — kompakt kürzt für die schmalen
   Berater-Karten. */
function renderShopBlock(sorteName, kontext){
  const k = kontext || {};
  const b = getBestellbarkeit(sorteName, k);
  const eng = !!k.kompakt;
  const sn = escAttr(sorteName);
  const rahmen = inhalt => `<div class="shop-block${eng ? ' eng' : ''}">${inhalt}</div>`;

  if(b.zustand === 'nur_beratung')
    return rahmen(`<span class="shop-hinweis">Nur zur Beratung — Arche-Noah-Sorten sind nicht käuflich.</span>`);

  const teile = [];

  /* Eigenveredelung. Bis der Konfigurator steht (S3), wandert die Sorte als
     einfacher Wunsch in die Merkliste; S3 ersetzt das durch die Konfiguration. */
  if(b.eigenproduktion){
    teile.push(
      `<div class="shop-zeile">
         <span class="shop-preis">Vorbestellung</span>
         <span class="shop-quelle">wird auf Wunsch veredelt</span>
         <button class="btn secondary shop-btn"
                 onclick="event.stopPropagation();merkEigenHinzu('${sn}')">Zur Liste hinzufügen</button>
       </div>`);
  }

  /* Fremdlieferanten — je Preiseintrag eine Zeile. */
  b.lieferanten.forEach(l=>{
    const zusatz = [l.unterlage, l.alter].filter(Boolean).join(' ');
    const preis = (typeof l.preis === 'number') ? l.preis.toFixed(2) + ' EUR' : 'Preis auf Anfrage';
    const daten = escAttr(JSON.stringify({
      qid: l.qid, quelle: l.quelle, email: l.email, preis: l.preis,
      unterlage: l.unterlage, alter: l.alter, mwst_satz: l.mwst_satz
    }));
    teile.push(
      `<div class="shop-zeile">
         <span class="shop-preis">${preis}</span>
         <span class="shop-quelle">(${escHtml(l.name)}${zusatz ? ' ' + escHtml(zusatz) : ''})</span>
         <button class="btn secondary shop-btn"
                 onclick="event.stopPropagation();addToBestellliste('${sn}', JSON.parse(this.dataset.p))"
                 data-p="${daten}">Zur Liste hinzufügen</button>
         ${l.vorbestellbar ? '<span class="shop-hinweis">vorbestellbar</span>' : ''}
       </div>`);
  });

  if(teile.length) return rahmen(teile.join(''));

  /* Kein Kaufweg — Grund nennen statt nur auszugrauen. */
  const klasse = b.zustand === 'gesperrt' ? 'shop-gesperrt' : 'shop-hinweis';
  return rahmen(`<span class="${klasse}">${escHtml(b.grund)}</span>`);
}

/* Einfacher Merkeintrag für die Eigenproduktion. S3 ersetzt das durch eine
   vollständige Baumkonfiguration; das Feld `konfiguriert` unterscheidet beide. */
function merkEigenHinzu(sorteName){
  const liste = getMerkliste(MERKLISTE_EIGEN);
  if(liste.konfigurationen.some(k => k.sorte === sorteName && !k.konfiguriert)){
    showToast(`„${sorteName}" steht bereits auf der Liste.`, 'info');
    return;
  }
  const s = getSorte(sorteName);
  liste.konfigurationen.push({
    id: 'W' + Date.now().toString(36),
    sorte: sorteName,
    frucht: (s && s.frucht) || '',
    menge: 1,
    konfiguriert: false,          /* noch kein Baum zusammengestellt */
    angelegt: new Date().toISOString()
  });
  liste.geaendert = new Date().toISOString();
  saveState();
  updateCartBadge();
  showToast(`„${sorteName}" zur Liste hinzugefügt.`, 'success');
}

/* Menge und Entfernen für die Eigenproduktions-Merkliste. Adressiert wird über
   die stabile `id`, nicht über den Listenindex: Die Ansicht wird nach jeder
   Änderung neu aufgebaut, und ein Index hätte auf einen anderen Eintrag gezeigt,
   sobald zwischenzeitlich etwas wegfiel. */
function _merkEigenFinden(id){
  const liste = getMerkliste(MERKLISTE_EIGEN);
  const idx = liste.konfigurationen.findIndex(k => k.id === id);
  return { liste, idx };
}

function merkEigenMenge(id, menge){
  const { liste, idx } = _merkEigenFinden(id);
  if(idx < 0) return;
  const n = parseInt(menge, 10) || 0;
  if(n <= 0) liste.konfigurationen.splice(idx, 1);
  else liste.konfigurationen[idx].menge = n;
  liste.geaendert = new Date().toISOString();
  saveState();
  if(typeof renderBestellModalContent === 'function') renderBestellModalContent();
  updateCartBadge();
}

function merkEigenEntfernen(id){
  const { liste, idx } = _merkEigenFinden(id);
  if(idx < 0) return;
  liste.konfigurationen.splice(idx, 1);
  liste.geaendert = new Date().toISOString();
  saveState();
  if(typeof renderBestellModalContent === 'function') renderBestellModalContent();
  updateCartBadge();
}

function toggleVerwendung(sorteName, cat){
  const s = getSorte(sorteName);
  const current = ((s && s.verwendung) || []).slice();
  const idx = current.indexOf(cat);
  if(idx>=0) current.splice(idx,1); else current.push(cat);
  if(!state.sortenEdits) state.sortenEdits = {};
  if(!state.sortenEdits[sorteName]) state.sortenEdits[sorteName] = {};
  state.sortenEdits[sorteName].verwendung = current;
  saveState();
  renderBaumTable();
}

function verwendungField(sorteName, arr){
  if(!isAdmin()){
    return fieldRow('Verwendung', (arr||[]).join(', '));
  }
  const safeName = escAttr(sorteName);
  return `<div class="field" style="grid-column:1 / -1;"><b>Verwendung</b><div class="verwendung-edit">
    ${VERWENDUNG_OPTIONEN.map(c=>`<label style="margin-right:12px;font-weight:400;">
      <input type="checkbox" ${(arr||[]).includes(c)?'checked':''} onchange="toggleVerwendung('${safeName}','${c}'); reopenModalFor('${safeName}')"> ${c}
    </label>`).join('')}
  </div></div>`;
}

function reopenModalFor(sorteName){
  const overlay = document.getElementById('modal-content');
  if(overlay.dataset.modalType==='baum') openBaumModal(overlay.dataset.modalId);
  else openSortenModal(sorteName);
}

function openBaumModal(id){
  const t = getTree(id);
  if(!t) return;
  const sorteInfo = getSorte(t.sorte);
  const merged = Object.assign({}, sorteInfo||{}, t); // Baum-eigene Werte haben Vorrang, sonst Sorten-Fallback
  const ausSorte = sorteInfo && sorteInfo.recherchiert;
  const sukz = state.sukzession[id] || [];
  const ernten = state.ernten[id] || [];
  const originalPW = merged.pflueckzeitpunkt||merged.pflueck_reifezeit||'';
  const mittel = t.sorte ? calcPfluckMittel(t.sorte) : null;
  const prediction = t.sorte ? predictErnte(t.sorte) : null;
  const mittelText = mittel ? `<b style="color:var(--gruen);">→ ${mittel.wert}</b> <span style="font-size:.75rem;color:var(--text-mid,#6B7280);">(${mittel.anzahl} Ernten, ${mittel.jahre.join(', ')})</span>` : '';
  let predictionHtml = '';
  if(prediction){
    const sign = prediction.abweichungTage>0 ? '+' : '';
    predictionHtml = `<div style="margin-top:4px;font-size:.82rem;"><b>📊 Vorhersage ${new Date().getFullYear()}:</b> <b style="color:var(--waldrand);">${prediction.wert}</b> ${pfluckWertToText(prediction.wert)} <span style="color:var(--text-mid,#6B7280);font-size:.75rem;">(${sign}${prediction.abweichungTage} Tage vs. Standard)</span></div>`;
  }
  const html = `
    <button class="close" onclick="closeModal()">&times;</button>
    <button class="close" style="right:44px;" title="Bearbeiten" onclick="editBaumWithLogin('${id}')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false" style="vertical-align:middle;">
        <line x1="4" y1="7" x2="20" y2="7"/>
        <circle cx="14" cy="7" r="2.3"/>
        <line x1="4" y1="14" x2="20" y2="14"/>
        <circle cx="9" cy="14" r="2.3"/>
        <line x1="4" y1="21" x2="20" y2="21"/>
        <circle cx="16" cy="21" r="2.3"/>
      </svg>
    </button>
    <button class="close" style="right:76px;" title="Als PDF speichern" onclick="exportBaumKartePDF('${id}')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="vertical-align:middle;">
        <path d="M6 9V3h12v6"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <rect x="6" y="14" width="12" height="7"/>
      </svg>
    </button>
    ${ausSorte? `<div class="badge-recherche">🔍 Sortenangaben web-recherchiert – bitte prüfen</div>
      <button class="btn-verify" onclick="toggleVerifiziert('${escAttr(t.sorte)}', {baumId:'${escAttr(t.id)}'})">✓ Als verifiziert markieren</button>`
      : (state.verifiziert[t.sorte]? `<div class="badge-verifiziert">✓ Verifiziert am ${state.verifiziert[t.sorte]}</div>
      <button class="btn-verify done" onclick="toggleVerifiziert('${escAttr(t.sorte)}', {baumId:'${escAttr(t.id)}'})">Verifizierung zurücknehmen</button>` : '')}
    <h2>${t.sorte||'Unbekannte Sorte'} <span class="idbadge">${t.id_placeholder? 'ID noch offen' : 'ID '+t.id}</span></h2>
    ${archeNoahLink(merged)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--rand);border-radius:10px;overflow:hidden;margin-bottom:8px;">
      <div class="field"><b>Obstart</b>${escHtml(t.frucht||'')}</div>
      <div class="field"><b>Pflückreife lt. Beschreibung</b>${escHtml(originalPW||'')}</div>
      <div class="field"><b>Pflückreife ermittelt</b>${mittelText||predictionHtml||'–'}</div>
    </div>
    ${fieldGrid([
      ['Verwendung', (merged.verwendung||[]).join(', ')],
      ['Genussreife', formatGenuss(merged.genuss_von,merged.genuss_bis,merged.genussreife,merged.genuss)]
    ])}
    ${fieldGrid([
      ['Gepflanzt', t.ausgepflanzt],
      ['Veredelt', t.veredelt]
    ])}
    ${t.unterlage ? '<div style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--rand);border-radius:10px;margin-bottom:8px;font-size:.88rem;"><b>Unterlage</b> '+escHtml(t.unterlage)+' <a href="#" onclick="event.preventDefault();event.stopPropagation();showUnterlageInfo(\''+escAttr(t.sorte)+'\')" style="font-size:.78rem;color:var(--waldrand);text-decoration:underline;cursor:pointer;white-space:nowrap;">Info</a></div>' : ''}
    ${fieldGrid([
      ['Ertrag', merged.ertrag],
      ['Befruchtungspartner', merged.befruchtungspartner]
    ])}
    ${fieldGrid([
      ['Erstmals tragend', t.erstmals_tragend],
      ['Lagerfähigkeit', merged.lagerfaehig],
      ['Herkunft', merged.herkunft_jahr||merged.herkunft]
    ])}
    ${merged.geschmack? `<div class="section-title">Geschmack / Nutzung</div><div class="field">${escHtml(merged.geschmack)}</div>`:''}
    ${merged.frucht_beschreibung? `<div class="section-title">Frucht</div><div class="field">${escHtml(merged.frucht_beschreibung)}</div>`:''}
    ${merged.eigenschaften? `<div class="section-title">Eigenschaften / Standortansprüche</div><div class="field">${escHtml(merged.eigenschaften)} ${merged.standort_anspruch? escHtml(merged.standort_anspruch):''}</div>`:''}
    ${merged.frucht ? `<div class="section-title" style="cursor:pointer;color:var(--gruen);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;" onclick="showGuildQuellen()">Begleitpflanzungen & Gilden</div><div class="field">${renderGuildSection(merged.frucht)}</div>`:''}
    ${ausSorte? `<div class="quelle-hinweis"><b>Quelle(n):</b> ${sorteInfo.quelle}<br>Sortenangaben aus Web-Recherche, nicht aus deiner Numbers-Tabelle – bitte am Baum verifizieren.</div>`:''}

    <div class="section-title">Lageplan</div>
    ${state.positions[id]
      ? `<div class="field">
          <button class="btn-verify" onclick="showOnLageplan('${id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="vertical-align:-2px;margin-right:4px;"><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>Im Lageplan anzeigen</button>
          ${isAdmin()? `<button class="btn-verify" style="border-color:var(--dachziegel);color:var(--dachziegel);" onclick="removePosition('${id}')">Stecknadel entfernen</button>`:''}
        </div>`
      : `<div class="field empty">Noch keine Position im Lageplan gesetzt.</div>`}
    <div class="section-title">Sukzessions-Dokumentation</div>
    <ul class="log-list" id="sukz-list"></ul>
    ${isEditMode()? `<div class="addlog">
      <input type="date" id="sukz-datum">
      <input type="text" class="txt" id="sukz-text" placeholder="Beobachtung / Ereignis">
      <button class="btn secondary" onclick="addSukz('${t.id}')">+ Eintrag</button>
    </div>` : ''}

    <div class="section-title">Ernte-Dokumentation</div>
    ${isEditMode()? `<div class="addlog">
      <input type="date" id="ernte-datum">
      <input type="number" step="0.001" min="0" class="txt" id="ernte-menge" placeholder="Menge in kg" style="width:120px;">
      <input type="text" class="txt" id="ernte-bem" placeholder="Bemerkung">
      <button class="btn secondary" onclick="addErnte('${t.id}')">+ Eintrag</button>
    </div>` : ''}
    <ul class="log-list" id="ernte-list"></ul>
    <div id="ernte-chart-wrap" style="margin-bottom:10px;"></div>

    ${(isEditMode() || (state.phaenologie && Object.keys(state.phaenologie).some(y=>Object.keys(state.phaenologie[y]).length>0)))
      ? `<div class="section-title">Phänologie-Ereignisse</div>
    <div class="field" id="phaeno-display"></div>
    ${isEditMode()? `<div class="addlog" style="flex-wrap:wrap;">
      <select id="phaeno-key" class="txt" style="width:200px;">
        <option value="holunder_bluete">Schwarzer Holunder – Blühbeginn</option>
        <option value="holunder_vollbluete">Schwarzer Holunder – Vollblüte</option>
        <option value="knaeulgras_rispenschieben">Wiesen-Knäuelgras – Rispenschieben</option>
      </select>
      <input type="date" id="phaeno-datum">
      <button class="btn secondary" onclick="addPhaenoEreignis()">+ Eintrag</button>
    </div>` : ''}`
      : ''}
  `;
  /* Kaufblock: „nochmal so einen Baum" — der Besucher steht vor dem Muster
     und will genau diese Sorte. Ohne Sorte am Baum gibt es nichts anzubieten. */
  const shopHtml = t.sorte
    ? `<div class="section-title">Diese Sorte bestellen</div>`
      + renderShopBlock(t.sorte, {frucht: t.frucht})
    : '';
  document.getElementById('modal-content').innerHTML = html + shopHtml;
  document.getElementById('modal-content').dataset.modalType = 'baum';
  document.getElementById('modal-content').dataset.modalId = id;
  document.getElementById('overlay').classList.add('open');
  renderSukzList(id); renderErnteList(id); renderPhaenoDisplay();
}

function renderSukzList(id){
  const list = document.getElementById('sukz-list');
  if(!list) return;
  const src = state.sukzession[id]||[];
  const indices = src.map((_,i)=>i).sort((a,b)=>String(src[b].jahr||'').localeCompare(String(src[a].jahr||'')));
  list.innerHTML = indices.length? '' : '<li class="empty" style="background:none;">Noch keine Einträge.</li>';
  const editing = isEditMode();
  indices.forEach(si=>{
    const it = src[si];
    const li = document.createElement('li');
    const datumAnzeige = it.jahr? new Date(it.jahr).toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'}) : '–';
    li.innerHTML = `<span><b>${datumAnzeige}</b> — ${escHtml(it.text)}</span>${editing? `<span class="del" onclick="delSukz('${id}', ${si})">✕</span>`:''}`;
    list.appendChild(li);
  });
}
function renderErnteList(id){
  const list = document.getElementById('ernte-list');
  if(!list) return;
  const src = state.ernten[id]||[];
  const indices = src.map((_,i)=>i).sort((a,b)=>(src[b].datum||'').localeCompare(src[a].datum||''));
  list.innerHTML = indices.length? '' : '<li class="empty" style="background:none;">Noch keine Einträge.</li>';
  const editing = isEditMode();
  indices.forEach(si=>{
    const it = src[si];
    const li = document.createElement('li');
    let mengeText = '';
    if(it.menge !== null && it.menge !== undefined && it.menge !== ''){
      const m = typeof it.menge === 'string' ? parseFloat(it.menge) : it.menge;
      if(!isNaN(m)){
        mengeText = m >= 1 ? m.toFixed(2)+' kg' : Math.round(m*1000)+' g';
      } else {
        mengeText = String(it.menge);
      }
    }
    li.innerHTML = `<span><b>${it.datum||'–'}</b> — ${mengeText} ${it.bemerkung? '('+escHtml(it.bemerkung)+')':''}</span>${editing? `<span class="del" onclick="delErnte('${id}', ${si})">✕</span>`:''}`;
    list.appendChild(li);
  });
  renderErnteChart(id);
}
function renderErnteChart(id){
  const wrap = document.getElementById('ernte-chart-wrap');
  if(!wrap) return;
  const items = (state.ernten[id]||[]);
  const valid = items.filter(it => it.datum && it.menge !== null && it.menge !== undefined && it.menge !== '' && !isNaN(parseFloat(it.menge)));
  if(valid.length < 1){ wrap.innerHTML = ''; return; }
  const byYear = {};
  valid.forEach(it => {
    const y = it.datum.slice(0,4);
    const m = parseFloat(it.menge);
    byYear[y] = (byYear[y]||0) + m;
  });
  const years = Object.keys(byYear).sort();
  const vals = years.map(y => byYear[y]);
  const maxVal = Math.max(...vals) || 1;
  const W = 300, H = 130, pad = 40, padR = 10, padT = 15, padB = 30;
  const chartW = W - pad - padR, chartH = H - padT - padB;
  const xStep = years.length > 1 ? chartW / (years.length - 1) : chartW / 2;
  const pts = years.map((y, i) => {
    const x = years.length > 1 ? pad + i * xStep : pad + chartW / 2;
    const yy = padT + chartH - (vals[i] / maxVal) * chartH;
    return { x, y: yy, year: y, val: vals[i] };
  });
  const pathD = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const areaD = pathD + ' L' + pts[pts.length-1].x.toFixed(1) + ',' + (padT + chartH) + ' L' + pts[0].x.toFixed(1) + ',' + (padT + chartH) + ' Z';
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:320px;height:auto;">`;
  svg += `<rect x="${pad}" y="${padT}" width="${chartW}" height="${chartH}" fill="none" stroke="var(--rand,#ddd)" stroke-width="0.5"/>`;
  svg += `<path d="${areaD}" fill="var(--gruen,#28362A)" fill-opacity="0.08"/>`;
  svg += `<path d="${pathD}" fill="none" stroke="var(--gruen,#28362A)" stroke-width="2" stroke-linejoin="round"/>`;
  // Trend line
  if(pts.length >= 2){
    const n = pts.length;
    const sumX = pts.reduce((s,p)=>s+p.x,0);
    const sumY = pts.reduce((s,p)=>s+p.y,0);
    const sumXY = pts.reduce((s,p,i)=>s+p.x*p.y,0);
    const sumXX = pts.reduce((s,p)=>s+p.x*p.x,0);
    const denom = n*sumXX - sumX*sumX;
    if(denom !== 0){
      const slope = (n*sumXY - sumX*sumY) / denom;
      const intercept = (sumY - slope*sumX) / n;
      const tx1 = pts[0].x, tx2 = pts[n-1].x;
      const ty1 = slope*tx1+intercept, ty2 = slope*tx2+intercept;
      svg += `<line x1="${tx1.toFixed(1)}" y1="${ty1.toFixed(1)}" x2="${tx2.toFixed(1)}" y2="${ty2.toFixed(1)}" stroke="var(--dachziegel,#B2543A)" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>`;
    }
  }
  pts.forEach(p => {
    if(pts.length === 1){
      const bw = 30;
      svg += `<rect x="${(p.x - bw/2).toFixed(1)}" y="${p.y.toFixed(1)}" width="${bw}" height="${(padT + chartH - p.y).toFixed(1)}" rx="3" fill="var(--gruen,#28362A)" fill-opacity="0.2" stroke="var(--gruen,#28362A)" stroke-width="1.5"/>`;
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--gruen,#28362A)" stroke="#fff" stroke-width="1.5"/>`;
    } else {
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--gruen,#28362A)" stroke="#fff" stroke-width="1.5"/>`;
    }
    svg += `<text x="${p.x.toFixed(1)}" y="${(padT + chartH + 16).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--text-mid,#6B7280)" font-family="DM Sans,sans-serif">${p.year}</text>`;
    const label = p.val >= 1 ? p.val.toFixed(2) : (p.val * 1000).toFixed(0) + 'g';
    svg += `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="600" fill="var(--gruen,#28362A)" font-family="DM Sans,sans-serif">${label}</text>`;
  });
  svg += '</svg>';
  wrap.innerHTML = svg;
}

function addSukz(id){
  const datum = document.getElementById('sukz-datum').value;
  const text = document.getElementById('sukz-text').value.trim();
  if(!datum || !text) return;
  if(!state.sukzession[id]) state.sukzession[id]=[];
  state.sukzession[id].push({jahr:datum, text});
  saveState(); renderSukzList(id);
  document.getElementById('sukz-datum').value=''; document.getElementById('sukz-text').value='';
}
function delSukz(id, idx){
  const items = state.sukzession[id]||[];
  const item = items[idx];
  state.sukzession[id] = items.filter((it,i)=>i!==idx);
  saveState(); renderSukzList(id);
  setUndo('sukz', {id, idx, item});
}
function addErnte(id){
  const datum = document.getElementById('ernte-datum').value;
  const mengeRaw = document.getElementById('ernte-menge').value.trim();
  const bemerkung = document.getElementById('ernte-bem').value.trim();
  if(!datum && !mengeRaw) return;
  const menge = mengeRaw ? parseFloat(mengeRaw) : null;
  if(mengeRaw && isNaN(menge)) return;
  if(!state.ernten[id]) state.ernten[id]=[];
  state.ernten[id].push({datum, menge, bemerkung});
  saveState(); renderErnteList(id);
  document.getElementById('ernte-datum').value=''; document.getElementById('ernte-menge').value=''; document.getElementById('ernte-bem').value='';
}
function delErnte(id, idx){
  const items = state.ernten[id]||[];
  const item = items[idx];
  state.ernten[id] = items.filter((it,i)=>i!==idx);
  _mittelCache=null;
  saveState(); renderErnteList(id);
  setUndo('ernte', {id, idx, item});
}

const _PHAENO_LABELS={holunder_bluete:'Holunder-Blühbeginn',holunder_vollbluete:'Holunder-Vollblüte',knaeulgras_rispenschieben:'Knäuelgras-Rispenschieben'};
function renderPhaenoDisplay(){
  const el=document.getElementById('phaeno-display');
  if(!el) return;
  const jahr=new Date().getFullYear();
  const phaeno=state.phaenologie&&state.phaenologie[jahr]?state.phaenologie[jahr]:null;
  const entries=phaeno?Object.entries(phaeno).filter(([,v])=>v):[];
  if(!entries.length){ el.innerHTML='<span style="color:var(--text-mid,#6B7280);font-size:.85rem;">Noch keine Phänologie-Ereignisse für '+jahr+' eingetragen.</span>'; return; }
  el.innerHTML=entries.map(([k,v])=>{
    const tag=tagDesJahres(v);
    const std=PHAENO_STANDARDS[k];
    const diff=(std!=null&&!isNaN(std))? tag-std : null;
    const diffText=(diff!=null&&!isNaN(diff))?` <span style="font-size:.78rem;color:${diff<0?'var(--gruen)':'var(--dachziegel)'};">(${diff>0?'+':''}${diff} Tage vs. Standard)</span>`:'';
    return `<div style="margin-bottom:4px;"><b>${_PHAENO_LABELS[k]||k}:</b> ${v}${diffText}</div>`;
  }).join('');
}
function addPhaenoEreignis(){
  const key=document.getElementById('phaeno-key').value;
  const datum=document.getElementById('phaeno-datum').value;
  if(!key||!datum) return;
  const jahr=new Date().getFullYear();
  setPhaenoEreignis(jahr, key, datum);
  renderPhaenoDisplay();
  document.getElementById('phaeno-datum').value='';
}

/* ---------- Modal: Sorten-Detail ---------- */
function openSortenModal(sorteName){
  let s = getSorte(sorteName);
  if(!s){
    const all=getAllSorten();
    s=all.find(x=>x.name===sorteName);
  }
  if(!s) return;
  s = Object.assign({}, s, {sorte: s.sorte || s.name});
  const safeName = escAttr(sorteName);
  const originalPW = s.pflueckzeitpunkt||s.pflueck_reifezeit||'';
  const mittel = calcPfluckMittel(sorteName);
  const prediction = predictErnte(sorteName);
  const mittelText = mittel ? `<b style="color:var(--gruen);">→ ${mittel.wert}</b> <span style="font-size:.75rem;color:var(--text-mid,#6B7280);">(${mittel.anzahl} Ernten, ${mittel.jahre.join(', ')})</span>` : '';
  let predictionHtml = '';
  if(prediction){
    const sign = prediction.abweichungTage>0 ? '+' : '';
    predictionHtml = `<div style="margin-top:4px;font-size:.82rem;"><b>📊 Vorhersage ${new Date().getFullYear()}:</b> <b style="color:var(--waldrand);">${prediction.wert}</b> ${pfluckWertToText(prediction.wert)} <span style="color:var(--text-mid,#6B7280);font-size:.75rem;">(${sign}${prediction.abweichungTage} Tage vs. Standard)</span></div>`;
  }
  const html = `
    <button class="close" onclick="closeModal()">&times;</button>
    <button class="close" style="right:44px;" title="Bearbeiten" onclick="editSorteWithLogin('${safeName}')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false" style="vertical-align:middle;">
        <line x1="4" y1="7" x2="20" y2="7"/>
        <circle cx="14" cy="7" r="2.3"/>
        <line x1="4" y1="14" x2="20" y2="14"/>
        <circle cx="9" cy="14" r="2.3"/>
        <line x1="4" y1="21" x2="20" y2="21"/>
        <circle cx="16" cy="21" r="2.3"/>
      </svg>
    </button>
    <button class="close" style="right:76px;" title="Als PDF speichern" onclick="exportSortenKartePDF('${safeName}')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="vertical-align:middle;">
        <path d="M6 9V3h12v6"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <rect x="6" y="14" width="12" height="7"/>
      </svg>
    </button>
    <button class="close" style="right:108px;" title="Teilen" onclick="shareSorte('${safeName}')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="vertical-align:middle;">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    </button>
    ${s.recherchiert? `<div class="badge-recherche">🔍 Web-recherchiert – bitte prüfen</div>
      <button class="btn-verify" onclick="toggleVerifiziert('${escAttr(s.sorte)}')">✓ Als verifiziert markieren</button>`
      : (state.verifiziert[s.sorte]? `<div class="badge-verifiziert">✓ Verifiziert am ${state.verifiziert[s.sorte]}</div>
      <button class="btn-verify done" onclick="toggleVerifiziert('${escAttr(s.sorte)}')">Verifizierung zurücknehmen</button>` : '')}
    <h2>${s.sorte}${s.baum_ids&&s.baum_ids.length?' <span class="idbadge" style="font-size:.78rem;">'+s.baum_ids.map(id=>'ID '+id).join(', ')+'</span>':''}</h2>
    ${archeNoahLink(s)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--rand);border-radius:10px;overflow:hidden;margin-bottom:8px;">
      <div class="field"><b>Obstart</b>${escHtml(s.frucht||'')}</div>
      <div class="field"><b>Pflückreife lt. Beschreibung</b>${escHtml(originalPW||'')}</div>
      <div class="field"><b>Pflückreife ermittelt</b>${mittelText||predictionHtml||'–'}</div>
    </div>
    ${fieldGrid([
      ['Verwendung', (s.verwendung||[]).join(', ')],
      ['Genussreife', formatGenuss(s.genuss_von,s.genuss_bis,s.genussreife,s.genuss)]
    ])}
    ${fieldGrid([
      ['Pflanzjahr', s.ausgepflanzt],
      ['Veredelungsjahr', s.veredelt]
    ])}
    ${s.unterlage ? '<div style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--rand);border-radius:10px;margin-bottom:8px;font-size:.88rem;"><b>Unterlage</b> '+escHtml(s.unterlage)+' <a href="#" onclick="event.preventDefault();event.stopPropagation();showUnterlageInfo(\''+escAttr(sorteName)+'\')" style="font-size:.78rem;color:var(--waldrand);text-decoration:underline;cursor:pointer;white-space:nowrap;">Info</a></div>' : ''}
    ${fieldGrid([
      ['Ertrag', s.ertrag],
      ['Befruchtungspartner', s.befruchtungspartner]
    ])}
    ${fieldGrid([
      ['Erstmals tragend', s.erstmals_tragend],
      ['Lagerfähigkeit', s.lagerfaehig],
      ['Herkunft', s.herkunft_jahr||s.herkunft],
      ['Anzahl Bäume', (s.baum_ids||[]).length + ' (' + (s.baum_ids||[]).join(', ') + ')'],
      ['Synonyme', s.synonyme]
    ])}
    ${s.geschmack? `<div class="section-title">Geschmack / Nutzung</div><div class="field">${escHtml(s.geschmack)}</div>`:''}
    ${s.frucht_beschreibung? `<div class="section-title">Frucht</div><div class="field">${escHtml(s.frucht_beschreibung)}</div>`:''}
    ${s.eigenschaften||s.standort_anspruch? `<div class="section-title">Eigenschaften / Standortansprüche</div><div class="field">${escHtml((s.eigenschaften||'')+(s.eigenschaften&&s.standort_anspruch?' ':'')+(s.standort_anspruch||''))}</div>`:''}
    ${s.frucht ? `<div class="section-title" style="cursor:pointer;color:var(--gruen);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;" onclick="showGuildPopup('${escAttr(s.sorte||s.name||'')}')">Begleitpflanzungen & Gilden</div><div class="field">${renderGuildSection(s.frucht)}</div>`:''}
    ${!s.geschmack && !s.eigenschaften && !s.frucht_beschreibung ? '<p class="empty">Für diese Sorte liegt noch keine ausführliche Beschreibung vor.</p>':''}
    ${s.recherchiert? `<div class="quelle-hinweis"><b>Quelle(n):</b> ${s.quelle}<br>Diese Angaben stammen aus einer Web-Recherche (nicht aus deiner Numbers-Tabelle) und sollten anhand der Bäume vor Ort verifiziert werden.</div>`:''}
  `;
  /* Kaufblock — dieselbe Funktion wie auf den Karten (S1). Im Modal ohne
     `kompakt`, hier ist Platz. */
  const shopHtml = `<div class="section-title">Bestellen</div>`
    + renderShopBlock(s.sorte || sorteName, {quelle: s.quelle, frucht: s.frucht});
  document.getElementById('modal-content').innerHTML = html + shopHtml;
  document.getElementById('modal-content').dataset.modalType = 'sorte';
  document.getElementById('modal-content').dataset.modalId = sorteName;
  document.getElementById('overlay').classList.add('open');
}

function closeModal(){ 
  const o=document.getElementById('overlay');
  o.classList.remove('open');
  o.style.display='';
}
document.getElementById('overlay').addEventListener('click', (e)=>{ if(e.target.id==='overlay') closeModal(); });

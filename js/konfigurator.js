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
/* Unterlagen-Katalog (v132, Volkmar 27.10.2026): alle gängigen Unterlagen nach
   LWG Bayern, Merkblatt 3101 und Faltblatt 3101b. Welche der Hof tatsächlich
   bekommt, weiß Volkmar erst beim Bestellen – deshalb ist jede einzeln
   aktivierbar (state.produktion.unterlagen_wahl[id] = { aktiv, preis }).
   Ab Werk aktiv sind nur die sechs, die am Hof schon im Einsatz sind; ihre IDs
   bleiben gleich, weil Merklisten auf sie verweisen.
   wuchs: schwach | mittel | stark – danach wählt der Baumfinder.
   formen: Stammformen, die die LWG für diese Unterlage nennt.
   Bewusst nicht aufgenommen (LWG rät ab): Colt (in Bayern nicht ausreichend
   frosthart), St. Julien 655/2 und Fereley (Frostrisse, Ausläufer), Quitte C. */
const LWG_QUELLE = 'LWG Bayern, Merkblatt 3101 (2016) und Faltblatt 3101b (2021)';
const UNTERLAGEN_KATALOG = [
  { id:'m27', name:'M 27', fruechte:['Apfel'], wuchs:'schwach', formen:['busch'],
    beschreibung:'Kleinste Apfelunterlage: Busch oder kleines Spalier, etwa 1,5–2 m hoch.',
    boden:'durchlässig, humos, nährstoffreich', pfahl:'zeitlebens', ertrag:'früh, meist regelmäßig',
    platz:'Abstand 1,5–2 m', hinweis:'bei Trockenheit wässern; Wühlmausschutz (Drahtkorb)' },
  { id:'m9', name:'M 9', fruechte:['Apfel'], wuchs:'schwach', formen:['busch'],
    beschreibung:'Schwachwachsend: Busch, Spindel, kleines Spalier, etwa 2,5 m hoch.',
    boden:'durchlässig, humos, nährstoffreich', pfahl:'zeitlebens', ertrag:'früh, meist regelmäßig',
    platz:'Abstand 1,75–2,25 m', hinweis:'bei Trockenheit wässern; Wühlmausschutz (Drahtkorb)' },
  { id:'m26', name:'M 26', fruechte:['Apfel'], wuchs:'schwach', formen:['busch'], standard_aktiv:true,
    beschreibung:'Kleinkronig, trägt früh, braucht einen Pfahl – für kleine Gärten.',
    boden:'mittel', pfahl:'zeitlebens', ertrag:'früh, meist regelmäßig',
    platz:'Abstand etwa 2,5 m', hinweis:'Wühlmausschutz (Drahtkorb)' },
  { id:'mm106', name:'MM 106', fruechte:['Apfel'], wuchs:'mittel', formen:['saeule','busch','halb'], standard_aktiv:true,
    beschreibung:'Halbstamm oder Busch, auch für Säulenäpfel – die Unterlage der meisten Hofbäume.',
    boden:'mittlere Böden, auf leichten schwächer', pfahl:'ja (außer Säule)', ertrag:'mittelfrüh',
    platz:'etwa 25 m²', platz_saeule:'Säule: 50–70 cm Abstand', hinweis:'blutlausresistent' },
  { id:'m7', name:'M 7', fruechte:['Apfel'], wuchs:'mittel', formen:['saeule','busch','halb'],
    beschreibung:'Mittelstark wie MM 106, kommt mit schweren und leichten Böden zurecht.',
    boden:'schwer bis leicht', pfahl:'ja (außer Säule)', ertrag:'mittelfrüh',
    platz:'etwa 25 m²', platz_saeule:'Säule: 50–70 cm Abstand', hinweis:'' },
  { id:'mm111', name:'MM 111', fruechte:['Apfel'], wuchs:'mittel', formen:['halb'],
    beschreibung:'Obere Grenze der mittelstarken Unterlagen, Halbstamm mit Rundkrone.',
    boden:'', pfahl:'', ertrag:'', platz:'Abstand 6–8 m', hinweis:'' },
  { id:'a2', name:'A 2', fruechte:['Apfel'], wuchs:'stark', formen:['halb','hoch'],
    beschreibung:'Starkwachsend für Halb- und Hochstamm; höherer Ertrag als Sämling.',
    boden:'gering, gut anpassungsfähig', pfahl:'', ertrag:'ab 4.–7. Standjahr',
    platz:'etwa 65–70 m²; Abstand 8–10 m', hinweis:'frosthart' },
  { id:'saemling', name:'Sämling', fruechte:['Apfel'], wuchs:'stark', formen:['halb','hoch'], standard_aktiv:true,
    beschreibung:'Hochstamm, langlebig, standfest – für Streuobstwiese und Weide.',
    boden:'gering, gut anpassungsfähig', pfahl:'', ertrag:'etwas später als A 2',
    platz:'etwa 80 m²; Abstand 8–10 m', hinweis:'frosthart, virusfrei' },
  { id:'quittea', name:'Quitte A', fruechte:['Birne','Quitte'], wuchs:'schwach', formen:['busch'],
    beschreibung:'Schwachwachsend für Busch und Spalier; bessere Fruchtgröße.',
    boden:'warm, gut durchlüftet, kalkempfindlich', pfahl:'ja', ertrag:'früh, meist regelmäßig',
    platz:'', hinweis:'frostempfindlich in Holz und Wurzel; bei Birne oft mit Zwischenveredelung' },
  { id:'quitteba29', name:'Quitte BA 29', fruechte:['Birne','Quitte'], wuchs:'schwach', formen:['busch'], standard_aktiv:true,
    beschreibung:'Schwachwachsend, trägt früh, kalktolerant – nicht mit jeder Birnensorte verträglich.',
    boden:'warm, gut durchlüftet; kalktolerant', pfahl:'ja', ertrag:'früh, meist regelmäßig',
    platz:'', hinweis:'frostempfindlich in Holz und Wurzel; bei Birne oft mit Zwischenveredelung' },
  { id:'pyrodwarf', name:'Pyrodwarf', fruechte:['Birne'], wuchs:'mittel', formen:['busch','halb'], standard_aktiv:true,
    beschreibung:'Arteigene Birnenunterlage: stärker als Quitte, schwächer als Sämling, ohne Zwischenveredelung.',
    boden:'kalktolerant', pfahl:'', ertrag:'', platz:'', hinweis:'weniger frostempfindlich als Quitte' },
  { id:'birnensaemling', name:'Birnensämling', fruechte:['Birne'], wuchs:'stark', formen:['halb','hoch'], standard_aktiv:true,
    beschreibung:'Hochstamm, langlebig, tiefwurzelnd (z. B. Kirchensaller Mostbirne).',
    boden:'gering', pfahl:'nein (standfest)', ertrag:'spät, schwankend', platz:'', hinweis:'frosthart' },
  { id:'stjuliena', name:'St. Julien A', fruechte:['Zwetschke','Pflaume','Mirabelle','Ringlotte','Pfirsich','Marille'], wuchs:'mittel', formen:['busch','halb'],
    beschreibung:'Mittelstark für Busch und Halbstamm; kaum Ausläufer.',
    boden:'guter Gartenboden, keine Staunässe', pfahl:'', ertrag:'früh, ab 2.–3. Standjahr',
    platz:'', hinweis:'auf leichten Böden wässern' },
  { id:'wavit', name:'WaVit', fruechte:['Zwetschke','Pflaume','Mirabelle','Ringlotte','Pfirsich','Marille'], wuchs:'mittel', formen:['busch','halb'],
    beschreibung:'Mittelstark, kaum Ausläufer; bei Pfirsich und Marille frosthärter als St. Julien A.',
    boden:'guter Gartenboden, keine Staunässe', pfahl:'', ertrag:'früh, ab 2.–3. Standjahr',
    platz:'', hinweis:'' },
  { id:'weiwa', name:'WeiWa', fruechte:['Zwetschke','Pflaume','Mirabelle','Ringlotte'], wuchs:'mittel', formen:['busch','halb'],
    beschreibung:'Mittelstark für Busch und Halbstamm; kaum Ausläufer.',
    boden:'guter Gartenboden, keine Staunässe', pfahl:'', ertrag:'früh, ab 2.–3. Standjahr',
    platz:'', hinweis:'' },
  { id:'brompton', name:'Bromptonpflaume', fruechte:['Zwetschke','Pflaume','Mirabelle','Ringlotte'], wuchs:'stark', formen:['busch','halb','hoch'],
    beschreibung:'Starkwachsend, standfest, verträgt leichte und schwere Böden.',
    boden:'leicht bis schwer', pfahl:'nein (standfest)', ertrag:'Halb-/Hochstamm ab 5. Standjahr',
    platz:'', hinweis:'frosthart' },
  { id:'myrobalane', name:'Myrobalane', fruechte:['Zwetschke','Pflaume','Mirabelle','Ringlotte'], wuchs:'stark', formen:['busch','halb','hoch'],
    beschreibung:'Starkwachsend, standfest – nur für leichte Böden.',
    boden:'nur leichte Böden', pfahl:'nein (standfest)', ertrag:'Halb-/Hochstamm ab 5. Standjahr',
    platz:'', hinweis:'frosthart; ggf. Stockausschläge' },
  { id:'pfirsichsaemling', name:'Pfirsich- bzw. Marillensämling', fruechte:['Pfirsich','Marille'], wuchs:'stark', formen:['busch','halb'],
    beschreibung:'Starkwachsender Busch oder Halbstamm, robust und standfest.',
    boden:'warm, leicht bis mittelschwer', pfahl:'', ertrag:'früh', platz:'', hinweis:'frosthart' },
  { id:'gisela3', name:'GiSelA 3', fruechte:['Kirsche'], wuchs:'schwach', formen:['busch'],
    beschreibung:'Etwa halb so groß wie auf Sämling, Spindel – einnetzbar gegen Kirschfruchtfliege.',
    boden:'', pfahl:'nur die ersten Jahre', ertrag:'ab 3. Standjahr', platz:'', hinweis:'bei Trockenheit wässern; nicht für Weichsel' },
  { id:'gisela5', name:'GiSelA 5', fruechte:['Kirsche','Weichsel'], wuchs:'mittel', formen:['busch'],
    beschreibung:'Etwa 35–40 % kleiner als auf Sämling, Spindel – passt auch in kleinere Gärten.',
    boden:'', pfahl:'nur die ersten Jahre', ertrag:'ab 3. Standjahr', platz:'', hinweis:'bei Trockenheit wässern' },
  { id:'gisela6', name:'GiSelA 6', fruechte:['Kirsche','Weichsel'], wuchs:'mittel', formen:['busch'],
    beschreibung:'Etwa 35–40 % kleiner als auf Sämling, Spindel.',
    boden:'', pfahl:'nur die ersten Jahre', ertrag:'ab 3. Standjahr', platz:'', hinweis:'bei Trockenheit wässern' },
  { id:'maxma14', name:'Maxma 14', fruechte:['Kirsche','Weichsel'], wuchs:'mittel', formen:['busch','halb'],
    beschreibung:'Etwa 20–25 % schwächer als Sämling; Busch.',
    boden:'', pfahl:'nur die ersten Jahre', ertrag:'ab 3. Standjahr', platz:'', hinweis:'' },
  { id:'vogelkirsche', name:'Vogelkirsche (F 12/1)', fruechte:['Kirsche','Weichsel'], wuchs:'stark', formen:['busch','halb','hoch'],
    beschreibung:'Herkömmliche Sämlingsunterlage für Halb- und Hochstamm, frosthart.',
    boden:'', pfahl:'nur die ersten Jahre', ertrag:'5.–6. Standjahr', platz:'', hinweis:'auch für Weichsel' }
];

const PRODUKTION_STANDARD = {
  unterlagen: UNTERLAGEN_KATALOG,
  stammformen: [
    { id:'busch', name:'Buschbaum',  aufpreis:null, beschreibung:'Krone ab ca. 60 cm' },
    { id:'halb',  name:'Halbstamm',  aufpreis:null, beschreibung:'Krone ab ca. 120 cm' },
    { id:'hoch',  name:'Hochstamm',  aufpreis:null, beschreibung:'Krone ab ca. 180 cm — für Wiese und Weide' },
    { id:'saeule', name:'Säule', aufpreis:null, nur:['Apfel'], nur_saeulensorten:true,
      beschreibung:'Schmal und ohne Seitenäste — nur mit Säulensorten (eigene Sorten wie die Ballerinas), für Topf, Terrasse und Balkon' }
  ],
  grundpreis: null,
  aufpreis_je_veredelung: null,
  saison: { bestellschluss:'12-31', lieferjahr_offset:2 }
};

/* Katalog plus Auswahl des Hofes. Ein früher gespeichertes, vollständiges
   state.produktion.unterlagen (bis v131) zählt als Auswahl, damit nichts verloren geht. */
function getProduktion(){
  const eigen = (typeof state !== 'undefined' && state && state.produktion) || {};
  const p = Object.assign({}, PRODUKTION_STANDARD, eigen);
  const wahl = Object.assign({}, eigen.unterlagen_wahl || {});
  (Array.isArray(eigen.unterlagen) ? eigen.unterlagen : []).forEach(u=>{
    if(u && u.id && !wahl[u.id]) wahl[u.id] = { aktiv: u.aktiv !== false, preis: u.preis == null ? null : u.preis };
  });
  p.unterlagen = UNTERLAGEN_KATALOG.map(u=>{
    const w = wahl[u.id] || {};
    return Object.assign({}, u, {
      frucht: u.fruechte[0],
      aktiv: w.aktiv === undefined ? !!u.standard_aktiv : !!w.aktiv,
      preis: w.preis == null ? null : w.preis
    });
  });
  p.stammformen = PRODUKTION_STANDARD.stammformen;
  return p;
}

function unterlagePasst(u, frucht){
  const f = obstartSchluessel(frucht);
  return (u.fruechte || [u.frucht]).some(x => obstartSchluessel(x) === f);
}

/* Säule nur mit Säulensorten: Die schlanke Form ist eine Eigenschaft der Sorte,
   keine Erziehung, die jede Sorte annimmt (LWG: Säulenäpfel/Ballerinas). */
function istSaeulensorte(name){
  const s = getSorte(name) || {};
  return /säule|ballerina/i.test(`${name} ${s.eigenschaften || ''} ${s.synonyme || ''}`);
}
function stammformPasst(st, frucht, sorten){
  if(st.nur && !st.nur.some(x => obstartSchluessel(x) === obstartSchluessel(frucht))) return false;
  if(st.nur_saeulensorten) return (sorten || []).length > 0 && sorten.every(istSaeulensorte);
  return true;
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

/* ---------- Verwaltung: Betrieb, Preise, Saison, Kapazität (A1) ----------
   Bis hierher standen Preise und Grenzen nur im Code. Ohne diese Maske hätte
   der Hof „Preis nach Angebot" auf ewig stehen lassen müssen — nicht weil die
   Rechnung fehlt, sondern weil niemand die Zahlen eintragen kann.

   Geschrieben wird nach state.produktion und state.betrieb; beides wandert über
   Firestore auf alle Geräte und steckt im Monatsbackup. */
function _prodSetzen(pfad, wert){
  if(!state.produktion) state.produktion = {};
  const teile = pfad.split('.');
  let ziel = state.produktion;
  for(let i = 0; i < teile.length - 1; i++){
    if(!ziel[teile[i]]) ziel[teile[i]] = {};
    ziel = ziel[teile[i]];
  }
  const letzte = teile[teile.length - 1];
  /* Leeres Feld heißt „nicht hinterlegt", nicht „null Euro". Der Unterschied
     entscheidet, ob die App einen Preis nennt oder auf das Angebot verweist. */
  const t = String(wert).trim();
  ziel[letzte] = (t === '') ? null : (isNaN(Number(t)) ? t : Number(t));
  saveState();
  renderProduktionAdmin();
}

function _betriebSetzen(feld, wert){
  if(!state.betrieb) state.betrieb = {};
  state.betrieb[feld] = wert;
  saveState();
  renderProduktionAdmin();
  refreshFilterOptions();
  renderResults();
}

function unterlageSetzen(id, feld, wert){
  if(!UNTERLAGEN_KATALOG.some(u => u.id === id)) return;
  if(!state.produktion) state.produktion = {};
  const p = getProduktion();
  /* Auswahl je Unterlage statt Kopie der ganzen Liste (v132): Texte aus dem
     Katalog kommen so mit jedem Deploy an, die Auswahl des Hofes bleibt. */
  const wahl = Object.assign({}, state.produktion.unterlagen_wahl || {});
  p.unterlagen.forEach(u=>{ if(!wahl[u.id]) wahl[u.id] = { aktiv:u.aktiv, preis:u.preis }; });
  const w = Object.assign({}, wahl[id]);
  if(feld === 'aktiv') w.aktiv = !!wert;
  else if(feld === 'preis'){
    const t = String(wert).trim();
    w.preis = (t === '') ? null : Number(t);
  }
  wahl[id] = w;
  state.produktion.unterlagen_wahl = wahl;
  delete state.produktion.unterlagen;
  saveState();
  renderProduktionAdmin();
}

function renderProduktionAdmin(){
  const karte = document.getElementById('card-produktion');
  const el = document.getElementById('produktion-admin');
  if(!karte || !el) return;
  if(!isAdmin()){ karte.style.display = 'none'; return; }
  karte.style.display = '';

  const p = getProduktion();
  const b = getBetrieb();
  const kap = p.kapazitaet || {};
  const sai = p.saison || {};
  const zahl = (wert, platzhalter) =>
    `value="${wert == null ? '' : escAttr(String(wert))}" placeholder="${escAttr(platzhalter)}"`;

  el.innerHTML = `
    <div class="section-title">Betrieb</div>
    <div class="pa-zeile">
      <label>Modus</label>
      <select onchange="_betriebSetzen('modus', this.value)">
        ${Object.keys(BETRIEBSMODI).map(k =>
          `<option value="${k}"${k === b.modus ? ' selected' : ''}>${k} — ${escHtml(BETRIEBSMODI[k].label)}</option>`).join('')}
      </select>
    </div>
    <div class="pa-erklaerung">
      Kataster ${b.kataster ? 'sichtbar' : 'aus'} ·
      Eigenveredelung ${b.eigenproduktion ? 'ja' : 'nein'} ·
      Fremdlisten ${b.fremdliste ? 'ja' : 'nein'}
    </div>
    <div class="pa-zeile">
      <label>Verkauf aktiv</label>
      <input type="checkbox"${b.shop_schalter ? ' checked' : ''}
             onchange="_betriebSetzen('shop_aktiv', this.checked)">
      <span class="pa-erklaerung" style="margin:0;">Aus = nur Beratung: keine Preise, keine Merkliste, keine Anfrage.</span>
    </div>
    ${b.shop_schalter && !b.shop_aktiv ? `<div class="pa-erklaerung">Derzeit außerhalb des Bestellzeitraums – der Verkauf ruht von selbst.</div>` : ''}
    <div class="pa-zeile">
      <label>Anfragen an</label>
      <input type="email" value="${escAttr(p.email || HOF_EMAIL_STANDARD)}" placeholder="${escAttr(HOF_EMAIL_STANDARD)}"
             onchange="_prodSetzen('email', this.value)">
    </div>
    <div class="pa-zeile">
      <label>Adresse im PDF</label>
      <input type="text" value="${escAttr(b.adresse || '')}" placeholder="Straße, PLZ Ort"
             onchange="_betriebSetzen('adresse', this.value.trim())">
    </div>

    <div class="section-title">Preise Eigenproduktion</div>
    <div class="pa-zeile">
      <label>Grundpreis (EUR)</label>
      <input type="number" step="0.01" min="0" ${zahl(p.grundpreis, 'leer = nach Angebot')}
             onchange="_prodSetzen('grundpreis', this.value)">
    </div>
    <div class="pa-zeile">
      <label>Aufpreis je zusätzlicher Veredelung</label>
      <input type="number" step="0.01" min="0" ${zahl(p.aufpreis_je_veredelung, 'EUR')}
             onchange="_prodSetzen('aufpreis_je_veredelung', this.value)">
    </div>
    <div class="pa-erklaerung">
      Solange der Grundpreis leer ist, schreibt der Konfigurator „Preis wird mit dem
      Angebot bekanntgegeben“ — eine Null wäre eine Preisauskunft, die niemand gegeben hat.
    </div>

    <div class="section-title">Saison</div>
    <div class="pa-zeile">
      <label>Bestellbeginn (MM-TT)</label>
      <input type="text" ${zahl(sai.bestellbeginn, 'leer = nur Schalter')}
             onchange="_prodSetzen('saison.bestellbeginn', this.value)">
    </div>
    <div class="pa-erklaerung">
      Mit Bestellbeginn und Bestellschluss geht der Verkauf zwischen beiden Tagen von selbst an
      und danach wieder aus. Ohne Bestellbeginn zählt nur der Schalter oben.
    </div>
    <div class="pa-zeile">
      <label>Bestellschluss (MM-TT)</label>
      <input type="text" ${zahl(sai.bestellschluss, '12-31')}
             onchange="_prodSetzen('saison.bestellschluss', this.value)">
    </div>
    <div class="pa-zeile">
      <label>Jahre bis zur Lieferung</label>
      <input type="number" min="1" max="5" ${zahl(sai.lieferjahr_offset, '2')}
             onchange="_prodSetzen('saison.lieferjahr_offset', this.value)">
      <span class="pa-erklaerung" style="margin:0;">Ergibt derzeit: Herbst ${konfigLieferjahr()}</span>
    </div>

    <div class="section-title">Kapazität je Saison</div>
    <div class="pa-zeile">
      <label>Höchstens je Sorte</label>
      <input type="number" min="1" ${zahl(kap.je_sorte_max, 'leer = keine Grenze')}
             onchange="_prodSetzen('kapazitaet.je_sorte_max', this.value)">
    </div>
    <div class="pa-zeile">
      <label>Höchstens Bäume gesamt</label>
      <input type="number" min="1" ${zahl(kap.baeume_gesamt, 'leer = keine Grenze')}
             onchange="_prodSetzen('kapazitaet.baeume_gesamt', this.value)">
    </div>
    <div class="pa-erklaerung">
      Beim Speichern einer Anfrage wird nachgefragt, wenn die Grenze überschritten würde —
      zugesagte, noch nicht gelieferte Bäume mitgezählt. Keine Sperre: Ob eine Sorte noch
      reicht, weißt du besser als diese Zahl.
    </div>

    <div class="section-title">Unterlagen</div>
    <div class="pa-erklaerung">Aktiv heißt: kann bestellt werden. Nicht aktive nennt der Baumfinder nur
      „auf Anfrage“, wenn keine aktive passt. Angaben nach ${escHtml(LWG_QUELLE)}.</div>
    <table class="pa-tabelle">
      <thead><tr><th>Name</th><th>Obstart</th><th>Wuchs</th><th>Aufpreis</th><th>aktiv</th></tr></thead>
      <tbody>
        ${p.unterlagen.map(u => `<tr>
          <td>${escHtml(u.name)}</td>
          <td>${escHtml((u.fruechte || [u.frucht]).join(', '))}</td>
          <td>${escHtml(u.wuchs || '')}</td>
          <td><input type="number" step="0.01" min="0" style="width:70px;"
                     ${zahl(u.preis, '0')} onchange="unterlageSetzen('${escAttr(u.id)}','preis',this.value)"></td>
          <td><input type="checkbox"${u.aktiv === false ? '' : ' checked'}
                     onchange="unterlageSetzen('${escAttr(u.id)}','aktiv',this.checked)"></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
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

  /* Nur freigeschaltete Unterlagen anbieten — die Verwaltung kann welche
     stilllegen, ohne sie zu loeschen. */
  const unterlagen = getProduktion().unterlagen
    .filter(u => unterlagePasst(u, frucht) && u.aktiv !== false);
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
  const unterlagen = p.unterlagen.filter(u => unterlagePasst(u, _konfig.frucht) && u.aktiv !== false);
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
      <button class="close" onclick="konfigAbbrechen()" aria-label="Schließen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
      <h2 style="font-family:var(--font-heading);color:var(--dark);margin:0 0 4px;">Baum zusammenstellen</h2>
      <p class="kf-unter">${escHtml(_konfig.frucht)} · Lieferung Herbst ${konfigLieferjahr()}</p>

      <div class="section-title">Unterlage</div>
      <select class="kf-feld" onchange="konfigSetzen('unterlage', this.value)">
        ${unterlagen.map(u => `<option value="${escAttr(u.id)}"${u.id === _konfig.unterlage ? ' selected' : ''}>${escHtml(u.name)} — ${escHtml(u.wuchs)}</option>`).join('')}
      </select>
      ${gewaehlteUnterlage.beschreibung ? `<div class="kf-erklaerung">${escHtml(gewaehlteUnterlage.beschreibung)}</div>` : ''}

      <div class="section-title">Stammform</div>
      <select class="kf-feld" onchange="konfigSetzen('stammform', this.value)">
        ${p.stammformen.filter(f => stammformPasst(f, _konfig.frucht, _konfig.sorten)).map(f => `<option value="${escAttr(f.id)}"${f.id === _konfig.stammform ? ' selected' : ''}>${escHtml(f.name)}</option>`).join('')}
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
          : eur(preis)}
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

  merkSpeichern();
  updateCartBadge();
  _konfig = null;
  showToast(`Baum mit ${eintrag.sorten.length} Sorte(n) zur Liste hinzugefügt.`, 'success');
  openBestelllisteModal();
}

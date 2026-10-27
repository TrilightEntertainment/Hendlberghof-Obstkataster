/* baumfinder.js — Hendlberghof Obstdatenbank
   Der Baumfinder (v132, Volkmar 27.10.2026): sechs kurze Fragen, am Ende
   „Dein Baum“ – Sorte(n), Unterlage und Stammform, passend zu Standort, Platz
   und Nutzung. Ersetzt als Einstieg in den Reiter Berater die lange Sortenliste;
   die bleibt darunter als „Selbst stöbern“.

   Lädt als letzte Datei: braucht kern (Obstart-Regeln, getBetrieb), kataster
   (getSorte, Bestellbarkeit, Merklisten), berater (GUILD_DB), shop
   (HOF_EMAIL_STANDARD, openBestelllisteModal) und konfigurator (Unterlagen,
   Preise). Über Dateigrenzen hinweg gibt es kein Hoisting.

   Grundsätze
   - Nur Hofsorten, ohne Walnuss und Che (Volkmar).
   - Spritzmittel werden nicht abgefragt: Der Hof spritzt nicht, robuste Sorten
     bekommen deshalb immer einen kleinen Vorsprung.
   - Verkauf aus = nur Beratung: kein Preis, keine Merkliste, statt dessen
     „Beratung anfragen“. Das PDF gibt es immer.
   - Eine nicht aktive Unterlage erscheint nur „auf Anfrage“, wenn keine aktive
     derselben Obstart passt.
   - Die Antworten bleiben im Gerät (localStorage), nirgends sonst. */

const BF_LS_KEY = 'hendlberghof_baumfinder';
const BF_OHNE = ['walnuss', 'che'];

const BF_LAGEN = [
  { id:'sued', label:'Südhang' }, { id:'ost', label:'Osthang' }, { id:'west', label:'Westhang' },
  { id:'nord', label:'Nordhang' }, { id:'mulde', label:'Mulde, Talboden', info:'Spätfrost häufiger' }
];
const BF_BOEDEN = [
  { id:'trocken', label:'eher trocken' }, { id:'mittel', label:'normal' }, { id:'feucht', label:'eher feucht' }
];
const BF_PLAETZE = [
  { id:'topf',  label:'Topf, Terrasse, Balkon', info:'kleiner Busch im Kübel', kreis:5 },
  { id:'klein', label:'Kleiner Garten', info:'Krone etwa 2–3 m', kreis:8 },
  { id:'haus',  label:'Hausgarten', info:'Krone etwa 4–5 m', kreis:11 },
  { id:'wiese', label:'Wiese oder Weide', info:'Hochstamm, 8–10 m Abstand', kreis:14 }
];
const BF_GARTEN = [
  { id:'huehner', label:'Hühner unter dem Baum' },
  { id:'schafe',  label:'Schafe oder Ziegen' },
  { id:'kinder',  label:'Kinder ernten mit' },
  { id:'bienen',  label:'Bienen und Insekten' },
  { id:'schatten', label:'Schatten für den Sitzplatz' },
  { id:'hecke',   label:'Hecke oder Windschutz' }
];
const BF_NUTZUNG = [
  { id:'tafel',   label:'Frisch essen' },
  { id:'lager',   label:'Über den Winter lagern' },
  { id:'most',    label:'Saft, Most' },
  { id:'backen',  label:'Backen, Kochen' },
  { id:'doerren', label:'Dörren' },
  { id:'schnaps', label:'Schnaps' },
  { id:'tiere',   label:'Für Vögel und Bienen' }
];
const BF_ERNTE = [
  { id:'sommer', label:'Sommer', info:'Juli, August' },
  { id:'herbst', label:'Herbst', info:'September, Oktober' },
  { id:'winter', label:'Winter', info:'gelagert bis ins Frühjahr' }
];
const BF_SCHRITTE = ['art', 'standort', 'platz', 'garten', 'nutzung', 'ernte'];

let _bf = bfLaden();

function bfLeer(){
  return { schritt:-1, art:null, hoehe:600, lage:'sued', boden:'mittel', platz:null,
           garten:[], nutzung:[], ernte:[], lange:false, mitPlan:true,
           filter:{ geschmack:[], fleisch:[], verwendung:[], genuss:[] }, auswahl:null };
}
function bfLaden(){
  try {
    const roh = JSON.parse(localStorage.getItem(BF_LS_KEY) || 'null');
    if(roh && typeof roh === 'object') return Object.assign(bfLeer(), roh);
  } catch(e){ /* gesperrter oder leerer Speicher – frisch beginnen */ }
  return bfLeer();
}
function bfMerken(){
  try { localStorage.setItem(BF_LS_KEY, JSON.stringify(_bf)); } catch(e){ /* Speicher gesperrt: Antworten gelten nur für diese Sitzung */ }
}

/* ---------- Daten ---------- */

/* Obstarten mit Hofsorten und mindestens einer Unterlage im Katalog */
function bfArten(){
  const zahl = {};
  SORTEN_DATA.forEach(s=>{
    const f = String(s.frucht || '').trim();
    if(!f || BF_OHNE.includes(obstartSchluessel(f))) return;
    if(!UNTERLAGEN_KATALOG.some(u => unterlagePasst(u, f))) return;
    zahl[f] = (zahl[f] || 0) + 1;
  });
  const vorne = ['Apfel', 'Birne', 'Zwetschke', 'Kirsche'];
  return Object.keys(zahl)
    .sort((a, b)=> ((vorne.indexOf(a) + 1) || 99) - ((vorne.indexOf(b) + 1) || 99) || a.localeCompare(b, 'de'))
    .map(f => ({ frucht:f, anzahl:zahl[f] }));
}

function bfSortenDerArt(art){
  const arten = art ? [art] : bfArten().map(a => a.frucht);
  return SORTEN_DATA
    .filter(s => arten.some(a => obstartSchluessel(a) === obstartSchluessel(s.frucht)))
    .map(s => getSorte(s.sorte) || s);
}

function bfMonat(s){
  const m = parseInt(String(s.pflueckzeitpunkt || '').split(',')[0], 10);
  return (m >= 1 && m <= 12) ? m : 0;
}
function bfText(s){
  return [s.eignung, s.geschmack, s.eigenschaften, s.lagerfaehig, s.standort_anspruch, (s.verwendung || []).join(' ')]
    .filter(Boolean).join(' ').toLowerCase();
}
function bfZiele(s){ return (s.standort && s.standort.ziele) || []; }
function bfIstRobust(s){
  return bfZiele(s).includes('robust') || /wenig anfällig|robust|widerstandsfähig|schorffest|gesund/.test(bfText(s));
}
function bfLagert(s){
  const bis = parseInt(s.genuss_bis, 10);
  return bfZiele(s).includes('lager') || (bis >= 1 && bis <= 5) || /bis (jän|jan|feb|mär|apr)/.test(bfText(s));
}
const BF_PASST = {
  tafel:   s => bfZiele(s).includes('tafel') || (s.verwendung || []).includes('Tafelobst') || /tafel/.test(bfText(s)),
  lager:   s => bfLagert(s),
  most:    s => bfZiele(s).includes('most') || (s.verwendung || []).includes('Saft/Most') || /most|\bsaft(?!ig)|obstwein|cider|pressen/.test(bfText(s)),
  backen:  s => (s.verwendung || []).includes('Wirtschaftsobst') || /back|koch|kuchen|strudel|mus\b|wirtschaft/.test(bfText(s)),
  doerren: s => /dörr/.test(bfText(s)) && !/dörren ungeeignet|nicht (zum |für )?dörr|ungeeignet zum dörr/.test(bfText(s)),
  schnaps: s => /schnaps|brenn|destill/.test(bfText(s))
};
const BF_GRUND = { tafel:'zum Frischessen', lager:'lagerfähig', most:'für Saft und Most', backen:'zum Backen und Kochen',
                   doerren:'zum Dörren', schnaps:'für Schnaps' };

/* ---------- Genusszeit und Merkmale (v134) ----------
   Pflückreif ist nicht genussreif: Der Kalender zeigt beides, über das
   Obstjahr von Juli bis Mai. Geschmack und Fruchtfleisch kommen aus den
   Freitexten der Sortenbeschreibung – wo keiner steht, gilt „ohne Angabe“,
   und die Sorte rückt beim Filtern ans Ende statt zu verschwinden. */
const BF_JAHR = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5];
const BF_MONAT_KURZ = ['', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const bfSaison = m => (m ? (m - 7 + 12) % 12 : 99);

function bfGenuss(s){
  const ernte = bfMonat(s);
  let von = parseInt(s.genuss_von, 10) || 0, bis = parseInt(s.genuss_bis, 10) || 0;
  if(!von) von = ernte;
  if(!bis) bis = von;
  const monate = [];
  if(von){ for(let m = von, i = 0; i < 12; i++, m = m % 12 + 1){ monate.push(m); if(m === bis) break; } }
  return { ernte, von, bis, monate };
}

const BF_FILTER = {
  geschmack: [ { id:'suess', label:'süß', re:/süß/ },
               { id:'saeuerlich', label:'säuerlich-frisch', re:/säuer|säure|weinig|spritzig|herb/ },
               { id:'wuerzig', label:'würzig, aromatisch', re:/würz|aroma|muskat|nuss|anis|edel/ } ],
  fleisch:   [ { id:'saftig', label:'saftig', re:/saftig/ },
               { id:'knackig', label:'knackig, fest', re:/knack|\bfest|hart/ },
               { id:'muerbe', label:'mürbe, schmelzend', re:/mürb|schmelz|weich|butt/ } ],
  verwendung:[ { id:'tafel', label:'frisch' }, { id:'most', label:'Most' },
               { id:'backen', label:'Backen' }, { id:'doerren', label:'Dörren' } ],
  genuss:    [ { id:'sommer', label:'Sommer', monate:[7, 8] }, { id:'herbst', label:'Herbst', monate:[9, 10, 11] },
               { id:'winter', label:'Winter', monate:[12, 1, 2] }, { id:'fruehjahr', label:'Frühjahr', monate:[3, 4, 5] } ]
};
const BF_FILTER_TITEL = { geschmack:'Geschmack', fleisch:'Fruchtfleisch', verwendung:'Verwendung', genuss:'Genusszeit' };

/* true = passt, false = passt nicht, null = keine Angabe */
function bfFilterPasst(s, gruppe, ids){
  if(!ids.length) return true;
  if(gruppe === 'geschmack' || gruppe === 'fleisch'){
    /* „schwach gewürzt“, „wenig Säure“, „ohne besonderes Aroma“ zählen nicht als Treffer */
    const g = String(s.geschmack || '').toLowerCase()
      .replace(/(schwach|kaum|wenig|nicht|ohne( besonderes)?)\s+(gewürzt|würzig|aromatisch|aroma|süß|säuerlich|säure)/g, '');
    if(!String(s.geschmack || '').trim()) return null;
    return BF_FILTER[gruppe].some(f => ids.includes(f.id) && f.re.test(g));
  }
  if(gruppe === 'verwendung'){
    if(!bfText(s).trim() && !bfZiele(s).length) return null;
    return ids.some(id => BF_PASST[id] && BF_PASST[id](s));
  }
  const gz = bfGenuss(s);
  if(!gz.monate.length) return null;
  return BF_FILTER.genuss.some(f => ids.includes(f.id) && f.monate.some(m => gz.monate.includes(m)));
}

function bfGefiltert(bewertet){
  const f = Object.assign({ geschmack:[], fleisch:[], verwendung:[], genuss:[] }, _bf.filter || {});
  const mit = [], ohne = [];
  bewertet.forEach(b=>{
    let fehlt = false;
    for(const gruppe of Object.keys(BF_FILTER)){
      const r = bfFilterPasst(b.s, gruppe, f[gruppe] || []);
      if(r === false) return;
      if(r === null) fehlt = true;
    }
    (fehlt || !String(b.s.geschmack || '').trim() ? ohne : mit).push(b);
  });
  const nachZeit = (a, b)=> bfSaison(bfGenuss(a.s).von) - bfSaison(bfGenuss(b.s).von) || b.punkte - a.punkte;
  return mit.sort(nachZeit).concat(ohne.sort(nachZeit).map(b => Object.assign({}, b, { ohneAngabe:true })));
}

/* Standort: harte Grenze nur, wo die Sorte Angaben hat. */
function bfStandortOk(s){
  const st = s.standort;
  if(!st) return null;
  const arr = v => Array.isArray(v) ? v : [v];
  const frost = _bf.lage === 'mulde' ? 'hoch' : 'mittel';
  return _bf.hoehe >= (st.hmin || 0) && _bf.hoehe <= st.hmax
    && arr(st.expo).includes(_bf.lage) && arr(st.ns).includes(_bf.boden)
    && !(frost === 'hoch' && st.frost === 'gering');
}

function bfBewerten(art){
  const verkauf = getBetrieb().shop_aktiv;
  return bfSortenDerArt(art).map(s=>{
    const ok = bfStandortOk(s);
    if(ok === false) return null;
    const gruende = [];
    let punkte = 1;
    if(ok === true){ punkte += 2; gruende.push('passt zu deinem Standort'); }
    _bf.nutzung.forEach(n=>{ if(BF_PASST[n] && BF_PASST[n](s)){ punkte += 2; gruende.push(BF_GRUND[n]); } });
    const m = bfMonat(s);
    const imSommer = m >= 7 && m <= 8, imHerbst = m >= 9 && m <= 10;
    if(_bf.ernte.includes('sommer') && imSommer){ punkte += 2; gruende.push('Ernte im Sommer'); }
    if(_bf.ernte.includes('herbst') && imHerbst){ punkte += 2; gruende.push('Ernte im Herbst'); }
    if(_bf.ernte.includes('winter') && bfLagert(s)){ punkte += 2; if(!gruende.includes('lagerfähig')) gruende.push('hält bis in den Winter'); }
    if(bfIstRobust(s)){ punkte += _bf.garten.includes('kinder') ? 2 : 1; gruende.push('robust'); }
    const bestellbar = verkauf && getBestellbarkeit(s.sorte).eigenproduktion;
    if(bestellbar) punkte += 1;
    return { s, punkte, gruende, monat:m, bestellbar, ohneStandort: ok === null };
  }).filter(Boolean).sort((a, b)=> b.punkte - a.punkte || a.s.sorte.localeCompare(b.s.sorte, 'de'));
}

/* ---------- Unterlage und Stammform ---------- */
const BF_WUCHS_FOLGE = ['schwach', 'mittel', 'stark'];

function bfWunsch(art){
  const g = _bf.garten;
  let wuchs = { topf:'schwach', klein:'schwach', haus:'mittel', wiese:'stark' }[_bf.platz] || 'mittel';
  let form;
  /* Der Platz hat Vorrang (Volkmar 28.10.2026): Ein Hochstamm braucht 8–10 m
     und kommt nur auf Wiese oder Weide. Tiere heben im kleinen Garten höchstens
     auf einen Halbstamm, im Topf gar nicht. */
  if((g.includes('schafe') || g.includes('huehner') || g.includes('schatten')) && wuchs === 'schwach' && _bf.platz !== 'topf') wuchs = 'mittel';
  if(!form){
    if(wuchs === 'schwach') form = 'busch';
    else if(wuchs === 'mittel') form = (g.includes('kinder') && !g.includes('huehner') && !g.includes('schatten')) ? 'busch' : 'halb';
    else form = 'hoch';
  }
  return { wuchs, form };
}

/* Aktive Unterlage der gewünschten Wuchsklasse; sonst die nächste aktive
   Klasse; erst wenn keine aktive passt, eine nicht aktive „auf Anfrage“. */
function bfUnterlage(art){
  const w = bfWunsch(art);
  const alle = getProduktion().unterlagen.filter(u => unterlagePasst(u, art));
  const mitForm = (liste, form) => liste.filter(u => (u.formen || []).includes(form));
  const reihe = [w.wuchs].concat(BF_WUCHS_FOLGE.filter(x => x !== w.wuchs)
    .sort((a, b)=> Math.abs(BF_WUCHS_FOLGE.indexOf(a) - BF_WUCHS_FOLGE.indexOf(w.wuchs)) - Math.abs(BF_WUCHS_FOLGE.indexOf(b) - BF_WUCHS_FOLGE.indexOf(w.wuchs))));
  for(const klasse of reihe){
    const aktiv = alle.filter(u => u.wuchs === klasse && u.aktiv);
    if(!aktiv.length) continue;
    const passend = mitForm(aktiv, w.form);
    const u = passend[0] || aktiv[0];
    const form = passend.length ? w.form : (u.formen || ['busch'])[0];
    return { u, form, wuchs:klasse, abweichung: klasse !== w.wuchs, aufAnfrage:false, wunsch:w };
  }
  const ersatz = mitForm(alle.filter(u => u.wuchs === w.wuchs), w.form)[0] || alle.find(u => u.wuchs === w.wuchs) || alle[0];
  if(!ersatz) return null;
  return { u:ersatz, form:(ersatz.formen || []).includes(w.form) ? w.form : (ersatz.formen || ['busch'])[0],
           wuchs:ersatz.wuchs, abweichung:false, aufAnfrage:true, wunsch:w };
}

/* ---------- Ergebnis ---------- */
function bfErgebnis(){
  let art = _bf.art;
  let bewertet = bfBewerten(art);
  if(!art && bewertet.length) art = bewertet[0].s.frucht;
  if(!_bf.art) bewertet = bewertet.filter(b => obstartSchluessel(b.s.frucht) === obstartSchluessel(art));
  if(!bewertet.length) return { art, leer:true };
  const unterlage = bfUnterlage(art);
  const maxBaum = _bf.platz === 'topf' ? 1 : maxSortenProBaum(art);
  const maxSorten = _bf.lange ? Math.min(3, maxBaum) : 1;
  const verkauf = getBetrieb().shop_aktiv;
  /* Mehrsortenbaum: nur Sorten, die der Hof selbst veredeln darf, wenn verkauft
     wird – sonst wäre der Baum nicht bestellbar. Verschiedene Pflückmonate zuerst. */
  const kandidaten = (maxSorten > 1 && verkauf) ? bewertet.filter(b => b.bestellbar) : bewertet;
  const gewaehlt = [];
  (kandidaten.length ? kandidaten : bewertet).forEach(b=>{
    if(gewaehlt.length >= maxSorten) return;
    const v = bfGenuss(b.s).von;
    if(gewaehlt.length && v && gewaehlt.some(g => bfGenuss(g.s).von === v)) return;
    gewaehlt.push(b);
  });
  if(gewaehlt.length < maxSorten){
    (kandidaten.length ? kandidaten : bewertet).forEach(b=>{ if(gewaehlt.length < maxSorten && !gewaehlt.includes(b)) gewaehlt.push(b); });
  }
  /* Eigene Auswahl aus der Liste hat Vorrang vor der Vorauswahl */
  const eigen = Array.isArray(_bf.auswahl)
    ? _bf.auswahl.map(n => bewertet.find(b => b.s.sorte === n)).filter(Boolean).slice(0, maxBaum) : null;
  const sorten = (eigen && eigen.length ? eigen : gewaehlt)
    .slice().sort((a, b)=> bfSaison(bfGenuss(a.s).von) - bfSaison(bfGenuss(b.s).von));
  const andereArten = _bf.art ? [] : [...new Set(bfBewerten(null).map(b => b.s.frucht))].filter(f => f !== art).slice(0, 3);
  return { art, unterlage, sorten, bewertet, maxBaum, andereArten, gesamt:bewertet.length };
}

function bfBefruchtung(sorten){
  const paare = [];
  for(let i = 0; i < sorten.length; i++){
    for(let j = i + 1; j < sorten.length; j++){
      const a = sorten[i].s, b = sorten[j].s;
      const nennt = (x, y) => x.befruchtungspartner
        && String(x.befruchtungspartner).toLowerCase().includes(String(y.sorte).toLowerCase().split(' ')[0]);
      if(nennt(a, b) || nennt(b, a)) paare.push([a.sorte, b.sorte]);
    }
  }
  return paare;
}

function bfPreis(erg){
  const p = getProduktion();
  if(p.grundpreis == null || !erg.unterlage) return null;
  const st = p.stammformen.find(f => f.id === erg.unterlage.form) || {};
  return p.grundpreis + (erg.unterlage.u.preis || 0) + (st.aufpreis || 0)
    + Math.max(0, erg.sorten.length - 1) * (p.aufpreis_je_veredelung || 0);
}

function bfSofort(art){
  let liste = [];
  try { liste = (JSON.parse((getProduktion().sofort) || '{}').liste) || []; } catch(e){ liste = []; }
  return liste.filter(x => obstartSchluessel(x.frucht) === obstartSchluessel(art));
}

function bfHinweise(erg){
  const h = [];
  const g = _bf.garten;
  const art = obstartSchluessel(erg.art);
  if(erg.sorten.length === 1 && (art === 'apfel' || art === 'birne'))
    h.push(`${erg.art === 'Birne' ? 'Birnen' : 'Äpfel'} brauchen meist eine zweite Sorte in der Nähe zur Bestäubung. Steht keine in der Nachbarschaft, löst ein Baum mit mehreren Sorten das gleich mit.`);
  bfBefruchtung(erg.sorten).forEach(([a, b]) => h.push(`${a} und ${b} befruchten einander – die Bestäubung geschieht im selben Baum.`));
  if(_bf.platz === 'topf')
    h.push('Im Topf: ein großer Kübel, durchlässige Erde und regelmäßig gießen. Echte Säulenäpfel sind eigene Sorten – unsere alten Hofsorten wachsen im Topf als kleiner Busch.');
  if(g.includes('huehner')) h.push('Hühner unter dem Baum: Halb- oder Hochstamm, damit die Krone über den Tieren bleibt.');
  if(g.includes('schafe')) h.push(_bf.platz === 'wiese'
    ? 'Schafe oder Ziegen: Hochstamm mit Krone ab etwa 1,8 m und ein fester Stammschutz gegen Verbiss.'
    : 'Schafe oder Ziegen bräuchten einen Hochstamm (Krone ab etwa 1,8 m) – der braucht aber 8–10 m Platz. Bei deinem Platz: Halbstamm mit festem Stammschutz, oder die Tiere vom Baum fernhalten.');
  if(g.includes('kinder')){
    const niedrig = erg.unterlage && ['busch', 'saeule'].includes(erg.unterlage.form);
    h.push(`Am Hof wird nicht gespritzt – deshalb robuste Sorten zuerst.${niedrig ? ' Der niedrige Baum lässt Kinder selbst ernten.' : ' Die unteren Äste bleiben für Kinder erreichbar, wenn du sie beim Schnitt stehen lässt.'}`);
  }
  if(g.includes('bienen') || _bf.nutzung.includes('tiere')) h.push('Mehrere Sorten verlängern die Blüte – gut für Bienen. Ein paar Früchte am Baum lassen freut die Vögel im Winter.');
  if(g.includes('schatten')) h.push('Für Schatten: ein Halbstamm mit breiter Krone, ein paar Meter vom Sitzplatz entfernt.');
  if(g.includes('hecke')) h.push('Für Hecke und Windschutz passen Wildobststräucher wie Dirndl oder Felsenbirne – frag uns danach.');
  if(erg.unterlage && erg.unterlage.abweichung)
    h.push(`Eine ${erg.unterlage.wunsch.wuchs} wachsende Unterlage ist derzeit nicht im Angebot – deshalb ${erg.unterlage.u.name}.`);
  if(erg.sorten.some(b => b.ohneStandort)) h.push('Zu manchen Sorten gibt es keine Standortangaben – im Gespräch klären wir, ob sie bei dir gedeihen.');
  return h;
}

/* ---------- Darstellung ---------- */
function renderBaumfinder(){
  const el = document.getElementById('baumfinder');
  if(!el || !window.__dataReady) return;
  if(_bf.schritt < 0) el.innerHTML = bfStart();
  else if(_bf.schritt >= BF_SCHRITTE.length) el.innerHTML = bfErgebnisHtml();
  else el.innerHTML = bfFrage(BF_SCHRITTE[_bf.schritt]);
}

function bfStart(){
  const fertig = _bf.platz && _bf.art !== null;
  return `
    <div class="bf-karte bf-start">
      <svg class="bf-baum" width="44" height="48" viewBox="0 0 44 48" aria-hidden="true">
        <circle cx="22" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="1.2"/>
        <line x1="22" y1="33" x2="22" y2="47" stroke="currentColor" stroke-width="1.2"/>
        <circle cx="16" cy="15" r="2" fill="none" stroke="currentColor"/><circle cx="27" cy="20" r="2" fill="none" stroke="currentColor"/></svg>
      <h2 class="bf-titel">Welcher Obstbaum passt zu dir?</h2>
      <p class="bf-text">Sechs kurze Fragen – am Ende steht dein Baum: Sorte, Unterlage und Baumform, passend zu deinem Garten.</p>
      <div class="bf-knoepfe">
        <button type="button" class="btn" onclick="bfGehe(0)">${fertig ? 'Neu beginnen' : 'Los geht’s'}</button>
        ${fertig ? `<button type="button" class="btn secondary" onclick="bfGehe(${BF_SCHRITTE.length})">Mein letztes Ergebnis</button>` : ''}
      </div>
    </div>`;
}

function bfKopf(nr){
  const n = BF_SCHRITTE.length;
  const passen = bfBewerten(_bf.art).length;
  return `
    <div class="bf-kopf">
      <button type="button" class="bf-zurueck" onclick="bfGehe(${nr - 1})" aria-label="Zurück">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg></button>
      <span>Frage ${nr + 1} von ${n}</span>
      <span class="bf-passen">${passen} ${passen === 1 ? 'Sorte passt' : 'Sorten passen'}</span>
    </div>
    <div class="bf-balken"><i style="width:${Math.round((nr + 1) / n * 100)}%"></i></div>`;
}

const bfWahl = (gruppe, wert, label, info, aktiv, extra) => `
  <button type="button" class="bf-wahl${aktiv ? ' aktiv' : ''}" onclick="bfSetze('${gruppe}','${escAttr(wert)}')">
    ${extra || ''}<span class="bf-wahl-text">${escHtml(label)}${info ? `<small>${escHtml(info)}</small>` : ''}</span></button>`;
const bfChip = (gruppe, wert, label, aktiv) => `
  <button type="button" class="bf-chip${aktiv ? ' aktiv' : ''}" aria-pressed="${aktiv ? 'true' : 'false'}" onclick="bfUmschalten('${gruppe}','${escAttr(wert)}')">${escHtml(label)}</button>`;

function bfFrage(name){
  const nr = BF_SCHRITTE.indexOf(name);
  const weiter = `<div class="bf-knoepfe"><button type="button" class="btn" onclick="bfGehe(${nr + 1})">Weiter</button></div>`;
  let inhalt = '';
  if(name === 'art'){
    inhalt = `<p class="bf-frage">Welches Obst soll es sein?</p>
      ${bfArten().map(a => bfWahl('art', a.frucht, a.frucht, '', _bf.art === a.frucht)).join('')}
      ${bfWahl('art', '', 'Weiß ich noch nicht', 'zeig mir, was am besten passt', _bf.art === '')}`;
  } else if(name === 'standort'){
    inhalt = `<p class="bf-frage">Wo steht der Baum?</p>
      <label class="bf-feld">Seehöhe <b id="bf-hoehe-wert">${_bf.hoehe} m</b>
        <input type="range" min="200" max="1200" step="10" value="${_bf.hoehe}"
               oninput="bfHoeheZeigen(this.value)" onchange="bfSetzeWert('hoehe', this.value)"></label>
      <div class="bf-unterfrage">Lage</div>
      <div class="bf-chips">${BF_LAGEN.map(l => `<button type="button" class="bf-chip${_bf.lage === l.id ? ' aktiv' : ''}" onclick="bfSetzeWert('lage','${l.id}')">${escHtml(l.label)}</button>`).join('')}</div>
      <div class="bf-unterfrage">Boden</div>
      <div class="bf-chips">${BF_BOEDEN.map(b => `<button type="button" class="bf-chip${_bf.boden === b.id ? ' aktiv' : ''}" onclick="bfSetzeWert('boden','${b.id}')">${escHtml(b.label)}</button>`).join('')}</div>
      <p class="bf-leise">Nicht sicher? Lass die Vorgabe stehen.</p>${weiter}`;
  } else if(name === 'platz'){
    inhalt = `<p class="bf-frage">Wie viel Platz hat der Baum?</p>
      ${BF_PLAETZE.map(p => bfWahl('platz', p.id, p.label, p.info, _bf.platz === p.id,
        `<svg width="30" height="34" viewBox="0 0 30 34" aria-hidden="true"><circle cx="15" cy="${16 - p.kreis * 0.4}" r="${p.kreis}" fill="none" stroke="currentColor" stroke-width="1"/><line x1="15" y1="${16 - p.kreis * 0.4 + p.kreis}" x2="15" y2="33" stroke="currentColor" stroke-width="1"/></svg>`)).join('')}`;
  } else if(name === 'garten'){
    inhalt = `<p class="bf-frage">Was gibt es noch in deinem Garten?</p>
      <div class="bf-chips">${BF_GARTEN.map(g => bfChip('garten', g.id, g.label, _bf.garten.includes(g.id))).join('')}</div>
      <p class="bf-leise">Mehreres möglich – oder nichts davon.</p>${weiter}`;
  } else if(name === 'nutzung'){
    const art = obstartSchluessel(_bf.art);
    const liste = BF_NUTZUNG.filter(n => n.id !== 'schnaps' || ['zwetschke', 'birne', 'kirsche', 'apfel', ''].includes(art));
    inhalt = `<p class="bf-frage">Was willst du mit dem Obst machen?</p>
      <div class="bf-chips">${liste.map(n => bfChip('nutzung', n.id, n.label, _bf.nutzung.includes(n.id))).join('')}</div>${weiter}`;
  } else if(name === 'ernte'){
    const mehrsorten = !_bf.art || istMehrsortenfaehig(_bf.art);
    inhalt = `<p class="bf-frage">Wann willst du ernten?</p>
      <div class="bf-chips">${BF_ERNTE.map(e => bfChip('ernte', e.id, `${e.label} · ${e.info}`, _bf.ernte.includes(e.id))).join('')}</div>
      ${mehrsorten && _bf.platz !== 'topf' ? `
      <button type="button" class="bf-wahl${_bf.lange ? ' aktiv' : ''}" onclick="bfSetzeWert('lange', ${_bf.lange ? 'false' : 'true'})">
        <span class="bf-wahl-text">Möglichst lange genießen<small>mehrere Sorten auf einem Baum – von der Ernte bis ins Frühjahr</small></span></button>` : ''}
      <div class="bf-knoepfe"><button type="button" class="btn" onclick="bfGehe(${nr + 1})">Meinen Baum zeigen</button></div>`;
  }
  return `<div class="bf-karte">${bfKopf(nr)}${inhalt}</div>`;
}

function bfErgebnisHtml(){
  const erg = bfErgebnis();
  const neu = `<button type="button" class="btn secondary" onclick="bfNeu()">Neu beginnen</button>`;
  if(erg.leer) return `
    <div class="bf-karte">
      <h2 class="bf-titel">Da wird es eng</h2>
      <p class="bf-text">Für diese Angaben finden wir unter unseren Hofsorten keine passende. Im Gespräch finden wir trotzdem eine Lösung.</p>
      ${bfBeratungBlock()}
      <div class="bf-knoepfe"><button type="button" class="btn secondary" onclick="bfGehe(${BF_SCHRITTE.length - 1})">Angaben ändern</button>${neu}</div>
    </div>`;
  const verkauf = getBetrieb().shop_aktiv;
  const u = erg.unterlage;
  const form = u ? getProduktion().stammformen.find(f => f.id === u.form) : null;
  const preis = verkauf ? bfPreis(erg) : null;
  const nichtFrei = erg.sorten.filter(x => !x.bestellbar).map(x => x.s.sorte);
  const alleBestellbar = !nichtFrei.length && u && !u.aufAnfrage;
  const sofort = verkauf ? bfSofort(erg.art) : [];
  const titel = `${erg.art}${form ? `, ${form.name}` : ''}${u ? ` auf ${u.u.name}` : ''}`;
  const unterzeile = [u && bfPlatz(u), u && u.u.ertrag && `trägt ${u.u.ertrag}`,
    erg.maxBaum > 1 ? `bis ${erg.maxBaum} Sorten auf einem Baum` : ''].filter(Boolean).join(' · ');
  const hinweise = bfHinweise(erg);
  const n = erg.sorten.length;
  const knopfText = `${n} ${n === 1 ? 'Sorte' : 'Sorten auf einem Baum'}${preis == null ? '' : ` · ${eur(preis)}`}`;
  return `
    <div class="bf-karte bf-ergebnis">
      <div class="bf-kopf"><button type="button" class="bf-zurueck" onclick="bfGehe(${BF_SCHRITTE.length - 1})" aria-label="Zurück">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg></button>
        <span>Dein Baum</span><span class="bf-passen">${erg.gesamt} passende Sorten</span></div>
      <div class="bf-balken"><i style="width:100%"></i></div>
      <h2 class="bf-titel">${escHtml(titel)}</h2>
      ${unterzeile ? `<p class="bf-leise">${escHtml(unterzeile)}</p>` : ''}
      ${u ? `<p class="bf-text">${escHtml(u.u.beschreibung)}${u.aufAnfrage ? ' <span class="bf-anfrage">auf Anfrage</span>' : ''}</p>` : ''}

      <div class="bf-unterfrage">Deine Auswahl – wann du genießt</div>
      ${bfKalenderHtml(erg.sorten)}
      <p class="bf-text bf-genuss-satz">${escHtml(bfGenussSatz(erg.sorten))}</p>

      ${verkauf ? `
        <div class="bf-knoepfe">
          ${alleBestellbar ? `<button type="button" class="btn" onclick="bfAufMerkliste()">${escHtml(knopfText)} – auf die Merkliste</button>` : ''}
          <button type="button" class="btn secondary" onclick="bfBeratungAnfragen()">Beratung anfragen</button>
        </div>
        <p class="bf-leise">${preis == null ? 'Preis mit dem Angebot' : 'Richtpreis'} · unverbindlich · Abholung am Hof · Herbst ${konfigLieferjahr()}
          ${alleBestellbar ? ` · <button type="button" class="bf-link" onclick="bfImKonfigurator()">Baum im Detail anpassen</button>` : ''}</p>
        ${nichtFrei.length ? `<p class="bf-leise">${escHtml(nichtFrei.join(', '))}: nicht zur eigenen Veredelung freigegeben – dazu beraten wir gern.</p>` : ''}` : bfBeratungBlock()}
      ${sofort.length ? `<div class="bf-sofort"><b>Sofort verfügbar am Hof:</b> ${sofort.map(x => escHtml(`${x.sorte || x.frucht}${x.unterlage ? ` (${x.unterlage})` : ''} – ${x.anzahl} Stk.`)).join(', ')}</div>` : ''}

      ${bfListeHtml(erg)}

      ${hinweise.length ? `<div class="bf-unterfrage">Gut zu wissen</div><ul class="bf-hinweise">${hinweise.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul>` : ''}
      <div class="bf-pdf">
        <label><input type="checkbox" ${_bf.mitPlan ? 'checked' : ''} onchange="bfSetzeWert('mitPlan', this.checked, true)"> mit Pflanzplan</label>
        <button type="button" class="btn secondary" onclick="bfPdf()">Als PDF speichern</button>
      </div>
      ${erg.andereArten.length ? `
        <div class="bf-unterfrage">Andere Obstarten, die passen</div>
        <div class="bf-chips">${erg.andereArten.map(f => `<button type="button" class="bf-chip" onclick="bfArtWechseln('${escAttr(f)}')">${escHtml(f)}</button>`).join('')}</div>` : ''}
      <div class="bf-knoepfe">${neu}</div>
    </div>`;
}

/* Kalender Juli bis Mai: Kreis = pflücken, Linie = genießen */
function bfKalenderHtml(sorten){
  const kopf = BF_JAHR.map(m => `<span>${BF_MONAT_KURZ[m]}</span>`).join('');
  const zeilen = sorten.map(x=>{
    const g = bfGenuss(x.s);
    const zellen = BF_JAHR.map(m=>{
      const genuss = g.monate.includes(m);
      const links = genuss && g.monate.includes(m === 1 ? 12 : m - 1) && m !== g.von;
      const rechts = genuss && m !== g.bis;
      return `<span class="bf-kal-zelle${genuss ? ' genuss' : ''}${links ? ' l' : ''}${rechts ? ' r' : ''}">${g.ernte === m ? '<i class="bf-kal-ernte"></i>' : ''}</span>`;
    }).join('');
    return `<div class="bf-kal-zeile"><span class="bf-kal-name">${escHtml(x.s.sorte)}</span><span class="bf-kal-monate">${zellen}</span></div>`;
  }).join('');
  return `<div class="bf-kal">
      <div class="bf-kal-zeile bf-kal-kopf"><span class="bf-kal-name"></span><span class="bf-kal-monate">${kopf}</span></div>
      ${zeilen}
      <div class="bf-kal-legende"><i class="bf-kal-ernte"></i> pflücken <i class="bf-kal-strich"></i> genießen</div>
    </div>`;
}

function bfGenussSatz(sorten){
  const g = sorten.map(x => Object.assign({ name:x.s.sorte }, bfGenuss(x.s))).filter(x => x.von);
  if(!g.length) return 'Zur Genusszeit dieser Sorten haben wir noch keine Angaben – frag uns.';
  const start = g.reduce((a, x)=> Math.min(a, bfSaison(x.ernte || x.von)), 99);
  const ende = g.reduce((a, x)=> Math.max(a, bfSaison(x.bis)), 0);
  const name = i => KONFIG_MONATE[BF_JAHR[i]] || '';
  const lager = g.filter(x => x.ernte && x.von && bfSaison(x.von) > bfSaison(x.ernte))
    .sort((a, b)=> (bfSaison(b.von) - bfSaison(b.ernte)) - (bfSaison(a.von) - bfSaison(a.ernte)))[0];
  const teile = [sorten.length > 1
    ? `Mit diesen ${sorten.length} Sorten hast du Obst von ${name(start)} bis ${name(ende)}.`
    : `${g[0].name}: von ${name(start)} bis ${name(ende)}.`];
  const ohne = sorten.filter(x => !bfGenuss(x.s).von).map(x => x.s.sorte);
  if(ohne.length) teile.push(`Zur Genusszeit von ${ohne.join(' und ')} fehlen uns noch Angaben.`);
  if(lager) teile.push(`Pflückreif ist nicht gleich genussreif: ${lager.name} wird im ${KONFIG_MONATE[lager.ernte]} gepflückt und erst ab ${KONFIG_MONATE[lager.von]} im kühlen Keller richtig süß und aromatisch.`);
  return teile.join(' ');
}

function bfListeHtml(erg){
  const f = Object.assign({ geschmack:[], fleisch:[], verwendung:[], genuss:[] }, _bf.filter || {});
  const liste = bfGefiltert(erg.bewertet);
  const gewaehlt = erg.sorten.map(x => x.s.sorte);
  const filterHtml = Object.keys(BF_FILTER).map(gruppe => `
      <div class="bf-filter"><span class="bf-filter-titel">${BF_FILTER_TITEL[gruppe]}</span>
        ${BF_FILTER[gruppe].map(x => `<button type="button" class="bf-chip${f[gruppe].includes(x.id) ? ' aktiv' : ''}" aria-pressed="${f[gruppe].includes(x.id) ? 'true' : 'false'}" onclick="bfFilter('${gruppe}','${x.id}')">${escHtml(x.label)}</button>`).join('')}
      </div>`).join('');
  const zeilen = liste.map(b=>{
    const an = gewaehlt.includes(b.s.sorte);
    const g = bfGenuss(b.s);
    const geschmack = String(b.s.geschmack || '').trim();
    const zeit = [g.ernte && `pflücken ${KONFIG_MONATE[g.ernte]}`,
      g.von && g.bis && `genießen ${KONFIG_MONATE[g.von]}${g.bis !== g.von ? `–${KONFIG_MONATE[g.bis]}` : ''}`].filter(Boolean).join(' · ');
    return `
      <div class="bf-zeile${an ? ' an' : ''}">
        <button type="button" class="bf-haken${an ? ' an' : ''}" aria-pressed="${an ? 'true' : 'false'}" aria-label="${escAttr(b.s.sorte)} ${an ? 'abwählen' : 'wählen'}" onclick="bfWaehlen('${escAttr(b.s.sorte)}')"></button>
        <button type="button" class="bf-zeile-text" onclick="openSortenModal('${escAttr(b.s.sorte)}')">
          <span class="bf-sorte-name">${escHtml(b.s.sorte)}</span>
          <span class="bf-sorte-reife">${geschmack ? escHtml(geschmack.length > 90 ? `${geschmack.slice(0, 88)}…` : geschmack) : 'Geschmack noch ohne Angabe'}</span>
          ${zeit ? `<span class="bf-sorte-reife">${escHtml(zeit)}</span>` : ''}
        </button>
      </div>`;
  }).join('');
  const aktiv = Object.values(f).some(x => x.length);
  return `
    <div class="bf-unterfrage">Verfeinern</div>
    ${filterHtml}
    ${aktiv ? `<button type="button" class="bf-link" onclick="bfFilterLeeren()">Filter zurücksetzen</button>` : ''}
    <div class="bf-unterfrage">${liste.length} passende Sorten · nach Genusszeit${erg.maxBaum > 1 ? ` · bis ${erg.maxBaum} wählen` : ''}</div>
    <div class="bf-liste">${zeilen || '<p class="bf-leise">Keine Sorte erfüllt alle Filter.</p>'}</div>`;
}

function bfBeratungBlock(){
  return `
    <div class="bf-beratung">
      <p class="bf-beratung-titel">Ein Obstbaum ist eine Entscheidung für Jahrzehnte.</p>
      <p class="bf-text">Wir kennen alte Sorten, die sich auf 720 m Seehöhe bewährt haben. Erzähl uns von deinem Garten – wir sagen dir, welche dort gedeiht, und warum.</p>
      <div class="bf-knoepfe"><button type="button" class="btn" onclick="bfBeratungAnfragen()">Beratung anfragen</button></div>
    </div>`;
}

function bfPlatz(u){ return (u.form === 'saeule' && u.u.platz_saeule) ? u.u.platz_saeule : u.u.platz; }

function bfReifeText(s){
  const teile = [];
  const m = bfMonat(s);
  if(m) teile.push(`pflücken ${KONFIG_MONATE[m]}`);
  if(s.genussreife) teile.push(`genießen ${s.genussreife}`);
  return teile.join(' · ');
}

/* ---------- Bedienung ---------- */
function bfGehe(schritt){
  if(schritt === 0 && _bf.schritt < 0) _bf = Object.assign(bfLeer(), { schritt:0 });
  _bf.schritt = Math.max(-1, Math.min(BF_SCHRITTE.length, schritt));
  bfMerken();
  renderBaumfinder();
  const el = document.getElementById('baumfinder');
  if(el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block:'start' });
}
function bfHoeheZeigen(wert){
  const el = document.getElementById('bf-hoehe-wert');
  if(el) el.textContent = `${wert} m`;
}
function bfNeu(){ _bf = bfLeer(); bfMerken(); bfGehe(0); }

/* Einfachauswahl: antippen und weiter */
function bfSetze(gruppe, wert){
  _bf[gruppe] = wert;
  _bf.auswahl = null;
  if(gruppe === 'art' && !istMehrsortenfaehig(wert || 'Apfel')) _bf.lange = false;
  bfGehe(_bf.schritt + 1);
}
function bfSetzeWert(feld, wert, stumm){
  _bf[feld] = (feld === 'hoehe') ? Math.max(200, Math.min(1200, parseInt(wert, 10) || 600)) : wert;
  if(feld !== 'mitPlan') _bf.auswahl = null;
  bfMerken();
  if(!stumm) renderBaumfinder();
}
function bfUmschalten(gruppe, wert){
  const liste = _bf[gruppe] || [];
  _bf[gruppe] = liste.includes(wert) ? liste.filter(x => x !== wert) : liste.concat(wert);
  _bf.auswahl = null;
  bfMerken();
  renderBaumfinder();
}
function bfArtWechseln(art){ _bf.art = art; _bf.auswahl = null; bfMerken(); renderBaumfinder(); }

/* Verfeinern ändert nur die Liste, nicht die Auswahl */
function bfFilter(gruppe, id){
  const f = Object.assign({ geschmack:[], fleisch:[], verwendung:[], genuss:[] }, _bf.filter || {});
  f[gruppe] = f[gruppe].includes(id) ? f[gruppe].filter(x => x !== id) : f[gruppe].concat(id);
  _bf.filter = f;
  bfMerken();
  renderBaumfinder();
}
function bfFilterLeeren(){ _bf.filter = bfLeer().filter; bfMerken(); renderBaumfinder(); }

function bfWaehlen(name){
  const erg = bfErgebnis();
  let auswahl = erg.sorten.map(x => x.s.sorte);
  if(auswahl.includes(name)){
    if(auswahl.length === 1){ showToast('Mindestens eine Sorte bleibt gewählt.', 'info'); return; }
    auswahl = auswahl.filter(x => x !== name);
  } else {
    if(auswahl.length >= erg.maxBaum){
      showToast(erg.maxBaum === 1 ? 'Hier passt nur eine Sorte – tippe erst die gewählte ab.' : `Höchstens ${erg.maxBaum} Sorten auf einem Baum.`, 'info');
      return;
    }
    auswahl = auswahl.concat(name);
  }
  _bf.auswahl = auswahl;
  bfMerken();
  renderBaumfinder();
}

function bfAufMerkliste(){
  const erg = bfErgebnis();
  if(erg.leer || !erg.unterlage) return;
  const p = getProduktion();
  const form = p.stammformen.find(f => f.id === erg.unterlage.form) || {};
  const liste = getMerkliste(MERKLISTE_EIGEN);
  liste.konfigurationen.push({
    id: `K${Date.now().toString(36)}`,
    konfiguriert: true,
    frucht: erg.art,
    sorte: erg.sorten[0].s.sorte,
    sorten: erg.sorten.map(x => ({ sorte:x.s.sorte })),
    unterlage: erg.unterlage.u.name,
    unterlage_id: erg.unterlage.u.id,
    stammform: form.name || '',
    stammform_id: erg.unterlage.form,
    menge: 1,
    notiz: 'aus dem Baumfinder',
    preis_berechnet: bfPreis(erg),
    lieferjahr: konfigLieferjahr(),
    angelegt: new Date().toISOString()
  });
  liste.geaendert = new Date().toISOString();
  merkSpeichern();
  updateCartBadge();
  showToast('Dein Baum steht auf der Merkliste.', 'success');
  openBestelllisteModal();
}

function bfImKonfigurator(){
  const erg = bfErgebnis();
  if(erg.leer || !erg.unterlage) return;
  konfiguratorOeffnen(erg.sorten[0].s.sorte);
  if(!_konfig) return;
  _konfig.sorten = erg.sorten.map(x => x.s.sorte).filter(n => getBestellbarkeit(n).eigenproduktion);
  if(!_konfig.sorten.length) _konfig.sorten = [erg.sorten[0].s.sorte];
  _konfig.unterlage = erg.unterlage.u.id;
  _konfig.stammform = erg.unterlage.form;
  renderKonfigurator();
}

function bfZusammenfassung(){
  const erg = bfErgebnis();
  const name = (liste, id) => (liste.find(x => x.id === id) || {}).label || id;
  const z = [
    'Meine Angaben im Baumfinder:',
    `Obstart: ${_bf.art || (erg.leer ? 'noch offen' : `${erg.art} (vorgeschlagen)`)}`,
    `Seehöhe: ${_bf.hoehe} m, Lage: ${name(BF_LAGEN, _bf.lage)}, Boden: ${name(BF_BOEDEN, _bf.boden)}`,
    `Platz: ${name(BF_PLAETZE, _bf.platz)}`,
    `Im Garten: ${_bf.garten.map(g => name(BF_GARTEN, g)).join(', ') || '–'}`,
    `Nutzung: ${_bf.nutzung.map(n => name(BF_NUTZUNG, n)).join(', ') || '–'}`,
    `Ernte: ${_bf.ernte.map(e => name(BF_ERNTE, e)).join(', ') || '–'}${_bf.lange ? ', möglichst lange' : ''}`
  ];
  if(!erg.leer){
    const form = erg.unterlage ? (getProduktion().stammformen.find(f => f.id === erg.unterlage.form) || {}).name : '';
    z.push('', `Vorschlag: ${erg.art}${form ? `, ${form}` : ''}${erg.unterlage ? ` auf ${erg.unterlage.u.name}` : ''}`);
    erg.sorten.forEach(x => z.push(`  - ${x.s.sorte}`));
  }
  return { erg, text:z.join('\r\n') };
}

function bfBeratungAnfragen(){
  const adresse = getProduktion().email || HOF_EMAIL_STANDARD;
  const z = bfZusammenfassung();
  const text = `Hallo,\r\n\r\nich hätte gern eine Beratung zu einem Obstbaum.\r\n\r\n${z.text}\r\n\r\nMeine Fragen:\r\n\r\n`;
  window.location.href = `mailto:${encodeURIComponent(adresse)}?subject=${encodeURIComponent('Beratung Obstbaum')}&body=${encodeURIComponent(text)}`;
}

/* ---------- PDF ---------- */
async function bfLogo(){
  try {
    const blob = await (await fetch('icons/icon-192.png')).blob();
    return await new Promise((ok, fehler)=>{ const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fehler; r.readAsDataURL(blob); });
  } catch(e){ return null; }
}

async function bfPdf(){
  if(!window.jspdf){ showToast('PDF-Bibliothek nicht geladen – Internet nötig.', 'error'); return; }
  const { erg } = bfZusammenfassung();
  if(erg.leer){ showToast('Noch kein Ergebnis für ein PDF.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const b = getBetrieb();
  const p = getProduktion();
  const heute = new Date().toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric' });
  const gruen = [40, 54, 42], gold = [217, 180, 88];
  let y = 18;
  const logo = await bfLogo();
  if(logo) doc.addImage(logo, 'PNG', 20, 12, 16, 16);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...gruen);
  doc.text('Hendlberghof', logo ? 40 : 20, y + 2);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  doc.text([b.adresse, p.email || HOF_EMAIL_STANDARD].filter(Boolean).join(' · '), logo ? 40 : 20, y + 8);
  doc.text(heute, 190, y + 2, { align:'right' });
  y = 34;
  doc.setDrawColor(...gold); doc.setLineWidth(0.4); doc.line(20, y, 190, y);
  y += 10;
  const absatz = (text, groesse, fett, farbe) => {
    doc.setFont('helvetica', fett ? 'bold' : 'normal'); doc.setFontSize(groesse || 10); doc.setTextColor(...(farbe || [30, 30, 30]));
    doc.splitTextToSize(String(text), 170).forEach(z => { if(y > 280){ doc.addPage(); y = 20; } doc.text(z, 20, y); y += (groesse || 10) * 0.45; });
    y += 1.5;
  };
  const u = erg.unterlage;
  const form = u ? (p.stammformen.find(f => f.id === u.form) || {}).name : '';
  absatz('Dein Baum', 9, true, [120, 120, 120]);
  absatz(`${erg.art}${form ? `, ${form}` : ''}${u ? ` auf ${u.u.name}` : ''}`, 15, true, gruen);
  if(u) absatz(`${u.u.beschreibung}${u.aufAnfrage ? ' (Unterlage auf Anfrage)' : ''}`, 10);
  y += 2;
  absatz(erg.sorten.length > 1 ? 'Sorten auf diesem Baum' : 'Sorte', 11, true, gruen);
  erg.sorten.forEach(x => {
    absatz(x.s.sorte, 11, true);
    const zeilen = [bfReifeText(x.s), x.s.geschmack, x.gruende.length ? `Warum: ${x.gruende.join(', ')}` : ''].filter(Boolean);
    zeilen.forEach(z => absatz(z, 9.5));
  });
  /* Genusskalender: Juli bis Mai, Kreis = pflücken, Linie = genießen */
  y += 2;
  if(y + 8 + erg.sorten.length * 6 > 280){ doc.addPage(); y = 20; }
  const x0 = 70, breite = 120, spalte = breite / BF_JAHR.length;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
  BF_JAHR.forEach((m, i) => doc.text(BF_MONAT_KURZ[m], x0 + i * spalte + spalte / 2, y, { align:'center' }));
  y += 2;
  doc.setDrawColor(...gold);
  erg.sorten.forEach(x => {
    y += 5;
    const g = bfGenuss(x.s);
    doc.setFontSize(9); doc.setTextColor(30, 30, 30);
    doc.text(doc.splitTextToSize(x.s.sorte, 46)[0], 20, y + 1);
    doc.setDrawColor(226, 218, 203); doc.setLineWidth(0.2); doc.line(x0, y, x0 + breite, y);
    doc.setDrawColor(...gold); doc.setLineWidth(1.2);
    g.monate.forEach(m => { const i = BF_JAHR.indexOf(m); if(i >= 0) doc.line(x0 + i * spalte + 0.6, y, x0 + (i + 1) * spalte - 0.6, y); });
    const ie = BF_JAHR.indexOf(g.ernte);
    if(ie >= 0){ doc.setLineWidth(0.4); doc.setFillColor(255, 255, 255); doc.circle(x0 + ie * spalte + spalte / 2, y, 1.4, 'FD'); }
  });
  y += 5;
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text('Kreis = pflücken · Linie = genießen', x0, y);
  y += 5;
  absatz(bfGenussSatz(erg.sorten), 9.5);
  if(b.shop_aktiv){
    const preis = bfPreis(erg);
    y += 1;
    absatz(`${preis == null ? 'Preis mit dem Angebot' : `Richtpreis ${eur(preis)}`} – unverbindlich, Abholung am Hof, Herbst ${konfigLieferjahr()}`, 10, true, gruen);
  }
  const hinweise = bfHinweise(erg);
  if(hinweise.length){ y += 2; absatz('Hinweise', 11, true, gruen); hinweise.forEach(h => absatz(`– ${h}`, 9.5)); }
  if(_bf.mitPlan && u){
    y += 2;
    absatz('Pflanzplan', 11, true, gruen);
    [['Platz und Abstand', bfPlatz(u)], ['Pfahl', u.u.pfahl], ['Boden', u.u.boden], ['Ertragsbeginn', u.u.ertrag],
     ['Pflege', u.u.hinweis], ['Pflanzzeit', 'Herbst nach dem Laubfall oder zeitiges Frühjahr']]
      .filter(([, w]) => w).forEach(([k, w]) => absatz(`${k}: ${w}`, 9.5));
    const gilde = getGuildRecommendations(erg.art);
    const begleit = [].concat(gilde.bestaeuber || [], gilde.boden || [], gilde.schaedling || [], gilde.naehrstoff || []);
    if(begleit.length) absatz(`Begleitpflanzen: ${[...new Set(begleit)].join(', ')}`, 9.5);
  }
  y += 2;
  absatz('Deine Angaben', 11, true, gruen);
  bfZusammenfassung().text.split('\r\n').slice(1, 8).forEach(z => absatz(z, 9));
  if(y > 285){ doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
  doc.text(`Unverbindliche Beratung des Hendlberghofs · Unterlagen nach ${LWG_QUELLE}`, 20, 291);
  doc.save(`Baumfinder_Hendlberghof_${heute.replace(/\./g, '-')}.pdf`);
}

if(window.__dataReadyPromise) window.__dataReadyPromise.then(()=> renderBaumfinder());

/* berater.js — Hendlberghof Obstdatenbank
   Sortenberater und Standort-Berater samt Arche-Noah-Bestand

   Aus einer einzelnen Datei herausgeloest (F6). Die Ladereihenfolge in
   index.html entspricht exakt der frueheren Reihenfolge im Script-Block und
   darf nicht veraendert werden: Ueber Dateigrenzen hinweg gibt es kein
   Hoisting mehr, und start.js setzt window.__dataReadyPromise, das berater.js
   beim Laden bereits liest. */

/* ===== Sortenberater ===== */

// ─── HOFSORTEN ────────────────────────────────────────────────────────────────
const ZIELE_DEF={apfel:[{id:'tafel',label:'Tafelobst'},{id:'most',label:'Most / Cider'},{id:'lager',label:'Lagerfähigkeit'},{id:'frueh',label:'Frühe Reife'},{id:'robust',label:'Pilzresistenz'},{id:'wild',label:'Wildtiernahrung'}],birne:[{id:'tafel',label:'Tafelobst'},{id:'most',label:'Most / Saft'},{id:'lager',label:'Lagerfähigkeit'},{id:'frueh',label:'Frühe Reife'},{id:'robust',label:'Robustheit'},{id:'bestaeuber',label:'Bestäuberblüte'}],zwetschke:[{id:'tafel',label:'Tafelobst'},{id:'einkochen',label:'Einkochen / Marmelade'},{id:'schnaps',label:'Schnaps / Destillat'},{id:'frueh',label:'Frühe Reife'},{id:'robust',label:'Robustheit'},{id:'wild',label:'Wildtiernahrung'}]};

// ─── ARCHE NOAH SORTEN A–F (echte PDF-Links von arche-noah.at) ──────────────
const AN_SORTEN=[
  // A
  {b:'A',name:'Adersleber Kalvill',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Alte Winterrenette mit feinem Aroma. Historisch bedeutsam, lange lagernd.',tags:['Lager','historisch','Winterapfel'],pdf:'https://www.arche-noah.at/media/test.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'A',name:'Ananasrenette',reife:'Winter',genuss:'Nov–März',beschreibung:'Altösterreichische Winterrenette mit edlem Gewürzaroma. Schwacher Wuchs, ideal für kleine Baumformen. Mitte–Ende Oktober pflücken.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/ananasrenette.pdf',erntem:[10],lagerm:[11,12,1,2,3]},
  {b:'A',name:'Antonowka (Possarts Nalivia)',reife:'Herbst',genuss:'Nov–Dez',beschreibung:'Russische Landsorte. Sehr winterhart und ertragssicher auch in Extremlagen bis 1400m. Großes gesundes Laub, wenig Pflegebedarf.',tags:['winterhart','Most','Höhenlage','robust'],pdf:'https://www.arche-noah.at/media/antonowka_possarts_nalivia.pdf',erntem:[9,10],lagerm:[11,12]},
  {b:'A',name:'Apfel aus Croncels',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Französische Sorte von 1869. Frosthart im Holz, für Straßenbepflanzung geeignet. Lang anhaltende Bienenweide-Blüte.',tags:['Tafelobst','historisch','Herbstapfel','robust'],pdf:'https://www.arche-noah.at/media/apfel_aus_croncels.pdf',erntem:[8,9],lagerm:[10]},
  // B
  {b:'B',name:'Bananenapfel Gföhlerwald',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Waldviertler Landsorte mit bananenähnlichem Aroma. Streuobst-Leitsorte für das nordöstliche Alpenvorland.',tags:['Lager','historisch','Streuobst','Waldviertel'],pdf:'https://www.arche-noah.at/media/bananenapfel_gfoehlerwald_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'B',name:'Batullenapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Robuste alte Landsorte für Streuobstwiesen. Zuverlässig tragend, pflegeleicht. Wichtig für Sortenerhaltung.',tags:['Streuobst','historisch','Most','robust'],pdf:'https://www.arche-noah.at/media/batullenapfel.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'B',name:'Belle fille de salins',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Neu dokumentierte Sorte (2026). Historische Rarität aus dem französischen Raum.',tags:['historisch','Rarität','Tafelobst'],pdf:'https://www.arche-noah.at/media/belle_fille_de_salins.pdf',erntem:[8,9],lagerm:[10]},
  {b:'B',name:'Berner Rosenapfel',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Schweizer Zufallssämling um 1890. Leuchtend karminrote Deckfarbe. Früh und regelmäßig tragend. Verträgt raue Lagen, meidet Staunässe.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/berner_rosenapfel.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'B',name:'Birnförmiger Apfel',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Ungewöhnliche birnenförmige Fruchtform. Historische Rarität für Sortengärten und genetische Vielfalt.',tags:['historisch','Rarität','Tafelobst'],pdf:'https://www.arche-noah.at/media/birnfoermigerapfel.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'B',name:'Blauensteiners Spitzapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Regionale österreichische Landsorte. Charakteristischer Spitzapfel-Typ. Wertvoll für Streuobsterhaltung.',tags:['historisch','Streuobst','österreichisch'],pdf:'https://www.arche-noah.at/media/blauensteiners_spitzapfel_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'B',name:'Böhmer Maschanzker',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Maschanzker-Typ aus dem böhmisch-niederösterreichischen Grenzraum. Robust und anpassungsfähig.',tags:['Most','historisch','Streuobst','robust'],pdf:'https://www.arche-noah.at/media/boehmer_maschanzker_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'B',name:'Böhmischer Brünnerling',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Neu dokumentierter Brünnerling-Typ aus dem böhmischen Raum (2025). Robuste Streuobstsorte mit Regionalcharakter.',tags:['historisch','Streuobst','Winterapfel'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2025_boehmischerbruennerling_web.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'B',name:'Bunta Wuedoima',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Steirische Regionalsorte. Typische Streuobstsorte der südösterreichischen Kulturlandschaft. Mehrfachnutzen: Obst, Bienenweide, Lebensraum.',tags:['Streuobst','historisch','Most','Steiermark'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2020_bunta_wuedoima_web_fin.pdf',erntem:[8,9],lagerm:[10,11]},
  // C
  {b:'C',name:'Candil Sinap',reife:'Winter',genuss:'Nov–März',beschreibung:'Orientalische Sorte mit charakteristisch länglicher Fruchtform. Hervorragender Geschmack, lange lagernd. Rarität für Liebhabergärten.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/candil_sinap.pdf',erntem:[10],lagerm:[11,12,1,2,3]},
  {b:'C',name:'Champagner Renette',reife:'Winter',genuss:'Dez–Feb',beschreibung:'Elegante Winterrenette. Gehört zu den ältesten Renettensorten Europas. Historisch bedeutsam, heute selten. Lange Haltbarkeit.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/champagner_renette.pdf',erntem:[10,11],lagerm:[12,1,2]},
  {b:'C',name:'Charlamowsky',reife:'Sommer',genuss:'Aug–Sep',beschreibung:'Russisch-persische Herkunft. Für Höhenlagen und Nordhang geeignet. Kurzlebiger Baum — regelmäßige Verjüngungsschnitte nötig.',tags:['Frühsorte','Tafelobst','historisch','Sommerapfel'],pdf:'https://www.arche-noah.at/media/charlamowsky.pdf',erntem:[7,8],lagerm:[9]},
  {b:'C',name:'Chrysofsker',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Historische Sorte mit griechischem Namen. Regionale Rarität aus dem österreichischen Sortenbestand.',tags:['historisch','Rarität','Herbstapfel'],pdf:'https://www.arche-noah.at/media/chrysofsker_foto_und_beschreibung.pdf',erntem:[8,9],lagerm:[10]},
  {b:'C',name:'Cludius Herbstapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Alte Herbstsorte. Robust und zuverlässig tragend. Für Streuobst und Hausgarten gleichermaßen geeignet.',tags:['Herbstapfel','historisch','robust'],pdf:'https://www.arche-noah.at/media/cludius_herbstapfel_beschreibung_und_foto2.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'C',name:'Coulons Renette',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Neu dokumentierte Renette (2025). Historische Sorte mit feinem Renetten-Aroma.',tags:['Lager','historisch','Winterapfel'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2025_coulonsrenette_web.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'C',name:'Cox Orangenrenette',reife:'Winter',genuss:'Okt–Feb',beschreibung:'1830 in England gezogen. Höchste Geschmacksqualität. Mildes feuchtes Klima bevorzugt — Wienerwald-Lagen ideal. Anfällig für Krebs und Schorf.',tags:['Tafelobst','historisch','Winterapfel','Premiumqualität'],pdf:'https://www.arche-noah.at/media/cox_orangenrenette.pdf',erntem:[9,10],lagerm:[11,12,1,2]},
  {b:'C',name:'Cox Pomona',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Verwandter der Cox Orangenrenette, etwas robuster und früher reifend. Guter Geschmack.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/cox_pomona.pdf',erntem:[8,9],lagerm:[10]},
  {b:'C',name:'Credes Quittenrenette',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Seltene Renette mit Quittenaromen. Historische Rarität für Sortengärten.',tags:['historisch','Rarität','Winterapfel'],pdf:'https://www.arche-noah.at/media/credes_quittenrenette_foto_und_beschreibung.pdf',erntem:[9,10],lagerm:[11,12,1]},
  // D
  {b:'D',name:'Danzinger Kantapfel',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Historische Sorte mit charakteristischer kantiger Fruchtform. Robust und lagernd. Wertvoll für Streuobst und Sortenerhaltung.',tags:['Lager','historisch','Most','Streuobst'],pdf:'https://www.arche-noah.at/media/danziger_kantapfel_web.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'D',name:'Discovery',reife:'Sommer',genuss:'Aug–Sep',beschreibung:'Englische Sorte von 1962. Frühreifend, gut für Direktvermarktung und Hausgarten. Angenehm süß-säuerlich.',tags:['Frühsorte','Tafelobst','Sommerapfel'],pdf:'https://www.arche-noah.at/media/discovery_01_2.pdf',erntem:[7,8],lagerm:[9]},
  // E
  {b:'E',name:'Edelkönig',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Österreichische Hochstammsorte mit edlem Geschmack. Historische Rarität für Sortengärten.',tags:['Tafelobst','historisch','österreichisch'],pdf:'https://www.arche-noah.at/media/edelkoenig.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'E',name:'Edelrambour von Winnitza',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Rambour-Typ aus dem ukrainischen Raum. Großfrüchtig, historisch bedeutsam.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/edelrambour__1.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'E',name:'Edelrenette',reife:'Herbst/Winter',genuss:'Okt–Feb',beschreibung:'Klassische Renette mit ausgezeichnetem Geschmack. In österreichischen Hausgärten historisch verbreitet. Lange Lagerung möglich.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/edelrenette_beschreibung_und_foto2.pdf',erntem:[9,10],lagerm:[11,12,1,2]},
  {b:'E',name:'Englische Spitalrenette',reife:'Winter',genuss:'Dez–März',beschreibung:'Alte englische Renette, in österreichischen Klostergärten lang kultiviert. Spät reifend, sehr lang lagernd. Genetisch wichtige Rarität.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/englische_spitalrenette.pdf',erntem:[11],lagerm:[12,1,2,3]},
  // F
  {b:'F',name:'Falchs Gulderling',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Historische Gulderling-Sorte, robust und ertragreich. Für Streuobstwiesen und extensiven Anbau, Mehrfachnutzen Tafel und Most.',tags:['Most','historisch','Streuobst','Tafelobst'],pdf:'https://www.arche-noah.at/media/falchs_gulderling.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'F',name:'Fameuse (Schneeapfel)',reife:'Herbst',genuss:'Okt–Jan',beschreibung:'Um 1730 in Kanada aus Samen gezogen. Reinweißes Fruchtfleisch mit Rosenaroma. Wenig schorf- und mehltauanfällig. Für Hausgarten und Streuobst.',tags:['Tafelobst','historisch','Herbstapfel','Schorfresistent'],pdf:'https://www.arche-noah.at/media/fameuse_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'F',name:"Fey's Record",reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Historische Sorte. Robust und anpassungsfähig für Streuobstlagen.',tags:['historisch','Herbstapfel','Streuobst'],pdf:'https://www.arche-noah.at/media/fey_s_record.pdf',erntem:[8,9],lagerm:[10]},
  {b:'F',name:'Frauenkalvill',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Alte Kalvillsorte mit delikatem Aroma. In österreichischen Klostergärten historisch verbreitet.',tags:['Tafelobst','historisch','österreichisch'],pdf:'https://www.arche-noah.at/media/frauenkalvill.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'F',name:'Fromms Renette',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Robuste Winterrenette mit gutem Geschmack und langer Haltbarkeit. Für Streuobst und Hausgarten geeignet.',tags:['Lager','historisch','Winterapfel','robust'],pdf:'https://www.arche-noah.at/media/fromms_renette_beschreibung_und_foto2.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'F',name:'Früher Roter Wiesling',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Frühe Rote Variante des österreichischen Wiesling. Wichtige regionale Mostsorte, robust, angepasst an niederösterreichische Lagen.',tags:['Most','historisch','Herbstapfel','österreichisch'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_frueher_roter_wiesling_b_web.pdf',erntem:[8,9],lagerm:[10]},
  // G
  {b:'G',name:'Galloway Pepping',reife:'Winter',genuss:'Nov–März',beschreibung:'Schottische Sorte mit feinem Aroma. Für kühle, feuchte Lagen geeignet — Wienerwald-Klima ideal. Historisch selten, genetisch wertvoll.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/galloway_pepping_foto_und_beschreibung.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'G',name:'Gascoynes Scharlachsämling',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Englische Sorte mit leuchtend roter Schale. Großfrüchtig, aromatisch. Für Streuobst und Hausgärten geeignet.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/gascoynes_scharlachsaemling.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'G',name:'Geflammter Kardinal',reife:'Sommer',genuss:'Jul–Aug',beschreibung:'Früh reifende historische Sommersorte. Lebhaft rot geflammte Schale. Bienenweide durch frühe Blüte — wertvoll als Gilden-Frühlieferant.',tags:['Frühsorte','Sommerapfel','historisch','Tafelobst'],pdf:'https://www.arche-noah.at/media/geflammter_kardinal.pdf',erntem:[7,8],lagerm:[]},
  {b:'G',name:'Gelber Bellefleur',reife:'Herbst/Winter',genuss:'Okt–Feb',beschreibung:'Großfrüchtige alte Sorte mit goldgelber Schale. Für Streuobst und Wirtschaftszwecke. Robust, anpassungsfähig.',tags:['Tafelobst','historisch','Streuobst','Most'],pdf:'https://www.arche-noah.at/media/gelber_bellefleur.pdf',erntem:[9,10],lagerm:[11,12,1,2]},
  {b:'G',name:'Gelber Edelapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Österreichische Landsorte mit gelbgrüner Schale und mildem Geschmack. Für Streuobstwiesen und Hausgärten. Gute Bestäubungsleistung.',tags:['Tafelobst','historisch','österreichisch','Streuobst'],pdf:'https://www.arche-noah.at/media/gelber_edelapfel.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'G',name:'George Cave',reife:'Sommer',genuss:'Jul–Aug',beschreibung:'Englische Frühsorte von 1923. Frühreifend, süß-aromatisch. Für Direktvermarktung und Hausgarten. Gute Bienenweide durch frühe Blüte.',tags:['Frühsorte','Sommerapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/george_cave_01_1.pdf',erntem:[7,8],lagerm:[]},
  {b:'G',name:'Gesäuseapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Steirische Regionalsorte aus dem Gesäuse. Robust und angepasst an Berglagen. Wichtige Sortenerhaltung für alpine Kulturlandschaft.',tags:['historisch','Streuobst','Steiermark','robust'],pdf:'https://www.arche-noah.at/media/gesaeuseapfel_2018.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'G',name:'Gestreifter Fasslapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Neu dokumentierte Sorte 2026. Charakteristisch gestreifter Fasslapfel-Typ. Regionale Rarität für Sortenerhaltung.',tags:['historisch','Rarität','Herbstapfel','NEU 2026'],pdf:'https://www.arche-noah.at/media/gestreifter_fasslapfel.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'G',name:'Gloria Mundi',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Eine der größten Apfelsorten überhaupt. Historische Schausorte, Bienenweide. Wuchs stark, für Windschutzreihen geeignet.',tags:['Tafelobst','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/gloria_mundi_beschreibung_1.pdf',erntem:[8,9],lagerm:[10]},
  {b:'G',name:'Goldrenette von Blenheim',reife:'Winter',genuss:'Nov–März',beschreibung:'Englische Renette von 1818. Feines Gewürzaroma, lang lagernd. Benötigt warmen Standort. Historisch bedeutsam, heute selten.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/goldrenette_von_blenheim.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'G',name:'Gravensteiner',reife:'Herbst',genuss:'Aug–Sep',beschreibung:'Klassische Herbstsorte mit unverwechselbarem Aroma. Starker Wuchs, ideal als Windschutzreihe. Unterpflanzung mit Brennnessel stärkt Boden.',tags:['Tafelobst','Most','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/gravensteiner.pdf',erntem:[8,9],lagerm:[]},
  {b:'G',name:'Großer Bohnapfel',reife:'Winter',genuss:'Dez–März',beschreibung:'Robuste alte Wintersorte. Lang lagernd, für Streuobst und Most. Winterfutter für Drosseln und Amseln — ökologisch wertvoll.',tags:['Lager','Most','historisch','Wildtier'],pdf:'https://www.arche-noah.at/media/grosser_bohnapfel.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'G',name:'Großherzog Friedrich von Baden',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Großfrüchtige historische Sorte. Robust und ertragreich. Für Streuobstwiesen und Direktvermarktung geeignet.',tags:['Tafelobst','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/grossherzog_friedrich_von_baden.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'G',name:'Großreiflinger Eckapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Steirische Regionalsorte aus Großreifling. Angepasst an alpine Berglagen. Wichtige regionale Sortenerhaltung für den Alpenraum.',tags:['historisch','Streuobst','Steiermark','robust'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2020_grossreiflinger_eckapfel_web_fin_.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'G',name:'Grüner Fürstenapfel',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Alte Sorte mit grüngelblicher Schale. Mildes Aroma, für Hausgarten und Streuobst. Historisch in österreichischen Gärten verbreitet.',tags:['Tafelobst','historisch','österreichisch'],pdf:'https://www.arche-noah.at/media/gruener_fuerstenapfel.pdf',erntem:[9,10],lagerm:[11,12,1]},
  // H
  {b:'H',name:'Harberts Renette',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Norddeutsche Winterrenette mit gutem Aroma. Lang lagernd, robust. Für Streuobst und Hausgarten gleichermaßen geeignet.',tags:['Lager','historisch','Winterapfel','robust'],pdf:'https://www.arche-noah.at/media/harberts_renette.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'H',name:'Haslinger',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Österreichische Regionalsorte. Robust und angepasst an mittelösterreichische Lagen. Wertvoll für regionale Sortenerhaltung.',tags:['historisch','österreichisch','Streuobst'],pdf:'https://www.arche-noah.at/media/haslinger.pdf',erntem:[9,10],lagerm:[11,12]},
  {b:'H',name:'Herzogin Olga Apfel',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Historische Tafelsorte mit adeligem Namen. Robust, ertragreich, für Streuobstwiesen geeignet. Bienenweide im Frühjahr.',tags:['Tafelobst','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/herzogin_olga_apfel.pdf',erntem:[8,9],lagerm:[10]},
  {b:'H',name:'Himbeerapfel von Holovous',reife:'Sommer',genuss:'Jul–Aug',beschreibung:'Frühreifende Sorte mit Himbeeraroma im Fruchtfleisch. Seltenheit für Liebhaber besonderer Aromen. Bienenweide durch frühe Blüte.',tags:['Frühsorte','Sommerapfel','historisch','Rarität'],pdf:'https://www.arche-noah.at/media/himbeerapfel_von_holovous_beschreibung_und_foto.pdf',erntem:[7,8],lagerm:[]},
  {b:'H',name:'Horneburger Pfannkuchenapfel',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Plattgedrückte charakteristische Fruchtform — namensgebend. Alter Wirtschaftsapfel, sehr ertragreich. Für Streuobst und Most.',tags:['Most','historisch','Winterapfel','Streuobst'],pdf:'https://www.arche-noah.at/media/horneburger.pdf',erntem:[10],lagerm:[11,12,1,2]},
  // I
  {b:'I',name:'Ingrid Marie',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Dänische Sorte von 1910. Leuchtend rote Schale, aromatisch. Zuverlässig tragend, für Bio-Anbau gut geeignet.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/ingrid_marie.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'I',name:'Ilzer Rosenapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Steirische Regionalsorte aus dem Ilztal. Rosenapfel-Typ mit angenehmem Aroma. Regionale Rarität für Sortenerhaltung im Alpenraum.',tags:['historisch','Streuobst','Steiermark','Rarität'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_ilzer_rosenapfel_web.pdf',erntem:[8,9],lagerm:[10,11]},
  // J
  {b:'J',name:'James Grieve',reife:'Herbst',genuss:'Aug–Sep',beschreibung:'Schottische Sorte von 1893. Frühreifend, süß-säuerlich, aromatisch. Guter Bestäuber für andere Sorten. Für feuchte kühle Lagen.',tags:['Tafelobst','historisch','Herbstapfel','Bestäuber'],pdf:'https://www.arche-noah.at/media/james_grieve.pdf',erntem:[8,9],lagerm:[]},
  {b:'J',name:'Jeanne Hardy',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Historische Sorte französischer Herkunft. Aromatisch und zuverlässig tragend. Für Streuobst und Hausgarten geeignet.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/jeanne_hardy.pdf',erntem:[8,9],lagerm:[10]},
  // K
  {b:'K',name:'Kaiser Alexander',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Großfrüchtige imposante Sorte. Einer der größten Äpfel überhaupt. Für Schausammlungen und Streuobst. Starker Wuchs, Windschutzreihe.',tags:['Tafelobst','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/kaiser_alexander.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'K',name:'Kaiser Wilhelm',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Deutsche Sorte von 1864. Robust, ertragreich, gut lagernd. Für Streuobst und Wirtschaftszwecke bewährt. Windschutz durch starken Wuchs.',tags:['Lager','historisch','Winterapfel','robust','Streuobst'],pdf:'https://www.arche-noah.at/media/kaiser_wilhelm.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'K',name:'Kardinal Graf Galen',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Historische Sorte mit kirchlichem Namen. Aromatisch und lagernd. Für Hausgarten und Streuobst, gute Bienenweide.',tags:['Tafelobst','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/kardinal_graf_galen.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'K',name:'Karmeliterrenette',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Alte Klostersorte aus Karmeliterorden-Gärten. Feines Renettenaroma, historisch bedeutsam. Genetische Rarität für Sortengärten.',tags:['Tafelobst','historisch','Rarität','österreichisch'],pdf:'https://www.arche-noah.at/media/karmeliterrenette.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'K',name:'Kleine Kasseler Renette',reife:'Winter',genuss:'Nov–März',beschreibung:'Kleine aber feine Winterrenette aus Nordhessen. Lang lagernd, intensives Aroma. Für Hausgarten und Liebhabersammlungen.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/kleine_kasseler_renette_beschreibung_und_foto.pdf',erntem:[10],lagerm:[11,12,1,2,3]},
  {b:'K',name:'Kleiner Brünnerling',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Neu dokumentierter Brünnerling-Typ 2025. Österreichische Landsorte, robust und anpassungsfähig. Wichtige Ergänzung zur Brünnerling-Gruppe.',tags:['historisch','Winterapfel','österreichisch','robust'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2025_kleinerbruennerling_web.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'K',name:'Klöcher Maschanzker',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Steirische Maschanzker-Variante aus Klöch. Robust, für südsteirische Lagen optimiert. Mostsorte mit Regionalcharakter.',tags:['Most','historisch','Steiermark','Streuobst'],pdf:'https://www.arche-noah.at/media/kloecher_maschanzker_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'K',name:'Königin Olga Apfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Historische Tafelsorte mit königlichem Namen. Robust, für Streuobstwiesen geeignet. Bienenweide und Wildtiernahrung.',tags:['Tafelobst','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/koenigin_olga_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'K',name:'Königin Sophienapfel',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Historische Sorte. Aromatisch und zuverlässig tragend. Für Hausgarten und Streuobst. Genetisch bedeutsam.',tags:['Tafelobst','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/koenigin_sophienapfel_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'K',name:'Königinapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Österreichische Landsorte. Charakteristische Fruchtform, historisch in Hausgärten verbreitet. Für Streuobst und Sortenerhaltung.',tags:['Tafelobst','historisch','österreichisch'],pdf:'https://www.arche-noah.at/media/koeniginapfel_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'K',name:'Königlicher Kurzstiel',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Charakteristisch kurzstielig. Historische Rarität. Robust und ertragreich für Streuobstwiesen.',tags:['historisch','Streuobst','Rarität'],pdf:'https://www.arche-noah.at/media/koeniglicher_kurzstiel_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'K',name:'Köstlicher Langstiel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Österreichische Landsorte mit charakteristisch langem Stiel. Aromatisch, für Hausgarten und Streuobst. Regional bedeutsam.',tags:['Tafelobst','historisch','österreichisch'],pdf:'https://www.arche-noah.at/media/koestlicher_langstiel_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'K',name:'Kronprinz Rudolf',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Österreichische Landsorte. Spätblüher — ideal für Spätfrostlagen bis 1000m. Verträgt Halbschatten, für Nordhang geeignet. Lang lagernd.',tags:['Lager','Spätfrostresistent','österreichisch','historisch'],pdf:'https://www.arche-noah.at/media/kronprinz_rudolf.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'K',name:'Kuhländer Gulderling',reife:'Herbst/Winter',genuss:'Okt–Dez',beschreibung:'Gulderling-Typ aus dem mährisch-schlesischen Raum. Robust und ertragreich. Für Streuobst und Most. Historisch bedeutsam für Mitteleuropa.',tags:['Most','historisch','Streuobst','robust'],pdf:'https://www.arche-noah.at/media/kuhlaender_gulderling.pdf',erntem:[9,10],lagerm:[11,12]},
  // L
  {b:'L',name:'Landsberger Renette',reife:'Winter',genuss:'Nov–März',beschreibung:'Deutsche Winterrenette. Feines Aroma, sehr lang lagernd. Für kühle feuchte Lagen gut geeignet — Wienerwald-Klima ideal.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/landsberger_renette.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'L',name:'Langer Bellefleur',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Charakteristisch langgestreckte Fruchtform — namensgebend. Alter Wirtschaftsapfel, robust und ertragreich. Für Streuobst und Most.',tags:['Most','historisch','Streuobst','Tafelobst'],pdf:'https://www.arche-noah.at/media/langer_bellefleur_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'L',name:'Lavanttaler Bananenapfel',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Kärntnische Regionalsorte aus dem Lavanttal. Bananenartiges Aroma, charakteristisch. Wichtige Sortenerhaltung für alpine Kulturlandschaft.',tags:['historisch','Streuobst','Kärnten','Rarität'],pdf:'https://www.arche-noah.at/media/lavanttaler_bananenapfel.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'L',name:'London Pepping',reife:'Winter',genuss:'Nov–März',beschreibung:'Englische Pepping-Sorte, historisch bedeutsam. Feines säuerliches Aroma, lang lagernd. Für kühle feuchte Lagen — für den Wienerwald geeignet.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/london_pepping.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  // M
  {b:'M',name:'Mantet',reife:'Sommer',genuss:'Jul–Aug',beschreibung:'Kanadische Frühsorte. Frühreifend, süß-aromatisch. Für Direktvermarktung und Hausgarten. Bienenweide durch frühe Blüte — wertvoll als Gilden-Frühlieferant.',tags:['Frühsorte','Sommerapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/mantet.pdf',erntem:[7,8],lagerm:[]},
  {b:'M',name:'Merton Worcester',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Englische Sorte von 1947. Aromatisch, frühreifend im Herbst. Für Hausgarten und Direktvermarktung. Gute Bienenweide.',tags:['Tafelobst','Herbstapfel','historisch'],pdf:'https://www.arche-noah.at/media/merton_worcester_01_1.pdf',erntem:[8,9],lagerm:[10]},
  {b:'M',name:'Minister von Hammerstein',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Deutsche Wintersorte mit imposantem Namen. Großfrüchtig, robust und lagernd. Für Streuobst und Wirtschaftszwecke bewährt.',tags:['Lager','historisch','Winterapfel','robust'],pdf:'https://www.arche-noah.at/media/minister_von_hammerstein.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'M',name:'Müschens Rosenapfel',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Rosenapfel-Typ mit angenehmem Rosen-Aroma. Historisch in deutschen und österreichischen Gärten verbreitet. Genetisch wertvoll.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/mueschens_rosenapfel_01_1.pdf',erntem:[8,9],lagerm:[10]},
  {b:'M',name:'Muskatrenette',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Renette mit charakteristischem Muskat-Aroma. Historische Rarität. Lang lagernd, für Liebhaber besonderer Aromen.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/muskatrenette_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12,1]},
  // N
  {b:'N',name:'Nancy',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Österreichische Regionalsorte. Robust und angepasst an mittelösterreichische Streuobstlagen. Für Sortenerhaltung im Alpenvorland bedeutsam.',tags:['historisch','Streuobst','österreichisch'],pdf:'https://www.arche-noah.at/media/nancy_web_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  // O
  {b:'O',name:'Oberdiecks Renette',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Deutsche Winterrenette mit feinem Aroma. Historisch bedeutsam, lang lagernd. Für gute tiefgründige Böden.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/oberdiecks_renette_beschreibung_und_foto.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'O',name:'Oberösterreichischer Brünnerling',reife:'Winter',genuss:'Nov–März',beschreibung:'Neu dokumentierter Brünnerling-Typ 2025. Oberösterreichische Landsorte, robust. Wichtige Ergänzung für die Brünnerling-Gruppe im Alpenvorland.',tags:['historisch','Winterapfel','österreichisch','robust'],pdf:'https://www.arche-noah.at/media/oberoesterreichischer_bruennerling.pdf',erntem:[10],lagerm:[11,12,1,2,3]},
  {b:'O',name:'Oderlin',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Historische Sorte aus dem österreichischen Raum. Robust und zuverlässig tragend. Für Streuobst und regionalen Sortenerhalt.',tags:['historisch','Streuobst','Herbstapfel'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_oderlin_web.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'O',name:'Okabena',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Seltene historische Sorte. Aromatisch und charakteristisch. Genetisch bedeutsam für die Sortenerhaltung.',tags:['historisch','Rarität','Herbstapfel'],pdf:'https://www.arche-noah.at/media/okabena_web.pdf',erntem:[8,9],lagerm:[10]},
  {b:'O',name:'Osnabrücker Renette',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Norddeutsche Winterrenette. Gutes Aroma, robust und lagernd. Für Streuobst und Hausgarten gleichermaßen geeignet.',tags:['Lager','historisch','Winterapfel','robust'],pdf:'https://www.arche-noah.at/media/osnabruecker_renette_web.pdf',erntem:[10],lagerm:[11,12,1,2]},
  // P
  {b:'P',name:'Palfauer Pommeralmapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Steirische Regionalsorte aus Palfau/Pommern. Angepasst an alpine Berglagen. Wichtige Sortenerhaltung für die steirische Kulturlandschaft.',tags:['historisch','Streuobst','Steiermark','robust'],pdf:'https://www.arche-noah.at/media/palfauer_pommeralmapfel_2018.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'P',name:'Parkers Pepping',reife:'Winter',genuss:'Nov–März',beschreibung:'Englische Pepping-Sorte. Feines säuerliches Aroma, sehr lang lagernd. Für kühle feuchte Lagen — Wienerwald-Klima geeignet.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/parkers_pepping_beschreibung_und_foto2.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'P',name:'Peasgoods Sondergleichen',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Englische Sorte von 1858. Außergewöhnlich großfrüchtig — einer der imposantesten Äpfel. Für Schauzwecke und Streuobst.',tags:['Tafelobst','historisch','Herbstapfel','Streuobst'],pdf:'https://www.arche-noah.at/media/peasgoods_sondergleichen.pdf',erntem:[8,9],lagerm:[10]},
  {b:'P',name:'Peter Smith',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Historische Sorte. Robust und ertragreich. Für Streuobstwiesen und extensiven Anbau geeignet.',tags:['historisch','Streuobst','Herbstapfel'],pdf:'https://www.arche-noah.at/media/peter_smith.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'P',name:'Pfirsichroter Sommerapfel',reife:'Sommer',genuss:'Jul–Aug',beschreibung:'Frühreifende Sommersorte mit pfirsichroter Schale. Bienenweide durch frühe Blüte. Für Hausgarten und Direktvermarktung.',tags:['Frühsorte','Sommerapfel','Tafelobst','historisch'],pdf:'https://www.arche-noah.at/media/pfirsichroter_sommerapfel_beschreibung_und_foto.pdf',erntem:[7,8],lagerm:[]},
  {b:'P',name:'Prigglitzer Abendrot',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Historische Sorte mit malerisch klingendem Namen. Leuchtend rote Schale. Robust für Streuobstwiesen.',tags:['Tafelobst','historisch','Herbstapfel','Streuobst'],pdf:'https://www.arche-noah.at/media/prigglitzer_abendrot_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10]},
  {b:'P',name:'Prinzenapfel',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Historische Sorte mit edlem Namen. Aromatisch und gut lagernd. Für Hausgarten und Streuobst.',tags:['Tafelobst','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/prinzenapfel.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'P',name:'Prinz Albrecht von Preussen',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Deutsche Sorte mit royalem Namen. Großfrüchtig, robust. Für Streuobstwiesen und Windschutzreihen geeignet.',tags:['Tafelobst','historisch','Streuobst','robust'],pdf:'https://www.arche-noah.at/media/prinz_albrecht.pdf',erntem:[8,9],lagerm:[10,11]},
  // Q
  {b:'Q',name:'Quittenmaschanzker',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Maschanzker-Typ mit Quittenaromen. Österreichische Rarität — verbindet zwei Fruchttypen in einer Sorte. Genetisch bedeutsam.',tags:['historisch','Rarität','österreichisch','Streuobst'],pdf:'https://www.arche-noah.at/media/quittenmaschanzker_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  // R
  {b:'R',name:'Ribston Pepping',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Englische Sorte von 1688 — Elternteil der Cox Orangenrenette. Feines Aroma, historisch bedeutsam. Für kühle feuchte Lagen optimal.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/ribston_pepping.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'R',name:'Riesenboiken',reife:'Winter',genuss:'Dez–März',beschreibung:'Eine der größten Apfelsorten. Sehr lang lagernd, für Most und Tafel. Starker Wuchs — als Windschutzreihe ideal.',tags:['Lager','Most','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/riesenboiken_beschreibung_und_foto.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'R',name:'Rodauner Goldapfel',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Österreichische Regionalsorte aus Rodaun bei Wien. Goldgelbe Schale, mildes Aroma. Historisch bedeutsam für den Wiener Raum.',tags:['Tafelobst','historisch','österreichisch'],pdf:'https://www.arche-noah.at/media/rodauner_goldapfel_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'R',name:'Rote Sternrenette',reife:'Winter',genuss:'Nov–März',beschreibung:'Renette mit charakteristischer Sternzeichnung. Historische Rarität, feines Aroma. Lang lagernd.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/rote_sternrenette_foto_und_beschreibung_1.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'R',name:'Rote Walze',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Charakteristisch walzenförmige Frucht. Historische Rarität. Für Sortengärten und genetische Vielfalt.',tags:['historisch','Rarität','Herbstapfel'],pdf:'https://www.arche-noah.at/media/rote_walze_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'R',name:'Roter Astrachan',reife:'Sommer',genuss:'Jul–Aug',beschreibung:'Russische Frühsorte. Lebhaft rot, frühreifend. Bienenweide durch frühe Blüte — wichtiger Gilden-Frühlieferant für Bestäuber.',tags:['Frühsorte','Sommerapfel','historisch','Bienenweide'],pdf:'https://www.arche-noah.at/media/roter_astrachan.pdf',erntem:[7,8],lagerm:[]},
  {b:'R',name:'Roter Bellefleur',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Rotschalige Bellefleur-Variante. Großfrüchtig, robust. Für Streuobst und Windschutzreihen.',tags:['Tafelobst','historisch','Streuobst','robust'],pdf:'https://www.arche-noah.at/media/roter_bellefleur.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'R',name:'Roter Berlepsch',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Deutsche Wintersorte. Leuchtend rote Schale, feines Aroma. Robust und lagernd. Für Bio-Streuobst geeignet.',tags:['Lager','historisch','Winterapfel','robust'],pdf:'https://www.arche-noah.at/media/roter_berlepsch.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'R',name:'Roter Boskoop',reife:'Herbst/Winter',genuss:'Okt–Feb',beschreibung:'Rotschalige Mutation des Boskoop. Starker Wuchs als Windschutz. Robust, lagernd, Mehrfachnutzen Tafel und Most.',tags:['Lager','Most','historisch','robust'],pdf:'https://www.arche-noah.at/media/roter_boskoop.pdf',erntem:[9,10],lagerm:[11,12,1,2]},
  {b:'R',name:'Roter Eiserapfel',reife:'Winter',genuss:'Dez–April',beschreibung:'Außergewöhnlich lang lagernd — bis in den April. Sehr robust, für Streuobst ideal. Winterfutter für Wildtiere.',tags:['Lager','historisch','Winterapfel','Wildtier'],pdf:'https://www.arche-noah.at/media/roter_eiserapfel.pdf',erntem:[11,12],lagerm:[1,2,3,4]},
  {b:'R',name:'Roter Gravensteiner',reife:'Herbst',genuss:'Aug–Sep',beschreibung:'Rotschalige Mutation des Gravensteiner. Unverwechselbares Aroma, starker Wuchs. Windschutzreihe und Bienenweide.',tags:['Tafelobst','Most','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/roter_gravensteiner.pdf',erntem:[8,9],lagerm:[]},
  {b:'R',name:'Roter Herbstkalvill',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Alte Kalvillsorte mit roter Schale. Feines Kalvill-Aroma, historisch bedeutsam. Für Sortengärten und Liebhaber.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/roter_herbstkalvill.pdf',erntem:[8,9],lagerm:[10]},
  {b:'R',name:'Roter Stettiner',reife:'Winter',genuss:'Nov–März',beschreibung:'Alte norddeutsche Wintersorte. Sehr robust und lagernd. Für Streuobstwiesen und extensiven Anbau bewährt.',tags:['Lager','historisch','Winterapfel','robust','Streuobst'],pdf:'https://www.arche-noah.at/media/roter_stettiner.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'R',name:'Roter von Simonffi',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Ungarische Regionalsorte. Robust und angepasst an kontinentale Lagen. Für Streuobst und Sortenerhaltung.',tags:['historisch','Streuobst','robust'],pdf:'https://www.arche-noah.at/media/roter_von_simonffi_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'R',name:'Roter Winterhimbeerapfel',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Wintersorte mit Himbeeraroma. Historische Rarität für Liebhaber besonderer Aromen. Lang lagernd.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/roter_winterhimbeerapfel.pdf',erntem:[10,11],lagerm:[12,1,2]},
  {b:'R',name:'Rotgestreifter Wiesling',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Rotgestreifte Wiesling-Variante aus Niederösterreich. Mostsorte mit Regionalcharakter. Robust und angepasst.',tags:['Most','historisch','Herbstapfel','österreichisch'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_rotgestreifter_wiesling_web.pdf',erntem:[8,9],lagerm:[10,11]},
  // S
  {b:'S',name:'Salzataler Raftingapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Steirische Regionalsorte aus dem Salzatal. Angepasst an alpine Berglagen. Historisch von Flößern genutzt — kulturgeschichtlich bedeutsam.',tags:['historisch','Streuobst','Steiermark','robust'],pdf:'https://www.arche-noah.at/media/salzataler_raftingapfel_2018.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'S',name:'Schieblers Taubenapfel',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Charakteristisch kleine, taubeneigroße Früchte. Historische Rarität. Lang lagernd, für Liebhaber historischer Sorten.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/schieblers_taubenapfel.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'S',name:'Schmidberger Renette',reife:'Winter',genuss:'Nov–März',beschreibung:'Österreichische Renette aus dem Stiftsbereich Kremsmünster. Feines Aroma, historisch bedeutsam. Klostergarten-Rarität.',tags:['Lager','historisch','Winterapfel','österreichisch'],pdf:'https://www.arche-noah.at/media/schmidberger_renette.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'S',name:'Schöner aus Nordhausen',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Thüringische Sorte mit imposanter Frucht. Großfrüchtig, aromatisch. Für Streuobst und Wirtschaftszwecke.',tags:['Tafelobst','historisch','Streuobst'],pdf:'https://www.arche-noah.at/media/schoener_aus_nordhausen.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'S',name:'Schöner von Wiltshire',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Englische Sorte. Aromatisch und charakteristisch. Für Hausgarten und Streuobst geeignet. Bienenweide.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/schoener_von_wiltshire.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'S',name:'Schwarzer Borsdorfer',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Dunkle Borsdorfer-Variante. Historische Rarität. Für Sortensammlungen und genetische Vielfalt bedeutsam.',tags:['historisch','Rarität','Streuobst'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_schw_borsdorfer_web.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'S',name:'Schweizer Glockenapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Schweizer Sorte mit glockenförmiger Frucht. Robust und angepasst an feuchte Lagen. Für Streuobst im Alpenvorland.',tags:['historisch','Streuobst','robust'],pdf:'https://www.arche-noah.at/media/schweizer_glockenapfel_web.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'S',name:'Siebenkant',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Charakteristisch siebenkantige Fruchtform — namensgebend. Historische Rarität. Genetisch bedeutsam.',tags:['historisch','Rarität','Streuobst'],pdf:'https://www.arche-noah.at/media/siebenkant_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'S',name:'Signe Tillisch',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Dänische Sorte. Aromatisch und zuverlässig tragend. Für Bio-Anbau und Hausgarten geeignet. Gute Bienenweide.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/signe_tillisch.pdf',erntem:[8,9],lagerm:[10]},
  {b:'S',name:'Sikulaer',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Österreichische Regionalsorte. Robust und angepasst. Für Streuobst und regionale Sortenerhaltung.',tags:['historisch','Streuobst','österreichisch'],pdf:'https://www.arche-noah.at/media/sikulaer_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12]},
  {b:'S',name:'Sommer Parmäne',reife:'Sommer',genuss:'Jul–Aug',beschreibung:'Frühreifende Parmäne-Variante. Feines Aroma bereits im Sommer. Bienenweide durch frühe Blüte — Gilden-Frühlieferant.',tags:['Frühsorte','Sommerapfel','historisch','Tafelobst'],pdf:'https://www.arche-noah.at/media/sommer_parmaene_01_1.pdf',erntem:[7,8],lagerm:[]},
  {b:'S',name:'Sommergewürzapfel',reife:'Sommer',genuss:'Jul–Aug',beschreibung:'Frühreifende Sorte mit würzigem Aroma. Bienenweide. Für Hausgarten und Direktvermarktung.',tags:['Frühsorte','Sommerapfel','historisch','Tafelobst'],pdf:'https://www.arche-noah.at/media/sommergewuerzapfel_01_1.pdf',erntem:[7,8],lagerm:[]},
  {b:'S',name:'Später Roter Wiesling',reife:'Herbst',genuss:'Okt–Nov',beschreibung:'Späte Rote Wiesling-Variante aus Niederösterreich. Mostsorte mit Regionalcharakter, robust.',tags:['Most','historisch','Herbstapfel','österreichisch'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_spaeter_roter_wiesling_s_web.pdf',erntem:[9,10],lagerm:[11]},
  {b:'S',name:'Stark Earliest',reife:'Sommer',genuss:'Jun–Jul',beschreibung:'Sehr frühreifende amerikanische Sorte. Ernte bereits im Juni/Juli — frühste Apfelernte. Bienenweide, Frühlieferant für Insekten.',tags:['Frühsorte','Sommerapfel','Bienenweide'],pdf:'https://www.arche-noah.at/media/stark_erliest.pdf',erntem:[6,7],lagerm:[]},
  {b:'S',name:'Steirischer Constantin',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Steirische Regionalsorte. Robust und angepasst an südösterreichische Lagen. Wichtige Sortenerhaltung im steirischen Streuobstbestand.',tags:['historisch','Streuobst','Steiermark','robust'],pdf:'https://www.arche-noah.at/media/steirischer_constantin_2018.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'S',name:'Steirischer Maschanzker',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Steirische Maschanzker-Variante. Wichtige regionale Mostsorte. Robust, angepasst an steirische Lagen. Kulturhistorisch bedeutsam.',tags:['Most','historisch','Steiermark','Streuobst'],pdf:'https://www.arche-noah.at/media/steirischer_maschanzker.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'S',name:'Steirischer Passamaner',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Steirische Landsorte. Robust und zuverlässig tragend. Für Streuobst und Most. Regionale Sortenerhaltung.',tags:['Most','historisch','Steiermark','Streuobst'],pdf:'https://www.arche-noah.at/media/steirischer_passamaner.pdf',erntem:[9,10],lagerm:[11,12]},
  {b:'S',name:'Steirische Schafnase',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Charakteristische schafnasenförmige Frucht. Steirische Rarität. Kulturhistorisch bedeutsam.',tags:['historisch','Rarität','Steiermark'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_steir_schafnase_web.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'S',name:'Sternrambur',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Neu dokumentiert 2026. Rambur-Typ mit charakteristischer Sternzeichnung. Historische Rarität, genetisch bedeutsam.',tags:['historisch','Rarität','Herbstapfel','NEU 2026'],pdf:'https://www.arche-noah.at/media/sternrambur.pdf',erntem:[8,9],lagerm:[10]},
  {b:'S',name:'Strauwalds Parmäne',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Neu dokumentiert 2025. Winterparmäne mit feinem Aroma. Historische Rarität für Sortensammlungen.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2025_strauwaldsparmaene_web.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'S',name:'Süßer Klapperapfel',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Niederösterreichische Landsorte. Die Kerne klappern bei Reife hörbar — namensgebend. Mostsorte mit Regionalcharakter.',tags:['Most','historisch','österreichisch','Streuobst'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_suesser_klapperapfel_web.pdf',erntem:[8,9],lagerm:[10,11]},
  // T
  {b:'T',name:'Tiroler Spitzlederer',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Tiroler Landsorte mit charakteristisch lederartig gerauter Schale. Robust für alpine Berglagen. Wichtige Sortenerhaltung für den Alpenraum.',tags:['historisch','Streuobst','winterhart','Tirol'],pdf:'https://www.arche-noah.at/media/tiroler_spitzlederer_beschreibung_und_foto.pdf',erntem:[9,10],lagerm:[11,12,1]},
  // W
  {b:'W',name:'Waldviertler Böhmer',reife:'Winter',genuss:'Nov–März',beschreibung:'Waldviertler Landsorte. Sehr robust und winterhart. Für das raue Klima des Waldviertels und ähnliche Höhenlagen optimiert.',tags:['winterhart','historisch','Waldviertel','Streuobst'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_waldviertler_boehmer_web.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'W',name:'Weißer Klarapfel',reife:'Sommer',genuss:'Jul–Aug',beschreibung:'Eine der bekanntesten Frühsorten. Frühblüher als Bienenweide. Für viele Höhenlagen bis 900m geeignet. Schnell essreif nach der Ernte.',tags:['Frühsorte','Sommerapfel','historisch','Tafelobst'],pdf:'https://www.arche-noah.at/media/weisser_klarapfel.pdf',erntem:[7,8],lagerm:[]},
  {b:'W',name:'Weißer Wiesling',reife:'Herbst',genuss:'Sep–Nov',beschreibung:'Weiße Wiesling-Variante aus Niederösterreich. Wichtige regionale Mostsorte. Robust, angepasst.',tags:['Most','historisch','österreichisch','Streuobst'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_weisser_wiesling_web.pdf',erntem:[8,9],lagerm:[10,11]},
  {b:'W',name:'Weißer Winter Taffetapfel',reife:'Winter',genuss:'Dez–März',beschreibung:'Alte Wintersorte mit seidig-weißer Schale — taffetartig glänzend, namensgebend. Historische Rarität, lang lagernd.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/weisser_winter_taffetapfel.pdf',erntem:[11,12],lagerm:[1,2,3]},
  {b:'W',name:'Weißer Winterkalvill',reife:'Winter',genuss:'Nov–März',beschreibung:'Älteste dokumentierte Kalvillsorte Europas. Feinstes Aroma, historisch einzigartig bedeutsam. Für Sortengärten unverzichtbar.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/weisser_winterkalvill.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'W',name:'Welschbrunner',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Neu dokumentiert 2025. Österreichische Landsorte. Robust und angepasst. Wichtige Ergänzung für die regionale Sortenvielfalt.',tags:['historisch','Winterapfel','österreichisch'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2025_welschbrunner_web.pdf',erntem:[10],lagerm:[11,12,1,2]},
  {b:'W',name:'Wildalpener Hubertusapfel',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Steirische Bergsorte aus Wildalpen. Angepasst an alpine Extremlagen. Schutzpatron Hubertus namengebend — jagdkulturell bedeutsam.',tags:['historisch','Streuobst','Steiermark','winterhart'],pdf:'https://www.arche-noah.at/media/obstsortenblatt_2016_wildalpener_hubertusapfel_web.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'W',name:'Winterbananenapfel',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Wintersorte mit bananenähnlichem Aroma. Historische Rarität. Lang lagernd, für Liebhaber besonderer Aromen.',tags:['Lager','historisch','Winterapfel','Rarität'],pdf:'https://www.arche-noah.at/media/winterbananenapfel_foto_und_beschreibung.pdf',erntem:[10,11],lagerm:[12,1,2]},
  {b:'W',name:'Wintergoldparmäne',reife:'Winter',genuss:'Nov–März',beschreibung:'Klassische englische Parmäne von 1200 — eine der ältesten Apfelsorten überhaupt. Feinstes Gewürzaroma, golden. Historisch unverzichtbar.',tags:['Lager','historisch','Winterapfel','Tafelobst'],pdf:'https://www.arche-noah.at/media/wintergoldparmaene.pdf',erntem:[10,11],lagerm:[12,1,2,3]},
  {b:'W',name:'Worcester Parmäne',reife:'Herbst',genuss:'Sep–Okt',beschreibung:'Englische Sorte von 1874. Erdbeer-Aroma, aromatisch-süß. Für Direktvermarktung und Hausgarten. Bienenweide.',tags:['Tafelobst','historisch','Herbstapfel'],pdf:'https://www.arche-noah.at/media/worcester_parmaene_beschreibung_und_foto.pdf',erntem:[8,9],lagerm:[10]},
  // Z
  {b:'Z',name:'Zigeunerin',reife:'Herbst/Winter',genuss:'Okt–Jan',beschreibung:'Österreichische Landsorte mit farbenfreudigem Namen. Robust und angepasst. Für Streuobst und regionale Sortenerhaltung.',tags:['historisch','Streuobst','österreichisch'],pdf:'https://www.arche-noah.at/media/zigeunerin_foto_und_beschreibung.pdf',erntem:[9,10],lagerm:[11,12,1]},
  {b:'Z',name:'Zitzenrenette aus Jaidhof',reife:'Winter',genuss:'Nov–Feb',beschreibung:'Niederösterreichische Renette aus Jaidhof im Kamptal. Charakteristische Zitzenform am Kelch. Historisch bedeutsam für die niederösterreichische Sortenerhaltung.',tags:['Lager','historisch','Winterapfel','österreichisch'],pdf:'https://www.arche-noah.at/media/zitzenrenette_jaidhof_beschreibung_und_foto.pdf',erntem:[10],lagerm:[11,12,1,2]}
];

// ─── STATUS ───────────────────────────────────────────────────────────────────
let _sortenCache=null;

function getAllSorten(){
  if(_sortenCache) return _sortenCache;
  const result=[];
  AN_SORTEN.forEach(s=>{
    const verwendung=[];
    const desc=(s.beschreibung||'').toLowerCase();
    const tags=s.tags.map(t=>t.toLowerCase());
    if(tags.includes('tafelobst')||desc.includes('tafelobst')||desc.includes('frischobst')) verwendung.push('Tafelobst');
    if(tags.includes('most')||desc.includes('most')||desc.includes('wirtschafts')||desc.includes('wirtschaftsapfel')) verwendung.push('Wirtschaftsobst');
    if(tags.some(t=>t.includes('most')||t.includes('saft'))||desc.includes('saft')||desc.includes('most')) verwendung.push('Saft/Most');
    if(verwendung.length===0) verwendung.push('Sonstiges');
    const full=getSorte(s.name);
    result.push({name:s.name,frucht:'Apfel',quelle:'arche',quelleName:'Arche Noah',verwendung,beschreibung:s.beschreibung,erntem:s.erntem||[],lagerm:s.lagerm||[],genuss:s.genuss,tags:s.tags,pdf:s.pdf,baum_ids:full?full.baum_ids||[]:[],pflueckzeitpunkt:full?(full.pflueckzeitpunkt||full.pflueck_reifezeit||''):''});
  });
  if(window.__dataReady && typeof state!=='undefined' && state){
    const baumSorten=getAllTrees();
    const sortenMap=new Map();
    baumSorten.forEach(t=>{
      if(t.sorte && !sortenMap.has(t.sorte)){
        const sorte=getSorte(t.sorte);
        const anSorte=AN_SORTEN.find(a=>a.name===t.sorte);
        const anTags=anSorte?anSorte.tags:[];
        sortenMap.set(t.sorte,{name:t.sorte,frucht:t.frucht||sorte?.frucht||'',quelle:'hof',quelleName:'Hofsorten',verwendung:getVerwendung(t),beschreibung:sorte?.beschreibung||sorte?.geschmack||sorte?.eigenschaften||'',geschmack:sorte?.geschmack,eigenschaften:sorte?.eigenschaften,erntem:sorte?.erntem||[],lagerm:sorte?.lagerm||[],genuss:sorte?.genuss||'',tags:[...new Set([...(sorte?.tags||[]),...anTags])],pdf:sorte?.pdf||'',baum_ids:sorte?.baum_ids||[],pflueckzeitpunkt:sorte?(sorte.pflueckzeitpunkt||sorte.pflueck_reifezeit||''):''});
      }
    });
    sortenMap.forEach(s=>result.push(s));
  }
  const seen=new Map();
  result.forEach(s=>{const key=s.name.toLowerCase();if(!seen.has(key)) seen.set(key,s);else{const existing=seen.get(key);if(s.quelle==='hof') seen.set(key,s);}});
  const deduped=[...seen.values()];
  if(state.sortenSichtbar && Object.keys(state.sortenSichtbar).length>0){
    _sortenCache=deduped.filter(s=>{const key=s.quelle==='arche'?'arche':s.quelle==='hof'?'hof':s.quelle;return state.sortenSichtbar[key]!==false;});
    return _sortenCache;
  }
  _sortenCache=deduped;
  return deduped;
}

// ─── SORTENBERATER (unified) ─────────────────────────────────────────────────
// ─── SORTENBERATER (unified) ─────────────────────────────────────────────────
let _sbrMode='sorten';
function sbrShowTab(t){
  _sbrMode=t;
  document.querySelectorAll('#tab-sortenberater .sbr-tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===t));
  const pb=document.getElementById('panel-berater');
  if(pb) pb.classList.toggle('active',t==='berater');
  renderResults();
}
function onFilterChange(){
  _sortenCache=null;
  updateSbCount();
  renderResults();
}
function resetFilters(){
  document.getElementById('sl-search').value='';
  document.getElementById('sb-filter-frucht').value='';
  document.getElementById('sb-filter-verwendung').value='';
  document.getElementById('sb-filter-quelle').value='';
  document.getElementById('hoehe').value=720;
  document.getElementById('hv').textContent='720m';
  document.getElementById('expo').value='mulde';
  document.getElementById('frost').value='mittel';
  document.getElementById('ns').value='mittel';
  _sortenCache=null;
  updateSbCount();
  renderResults();
}

// ─── BERATER ──────────────────────────────────────────────────────────────────
function hofpoolDaten(){
  if(!window.__dataReady || typeof state==='undefined' || !state) return {liste:[], anzahl:{}};
  const anzahl={};
  const baeume=getAllTrees();
  baeume.forEach(t=>{ if(t.sorte) anzahl[t.sorte]=(anzahl[t.sorte]||0)+1; });
  const map=new Map();
  SORTEN_DATA.forEach(s=>{ if(anzahl[s.sorte]) map.set(s.sorte, getSorte(s.sorte)||s); });
  Object.keys(anzahl).forEach(name=>{
    if(!map.has(name)){
      const t=baeume.find(x=>x.sorte===name);
      map.set(name,{sorte:name,frucht:t.frucht||'',pflueckzeitpunkt:t.pflueckzeitpunkt||t.pflueck_reifezeit||'',geschmack:t.geschmack||'',eigenschaften:t.eigenschaften||'',frucht_beschreibung:t.frucht_beschreibung||'',verwendung:getVerwendung(t),lagerfaehig:t.lagerfaehig||''});
    }
  });
  return {liste:Array.from(map.values()), anzahl};
}
function hofTags(s){
  const t=[...(s.verwendung||[])];
  if(s.lagerfaehig) t.push('lagerfähig');
  if(s.arche_pdf) t.push('Arche Noah');
  if(state.verifiziert && state.verifiziert[s.sorte]) t.push('verifiziert');
  else if(s.recherchiert) t.push('recherchiert');
  const pz=s.pflueckzeitpunkt||s.pflueck_reifezeit||'';
  if(pz){const m=parseFloat(String(pz).replace(',','.'));if(!isNaN(m)){const f=(s.frucht||'').toLowerCase();t.push(m<=8?'Sommer'+f:m<=10?'Herbst'+f:'Winter'+f);}}
  const full=getSorte(s.name||s.sorte);
  if(full){const txt=[full.eigenschaften||'',full.beschreibung||'',full.eignung||'',full.standort_anspruch||''].join(' ').toLowerCase();if(txt.includes('historisch')) t.push('historisch');if(txt.includes('streuobst')) t.push('Streuobst');if(txt.includes('rarität')||txt.includes('raritaet')) t.push('Rarität');if(txt.includes('winterhart')) t.push('winterhart');}
  return t;
}

/* ─── GILDEN & BEGLEITPFLANZUNG ─────────────────────────────────────────────── */
const GUILD_DB = {
  apfel: {
    naehrstoff: ['Beinwell', 'Brennnessel', 'Ringelblume'],
    boden: ['Weißklee', 'Rotklee', 'Luzerne'],
    schaedling: ['Lavendel', 'Borretsch', 'Kapuzinerkresse', 'Rainfarn'],
    bestaeuber: ['Fenchel', 'Dill', 'Kamille'],
    warnung: []
  },
  birne: {
    naehrstoff: ['Beinwell', 'Brennnessel', 'Ringelblume'],
    boden: ['Weißklee', 'Rotklee'],
    schaedling: ['Lavendel', 'Borretsch', 'Kapuzinerkresse'],
    bestaeuber: ['Fenchel', 'Dill'],
    warnung: []
  },
  walnuss: {
    naehrstoff: [],
    boden: [],
    schaedling: [],
    bestaeuber: [],
    warnung: ['Walnuesse sondern Juglone ab, das viele Begleitpflanzen hemmt. Unter Walnussbaeumen nur sortenreiche Wildblumenwiesen anlegen. Keine Solanaceen, Rosen oder Beeren in Boden.naehe.']
  },
  kirsche: {
    naehrstoff: ['Beinwell', 'Brennnessel'],
    boden: ['Weißklee'],
    schaedling: ['Lavendel', 'Rainfarn'],
    bestaeuber: ['Fenchel', 'Dill', 'Kamille'],
    warnung: []
  },
  zwetschke: {
    naehrstoff: ['Beinwell', 'Brennnessel', 'Ringelblume'],
    boden: ['Weißklee', 'Rotklee', 'Luzerne'],
    schaedling: ['Lavendel', 'Borretsch', 'Kapuzinerkresse'],
    bestaeuber: ['Fenchel', 'Dill', 'Kamille'],
    warnung: []
  },
  sonstige: {
    naehrstoff: ['Beinwell', 'Brennnessel', 'Ringelblume'],
    boden: ['Weißklee'],
    schaedling: ['Lavendel'],
    bestaeuber: ['Fenchel'],
    warnung: []
  }
};

function getGuildRecommendations(frucht) {
  const key = (frucht||'').toLowerCase();
  return GUILD_DB[key] || GUILD_DB.sonstige;
}

function renderGuildSection(frucht) {
  const g = getGuildRecommendations(frucht);
  const cats = [
    { key: 'naehrstoff', label: 'Naehrstoff-Akkumulatoren' },
    { key: 'boden', label: 'Bodenverbesserer' },
    { key: 'schaedling', label: 'Schaedlingsabwehr' },
    { key: 'bestaeuber', label: 'Bestaeuber-Anziehung' }
  ];
  let html = '';
  cats.forEach(c => {
    const items = g[c.key];
    if(!items || !items.length) return;
    html += '<div style="margin-top:4px;"><span style="color:var(--muted);font-size:.78rem;">'+c.label+':</span> <span style="font-size:.82rem;">'+items.join(', ')+'</span></div>';
  });
  if(g.warnung && g.warnung.length){
    html += '<div style="margin-top:6px;padding:6px 8px;background:rgba(220,38,38,.08);border-radius:6px;font-size:.78rem;color:#991b1b;">'+g.warnung.join(' ')+'</div>';
  }
  return html;
}

const GUILD_QUELLEN = [
  { autor: 'Robert Kourik', titel: 'Designing and Maintaining Your Edible Landscape', jahr: 2005, url: '' },
  { autor: 'Toby Hemenway', titel: 'Gaia\'s Garden: A Guide to Home-Scale Permaculture', jahr: 2009, url: '' },
  { autor: 'Sepp Holzer', titel: 'Der Obstbau', jahr: 2018, url: '' },
  { autor: 'Plants For A Future (PFAF)', titel: 'pfaf.org — Edible, Medicinal and Useful Plants', jahr: 'online', url: 'https://pfaf.org' },
  { autor: 'Bund Oekologische Lebensmittelwirtschaft', titel: 'Kompost & Gründüngung im Bio-Obstbau', jahr: 2020, url: 'https://www.boelw.de/themen/pflanze/duengung/' }
];

/* ─── UNTERLAGEN (ROOTSTOCK) ──────────────────────────────────────────────── */
const ROOTSTOCK_INFO = {
  apfel: {
    label: 'Apfelunterlagen',
    intro: 'Die Unterlage (Rootstock) bestimmt Staerke, Groesse und Ertrag des Baumes. Sie beeinflusst, wie schnell der Baum Wurzeln schlaegt, wie gross er wird und wann er erstmals traegt.',
    items: [
      {code:'MM106', name:'MM106', stärke:'Halbstark wachsend', beschreibung:'Der Klassiker fuer Streuobst. Baum wird 4–5m hoch, traegt ab 4–5 Jahren regelmaessig und ergiebig. Vertraegt mittlere Boeden und ist winterhart.'},
      {code:'M26', name:'M26', stärke:'Schwach bis halbstark', beschreibung:'Fuer kleinere Baeume (3–4m). Traegt frueher als MM106, braucht aber Haltstab. Gut fuer Hausgaerten und intensivere Anlagen.'},
      {code:'M9', name:'M9', stärke:'Zwergunterlage', beschreibung:'Sehr schwach wachsend (2–3m). Ertragreich ab 2–3 Jahren, braucht Pfahl. Fuer Hochdichtpflanzung und Topfobst.'},
      {code:'Bittenfelder', name:'Bittenfelder', stärke:'Saemlingsunterlage',beschreibung:'Starke Saemlingunterlage (5–6m). Robust, laengere Jungendphase, aber langlebig. Fuer Streuobst und historische Sorten.'}
    ]
  },
  birne: {
    label: 'Birnunterlagen',
    intro: 'Birnen werden fast ausschliesslich auf Quitte oder Quitte-Hybriden veredelt. Die Wahl der Unteralge bestimmt Wuchsstaerke und Anpassung an Bodenverhaeltnisse.',
    items: [
      {code:'Quitte BA29', name:'Quitte BA29', stärke:'Halbstark wachsend', beschreibung:'Standardunterlage fuer Birnen. Baum 4–5m, vertraegt kalkhaltige Boeden. Traegt ab 4–6 Jahren, zuverlaessig und ertragreich.'},
      {code:'QBA', name:'QBA ( Quitte)', stärke:'Halbstark', beschreibung:'Klassische Quitte. Aehnlich wie BA29, gut angepasst an mitteleuropaeische Boeden. Fuer Streuobst und Hausgarten.'},
      {code:'Pyrodwarf', name:'Pyrodwarf', stärke:'Schwachwachsend',beschreibung:'Fuer Birnen nutzbar, bleibt kleiner (3–3,5m). Fruehtragend, aber weniger verbreitet als Quitte-Unterlagen.'},
      {code:'OHxF', name:'OHxF (Old Home x Farmingdale)', stärke:'Variabel', beschreibung:'Resistente Hybride aus USA. Verschiedene Stärken (OHxF 87, 97, 333). Resistent gegen Feuerbrand. Fuer professionelle Anlagen.'}
    ]
  },
  walnuss: {
    label: 'Walnuss-Unterlagen',
    intro: 'Walnuesse werden selten veredelt — die meisten Baeume wachsen direkt aus Samen. Edelunterlagen sind fuer hochwertige Sorten noetig.',
    items: [
      {code:'Sämling', name:'Sämling', stärke:'Volle Staerke', beschreibung:'Direkt aus dem Samen gewachsen. Baum wird 10–15m, traegt ab 8–12 Jahren. Laengste Jugendphase, aber laanglebig und robust.'},
      {code:'Baumpfirsich', name:'Baumpfirsich (Prunus persica)', stärke:'Edelunterlage', beschreibung:'Fuer veredelte Walnusssorten. Reduziert Wuchsstaerke, fuehrt zu frueherem Ertrag. Noch nicht weit verbreitet in Europa.'}
    ]
  }
};

function getRootstockInfo(frucht) {
  const key = (frucht||'').toLowerCase();
  return ROOTSTOCK_INFO[key] || null;
}

function showUnterlageInfo(sorteName) {
  const s = getSorte(sorteName);
  if(!s) return;
  const frucht = (s.frucht||'').toLowerCase();
  const info = getRootstockInfo(frucht);
  const aktuelleUnterlage = s.unterlage || '';

  const mc = document.getElementById('modal-content');
  mc.dataset.prevHtml = mc.innerHTML;

  let html = '<div style="max-width:520px;"><button class="close" onclick="hideUnterlageInfo()">&times;</button>';
  html += '<h3 style="font-family:var(--font-heading);color:var(--dark);margin:0 0 12px;">Unterlagen (Rootstock)</h3>';

  if(info) {
    html += '<p style="font-size:.85rem;color:var(--text);line-height:1.5;margin-bottom:12px;">'+info.intro+'</p>';
    html += '<div style="font-size:.82rem;color:var(--muted);margin-bottom:14px;font-weight:600;">'+info.label+':</div>';

    info.items.forEach(item => {
      const isActive = aktuelleUnterlage && (item.code === aktuelleUnterlage || item.name === aktuelleUnterlage);
      const border = isActive ? 'border-left:3px solid var(--gold);background:rgba(217,180,88,.06);' : 'border-left:3px solid var(--border);';
      html += '<div style="padding:8px 10px;margin-bottom:8px;border-radius:0 6px 6px 0;'+border+'">';
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">';
      html += '<strong style="font-size:.88rem;color:var(--dark);">'+escHtml(item.name)+'</strong>';
      html += '<span style="font-size:.75rem;color:var(--muted);">'+escHtml(item.stärke)+'</span>';
      if(isActive) html += ' <span style="font-size:.7rem;background:var(--gold);color:#fff;padding:1px 6px;border-radius:4px;">diese Sorte</span>';
      html += '</div>';
      html += '<div style="font-size:.82rem;color:var(--text);line-height:1.45;">'+escHtml(item.beschreibung)+'</div>';
      html += '</div>';
    });
  } else {
    html += '<p style="font-size:.85rem;color:var(--text);line-height:1.5;margin-bottom:10px;">Fuer '+escHtml(s.frucht||'diese Obstart')+' liegen keine detaillierten Unterlagen-Daten vor.</p>';
  }

  if(aktuelleUnterlage) {
    html += '<div style="margin-top:14px;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;">';
    html += '<div style="font-size:.82rem;color:var(--muted);margin-bottom:4px;">Aktuelle Unterlage dieser Sorte:</div>';
    html += '<div style="font-size:1rem;font-weight:600;color:var(--dark);">'+escHtml(aktuelleUnterlage)+'</div>';
    html += '</div>';
  }

  html += '<p style="font-size:.78rem;color:var(--muted);line-height:1.4;margin-top:14px;"><em>Quelle: Obstbaumschule Kriechbaumhof, Permakultur-Praxiserfahrung</em></p>';
  html += '</div>';

  mc.innerHTML = html;
  document.getElementById('overlay').classList.add('open');
}
function hideUnterlageInfo(){
  const mc = document.getElementById('modal-content');
  const prev = mc.dataset.prevHtml;
  if(prev){ mc.innerHTML = prev; delete mc.dataset.prevHtml; }
  else closeModal();
}

function showGuildQuellen() {
  let listHtml = GUILD_QUELLEN.map(q =>
    q.url
      ? '<li style="margin-bottom:4px;"><a href="'+q.url+'" target="_blank" rel="noopener"><strong>'+q.autor+' ('+q.jahr+')</strong></a></li>'
      : '<li style="margin-bottom:4px;"><strong>'+q.autor+' ('+q.jahr+')</strong>: <span style="font-weight:normal;">'+q.titel+'</span></li>'
  ).join('');
  const modalHtml = '<div style="max-width:520px;">' +
    '<h3 style="font-family:var(--font-heading);color:var(--dark);margin:0 0 12px;">Gilden & Begleitpflanzung</h3>' +
    '<p style="font-size:.85rem;color:var(--text);line-height:1.5;margin-bottom:10px;">Empfehlungen fuer Begleitpflanzen rund um Obstbaeume. Gilden sind Pflanzen, die sich gegenseitig unterstuetzen — durch Naehrstoffanreicherung, Schaedlingsabwehr oder Bestaeuberfoerderung.</p>' +
    '<p style="font-size:.78rem;color:var(--muted);line-height:1.4;margin-bottom:10px;"><em>Hinweis: Gilden-Empfehlungen basieren auf Permakultur-Praxiserfahrung, nicht auf wissenschaftlich validierten Studien. Sie ergaenzen, ersetzen aber nicht eine fundierte Boden- und Pflanzenpflege.</em></p>' +
    '<div class="section-title">Quellen</div>' +
    '<ol style="font-size:.82rem;padding-left:18px;margin:6px 0;">'+listHtml+'</ol>' +
    '</div>';
  document.getElementById('modal-content').innerHTML = modalHtml;
  document.getElementById('overlay').classList.add('open');
}

function showGuildPopup(sorteName){
  const s=getSorte(sorteName);
  const frucht=s?(s.frucht||'').toLowerCase():'';
  const g=getGuildRecommendations(frucht);
  let html='<div style="max-width:520px;">';
  html+='<h3 style="font-family:var(--font-heading);color:var(--dark);margin:0 0 12px;">Gilden & Begleitpflanzung</h3>';
  html+='<p style="font-size:.85rem;color:var(--text);line-height:1.5;margin-bottom:10px;">Empfehlungen fuer Begleitpflanzen rund um Obstbaeume. Gilden sind Pflanzen, die sich gegenseitig unterstuetzen — durch Naehrstoffanreicherung, Schaedlingsabwehr oder Bestaeuberfoerderung.</p>';
  html+='<p style="font-size:.78rem;color:var(--muted);line-height:1.4;margin-bottom:14px;"><em>Hinweis: Gilden-Empfehlungen basieren auf Permakultur-Praxiserfahrung, nicht auf wissenschaftlich validierten Studien.</em></p>';
  const cats=[{key:'naehrstoff',label:'Naehrstoff-Akkumulatoren'},{key:'boden',label:'Bodenverbesserer'},{key:'schaedling',label:'Schaedlingsabwehr'},{key:'bestaeuber',label:'Bestaeuber-Anziehung'}];
  let hasPlants=false;
  cats.forEach(c=>{
    const items=g[c.key];
    if(!items||!items.length) return;
    hasPlants=true;
    html+='<div style="margin-bottom:6px;"><span style="color:var(--muted);font-size:.78rem;font-weight:600;">'+c.label+':</span> <span style="font-size:.85rem;">'+items.join(', ')+'</span></div>';
  });
  if(g.warnung&&g.warnung.length){
    html+='<div style="margin:8px 0;padding:8px;background:rgba(220,38,38,.08);border-radius:6px;font-size:.82rem;color:#991b1b;">'+g.warnung.join(' ')+'</div>';
  }
  if(!hasPlants&&!g.warnung?.length){
    html+='<p class="empty">Fuer diese Obstart liegen keine Begleitpflanzen-Daten vor.</p>';
  }
  html+='<div class="section-title" style="margin-top:14px;">Quellen</div>';
  html+='<ol style="font-size:.82rem;padding-left:18px;margin:6px 0;">';
  GUILD_QUELLEN.forEach(q=>{
    if(q.url){
      html+='<li style="margin-bottom:4px;"><a href="'+q.url+'" target="_blank" rel="noopener"><strong>'+q.autor+' ('+q.jahr+')</strong></a></li>';
    } else {
      html+='<li style="margin-bottom:4px;"><strong>'+q.autor+' ('+q.jahr+')</strong>: <span style="font-weight:normal;">'+q.titel+'</span></li>';
    }
  });
  html+='</ol></div>';
  document.getElementById('modal-content').innerHTML=html;
  document.getElementById('overlay').classList.add('open');
}

function beraterPool(){
  const all=getAllSorten();
  return all.map(s=>{
    const full=getSorte(s.name);
    let standort=full?.standort||null;
    return Object.assign({}, s, standort?{standort,sorte:full?.sorte||s.name}:null);
  }).filter(s=>s.standort);
}
function beraterPoolFiltered(){
  let pool=beraterPool();
  const qVal=document.getElementById('sb-filter-quelle')?.value;
  if(qVal) pool=pool.filter(s=>s.quelle===qVal);
  return pool;
}
function sbFullPool(){
  let pool=beraterPoolFiltered();
  const artVal=(document.getElementById('sb-filter-frucht')?.value||'').toLowerCase();
  if(artVal) pool=pool.filter(s=>(s.frucht||'').toLowerCase()===artVal);
  const verwVal=document.getElementById('sb-filter-verwendung')?.value;
  if(verwVal) pool=pool.filter(s=>(s.standort?.ziele||[]).includes(verwVal));
  return pool;
}
function updateSbCount(){
  if(_sbrMode==='berater'){
    const pool=sbFullPool();
    const stats={};
    pool.forEach(s=>{const f=s.frucht||'Sonstiges';stats[f]=(stats[f]||0)+1;});
    const statsText=Object.entries(stats).filter(([,n])=>n>0).map(([f,n])=>n+' '+f).join(', ');
    const countEl=document.getElementById('sb-count');
    if(countEl) countEl.textContent=pool.length+' Sorten'+(statsText?' ('+statsText+')':'');
  } else {
    const pool=getFilteredSorten();
    const stats={};
    pool.forEach(s=>{const f=s.frucht||'Sonstiges';stats[f]=(stats[f]||0)+1;});
    const statsText=Object.entries(stats).filter(([,n])=>n>0).map(([f,n])=>n+' '+f).join(', ');
    const countEl=document.getElementById('sb-count');
    if(countEl) countEl.textContent=pool.length+' Sorten'+(statsText?' ('+statsText+')':'');
  }
}
function renderSbArten(){
  const prio=['Apfel','Birne','Walnuss'];
  const pool=getAllSorten();
  const arten=[...new Set(pool.map(s=>s.frucht).filter(Boolean))];
  arten.sort((a,b)=>{const ia=prio.indexOf(a),ib=prio.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b,'de');});
  const el=document.getElementById('sb-filter-frucht');
  if(!el) return;
  const prev=el.value;
  el.innerHTML='<option value="">Obstarten ('+arten.length+')</option>'+arten.map(a=>'<option value="'+escAttr(a.toLowerCase())+'">'+a+'</option>').join('');
  if(prev && arten.some(a=>a.toLowerCase()===prev)) el.value=prev;
}
function renderVerwendung(){
  const artVal=(document.getElementById('sb-filter-frucht')?.value||'').toLowerCase()||'apfel';
  const zdef=ZIELE_DEF[artVal]||ZIELE_DEF.apfel;
  const el=document.getElementById('sb-filter-verwendung');
  if(!el) return;
  const prev=el.value;
  el.innerHTML='<option value="">Verwendung</option>'+zdef.map(z=>'<option value="'+escAttr(z.id)+'">'+z.label+'</option>').join('');
  if(prev && zdef.some(z=>z.id===prev)) el.value=prev;
}
function tagCls(t){const tl=t.toLowerCase();if(['sommerapfel','sommerbirne','herbstapfel','herbstbirne','winterapfel','winterbirne','frühsorte','lager'].some(k=>tl===k))return 'tr';if(['pilzresistent','robust','winterhart','resistent','feuerbrand','scharka','bio','schorfresistent'].some(k=>tl.includes(k)))return 'tg';if(['most','cider','einkochen','schnaps','destillat','saft','tafelobst'].some(k=>tl.includes(k)))return 'ta';if(['bestäuber','wildtier','streuobst','historisch','österreichisch','rarität'].some(k=>tl.includes(k)))return 'tp';return 'tb';}
function tagSortKey(t){const c=tagCls(t);return c==='tr'?0:c==='ta'?1:2;}
function formatGenuss(von,bis,reife,genuss){
  if(von&&bis){const n=['','Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];return n[parseInt(von)]+' bis '+n[parseInt(bis)];}
  const val=reife||genuss;
  if(val){const ABV={Jan:'Januar',Feb:'Februar',Mär:'März',März:'März',Apr:'April',Mai:'Mai',Jun:'Juni',Jul:'Juli',Aug:'August',Sep:'September',Okt:'Oktober',Nov:'November',Dez:'Dezember'};const p=val.split(/[–\-]+/);if(p.length===2)return(ABV[p[0].trim()]||p[0].trim())+' bis '+(ABV[p[1].trim()]||p[1].trim());return val;}
  return '';
}

// ─── UNIFIED RENDER ──────────────────────────────────────────────────────────
function getFilteredSorten(){
  const suche=(document.getElementById('sl-search')?.value||'').toLowerCase();
  const fruchtFilter=(document.getElementById('sb-filter-frucht')?.value||'').toLowerCase();
  const qVal=document.getElementById('sb-filter-quelle')?.value||'';
  const verwVal=document.getElementById('sb-filter-verwendung')?.value||'';
  let pool=getAllSorten();
  if(qVal) pool=pool.filter(s=>s.quelle===qVal);
  if(fruchtFilter) pool=pool.filter(s=>(s.frucht||'').toLowerCase()===fruchtFilter);
  if(verwVal){const vk={tafel:['tafel','tafelobst'],most:['most','wirtschaft','saft'],lager:['lager'],frueh:['früh','frueh'],robust:['robust'],wild:['wild']};const kw=vk[verwVal]||[verwVal];pool=pool.filter(s=>(s.verwendung||[]).some(v=>{const vl=v.toLowerCase();return kw.some(k=>vl.includes(k));}));}
  if(suche) pool=pool.filter(s=>s.name.toLowerCase().includes(suche)||(s.beschreibung||'').toLowerCase().includes(suche)||(s.tags||[]).some(t=>t.toLowerCase().includes(suche)));
  pool.sort((a,b)=>a.name.localeCompare(b.name,'de'));
  return pool;
}
function renderResults(){
  renderSbArten();
  renderVerwendung();
  updateSbCount();
  if(_sbrMode==='berater'){ beraten(); } else { renderSortenListe(); }
}
let _sortenSeite=1;
const ITEMS_PER_PAGE=20;
function renderSortenListe(){
  const pool=getFilteredSorten();
  const gesamt=pool.length;
  const seiten=Math.ceil(gesamt/ITEMS_PER_PAGE);
  if(_sortenSeite>seiten) _sortenSeite=seiten||1;
  const start=(_sortenSeite-1)*ITEMS_PER_PAGE;
  const page=pool.slice(start,start+ITEMS_PER_PAGE);
  let paginationHtml='';
  if(seiten>1){
    paginationHtml='<div class="sl-pagination">';
    paginationHtml+='<button class="sl-page-btn" onclick="_sortenSeite--;renderResults()" '+(_sortenSeite===1?'disabled':'')+'>‹ Zurück</button>';
    paginationHtml+='<span class="sl-page-info">Seite '+_sortenSeite+' von '+seiten+'</span>';
    paginationHtml+='<button class="sl-page-btn" onclick="_sortenSeite++;renderResults()" '+(_sortenSeite===seiten?'disabled':'')+'>Weiter ›</button>';
    paginationHtml+='</div>';
  }
  if(!page.length){
    document.getElementById('res').innerHTML=paginationHtml+'<p class="sl-empty">Keine Sorten gefunden.</p>';
    return;
  }
  const html=page.map(s=>{
    const tags=[...new Set([...(s.tags||[]),...hofTags(s)])].sort((a,b)=>tagSortKey(a)-tagSortKey(b)).map(t=>'<span class="sb-tag '+tagCls(t)+'">'+t+'</span>').join('');
    const quelleBadge=s.quelle==='arche'?'<span class="an-badge">Arche Noah</span>':'<span class="an-badge hof-badge">Hofsorte</span>';
    const pflText=s.pflueckzeitpunkt||'';
    const mittel=s.baum_ids&&s.baum_ids.length?calcPfluckMittel(s.name):null;
    const mittelText=mittel?' <span style="color:var(--gruen);font-weight:600;">→ '+mittel.wert+'</span>':'';
    const idsText=(s.baum_ids&&s.baum_ids.length)?' '+s.baum_ids.map(id=>'<span class="idbadge">ID '+id+'</span>').join(' '):'';
    const verwendungText=(s.verwendung&&s.verwendung.length)?s.verwendung.join(', '):'';
    const lageplanBtn=(s.quelle==='hof'&&state.positions)?(()=>{const pi=(s.baum_ids||[]).find(id=>state.positions[id]);return pi?'<button class="btn secondary" style="font-size:.78rem;padding:2px 8px;margin-top:4px;" onclick="event.stopPropagation();showOnLageplan(\''+escAttr(pi)+'\')">Im Lageplan anzeigen</button>':'';})():'';
    const preisHtml = renderShopBlock(s.name, {quelle:s.quelle, frucht:s.frucht, kompakt:true});
    return '<div class="sl-card" onclick="openSortenModal(\''+escAttr(s.name)+'\')">'+quelleBadge+
      '<div class="sl-card-name">'+s.name+'<span class="sl-card-ids">'+idsText+'</span></div>'+
      '<div class="sl-card-reife">'+s.frucht+(pflText?' · Pflückzeit: '+pflText+mittelText:(mittelText?' · Mittelwert:'+mittelText:''))+(verwendungText?' · '+verwendungText:'')+'</div>'+
      '<div class="sb-tags">'+tags+'</div>'+
      '<div class="sl-card-desc">'+(s.beschreibung||'').slice(0,120)+((s.beschreibung||'').length>120?'…':'')+'</div>'+
      (lageplanBtn?'<div style="margin-top:4px;">'+lageplanBtn+'</div>':'')+
      preisHtml+
    '</div>';
  }).join('');
  document.getElementById('res').innerHTML=paginationHtml+'<div class="sl-grid">'+html+'</div>';
}

// ─── BERATEN (standort mode) ─────────────────────────────────────────────────
function beraten(){
  const hoehe=parseInt(document.getElementById('hoehe').value),expo=document.getElementById('expo').value,frost=document.getElementById('frost').value,ns=document.getElementById('ns').value;
  const verwVal=document.getElementById('sb-filter-verwendung')?.value;
  const artVal=(document.getElementById('sb-filter-frucht')?.value||'').toLowerCase()||'apfel';
  const gZ=verwVal?[verwVal]:(ZIELE_DEF[artVal]||ZIELE_DEF.apfel).map(z=>z.id);
  const pool=beraterPoolFiltered().filter(s=>(s.frucht||'').toLowerCase()===artVal);
  const toArr=v=>Array.isArray(v)?v:[v];
  const scored=pool.filter(s=>{const st=s.standort;return hoehe>=((st.hmin||0))&&hoehe<=st.hmax&&toArr(st.expo).includes(expo)&&toArr(st.ns).includes(ns)&&!(frost==='hoch'&&st.frost==='gering');})
    .map(s=>({s, score:gZ.filter(z=>s.standort.ziele.includes(z)).length}))
    .sort((a,b)=>{ if(b.score!==a.score) return b.score-a.score; if(a.s.quelle==='hof'&&b.s.quelle!=='hof') return -1; if(a.s.quelle!=='hof'&&b.s.quelle==='hof') return 1; return (a.s.sorte||a.s.name||'').localeCompare(b.s.sorte||b.s.name||'','de'); });
  const _qVal=document.getElementById('sb-filter-quelle')?.value;
  if(!_qVal){const _d=new Map();for(let i=scored.length-1;i>=0;i--){const n=scored[i].s.sorte||scored[i].s.name;if(_d.has(n)) scored.splice(i,1);else _d.set(n,1);}}
  const lbl=artVal.charAt(0).toUpperCase()+artVal.slice(1);
  const expoEl=document.getElementById('expo');
  if(!scored.length){document.getElementById('res').innerHTML='<div class="sb-leer">Keine passende Sorte für diesen Standort gefunden. Aktuell liegen Standort-Daten für '+pool.length+' '+lbl+'-Sorten vor.</div>';return;}
  window._beraterScored=scored; window._beraterShown=0;
  const INIT_SHOW=12;
  let html='<p class="res-header">'+lbl+' · '+hoehe+'m · '+expoEl.options[expoEl.selectedIndex].text+' · '+scored.length+' Empfehlung'+(scored.length>1?'en':'')+' aus '+pool.length+' Sorten mit Standort-Daten</p><div id="berater-results"></div>';
  document.getElementById('res').innerHTML=html;
  renderBeraterBatch(INIT_SHOW);
}

function renderBeraterBatch(count){
  const scored=window._beraterScored||[];
  const anzahl={}; getAllTrees().forEach(t=>{if(t.sorte) anzahl[t.sorte]=(anzahl[t.sorte]||0)+1;});
  const container=document.getElementById('berater-results');
  if(!container) return;
  const start=window._beraterShown||0;
  const end=Math.min(start+count, scored.length);
  let html='';
  for(let i=start;i<end;i++){
    const e=scored[i];
    const s=e.s;
    const tags=[...new Set([...(s.tags||[]),...hofTags(s)])].sort((a,b)=>tagSortKey(a)-tagSortKey(b)).map(t=>'<span class="sb-tag '+tagCls(t)+'">'+t+'</span>').join('');
    const reife=s.pflueckzeitpunkt||s.pflueck_reifezeit||'–';
    const sn=s.sorte||s.name||'';
    const n=anzahl[sn]||0;
    const nTxt=n?' · '+n+' Baum/Bäume am Hof':'';
    const quelleLabel=s.quelle==='arche'?'Arche Noah':'Hofsorte';
    const idText=(s.baum_ids&&s.baum_ids.length)?' '+s.baum_ids.map(id=>'<span class="idbadge">ID '+id+'</span>').join(' '):'';
    const posBaumId=state.positions? Object.keys(state.positions).find(k=>{const t=getTree(k);return t&&t.sorte===sn;}) : null;
    const safeSn=escAttr(sn);
    const lageplanBtn=posBaumId?'<button class="btn secondary" style="font-size:.78rem;padding:3px 10px;" onclick="event.stopPropagation();showOnLageplan(\''+escAttr(posBaumId)+'\')">Im Lageplan anzeigen</button>':'';
    const guildBtn=s.frucht?'<button class="btn secondary" style="font-size:.78rem;padding:3px 10px;" onclick="event.stopPropagation();showGuildPopup(\''+escAttr(sn)+'\')">Begleitpflanzen</button>':'';
    const btnRow=(lageplanBtn||guildBtn)?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;padding-top:6px;border-top:1px solid var(--border);">'+lageplanBtn+guildBtn+'</div>':'';
    const preisHtml = renderShopBlock(sn, {quelle:s.quelle, frucht:s.frucht, kompakt:true});
    const archeHtml=archeNoahLink(s);
    html+='<div class="sb-sorte" style="cursor:pointer" onclick="openSortenModal(\''+safeSn+'\')"><div class="sb-sorte-name">'+sn+idText+'<span class="sb-reife">Pflueckzeit: '+reife+nTxt+' &middot; bis '+s.standort.hmax+'m</span></div><div class="sb-tags">'+tags+'</div><div class="sb-gilde"><strong>'+quelleLabel+'</strong> '+s.standort.basis+'</div>'+(archeHtml?'<div style="margin-top:6px;">'+archeHtml+'</div>':'')+btnRow+preisHtml+'</div>';
  }
  container.insertAdjacentHTML('beforeend', html);
  window._beraterShown=end;
  const oldBtn=document.getElementById('berater-more-btn');
  if(oldBtn) oldBtn.remove();
  if(end<scored.length){
    const moreBtn='<button class="btn secondary" id="berater-more-btn" style="margin:12px auto;display:block;" onclick="renderBeraterBatch(12)">Mehr laden ('+(scored.length-end)+' weitere)</button>';
    container.insertAdjacentHTML('beforeend', moreBtn);
  }
}

// ─── PFLÜCKZEIT: HILFSFUNKTIONEN ────────────────────────────────────────────
const _TAGE_IM_MONAT=[0,31,28,31,30,31,30,31,31,30,31,30,31];
const _MONAT_NAMEN=['','Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function _daysInMonth(m,jahr){
  if(m===2 && jahr%4===0 && (jahr%100!==0 || jahr%400===0)) return 29;
  return _TAGE_IM_MONAT[m]||30;
}

function ernteToPfluckwert(datum){
  if(!datum) return '';
  const teile=String(datum).split('-');
  if(teile.length<3) return '';
  const jahr=parseInt(teile[0]), monat=parseInt(teile[1]), tag=parseInt(teile[2]);
  if(!monat || !tag) return '';
  const dim=_daysInMonth(monat,jahr);
  const pos=Math.round(1 + (tag-1)/(dim-1) * 8);
  return monat+','+Math.min(9,Math.max(1,pos));
}

function pfluckWertToText(wert){
  if(!wert) return '';
  const teile=String(wert).split(',');
  if(teile.length<2) return '';
  const monat=parseInt(teile[0]), pos=parseInt(teile[1]);
  if(!monat || !_MONAT_NAMEN[monat]) return wert;
  let prefix='';
  if(pos<=1) prefix='Anfang ';
  else if(pos<=3) prefix='erstes Drittel ';
  else if(pos<=6) prefix='Mitte ';
  else if(pos<=8) prefix='letztes Drittel ';
  else prefix='Ende ';
  return prefix+_MONAT_NAMEN[monat];
}

function tagDesJahres(datum){
  if(!datum) return 0;
  const teile=String(datum).split('-');
  if(teile.length<3) return 0;
  const jahr=parseInt(teile[0]), monat=parseInt(teile[1]), tag=parseInt(teile[2]);
  let tage=tag;
  for(let m=1;m<monat;m++) tage+=_daysInMonth(m,jahr);
  return tage;
}

function pfluckWertToTag(wert,jahr){
  if(!wert) return 0;
  if(!jahr) jahr=new Date().getFullYear();
  const teile=String(wert).split(',');
  if(teile.length<2) return 0;
  const monat=parseInt(teile[0]), pos=parseInt(teile[1]);
  if(!monat) return 0;
  const dim=_daysInMonth(monat,jahr);
  const tag=Math.round(1 + (pos-1)/8 * (dim-1));
  return tagDesJahres(jahr+'-'+String(monat).padStart(2,'0')+'-'+String(Math.min(dim,Math.max(1,tag))).padStart(2,'0'));
}

function tagToPfluckWert(tag,jahr){
  if(!tag || !jahr) return '';
  tag=Math.max(1,Math.min(tag,365));
  let monat=1, rest=tag;
  for(let m=1;m<=12;m++){
    const dim=_daysInMonth(m,jahr);
    if(rest<=dim){ monat=m; break; }
    rest-=dim;
    if(m===12) monat=12;
  }
  const dim=_daysInMonth(monat,jahr);
  const pos=Math.round(1 + (rest-1)/Math.max(1,dim-1) * 8);
  return monat+','+Math.min(9,Math.max(1,pos));
}

let _mittelCache=null;
function calcPfluckMittel(sorteName){
  if(!sorteName || !state.ernten) return null;
  if(!_mittelCache) _mittelCache={};
  if(_mittelCache[sorteName]!==undefined) return _mittelCache[sorteName];
  const baeume=getAllTrees().filter(t=>t.sorte===sorteName);
  if(!baeume.length) return null;
  const werte=[];
  baeume.forEach(b=>{
    (state.ernten[b.id]||[]).forEach(e=>{
      if(!e.datum) return;
      const jahr=parseInt(e.datum.substring(0,4));
      const pw=ernteToPfluckwert(e.datum);
      if(pw){
        const teile=pw.split(',');
        werte.push({wert:pw, numerisch:parseInt(teile[0])+parseInt(teile[1])/10, jahr:jahr, baumId:b.id, datum:e.datum});
      }
    });
  });
  if(!werte.length){ _mittelCache[sorteName]=null; return null; }
  const avg=werte.reduce((s,v)=>s+v.numerisch,0)/werte.length;
  const avgMonat=Math.floor(avg);
  const avgPos=Math.round((avg-avgMonat)*10);
  const mittelwert=avgMonat+','+Math.min(9,Math.max(1,avgPos));
  const uniqueJahre=[...new Set(werte.map(v=>v.jahr))].sort();
  const result={wert:mittelwert, numerisch:avg, anzahl:werte.length, jahre:uniqueJahre, eintraege:werte};
  _mittelCache[sorteName]=result;
  return result;
}

// ─── PHÄNOLOGIE: TRACKER & VORHERSAGE ───────────────────────────────────────
const PHAENO_STANDARDS={
  holunder_bluete:110,
  holunder_vollbluete:125,
  knaeulgras_rispenschieben:115
};

function getPhaeno(jahr){
  if(!state.phaenologie) state.phaenologie={};
  if(!state.phaenologie[jahr]) state.phaenologie[jahr]={};
  return state.phaenologie[jahr];
}

function setPhaenoEreignis(jahr,key,datum){
  const phaeno=getPhaeno(jahr);
  phaeno[key]=datum||null;
  saveState();
}

function predictErnte(sorteName){
  const jahr=new Date().getFullYear();
  const phaeno=state.phaenologie&&state.phaenologie[jahr]?state.phaenologie[jahr]:null;
  if(!phaeno||!phaeno.holunder_bluete) return null;
  const aktTag=tagDesJahres(phaeno.holunder_bluete);
  const stdTag=PHAENO_STANDARDS.holunder_bluete;
  if(!aktTag || !stdTag) return null;
  const abweichung=aktTag-stdTag;
  const mittel=calcPfluckMittel(sorteName);
  if(!mittel) return null;
  const stdPfluckTag=pfluckWertToTag(mittel.wert,jahr);
  if(!stdPfluckTag) return null;
  const vorhergesagtTag=stdPfluckTag+abweichung;
  const vorhergesagt=tagToPfluckWert(vorhergesagtTag,jahr);
  if(!vorhergesagt) return null;
  return {wert:vorhergesagt, abweichungTage:abweichung, quelle:'phaenologie', mittelwert:mittel.wert, phaenoDaten:phaeno};
}

function getSortenQuelleLabel(q){
  const labels={alle:'Alle Quellen',arche:'Arche Noah',hof:'Hofsorten',import:'Importe'};
  return labels[q]||q;
}

if(window.__dataReadyPromise){window.__dataReadyPromise.then(()=>{renderSbArten();renderVerwendung();renderResults();});}

// ─── ARCHE NOAH ──────────────────────────────────────────────────────────────
const AN_BUCHSTABEN=['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','W','Z'];
const MONATE=[
  {m:6,kz:'Jun',cls:'sommer'},{m:7,kz:'Jul',cls:'sommer'},{m:8,kz:'Aug',cls:'sommer'},
  {m:9,kz:'Sep',cls:'herbst'},{m:10,kz:'Okt',cls:'herbst'},{m:11,kz:'Nov',cls:'herbst'},
  {m:12,kz:'Dez',cls:'winter'},{m:1,kz:'Jan',cls:'winter'},{m:2,kz:'Feb',cls:'winter'},
  {m:3,kz:'Mär',cls:'winter'}
];
const MNAM={1:'Jan',2:'Feb',3:'Mär',4:'Apr',5:'Mai',6:'Jun',7:'Jul',8:'Aug',9:'Sep',10:'Okt',11:'Nov',12:'Dez'};

// Genussmonate = Erntemonat(e) + Lagermonate zusammen (= gesamtes Genussfenster)
// Sonderfälle: Sommersorten ohne Lager — Genuss direkt nach Ernte, nur 1–2 Wochen
// Wir leiten genussm zur Laufzeit ab: union(erntem, lagerm)
// Falls lagerm leer → genussm = erntem (frisch ab Baum)
function getGenussm(s){
  const e=s.erntem||[];
  const l=s.lagerm||[];
  if(l.length===0) return e; // Frischsorte: nur Erntemonat(e)
  return [...new Set([...e,...l])];
}

// Genuss-Textstring aus genussm ableiten
function genussText(s){
  const gm=getGenussm(s);
  if(!gm.length) return s.genuss||'–';
  // Sortiere nach Kalender (Jun=6 → Mär=3, Jahreswechsel beachten)
  const ord=m=>m>=6?m:m+12;
  const sorted=[...gm].sort((a,b)=>ord(a)-ord(b));
  if(sorted.length===1) return MNAM[sorted[0]];
  return MNAM[sorted[0]]+'–'+MNAM[sorted[sorted.length-1]];
}

// ─── IMPORT SYSTEM ──────────────────────────────────────────────────────────
const IMPORT_FIELDS=[
  {id:'id',label:'Eigene ID',required:false,autoDetect:['id','ID','Nr.','Nummer','baum_id','baum-id']},
  {id:'sorte',label:'Sorte',required:true,autoDetect:['sorte','Sorte','name','Name','sorte_name','Sortenname']},
  {id:'frucht',label:'Obstart',required:true,autoDetect:['frucht','Frucht','obstart','Obstart','art','Art','typ']},
  {id:'ausgepflanzt',label:'Pflanzjahr',required:false,autoDetect:['ausgepflanzt','Pflanzjahr','pflanzjahr','jahr','Year','pflanzdatum']},
  {id:'pflueckzeitpunkt',label:'Pflückzeit',required:false,autoDetect:['pflueckzeitpunkt','Pflückzeit','pflueck_reifezeit','erntemonat']},
  {id:'geschmack',label:'Geschmack',required:false,autoDetect:['geschmack','Geschmack','aroma','Aroma']},
  {id:'eigenschaften',label:'Eigenschaften',required:false,autoDetect:['eigenschaften','Eigenschaften','beschreibung','notes','Notizen']},
  {id:'verwendung',label:'Verwendung',required:false,autoDetect:['verwendung','Verwendung','use','nutzung','Nutzung']}
];

let importState={
  file:null,
  workbook:null,
  sheets:[],
  selectedSheet:null,
  headers:[],
  rows:[],
  mapping:{},
  preview:[],
  step:1
};

function openImportModal(){
  importState={file:null,workbook:null,sheets:[],selectedSheet:null,headers:[],rows:[],mapping:{},preview:[],step:1};
  document.getElementById('import-overlay').style.display='flex';
  showImportStep(1);
}

function closeImportModal(){
  document.getElementById('import-overlay').style.display='none';
}

function showImportStep(step){
  importState.step=step;
  for(let i=1;i<=5;i++){
    const el=document.getElementById('import-step-'+i);
    if(el) el.style.display=i===step?'block':'none';
  }
  document.getElementById('import-back-btn').style.display=step>1?'inline-block':'none';
  const nextBtn=document.getElementById('import-next-btn');
  if(step===4){
    nextBtn.textContent='Importieren';
    nextBtn.disabled=false;
  } else if(step===5){
    nextBtn.style.display='none';
  } else {
    nextBtn.textContent='Weiter →';
    nextBtn.disabled=!canProceedImport();
  }
}

function canProceedImport(){
  switch(importState.step){
    case 1:return importState.file!==null;
    case 2:return importState.selectedSheet!==null;
    case 3:return Object.values(importState.mapping).some(v=>v);
    case 4:return importState.preview.length>0;
    default:return false;
  }
}
function revalidateImportBtn(){
  const nextBtn=document.getElementById('import-next-btn');
  if(nextBtn && importState.step===3) nextBtn.disabled=!canProceedImport();
}

function importNextStep(){
  if(importState.step===4){
    executeImport();
    return;
  }
  if(importState.step===1 && importState.file){
    parseImportFile();
    return;
  }
  if(importState.step===2 && importState.selectedSheet){
    loadSheetData();
    return;
  }
  if(importState.step===3){
    generatePreview();
    return;
  }
  showImportStep(importState.step+1);
}

function importPrevStep(){
  if(importState.step>1) showImportStep(importState.step-1);
}

function parseImportFile(){
  const file=importState.file;
  const ext=file.name.split('.').pop().toLowerCase();
  
  if(ext==='csv'||ext==='tsv'){
    const reader=new FileReader();
    reader.onload=function(e){
      const data=e.target.result;
      let delimiter=',';
      if(ext==='tsv') delimiter='\t';
      else{
        const firstLine=data.split('\n')[0]||'';
        const semiCount=(firstLine.match(/;/g)||[]).length;
        const commaCount=(firstLine.match(/,/g)||[]).length;
        if(semiCount>commaCount) delimiter=';';
      }
      const rows=parseCSV(data,delimiter);
      importState.sheets=['CSV'];
      importState.selectedSheet='CSV';
      importState.headers=rows[0]||[];
      importState.rows=rows.slice(1);
      detectMapping();
      showImportStep(3);
    };
    reader.readAsText(file);
  } else {
    const reader=new FileReader();
    reader.onload=function(e){
      try{
        importState.workbook=XLSX.read(e.target.result,{type:'array'});
        importState.sheets=importState.workbook.SheetNames;
        importState.selectedSheet=importState.sheets[0];
        
        if(importState.sheets.length>1){
          const select=document.getElementById('import-sheet-select');
          select.innerHTML=importState.sheets.map(s=>'<option value="'+s+'">'+s+'</option>').join('');
          select.onchange=function(){importState.selectedSheet=this.value;};
          showImportStep(2);
        } else {
          loadSheetData();
        }
      }catch(err){
        alert('Fehler beim Lesen der Datei: '+err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function parseCSV(text,delimiter=','){
  text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const lines=[];
  let current=[];
  let inQuotes=false;
  let value='';
  
  for(let i=0;i<text.length;i++){
    const c=text[i];
    const next=text[i+1];
    
    if(inQuotes){
      if(c==='"'&&next==='"'){
        value+='"';
        i++;
      } else if(c==='"'){
        inQuotes=false;
      } else {
        value+=c;
      }
    } else {
      if(c==='"'){
        inQuotes=true;
      } else if(c===delimiter){
        current.push(value.trim());
        value='';
      } else if(c==='\n'||c==='\r'){
        if(c==='\r'&&next==='\n') i++;
        current.push(value.trim());
        value='';
        if(current.length>0) lines.push(current);
        current=[];
      } else {
        value+=c;
      }
    }
  }
  current.push(value.trim());
  if(current.length>0&&current.some(v=>v)) lines.push(current);
  return lines;
}

function loadSheetData(){
  if(!importState.workbook||!importState.selectedSheet) return;
  const sheet=importState.workbook.Sheets[importState.selectedSheet];
  const data=XLSX.utils.sheet_to_json(sheet,{header:1});
  importState.headers=data[0]||[];
  importState.rows=data.slice(1);
  detectMapping();
  showImportStep(3);
}

function detectMapping(){
  importState.mapping={};
  const headers=importState.headers.map(h=>h.toString().toLowerCase());
  
  const tpls=getImportTemplates();
  if(tpls.length>0){
    const last=tpls[tpls.length-1];
    if(last.headerAliases){
      importState.headers.forEach(h=>{
        if(last.headerAliases[h]) importState.mapping[last.headerAliases[h]]=h;
      });
    } else if(last.mapping){
      importState.mapping=Object.assign({},last.mapping);
    }
  }
  
  IMPORT_FIELDS.forEach(field=>{
    if(importState.mapping[field.id]) return;
    const found=field.autoDetect.find(ad=>headers.includes(ad.toLowerCase()));
    if(found){
      const idx=headers.indexOf(found.toLowerCase());
      importState.mapping[field.id]=importState.headers[idx];
    }
  });
  
  renderMappingUI();
}

function renderMappingUI(){
  const container=document.getElementById('import-mapping');
  const unusedHeaders=[...importState.headers];
  
  let html=IMPORT_FIELDS.map(field=>{
    const options=importState.headers.map(h=>'<option value="'+h+'" '+(importState.mapping[field.id]===h?'selected':'')+'>'+h+'</option>').join('');
    const required=field.required?'<span style="color:red">*</span>':'';
    return '<div class="import-mapping-row">'+
      '<label>'+field.label+required+'</label>'+
      '<div class="import-mapping-arrow">←</div>'+
      '<select onchange="importState.mapping[\''+field.id+'\']=this.value||null;revalidateImportBtn()">'+ '<option value="">– Nicht zuordnen –</option>'+options+'</select>'+
    '</div>';
  }).join('');
  
  container.innerHTML=html;
}

function generatePreview(){
  importState.preview=[];
  const mapping=importState.mapping;
  
  importState.rows.slice(0,10).forEach(row=>{
    const obj={};
    IMPORT_FIELDS.forEach(field=>{
      const header=mapping[field.id];
      if(header){
        const idx=importState.headers.indexOf(header);
        if(idx>=0) obj[field.id]=row[idx]||'';
      }
    });
    if(obj.sorte) importState.preview.push(obj);
  });
  
  renderPreview();
  showImportStep(4);
}

function renderPreview(){
  const container=document.getElementById('import-preview');
  
  if(importState.preview.length===0){
    container.innerHTML='<p class="import-hint">Keine Daten zur Vorschau vorhanden.</p>';
    return;
  }
  
  let html='<table class="import-preview-table"><thead><tr>';
  html+='<th>ID</th><th>Sorte</th><th>Obstart</th><th>Pflanzjahr</th><th>Pflückzeit</th>';
  html+='</tr></thead><tbody>';
  
  importState.preview.forEach(row=>{
    html+='<tr>'+
      '<td>'+(row.id||'–')+'</td>'+
      '<td>'+(row.sorte||'–')+'</td>'+
      '<td>'+(row.frucht||'–')+'</td>'+
      '<td>'+(row.ausgepflanzt||'–')+'</td>'+
      '<td>'+(row.pflueckzeitpunkt||'–')+'</td>'+
    '</tr>';
  });
  
  html+='</tbody></table>';
  html+='<p class="import-hint" style="margin-top:12px;">'+importState.preview.length+' von '+importState.rows.length+' Zeilen angezeigt.</p>';
  
  container.innerHTML=html;
}

function executeImport(){
  // Snapshot vor dem Import erstellen
  if(!state.importSnapshots) state.importSnapshots=[];
  const importId='IMP-'+Date.now();
  state.importSnapshots.push({
    datum:new Date().toISOString(),
    importId:importId,
    customTrees:JSON.parse(JSON.stringify(state.customTrees||[])),
    positions:JSON.parse(JSON.stringify(state.positions||{}))
  });
  if(state.importSnapshots.length>5) state.importSnapshots.shift();
  
  const result={imported:0,updated:0,skipped:0,errors:[]};
  const mapping=importState.mapping;
  const importedIds=[];
  
  // Prüfe ob Re-Import (gleiche Datei bereits importiert)
  const existingImport=state.importLog?.find(e=>e.datei===importState.file?.name);
  const isReImport=existingImport&&existingImport.treeIds?.length>0;
  
  importState.rows.forEach((row,idx)=>{
    try{
      const sorte=getValueByMapping(row,mapping,'sorte');
      if(!sorte) return;
      
      const frucht=getValueByMapping(row,mapping,'frucht')||'Apfel';
      const id=getValueByMapping(row,mapping,'id');
      
      const newTree={
        id:id||'NEU-'+Date.now()+'-'+idx,
        sorte:sorte,
        frucht:normalizeFrucht(frucht),
        ausgepflanzt:getValueByMapping(row,mapping,'ausgepflanzt')||'',
        pflueckzeitpunkt:getValueByMapping(row,mapping,'pflueckzeitpunkt')||'',
        geschmack:getValueByMapping(row,mapping,'geschmack')||'',
        eigenschaften:getValueByMapping(row,mapping,'eigenschaften')||'',
        quelle:'import',
        importDatum:new Date().toISOString(),
        quelleDatei:importState.file?.name||''
      };
      
      if(!state.customTrees) state.customTrees=[];
      const existingIdx=state.customTrees.findIndex(t=>t.id===newTree.id);
      
      if(existingIdx>=0){
        // Baum existiert bereits - nur leere Felder ausfüllen (ergänzen)
        const existing=state.customTrees[existingIdx];
        const merged={...existing};
        
        // Nur leere Felder ausfüllen
        Object.keys(newTree).forEach(key=>{
          if(key==='id'||key==='quelle'||key==='importDatum'||key==='quelleDatei') return;
          if(!existing[key]&&newTree[key]){
            merged[key]=newTree[key];
          }
        });
        
        state.customTrees[existingIdx]=merged;
        result.updated++;
      } else {
        // Neuer Baum
        state.customTrees.push(newTree);
        result.imported++;
      }
      
      importedIds.push(newTree.id);
    }catch(err){
      result.errors.push('Zeile '+(idx+2)+': '+err.message);
    }
  });
  
  // Import protokollieren
  if(!state.importLog) state.importLog=[];
  state.importLog.push({
    id:importId,
    datum:new Date().toISOString(),
    datei:importState.file?.name||'Unbekannt',
    anzahl:result.imported,
    treeIds:importedIds,
    mapping:{...mapping}
  });
  
  saveState();
  showImportResult(result);
  renderImportLog();
  renderImportTemplates();
  if(result.imported>0||result.updated>0){
    showSaveTemplateDialog();
  }
}

function getValueByMapping(row,mapping,fieldId){
  const header=mapping[fieldId];
  if(!header) return null;
  const idx=importState.headers.indexOf(header);
  return idx>=0?(row[idx]||null):null;
}

function normalizeFrucht(f){
  const lower=(f||'').toLowerCase();
  if(lower.includes('apfel')||lower.includes('apple')) return 'Apfel';
  if(lower.includes('birne')||lower.includes('pear')) return 'Birne';
  if(lower.includes('walnuss')||lower.includes('nuss')||lower.includes('walnut')) return 'Walnuss';
  if(lower.includes('zwetsch')||lower.includes('pflaume')||lower.includes('plum')) return 'Zwetschke';
  if(lower.includes('kirsch')||lower.includes('cherry')) return 'Kirsch';
  return f||'Sonstige';
}

function showImportResult(result){
  const container=document.getElementById('import-result');
  let html='<div style="text-align:center;padding:1rem;">';
  html+='<div style="font-size:2rem;margin-bottom:0.5rem;">✅</div>';
  html+='<h4 style="margin:0 0 0.5rem;">Import abgeschlossen</h4>';
  
  if(result.imported>0&&result.updated>0){
    html+='<p>'+result.imported+' neue + '+result.updated+' aktualisierte Sorten</p>';
  } else if(result.imported>0){
    html+='<p>'+result.imported+' Sorten importiert</p>';
  } else if(result.updated>0){
    html+='<p>'+result.updated+' Sorten aktualisiert (ergänzt)</p>';
  } else {
    html+='<p>Keine neuen Sorten importiert</p>';
  }
  
  if(result.errors.length>0){
    html+='<p style="color:var(--dachziegel);">'+result.errors.length+' Fehler</p>';
    html+='<ul style="text-align:left;font-size:.85rem;max-height:100px;overflow-y:auto;">';
    result.errors.slice(0,10).forEach(e=>html+='<li>'+e+'</li>');
    html+='</ul>';
  }
  html+='<button class="btn" onclick="closeImportModal()" style="margin-top:1rem;">Schließen</button>';
  html+='</div>';
  container.innerHTML=html;
  showImportStep(5);
  
  if(result.imported>0||result.updated>0){
    renderBaumTable();
    renderResults();
    renderImportLog();
  }
}

function downloadExcelTemplate(){
  const ws=XLSX.utils.aoa_to_sheet([['ID','Sorte','Obstart','Pflanzjahr','Pflückzeit','Geschmack','Eigenschaften','Verwendung'],['A1','Boskoop','Apfel','2015','Oktober','Säuerlich','Robust, lagerfähig','Tafelobst']]);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Vorlage');
  XLSX.writeFile(wb,'Obstdatenbank_Vorlage.xlsx');
}

function getImportTemplates(){
  return JSON.parse(localStorage.getItem('import_templates')||'[]');
}
function setImportTemplates(tpls){
  localStorage.setItem('import_templates',JSON.stringify(tpls));
}

function renderImportTemplates(){
  const el=document.getElementById('import-templates-list');
  if(!el) return;
  const tpls=getImportTemplates();
  if(tpls.length===0){
    el.innerHTML='<p style="font-size:.82rem;color:var(--muted);font-style:italic;">Noch keine Vorlagen. Erst eine Datei importieren und Mapping speichern.</p>';
    return;
  }
  el.innerHTML=tpls.map((t,i)=>{
    const d=new Date(t.datum);
    const datum=d.toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit',year:'2-digit'});
    const mapCount=Object.keys(t.mapping||{}).filter(k=>t.mapping[k]).length;
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem;">'+
      '<span style="flex:1;"><b>'+escHtml(t.name)+'</b> <span style="color:var(--muted);font-size:.78rem;">('+datum+' · '+mapCount+' Felder)</span></span>'+
      '<button class="btn secondary" style="padding:4px 10px;font-size:.75rem;" onclick="loadImportTemplate('+i+')">Laden</button>'+
      '<button class="btn secondary" style="padding:4px 10px;font-size:.75rem;color:var(--dachziegel);border-color:var(--dachziegel);" onclick="deleteImportTemplate('+i+')">Löschen</button>'+
    '</div>';
  }).join('');
}

function deleteImportTemplate(idx){
  const tpls=getImportTemplates();
  if(idx<0||idx>=tpls.length) return;
  if(!confirm('Vorlage "'+tpls[idx].name+'" wirklich löschen?')) return;
  tpls.splice(idx,1);
  setImportTemplates(tpls);
  renderImportTemplates();
}

function saveImportTemplate(name){
  if(!name||!name.trim()) return;
  const mapping=importState?Object.assign({},importState.mapping):{};
  const headerAliases={};
  if(importState&&importState.headers){
    Object.keys(mapping).forEach(fieldId=>{
      const header=mapping[fieldId];
      if(header) headerAliases[header]=fieldId;
    });
  }
  const template={
    name:name.trim(),
    datum:new Date().toISOString(),
    mapping:mapping,
    headerAliases:headerAliases
  };
  const tpls=getImportTemplates();
  tpls.push(template);
  setImportTemplates(tpls);
  renderImportTemplates();
}

function loadImportTemplate(idx){
  const tpls=getImportTemplates();
  if(idx<0||idx>=tpls.length) return;
  const tpl=tpls[idx];
  if(importState){
    importState.mapping=Object.assign({},tpl.mapping);
  }
  renderMappingUI();
}

function applyLastTemplateMapping(){
  const tpls=getImportTemplates();
  if(tpls.length===0||!importState) return;
  const last=tpls[tpls.length-1];
  if(last.headerAliases&&importState.headers){
    const newMapping={};
    IMPORT_FIELDS.forEach(f=>{ newMapping[f.id]=null; });
    importState.headers.forEach(h=>{
      if(last.headerAliases[h]) newMapping[last.headerAliases[h]]=h;
    });
    importState.mapping=newMapping;
  } else if(last.mapping){
    importState.mapping=Object.assign({},last.mapping);
  }
}

function showSaveTemplateDialog(){
  closeImportModal();
  const html='<button class="close" onclick="closeModal()">&times;</button>'+
    '<h2>Mapping speichern?</h2>'+
    '<p style="font-size:.88rem;color:var(--muted);margin:8px 0 16px;">Dieses Mapping als Vorlage speichern? Beim nächsten Import gleicher Datei wird die Zuordnung automatisch übernommen.</p>'+
    '<input type="text" id="tpl-name-input" placeholder="Name der Vorlage…" style="width:100%;margin-bottom:16px;" value="Meine Vorlage">'+
    '<div class="edit-actions">'+
      '<button class="btn" onclick="confirmSaveTemplate()">Speichern</button>'+
      '<button class="btn secondary" onclick="closeModal()">Nein, danke</button>'+
    '</div>';
  document.getElementById('modal-content').innerHTML=html;
  document.getElementById('overlay').classList.add('open');
  document.getElementById('tpl-name-input').focus();
}

function confirmSaveTemplate(){
  const input=document.getElementById('tpl-name-input');
  const name=input?input.value:'';
  saveImportTemplate(name);
  closeModal();
}

// ─── IMPORT MANAGEMENT ──────────────────────────────────────────────────────
function renderImportLog(){
  const container=document.getElementById('import-log-list');
  if(!container) return;
  
  if(!state.importLog||state.importLog.length===0){
    container.innerHTML='<p style="color:var(--muted);font-size:.9rem;">Noch keine Imports durchgeführt.</p>';
    updateSnapshotsInfo();
    return;
  }
  
  let html='<div class="import-log-table">';
  state.importLog.slice().reverse().forEach(entry=>{
    const datum=new Date(entry.datum).toLocaleString('de-AT');
    html+='<div class="import-log-entry" onclick="showImportDetails(\''+entry.id+'\')" style="cursor:pointer;">'+
      '<div class="import-log-info">'+
        '<strong>'+entry.datei+'</strong>'+
        '<span>'+entry.anzahl+' Bäume &middot; '+datum+'</span>'+
      '</div>'+
      '<div class="import-log-actions" onclick="event.stopPropagation();">'+
        '<button class="btn secondary" onclick="undoImport(\''+entry.id+'\')" title="Rückgängig">↩ Undo</button>'+
        '<button class="btn secondary" onclick="deleteImport(\''+entry.id+'\')" title="Import löschen">✕ Löschen</button>'+
      '</div>'+
    '</div>';
  });
  html+='</div>';
  container.innerHTML=html;
  
  updateSnapshotsInfo();
}

function showImportDetails(importId){
  const entry=state.importLog?.find(e=>e.id===importId);
  if(!entry) return;
  
  const datum=new Date(entry.datum).toLocaleString('de-AT');
  const trees=entry.treeIds?.map(id=>getTree(id)).filter(Boolean)||[];
  
  let html='<div style="max-width:500px;">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">';
  html+='<h3 style="margin:0;font-family:Georgia,serif;">Import-Details</h3>';
  html+='<button class="btn secondary" onclick="closeModal()">✕</button>';
  html+='</div>';
  
  html+='<div class="card" style="margin-bottom:1rem;">';
  html+='<p><strong>Datei:</strong> '+entry.datei+'</p>';
  html+='<p><strong>Datum:</strong> '+datum+'</p>';
  html+='<p><strong>Anzahl:</strong> '+entry.anzahl+' Bäume</p>';
  html+='</div>';
  
  if(trees.length>0){
    html+='<h4 style="margin:0 0 0.5rem;font-size:.9rem;color:var(--muted);">Importierte Bäume:</h4>';
    html+='<div style="max-height:200px;overflow-y:auto;">';
    trees.forEach(t=>{
      html+='<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.88rem;">';
      html+='<strong>'+t.id+'</strong> — '+t.sorte+' ('+t.frucht+')';
      html+='</div>';
    });
    html+='</div>';
  }
  
  html+='</div>';
  
  document.getElementById('modal-content').innerHTML=html;
  document.getElementById('overlay').classList.add('open');
}

function updateSnapshotsInfo(){
  const container=document.getElementById('import-snapshots-info');
  if(!container) return;
  
  const count=state.importSnapshots?state.importSnapshots.length:0;
  container.textContent=count>0?count+' Snapshots verfügbar (max. 5)':'Keine Snapshots vorhanden';
}

function undoImport(importId){
  if(!state.importLog||!state.importSnapshots) return;
  
  const importEntry=state.importLog.find(e=>e.id===importId);
  if(!importEntry){
    alert('Import nicht gefunden.');
    return;
  }
  
  // Finde den passenden Snapshot (hat die gleiche importId)
  const snapshot=state.importSnapshots.find(s=>s.importId===importId);
  if(!snapshot){
    alert('Kein Snapshot für diesen Import vorhanden (evtl. älter als 5 Imports).');
    return;
  }
  
  if(!confirm('Import rückgängig machen? '+importEntry.anzahl+' Bäume werden entfernt.')) return;
  
  // Snapshot wiederherstellen
  state.customTrees=snapshot.customTrees;
  state.positions=snapshot.positions;
  
  // Import aus Log entfernen
  state.importLog=state.importLog.filter(e=>e.id!==importId);
  
  saveState();
  renderImportLog();
  renderBaumTable();
  renderResults();
  alert('Import rückgängig gemacht!');
}

function deleteImport(importId){
  if(!state.importLog) return;
  
  const importEntry=state.importLog.find(e=>e.id===importId);
  if(!importEntry){
    alert('Import nicht gefunden.');
    return;
  }
  
  if(!confirm(importEntry.anzahl+' importierte Bäume löschen?')) return;
  
  // Importierte Bäume entfernen
  if(state.customTrees&&importEntry.treeIds){
    state.customTrees=state.customTrees.filter(t=>!importEntry.treeIds.includes(t.id));
  }
  
  // Ordnerte für Positions- und Edit-Einträge aufräumen
  if(importEntry.treeIds){
    importEntry.treeIds.forEach(id=>{
      if(state.positions) delete state.positions[id];
      if(state.satPositions) delete state.satPositions[id];
      if(state.baumEdits) delete state.baumEdits[id];
    });
  }
  
  // Import aus Log entfernen
  state.importLog=state.importLog.filter(e=>e.id!==importId);
  
  saveState();
  renderImportLog();
  renderBaumTable();
  renderResults();
  alert('Import gelöscht!');
}

// Dropzone Event Listener
/* ─── FEATURE 3: PREISLISTE & BESTELLLISTE ──────────────────────────────────── */

function getDefaultPreislisten() {
  return {
    arche: { name:'Arche Noah', email:'', preise:[] },
    hof: { name:'Hofsorten', email:'', preise:[] }
  };
}

function renderPreislistenAdmin() {
  if(!isAdmin()) { document.getElementById('preislisten-admin').innerHTML=''; return; }
  const pl = state.preislisten || {};
  let html = '';
  Object.entries(pl).forEach(([qid, quelle])=>{
    html += '<div style="margin-bottom:14px;padding:10px;border:1px solid var(--border);border-radius:8px;">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
    html += '<input value="'+escAttr(quelle.name||'')+'" style="font-weight:600;font-size:.9rem;border:none;border-bottom:1px solid var(--border);background:transparent;width:160px;" onchange="updateQuelleName(\''+qid+'\',this.value)">';
    html += '<input value="'+escAttr(quelle.email||'')+'" placeholder="Email" style="font-size:.8rem;border:none;border-bottom:1px solid var(--border);background:transparent;width:180px;" onchange="updateQuelleEmail(\''+qid+'\',this.value)">';
    html += '<button class="btn secondary" style="font-size:.75rem;padding:2px 8px;" onclick="openPreisImport(\''+qid+'\')">CSV importieren</button>';
    html += '<button class="btn secondary" style="font-size:.75rem;padding:2px 8px;" onclick="downloadPreisCsvTemplate()">Vorlage</button>';
    html += '<button class="btn secondary" style="font-size:.75rem;padding:2px 8px;" onclick="removePreisquelle(\''+qid+'\')">Entfernen</button>';
    html += '</div>';
    html += '<table style="width:100%;font-size:.8rem;border-collapse:collapse;">';
    html += '<tr style="color:var(--muted);font-size:.75rem;"><td style="padding:2px 4px;">Sorte</td><td style="padding:2px 4px;">Unterlage</td><td style="padding:2px 4px;">Alter</td><td style="padding:2px 4px;">Preis</td><td style="padding:2px 4px;">MWST</td><td style="padding:2px 4px;">Vorbestellbar</td><td></td></tr>';
    (quelle.preise||[]).forEach((p, i)=>{
      html += '<tr>';
      html += '<td style="padding:2px 4px;"><input value="'+escAttr(p.sorte||'')+'" style="width:120px;" onchange="updatePreisItem(\''+qid+'\','+i+',\'sorte\',this.value)"></td>';
      html += '<td style="padding:2px 4px;"><input value="'+escAttr(p.unterlage||'')+'" style="width:60px;" onchange="updatePreisItem(\''+qid+'\','+i+',\'unterlage\',this.value)"></td>';
      html += '<td style="padding:2px 4px;"><input value="'+escAttr(p.alter||'')+'" style="width:50px;" onchange="updatePreisItem(\''+qid+'\','+i+',\'alter\',this.value)"></td>';
      html += '<td style="padding:2px 4px;"><input type="number" step="0.01" min="0" value="'+(p.preis||0)+'" style="width:60px;" onchange="updatePreisItem(\''+qid+'\','+i+',\'preis\',parseFloat(this.value)||0)"></td>';
      html += '<td style="padding:2px 4px;"><span style="font-size:.78rem;color:var(--muted);">13%</span></td>';
      html += '<td style="padding:2px 4px;text-align:center;"><input type="checkbox" '+(p.vorbestellbar?'checked':'')+' onchange="updatePreisItem(\''+qid+'\','+i+',\'vorbestellbar\',this.checked)"></td>';
      html += '<td style="padding:2px 4px;"><button style="background:none;border:none;color:var(--dachziegel);cursor:pointer;font-size:.8rem;" onclick="removePreisItem(\''+qid+'\','+i+')">x</button></td>';
      html += '</tr>';
    });
    html += '</table>';
    html += '<button class="btn secondary" style="font-size:.78rem;margin-top:6px;padding:3px 10px;" onclick="addPreisItem(\''+qid+'\')">+ Preis hinzufuegen</button>';
    html += '</div>';
  });
  document.getElementById('preislisten-admin').innerHTML = html || '<p style="font-size:.85rem;color:var(--muted);">Noch keine Preislisten angelegt. Fuege eine Quelle hinzu.</p>';
}

function addPreisquelle() {
  if(!state.preislisten) state.preislisten = {};
  const qid = 'quelle_' + Date.now();
  state.preislisten[qid] = { name:'Neue Quelle', email:'', preise:[] };
  saveState();
  renderPreislistenAdmin();
  showToast('Quelle angelegt','success');
}

function removePreisquelle(qid) {
  if(!confirm('Quelle "'+(state.preislisten[qid]?.name||qid)+'" wirklich entfernen?')) return;
  delete state.preislisten[qid];
  saveState();
  renderPreislistenAdmin();
  showToast('Quelle entfernt','success');
}

function updateQuelleName(qid, val) {
  if(state.preislisten[qid]) { state.preislisten[qid].name = val; saveState(); showToast('Name gespeichert','success'); }
}

function updateQuelleEmail(qid, val) {
  if(state.preislisten[qid]) { state.preislisten[qid].email = val; saveState(); showToast('Email gespeichert','success'); }
}

function addPreisItem(qid) {
  if(!state.preislisten[qid]) return;
  state.preislisten[qid].preise.push({sorte:'',unterlage:'',alter:'',preis:0,vorbestellbar:false});
  saveState();
  renderPreislistenAdmin();
  showToast('Preis hinterlegt','success');
}

function removePreisItem(qid, idx) {
  if(!state.preislisten[qid]) return;
  state.preislisten[qid].preise.splice(idx, 1);
  saveState();
  renderPreislistenAdmin();
  showToast('Preis entfernt','success');
}

function updatePreisItem(qid, idx, field, val) {
  if(!state.preislisten[qid] || !state.preislisten[qid].preise[idx]) return;
  state.preislisten[qid].preise[idx][field] = val;
  saveState();
  showToast('Gespeichert','success');
}

function downloadPreisCsvTemplate() {
  const csv = 'Sorte,Unterlage,Alter,Preis,auf Bestellung\nBernhardiner Apfel,MM106,2-3,8.50,nein\nGoldparone,Keine,3-4,12.00,ja\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'preisliste_vorlage.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Vorlage heruntergeladen','success');
}

/* Nur noch ein dünner Aufsatz auf getFremdlieferanten() in kataster.js. Vorher
   gab es zwei Zuordnungen mit unterschiedlicher Genauigkeit — die unscharfe hier
   und eine exakte in getBestellbarkeit(). Damit konnte dieselbe Sorte auf der
   Karte einen Preis zeigen und in der Bestellbarkeit als „nicht verfügbar"
   gelten. Eine Zuordnung, ein Ergebnis. */
function getPreisFuerSorte(sorteName) {
  return getFremdlieferanten(sorteName);
}

// ─── PREISLISTEN-IMPORT ──────────────────────────────────────────────────────
let preisImportState = { qid: null, rows: [], headers: [], mapping: {}, preview: [] };

const PREIS_CSV_FIELDS = [
  {id:'sorte', label:'Sorte', required:true, autoDetect:['sorte','Sorte','name','Name','sortenname']},
  {id:'unterlage', label:'Unterlage', required:true, autoDetect:['unterlage','Unterlage','rootstock','Unterl.']},
  {id:'alter', label:'Alter', required:true, autoDetect:['veredelt','Veredelt','alter','Alter','Jahr','veredelungsjahr']},
  {id:'preis', label:'Preis inkl. MWST', required:true, autoDetect:['preis','Preis','price','Preis inkl','brutto','ep','EP','Einzelpreis']},
  {id:'vorbestellbar', label:'auf Bestellung', required:true, autoDetect:['vorbestellbar','Vorbestellung','pre-order','nur vorbestellung','vorbestellbar?','auf Bestellung','auf bestellung']},
  {id:'mwst', label:'MWST Satz (%)', required:false, autoDetect:['mwst','MWSt','USt','ust','steuersatz','mehrwertsteuer','tax','vat']}
];

function openPreisImport(qid) {
  preisImportState = { qid, rows: [], headers: [], mapping: {}, preview: [] };
  const html = `
    <button class="close" onclick="closeModal()">&times;</button>
    <h2 style="font-family:var(--font-heading);color:var(--dark);margin:0 0 12px;">Preisliste importieren</h2>
    <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px;">Quelle: <b>${(state.preislisten[qid]?.name||qid)}</b></p>
    <div id="preis-import-step1">
      <p style="font-size:.85rem;font-weight:600;margin-bottom:6px;">CSV-Datei wählen:</p>
      <input type="file" id="preis-import-file" accept=".csv,.tsv,.xlsx,.xls,.txt" onchange="handlePreisImportFile(this.files[0])" style="font-size:.85rem;width:100%;">
      <p style="font-size:.78rem;color:var(--muted);margin:8px 0 14px;">Format: Sorte,Unterlage,Alter,Preis,auf Bestellung</p>
      <p style="font-size:.85rem;font-weight:600;margin-bottom:6px;">Oder CSV-Text einfügen:</p>
      <textarea id="preis-import-paste" rows="6" placeholder="Sorte,Unterlage,Alter,Preis,auf Bestellung&#10;Berner Rosen Apfel,MM106,2-3,8.50,nein&#10;Goldparone,Keine,3-4,12.00,ja" style="width:100%;font-size:.82rem;font-family:monospace;padding:8px;border:1px solid var(--border);border-radius:6px;resize:vertical;"></textarea>
      <button class="btn" style="margin-top:8px;" onclick="handlePreisImportText()">Text einlesen</button>
    </div>
    <div id="preis-import-step2" style="display:none;"></div>
    <div id="preis-import-step3" style="display:none;"></div>
  `;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
}

function handlePreisImportText(){
  const text = (document.getElementById('preis-import-paste')||{}).value||'';
  if(!text.trim()){ showToast('Bitte CSV-Text einfügen.','error'); return; }
  parsePreisCsvText(text);
}

function parsePreisCsvText(text){
  text = text.replace(/^\ufeff/,'');
  const delimiters = [';', ',', '\t'];
  let bestData = null, bestCols = 0;
  for(const delim of delimiters){
    const data = parseCSV(text, delim);
    if(data.length >= 2 && data[0].length > bestCols){
      bestData = data;
      bestCols = data[0].length;
    }
    if(bestCols >= 4) break;
  }
  if(!bestData || bestData.length < 2 || bestCols < 2){
    showToast('CSV konnte nicht gelesen werden ('+bestCols+' Spalten erkannt).','error');
    return;
  }
  preisImportState.headers = bestData[0].map(h=>h.replace(/^\ufeff/,'').trim());
  preisImportState.rows = bestData.slice(1).filter(r=>r.some(v=>v));
  detectPreisMapping();
}

function handlePreisImportFile(file) {
  if(!file) return;
  const name = file.name.toLowerCase();
  if(name.endsWith('.xlsx') || name.endsWith('.xls')){
    if(typeof XLSX === 'undefined'){ alert('Excel-Bibliothek nicht geladen. Bitte Internetverbindung prüfen.'); return; }
    const reader = new FileReader();
    reader.onload = function(e){
      try {
        const wb = XLSX.read(e.target.result, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, {header:1});
        if(data.length < 2){ showToast('Die Datei enthält keine Daten.','error'); return; }
        preisImportState.headers = data[0].map(h=>String(h||'').trim().replace(/^\ufeff/,''));
        preisImportState.rows = data.slice(1).filter(r=>r.some(v=>v));
        detectPreisMapping();
      } catch(err){ showToast('Fehler: '+err.message,'error'); }
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = function(e){
      parsePreisCsvText(e.target.result);
    };
    reader.readAsText(file);
  }
}

function detectPreisMapping() {
  preisImportState.mapping = {};
  const headers = preisImportState.headers.map(h=>h.toLowerCase().trim());
  const usedCols = new Set();
  PREIS_CSV_FIELDS.forEach(field => {
    const found = field.autoDetect.find(ad => headers.includes(ad.toLowerCase()));
    if(found){
      const idx = headers.indexOf(found.toLowerCase());
      preisImportState.mapping[field.id] = preisImportState.headers[idx];
      usedCols.add(idx);
    }
  });
  const rows = preisImportState.rows.slice(0, 5);
  PREIS_CSV_FIELDS.forEach(field => {
    if(preisImportState.mapping[field.id]) return;
    let bestIdx = -1, bestScore = 0;
    preisImportState.headers.forEach((h, idx) => {
      if(usedCols.has(idx)) return;
      let score = 0;
      const sampleVals = rows.map(r => String(r[idx]||'').trim()).filter(v => v);
      if(!sampleVals.length) return;
      if(field.id === 'sorte'){
        const hasText = sampleVals.filter(v => /^[A-ZÄÖÜ]/.test(v)).length;
        const hasObst = sampleVals.filter(v => /apfel|birne|zwetsch|kirsch|marille|quitte|pflaum|nuss|walnuss|sonne|pepping|rosen|gold/i.test(v)).length;
        const noPrice = sampleVals.filter(v => !/[€$]/.test(v) && !/^\d+[.,]\d{2}$/.test(v)).length;
        score = (hasText * 3) + (hasObst * 5) + (noPrice * 2);
      } else if(field.id === 'preis'){
        const hasDecimal = sampleVals.filter(v => /^\d+[.,]\d{1,2}$/.test(v.replace(/[€$\s]/g,''))).length;
        const hasEuro = sampleVals.filter(v => /[€$]/.test(v)).length;
        score = (hasDecimal * 5) + (hasEuro * 3);
      } else if(field.id === 'unterlage'){
        const hasCode = sampleVals.filter(v => /^(MM|Bf|A|B|C|Keine|OHNE|\d)/i.test(v) && v.length < 15).length;
        score = hasCode * 5;
      } else if(field.id === 'alter'){
        const hasRange = sampleVals.filter(v => /^\d+[\s-]+\d+$/.test(v) || /^\d+$/.test(v)).length;
        score = hasRange * 5;
      } else if(field.id === 'mwst'){
        const hasPercent = sampleVals.filter(v => /^\d{1,2}$/.test(v.replace('%','').trim()) && parseInt(v) <= 30).length;
        score = hasPercent * 5;
      } else if(field.id === 'vorbestellbar'){
        const isBool = sampleVals.every(v => /^(ja|nein|true|false|0|1|x|yes|no)$/i.test(v));
        score = isBool ? 5 : 0;
      }
      if(score > bestScore){ bestScore = score; bestIdx = idx; }
    });
    if(bestIdx >= 0 && bestScore >= 5){
      preisImportState.mapping[field.id] = preisImportState.headers[bestIdx];
      usedCols.add(bestIdx);
    }
  });
  renderPreisMappingUI();
}

function renderPreisMappingUI() {
  const s = preisImportState;
  let html = '<p style="font-size:.85rem;margin-bottom:4px;"><b>'+s.rows.length+'</b> Zeilen, <b>'+s.headers.length+'</b> Spalten erkannt: <span style="color:var(--gruen);">'+s.headers.join(', ')+'</span></p>';
  const allRequired = PREIS_CSV_FIELDS.filter(f=>f.required).every(f=>s.mapping[f.id]);
  if(allRequired){
    html += '<p style="font-size:.8rem;color:var(--gruen);margin-bottom:8px;">✓ Alle Pflichtspalten zugeordnet. Du kannst direkt importieren oder unten die Zuordnung prüfen.</p>';
  } else {
    html += '<p style="font-size:.82rem;margin-bottom:8px;">Spalten zuordnen (Pflichtfelder mit *):</p>';
  }
  PREIS_CSV_FIELDS.forEach(field => {
    html += '<div style="margin-bottom:8px;">';
    html += '<div style="font-weight:600;font-size:.82rem;margin-bottom:2px;">'+field.label+(field.required?' *':'')+'</div>';
    html += '<select id="pim-'+field.id+'" style="font-size:.9rem;padding:8px 10px;border:1px solid var(--border);border-radius:6px;width:100%;min-height:44px;">';
    html += '<option value="">— nicht importieren —</option>';
    s.headers.forEach(h => {
      const sel = s.mapping[field.id] === h ? 'selected' : '';
      html += '<option value="'+h.replace(/"/g,'&quot;')+'" '+sel+'>'+h+'</option>';
    });
    html += '</select></div>';
  });
  html += '<div style="display:flex;gap:8px;margin-top:12px;">';
  html += '<button class="btn secondary" onclick="previewPreisImport()">Vorschau</button>';
  if(allRequired){
    html += '<button class="btn" onclick="executePreisImport()">Direkt importieren</button>';
  }
  html += '</div>';
  document.getElementById('preis-import-step2').innerHTML = html;
  document.getElementById('preis-import-step2').style.display = '';
}

function getPreisColVal(row, fieldId) {
  const s = preisImportState;
  const colName = s.mapping[fieldId];
  if(!colName) return '';
  const idx = s.headers.indexOf(colName);
  if(idx < 0) return '';
  return String(row[idx]||'').trim();
}

function parsePreisValue(val) {
  if(!val) return 0;
  val = String(val).replace(/[€EUR\s]/g,'').replace(',','.').trim();
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function parseMwstValue(val) {
  if(!val) return 13;
  const n = parseFloat(String(val).replace('%','').replace(',','.').trim());
  return isNaN(n) ? 13 : Math.round(n);
}

function parseVorbestellbar(val) {
  if(!val) return false;
  const v = String(val).toLowerCase().trim();
  return v === 'ja' || v === 'yes' || v === 'true' || v === '1' || v === 'x';
}

function fuzzyMatchSorte(csvSorte, csvUnterlage) {
  if(!csvSorte) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9äöüß]/g,'');
  const csvNorm = norm(csvSorte);
  const allSorten = getAllSorten();
  let best = null, bestDist = Infinity;
  for(const s of allSorten){
    const sName = s.name || s.sorte || '';
    if(norm(sName) === csvNorm){
      if(csvUnterlage && s.unterlage && norm(s.unterlage) === norm(csvUnterlage)) return { name: sName, exact: true };
      if(!best || bestDist > 0) { best = { name: sName, exact: true }; bestDist = 0; }
    }
  }
  if(best) return best;
  for(const s of allSorten){
    const sName = s.name || s.sorte || '';
    const dist = levenshtein(csvNorm, norm(sName));
    if(dist <= 2 && dist < bestDist){ bestDist = dist; best = { name: sName, exact: false, dist }; }
  }
  return best;
}

function previewPreisImport() {
  PREIS_CSV_FIELDS.forEach(field => {
    const sel = document.getElementById('pim-'+field.id);
    if(sel) preisImportState.mapping[field.id] = sel.value || '';
  });
  if(!preisImportState.mapping.sorte){ alert('Bitte die Spalte "Sorte" zuordnen.'); return; }
  if(!preisImportState.mapping.preis){ alert('Bitte die Spalte "Preis" zuordnen.'); return; }

  const preview = preisImportState.rows.slice(0, 20).map(row => {
    const sorte = getPreisColVal(row, 'sorte');
    const unterlage = getPreisColVal(row, 'unterlage');
    const alter = getPreisColVal(row, 'alter');
    const preis = parsePreisValue(getPreisColVal(row, 'preis'));
    const mwst = parseMwstValue(getPreisColVal(row, 'mwst'));
    const vorbestellbar = parseVorbestellbar(getPreisColVal(row, 'vorbestellbar'));
    const match = fuzzyMatchSorte(sorte, unterlage);
    return { sorte, unterlage, alter, preis, mwst, vorbestellbar, match };
  });
  preisImportState.preview = preview;

  let html = '<p style="font-size:.85rem;margin-bottom:8px;"><b>'+preisImportState.rows.length+'</b> Zeilen gefunden. Vorschau (erste '+preview.length+'):</p>';
  html += '<div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;">';
  html += '<table style="width:100%;font-size:.78rem;border-collapse:collapse;">';
  html += '<tr style="background:var(--gruen-hell);position:sticky;top:0;"><td style="padding:4px 6px;font-weight:600;">Sorte (CSV)</td><td style="padding:4px 6px;">Unterl.</td><td style="padding:4px 6px;">Preis</td><td style="padding:4px 6px;">MWST</td><td style="padding:4px 6px;">Vorbest.</td><td style="padding:4px 6px;">Match</td></tr>';
  preview.forEach(r => {
    const matchColor = r.match ? (r.match.exact ? 'var(--gruen)' : 'var(--waldrand)') : 'var(--dachziegel)';
    const matchText = r.match ? (r.match.exact ? '✓ '+r.match.name : '~ '+r.match.name+' ('+r.match.dist+')') : '⚠ nicht zugeordnet';
    html += '<tr style="border-top:1px solid var(--border);">';
    html += '<td style="padding:3px 6px;">'+r.sorte+'</td>';
    html += '<td style="padding:3px 6px;">'+r.unterlage+'</td>';
    html += '<td style="padding:3px 6px;">'+r.preis.toFixed(2)+' EUR</td>';
    html += '<td style="padding:3px 6px;">'+r.mwst+'%</td>';
    html += '<td style="padding:3px 6px;">'+(r.vorbestellbar?'Ja':'Nein')+'</td>';
    html += '<td style="padding:3px 6px;color:'+matchColor+';font-weight:600;">'+matchText+'</td>';
    html += '</tr>';
  });
  html += '</table></div>';

  const unmatched = preview.filter(r=>!r.match).length;
  if(unmatched > 0) html += '<p style="font-size:.8rem;color:var(--dachziegel);margin-top:6px;">⚠ '+unmatched+' Zeile(n) konnten keiner Sorte zugeordnet werden.</p>';

  html += '<div style="display:flex;gap:8px;margin-top:12px;">';
  html += '<button class="btn" onclick="executePreisImport()">Import ausführen (ersetzt alle Preise)</button>';
  html += '<button class="btn secondary" onclick="openPreisImport(\''+preisImportState.qid+'\')">Zurück</button>';
  html += '</div>';

  document.getElementById('preis-import-step3').innerHTML = html;
  document.getElementById('preis-import-step3').style.display = '';
}

function executePreisImport() {
  PREIS_CSV_FIELDS.forEach(field => {
    const sel = document.getElementById('pim-'+field.id);
    if(sel) preisImportState.mapping[field.id] = sel.value || '';
  });
  if(!preisImportState.mapping.sorte){ showToast('Bitte Spalte "Sorte" zuordnen.','error'); return; }
  if(!preisImportState.mapping.preis){ showToast('Bitte Spalte "Preis" zuordnen.','error'); return; }
  const qid = preisImportState.qid;
  if(!state.preislisten[qid]) return;
  const neuePreise = preisImportState.rows.map(row => {
    const sorte = getPreisColVal(row, 'sorte');
    const unterlage = getPreisColVal(row, 'unterlage');
    const alter = getPreisColVal(row, 'alter');
    const preis = parsePreisValue(getPreisColVal(row, 'preis'));
    const mwst = parseMwstValue(getPreisColVal(row, 'mwst'));
    const vorbestellbar = parseVorbestellbar(getPreisColVal(row, 'vorbestellbar'));
    const match = fuzzyMatchSorte(sorte, unterlage);
    return {
      sorte: match ? match.name : sorte,
      unterlage: unterlage,
      alter: alter,
      preis: preis,
      mwst_satz: mwst,
      vorbestellbar: vorbestellbar
    };
  }).filter(p => p.sorte && p.preis > 0);

  state.preislisten[qid].preise = neuePreise;
  saveState();
  closeModal();
  renderPreislistenAdmin();
  showToast(neuePreise.length+' Preise importiert','success');
}

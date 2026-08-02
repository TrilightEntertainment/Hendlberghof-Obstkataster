#!/usr/bin/env python3
"""
Katalog-Rueckweg: Aenderungen aus der App (Firestore) zurueck in data/*.json.

Hintergrund
-----------
Die App fuehrt zwei Quellen zusammen:
  data/*.json        versionierter Katalog (Git)      <- die eigentliche Wahrheit
  Firestore-state    customTrees / baumEdits / sortenEdits  <- Overlays aus der App

Overlays gewinnen zur Laufzeit. Werden sie nie zurueckgeschrieben, driften beide
Staende auseinander: eine Korrektur im JSON bleibt wirkungslos, weil das Overlay
sie ueberdeckt. Dieses Werkzeug loest das auf.

Ablauf
------
  1. ohne Argumente: zeigt nur an, was uebernommen wuerde (nichts wird geaendert)
  2. mit --anwenden:  schreibt die Aenderungen in data/*.json
  3. danach: Aenderungen pruefen, committen, pushen
  4. zuletzt die uebernommenen Overlays in der App loeschen
     (Daten & Sicherung -> Overlays aufraeumen), sonst ueberdecken sie weiter.

Aufruf:
  python3 tools/katalog_rueckweg.py                 # Vorschau
  python3 tools/katalog_rueckweg.py --anwenden      # schreiben
"""

import argparse, json, os, shutil, sys, urllib.request
from datetime import datetime

FIRESTORE_URL = ("https://firestore.googleapis.com/v1/projects/hendlberghof"
                 "/databases/(default)/documents/app_state/main")


def entpacke(v):
    if "stringValue" in v:   return v["stringValue"]
    if "integerValue" in v:  return int(v["integerValue"])
    if "doubleValue" in v:   return float(v["doubleValue"])
    if "booleanValue" in v:  return v["booleanValue"]
    if "nullValue" in v:     return None
    if "mapValue" in v:
        return {k: entpacke(x) for k, x in v["mapValue"].get("fields", {}).items()}
    if "arrayValue" in v:
        return [entpacke(x) for x in v["arrayValue"].get("values", [])]
    return None


def main():
    ap = argparse.ArgumentParser(description="App-Aenderungen zurueck in den Katalog")
    ap.add_argument("--daten", default="data", help="Ordner mit den Katalog-JSONs")
    ap.add_argument("--anwenden", action="store_true",
                    help="Aenderungen wirklich schreiben (sonst nur Vorschau)")
    a = ap.parse_args()

    with urllib.request.urlopen(FIRESTORE_URL, timeout=60) as r:
        doc = json.load(r)
    state = {k: entpacke(v) for k, v in doc.get("fields", {}).items()}

    baum_pfad   = os.path.join(a.daten, "baum_data.json")
    sorten_pfad = os.path.join(a.daten, "sorten_data.json")
    baeume = json.load(open(baum_pfad, encoding="utf-8"))
    sorten = json.load(open(sorten_pfad, encoding="utf-8"))
    b_index = {b["id"]: b for b in baeume}
    s_index = {s["sorte"]: s for s in sorten}

    aktionen = []
    edits = state.get("baumEdits") or {}

    # Alle Aenderungen werden immer im Speicher ausgefuehrt, geschrieben wird nur
    # mit --anwenden. Nur so zeigt die Vorschau wirklich das Ergebnis: frueher kam
    # ein neuer Baum erst im Schreibmodus in b_index, weshalb die Vorschau seine
    # baumEdits stillschweigend uebersprang.

    # --- 1. In der App angelegte Baeume (customTrees) --------------------------
    # Ein baumEdit kann die ID aendern (z.B. NEU-1 -> W20). Massgeblich ist die
    # ID, unter der die App den Baum fuehrt - sonst legt ein zweiter Lauf ihn
    # erneut an, weil die urspruengliche ID nie im Katalog auftaucht.
    for c in (state.get("customTrees") or []):
        cid = c.get("id", "")
        if not cid:
            continue
        wirk_id = (edits.get(cid) or {}).get("id") or cid
        if cid in b_index or wirk_id in b_index:
            continue
        hinweis = "" if wirk_id == cid else f"(heisst in der App {wirk_id})"
        aktionen.append(("neuer Baum", cid, c.get("sorte", ""), hinweis))
        neu = {k: v for k, v in c.items() if k not in ("sukzession", "ernten")}
        neu.setdefault("position", None)
        baeume.append(neu)
        b_index[cid] = neu

    # --- 2. Feldaenderungen an Katalog-Baeumen (baumEdits) ---------------------
    for bid, edit in edits.items():
        ziel = b_index.get(bid)
        if not ziel:
            # Baum wurde bereits unter seiner geaenderten ID uebernommen
            wirk_id = (edit or {}).get("id")
            ziel = b_index.get(wirk_id) if wirk_id else None
        if not ziel:
            aktionen.append(("Baum fehlt im Katalog", bid, "", "uebersprungen"))
            continue
        for feld, wert in (edit or {}).items():
            alt = ziel.get(feld, "")
            if str(alt) != str(wert):
                warn = "  <-- ID-Aenderung!" if feld == "id" else ""
                aktionen.append(("Baumfeld", bid, f"{feld}: {alt or '(leer)'} -> {wert}", warn))
                ziel[feld] = wert

    # --- 3. Sortenaenderungen (sortenEdits) -----------------------------------
    for name, edit in (state.get("sortenEdits") or {}).items():
        ziel = s_index.get(name)
        if not ziel:
            aktionen.append(("Sorte fehlt im Katalog", name, "", "uebersprungen"))
            continue
        for feld, wert in (edit or {}).items():
            alt = ziel.get(feld, "")
            if json.dumps(alt, ensure_ascii=False, sort_keys=True) != \
               json.dumps(wert, ensure_ascii=False, sort_keys=True):
                kurz = json.dumps(wert, ensure_ascii=False)[:50]
                aktionen.append(("Sortenfeld", name, f"{feld} -> {kurz}", ""))
                ziel[feld] = wert

    # --- Ausgabe --------------------------------------------------------------
    if not aktionen:
        print("Katalog und App sind deckungsgleich – nichts zu uebernehmen.")
        return 0

    print(f"{len(aktionen)} Abweichung(en) gefunden:\n")
    for art, schluessel, detail, hinweis in aktionen:
        print(f"  [{art}] {schluessel}  {detail} {hinweis}".rstrip())

    if not a.anwenden:
        print("\nVorschau – es wurde nichts geaendert.")
        print("Zum Uebernehmen:  python3 tools/katalog_rueckweg.py --anwenden")
        return 0

    stempel = datetime.now().strftime("%Y%m%d-%H%M%S")
    for pfad, daten in ((baum_pfad, baeume), (sorten_pfad, sorten)):
        shutil.copy(pfad, f"{pfad}.{stempel}.bak")
        with open(pfad, "w", encoding="utf-8") as f:
            json.dump(daten, f, ensure_ascii=False)

    print(f"\nGeschrieben. Sicherungskopien: *.{stempel}.bak")
    print("Naechste Schritte:")
    print("  1. git diff data/   – Aenderungen pruefen")
    print("  2. committen und pushen")
    print("  3. In der App die uebernommenen Overlays loeschen,")
    print("     sonst ueberdecken sie den Katalog weiterhin.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

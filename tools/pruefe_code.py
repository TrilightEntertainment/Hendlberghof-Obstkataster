#!/usr/bin/env python3
"""
Pflichtpruefung vor jedem Commit (siehe AGENTS.md).

Prueft drei Dinge:

  1. Klammerbilanz  {} () []  je Datei - muss exakt aufgehen.
     Grob, aber wirksam: Der Ausfall v68 war ein einzelnes zusaetzliches '}',
     das den kompletten Script-Block am Parsen hinderte und die App auch live
     lahmlegte. Eine Ungleichheit haette das vorher gezeigt.

  2. Zeichenketten-Verkettung alten Stils ('...'+x+'...') darf nicht zunehmen.
     Das ist die Umsetzung von F2 aus Abschnitt 11.2 des Plans: Bestehender
     Code wird nicht umgeschrieben, neuer aber mit Template-Literals (Backticks)
     gebaut. Eine reine Konvention im Dokument wird beim naechsten Mal
     uebersehen - deshalb der Sperrklinken-Vergleich gegen einen Basiswert.
     Sinkt der Wert, ist das gut; steigt er, ist neuer Code im alten Stil
     entstanden.

  3. Zeilen mit ungerader Zahl unmaskierter ' - moegliche nicht geschlossene
     Zeichenkette. Nur Hinweis, kein Fehler: Apostrophe in Texten ("So
     funktioniert's") loesen ihn berechtigt aus.

Aufruf:
  python3 tools/pruefe_code.py              # pruefen (Rueckgabe 1 bei Fehler)
  python3 tools/pruefe_code.py --basis      # aktuelle Werte als Basis sichern
  python3 tools/pruefe_code.py datei.html   # bestimmte Dateien pruefen
"""

import glob, json, os, re, sys

HIER = os.path.dirname(os.path.abspath(__file__))
WURZEL = os.path.dirname(HIER)
BASIS_DATEI = os.path.join(HIER, "pruefe_basis.json")


def standarddateien():
    dateien = [os.path.join(WURZEL, "index.html")]
    dateien += sorted(glob.glob(os.path.join(WURZEL, "js", "*.js")))
    return [d for d in dateien if os.path.exists(d)]


def verkettungen(text):
    return len(re.findall(r"'\s*\+", text)) + len(re.findall(r"\+\s*'", text))


def ungerade_anfuehrung(text):
    treffer = []
    for nr, zeile in enumerate(text.split("\n"), 1):
        if zeile.replace("\\'", "").count("'") % 2 == 1:
            treffer.append((nr, zeile.strip()[:90]))
    return treffer


def main():
    argumente = [a for a in sys.argv[1:] if not a.startswith("--")]
    basis_schreiben = "--basis" in sys.argv
    dateien = argumente or standarddateien()
    if not dateien:
        print("Keine Dateien gefunden.")
        return 1

    fehler = []
    gesamt_verkettungen = 0
    hinweise = []

    print("Geprueft:")
    for pfad in dateien:
        text = open(pfad, encoding="utf-8").read()
        kurz = os.path.relpath(pfad, WURZEL)

        teile = []
        for auf, zu in (("{", "}"), ("(", ")"), ("[", "]")):
            a, z = text.count(auf), text.count(zu)
            teile.append("%s%s %d/%d" % (auf, zu, a, z))
            if a != z:
                fehler.append("%s: %s%s unausgeglichen - %d zu %d"
                              % (kurz, auf, zu, a, z))
        v = verkettungen(text)
        gesamt_verkettungen += v
        hinweise += [(kurz, nr, z) for nr, z in ungerade_anfuehrung(text)]
        print("  %-28s %s | Verkettungen %d" % (kurz, "  ".join(teile), v))

    # Versionsstempel: index.html, sw.js und die Precache-Liste muessen dieselbe
    # Nummer nennen. Seit der Dateitrennung (F6) speichert der Browser die
    # js-Dateien unabhaengig von index.html zwischen - ohne Stempel bekaeme ein
    # Besucher neues Markup mit altem Code. Faellt beim Testen kaum auf, weil der
    # eigene Browser die Dateien gerade frisch geholt hat.
    idx = os.path.join(WURZEL, "index.html")
    sw = os.path.join(WURZEL, "sw.js")
    if os.path.exists(idx) and os.path.exists(sw):
        t_idx, t_sw = open(idx, encoding="utf-8").read(), open(sw, encoding="utf-8").read()
        stempel = set(re.findall(r'src="js/[a-z]+\.js\?v=(\d+)"', t_idx))
        cache = re.search(r"CACHE_NAME\s*=\s*'hendlberghof-v(\d+)'", t_sw)
        pre = set(re.findall(r"'\./js/[a-z]+\.js\?v=(\d+)'", t_sw))
        if len(stempel) > 1:
            fehler.append("index.html nennt mehrere Versionsstempel: %s" % ", ".join(sorted(stempel)))
        elif not stempel:
            fehler.append("index.html: js-Verweise ohne ?v=<nummer> - der Browser "
                          "liefert sonst alten Code zu neuem Markup")
        elif cache and stempel != {cache.group(1)}:
            fehler.append("Versionsstempel %s in index.html passt nicht zu "
                          "CACHE_NAME v%s in sw.js" % (stempel.pop(), cache.group(1)))
        elif pre and pre != stempel:
            fehler.append("Precache-Liste in sw.js nennt Stempel %s, index.html %s"
                          % (", ".join(sorted(pre)), ", ".join(sorted(stempel))))
        else:
            print("Versionsstempel stimmig: v%s in index.html, sw.js und Precache-Liste."
                  % (cache.group(1) if cache else "?"))

    basis = {}
    if os.path.exists(BASIS_DATEI):
        basis = json.load(open(BASIS_DATEI, encoding="utf-8"))
    alt = basis.get("verkettungen")

    if basis_schreiben:
        json.dump({"verkettungen": gesamt_verkettungen}, open(BASIS_DATEI, "w"),
                  indent=1)
        print("\nBasiswert gesetzt: %d Verkettungen." % gesamt_verkettungen)
        return 0

    print()
    if alt is None:
        print("Kein Basiswert vorhanden. Mit --basis anlegen.")
    elif gesamt_verkettungen > alt:
        fehler.append("Verkettungen alten Stils gestiegen: %d -> %d. Neue UI "
                      "bitte mit Template-Literals (Backticks) bauen; siehe F2."
                      % (alt, gesamt_verkettungen))
    elif gesamt_verkettungen < alt:
        print("Verkettungen gesunken: %d -> %d. Basiswert mit --basis nachziehen."
              % (alt, gesamt_verkettungen))
    else:
        print("Verkettungen unveraendert bei %d." % gesamt_verkettungen)

    if hinweise:
        print("\nHinweis - ungerade Zahl einfacher Anfuehrungszeichen (%d):"
              % len(hinweise))
        for kurz, nr, z in hinweise[:8]:
            print("  %s:%d  %s" % (kurz, nr, z))
        print("  Meist harmlos (Apostroph im Text). Nur pruefen, wenn dort "
              "gerade gearbeitet wurde.")

    if fehler:
        print("\nFEHLER:")
        for f in fehler:
            print("  - " + f)
        print("\nNicht committen, bevor das behoben ist.")
        return 1

    print("\nIn Ordnung. Jetzt noch die Seite im Browser mit Cache-Buster laden "
          "(?v=<Zeitstempel>) und pruefen:")
    print("  kein Start-Alert, window.__dataReady === true, Konsole leer, "
          "ein Baum-Modal oeffnet.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

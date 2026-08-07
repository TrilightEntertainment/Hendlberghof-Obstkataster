#!/usr/bin/env python3
"""
Uebergabepaket schnueren.

Sammelt alles, was jemand braucht, der dieses Projekt uebernimmt: den
erhobenen Ist-Stand, die Planungsunterlagen, den Katalog, den Live-Stand aus
Firestore und die Werkzeuge. Ergebnis ist ein datierter Ordner plus ZIP in der
privaten Ablage, gespiegelt nach iCloud.

Warum ein eigenes Werkzeug und nicht das Monatsbackup: Das Backup sichert
Daten. Eine Uebergabe muss zusaetzlich erklaeren - Entscheidungen, Fallen,
Zugaenge, offene Punkte. Der erklaerende Teil steht in UEBERGABE.md und wird
gepflegt; der Zahlenteil (STAND.md) wird bei jedem Lauf frisch erhoben, damit
er nicht veraltet.

BEWUSST NICHT IM REPO: Das Paket enthaelt Betriebsinterna, eine
Sicherheitsnotiz zur Website und rechtliche Einschaetzungen. Das Repo ist
oeffentlich. Nur dieses Skript liegt dort - es enthaelt keine Inhalte.

Aufruf:
  python3 tools/uebergabe.py
  python3 tools/uebergabe.py --ziel ~/woanders
  python3 tools/uebergabe.py --ohne-medien   # ohne PDFs und Lageplanbild
"""

import argparse, collections, json, os, re, shutil, subprocess, sys, urllib.request
from datetime import datetime

FIRESTORE = ("https://firestore.googleapis.com/v1/projects/hendlberghof"
             "/databases/(default)/documents/app_state/main")

HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HIER)
PROJEKT = os.path.dirname(REPO)


def sh(*args, cwd=None):
    try:
        return subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                              timeout=30).stdout.strip()
    except Exception:
        return ""


def firestore_felder():
    """Nur die Feldnamen, nicht die Inhalte: Fuer den Stand genuegt zu wissen,
    was dort liegt - und app_state/bestellungen ist ohnehin gesperrt."""
    try:
        with urllib.request.urlopen(FIRESTORE, timeout=30) as r:
            return sorted(json.load(r).get("fields", {}).keys())
    except Exception as e:
        return [f"(nicht abrufbar: {e})"]


def stand_erheben():
    z = []
    z.append("# Stand — automatisch erhoben\n")
    z.append(f"Erzeugt am {datetime.now().strftime('%d.%m.%Y %H:%M')} "
             "durch `tools/uebergabe.py`.\n")
    z.append("Dieser Teil wird bei jeder Übergabe neu gemessen. Die Einordnung "
             "steht in `UEBERGABE.md`.\n")

    # --- Daten
    z.append("\n## Katalog\n")
    try:
        b = json.load(open(os.path.join(REPO, "data", "baum_data.json"), encoding="utf-8"))
        s = json.load(open(os.path.join(REPO, "data", "sorten_data.json"), encoding="utf-8"))
        z.append(f"- **{len(b)} Bäume**, **{len(s)} Sorten**")
        arten = collections.Counter(x.get("frucht", "?") for x in b)
        z.append("- Obstarten: " + ", ".join(f"{k} {v}" for k, v in arten.most_common()))
        verm = collections.Counter(x.get("vermehrung", "nicht gesetzt") for x in s)
        z.append("- Vermehrungsrecht: " + ", ".join(f"{k} {v}" for k, v in verm.most_common()))
        ohne = [x["sorte"] for x in s if not x.get("pflueckzeitpunkt")
                and not x.get("pflueck_reifezeit")]
        if ohne:
            z.append(f"- ohne Pflückzeit: {len(ohne)} ({', '.join(ohne[:4])}…)")
    except Exception as e:
        z.append(f"- Katalog nicht lesbar: {e}")

    # --- Code
    z.append("\n## Code\n")
    js = os.path.join(PROJEKT, "files", "js")
    if os.path.isdir(js):
        gesamt = 0
        for n in sorted(os.listdir(js)):
            if not n.endswith(".js"):
                continue
            zeilen = len(open(os.path.join(js, n), encoding="utf-8").read().split("\n"))
            gesamt += zeilen
            z.append(f"- `js/{n}` — {zeilen} Zeilen")
        z.append(f"- **zusammen {gesamt} Zeilen** in {len(os.listdir(js))} Dateien")
    try:
        sw = open(os.path.join(REPO, "sw.js"), encoding="utf-8").read()
        m = re.search(r"hendlberghof-v(\d+)", sw)
        if m:
            z.append(f"- Service Worker **v{m.group(1)}**")
    except Exception:
        pass
    basis = os.path.join(HIER, "pruefe_basis.json")
    if os.path.exists(basis):
        z.append(f"- Verkettungen alten Stils (Sperrklinke): "
                 f"{json.load(open(basis)).get('verkettungen')}")

    # --- Git
    z.append("\n## Git\n")
    z.append(f"- letzter Commit: `{sh('git', 'log', '--oneline', '-1', cwd=REPO)}`")
    z.append(f"- Commits gesamt: {sh('git', 'rev-list', '--count', 'HEAD', cwd=REPO)}")
    marken = sh("git", "tag", cwd=REPO)
    z.append(f"- Marken: {marken.replace(chr(10), ', ') if marken else 'keine'}")
    offen = sh("git", "status", "--short", cwd=REPO)
    z.append(f"- Arbeitsbaum: {'sauber' if not offen else 'ÄNDERUNGEN OFFEN'}")

    # --- Firestore
    z.append("\n## Firestore\n")
    felder = firestore_felder()
    z.append(f"- `app_state/main` ohne Anmeldung lesbar, Felder: {', '.join(felder)}")
    z.append("- `bestellungen` darin enthalten: "
             + ("**JA — das wäre ein Datenschutzproblem**" if "bestellungen" in felder
                else "nein (seit 3.8.2026 in eigenem, gesperrtem Dokument)"))

    # --- Website
    theme = os.path.join(PROJEKT, "website-theme")
    z.append("\n## Website-Umbau (A5)\n")
    if os.path.isdir(theme):
        for wurzel, _, dateien in os.walk(theme):
            for n in sorted(dateien):
                if n == ".DS_Store":
                    continue
                p = os.path.join(wurzel, n)
                rel = os.path.relpath(p, theme)
                z.append(f"- `{rel}` — {os.path.getsize(p)//1024 or 1} KB")
        z.append("- liegt **ausserhalb des Repos** — nur im Übergabepaket gesichert")
    else:
        z.append("- kein `website-theme/` vorhanden")

    # --- Plan
    plan = os.path.join(PROJEKT, "PLAN_SHOP_MERKLISTE.md")
    if os.path.exists(plan):
        t = open(plan, encoding="utf-8").read()
        z.append("\n## Umsetzungsplan\n")
        erledigt = len(re.findall(r"\[x\]", t))
        offen = len(re.findall(r"\[ \]", t))
        z.append(f"- erledigt: {erledigt} · offen: {offen}")
        offen_zeilen = [l.strip()[6:].strip() for l in t.split("\n")
                        if l.strip().startswith("- [ ]")]
        for o in offen_zeilen[:8]:
            z.append(f"  - {o[:110]}")

    return "\n".join(z) + "\n"


def main():
    ap = argparse.ArgumentParser(description="Uebergabepaket erzeugen")
    ap.add_argument("--ziel", default=os.path.expanduser("~/Hendlberghof-Backups/uebergabe"))
    ap.add_argument("--ohne-medien", action="store_true",
                    help="Arche-Noah-Blaetter, Lageplanbild und Symbole weglassen "
                         "(spart rund 19 MB; nur sinnvoll, wenn der Empfaenger "
                         "Zugriff auf das Repo hat)")
    a = ap.parse_args()

    tag = datetime.now().strftime("%Y-%m-%d")
    ordner = os.path.join(a.ziel, f"UEBERGABE_{tag}")
    # "data", nicht "daten": Die App holt data/baum_data.json. Mit einem
    # eingedeutschten Ordnernamen laesst sich das Paket nicht starten.
    os.makedirs(os.path.join(ordner, "data"), exist_ok=True)
    os.makedirs(os.path.join(ordner, "werkzeuge"), exist_ok=True)

    # 1. Erhobener Stand
    open(os.path.join(ordner, "STAND.md"), "w", encoding="utf-8").write(stand_erheben())

    # 2. Erklaerende Unterlagen
    kopiert = []
    for n in ("UEBERGABE.md", "AGENTS.md", "PLAN_SHOP_MERKLISTE.md",
              "STYLEGUIDE.md", "MIGRATION_OPENCODE.md"):
        p = os.path.join(PROJEKT, n)
        if os.path.exists(p):
            shutil.copy(p, ordner); kopiert.append(n)
    # Styleguide liegt im Repo, nicht im Projektordner
    p = os.path.join(REPO, "STYLEGUIDE.md")
    if os.path.exists(p) and "STYLEGUIDE.md" not in kopiert:
        shutil.copy(p, ordner); kopiert.append("STYLEGUIDE.md")

    # Projektstaende (Verlauf)
    verlauf = os.path.join(ordner, "verlauf")
    os.makedirs(verlauf, exist_ok=True)
    for n in sorted(os.listdir(os.path.join(PROJEKT, "files"))):
        if "PROJEKTSTATUS" in n and n.endswith(".md"):
            shutil.copy(os.path.join(PROJEKT, "files", n), verlauf)

    # 3. Katalog und Live-Stand
    for n in ("baum_data.json", "sorten_data.json", "seed_positions.json"):
        p = os.path.join(REPO, "data", n)
        if os.path.exists(p):
            shutil.copy(p, os.path.join(ordner, "data"))
    hb = os.path.expanduser("~/Hendlberghof-Backups")
    neueste = sorted([f for f in os.listdir(hb) if f.endswith("_state.json")]) if os.path.isdir(hb) else []
    if neueste:
        shutil.copy(os.path.join(hb, neueste[-1]),
                    os.path.join(ordner, "data", "firestore_" + neueste[-1]))

    # 4. Anwendung und Werkzeuge
    for p, ziel in ((os.path.join(PROJEKT, "files", "Hendlberghof_Obstdatenbank.html"), ordner),
                    (os.path.join(REPO, "sw.js"), ordner),
                    (os.path.join(REPO, "manifest.json"), ordner),
                    (os.path.join(REPO, "README.md"), ordner),
                    (os.path.join(REPO, "firestore.rules"), ordner),
                    (os.path.join(PROJEKT, ".claude", "serve.py"), ordner),
                    (os.path.join(PROJEKT, ".claude", "launch.json"), ordner)):
        if os.path.exists(p):
            shutil.copy(p, ziel)

    # 4b. Belegte Quellen und Medien.
    #     Liegen zwar im Git und damit ausser Haus - aber eine Uebergabe muss aus
    #     sich heraus funktionieren. Wer das Archiv bekommt, hat nicht
    #     zwangslaeufig Zugriff auf das Repo, und ohne das Lageplanbild bleibt
    #     die Karte leer. Die Arche-Noah-Blaetter sind die Belege fuer die
    #     standort-Attribute; ohne sie steht die Sortenberatung ohne Quelle da.
    if not a.ohne_medien:
        for unter in ("arche_pdfs", "arche_pdfs_birnen", "assets", "icons"):
            quelle = os.path.join(REPO, unter)
            if os.path.isdir(quelle):
                ziel = os.path.join(ordner, unter)
                shutil.rmtree(ziel, ignore_errors=True)
                shutil.copytree(quelle, ziel,
                                ignore=shutil.ignore_patterns(".DS_Store"))
    # 4c. Der Website-Umbau (A5).
    #     Wichtiger Sonderfall: website-theme/ liegt im Projektordner, NICHT im
    #     Repo - es gehoert zu wordpress, nicht zum Kataster. Damit existiert es
    #     nur auf diesem Mac. Faellt es hier heraus, ist es nirgends gesichert.
    theme_quelle = os.path.join(PROJEKT, "website-theme")
    if os.path.isdir(theme_quelle):
        theme_ziel = os.path.join(ordner, "website-theme")
        shutil.rmtree(theme_ziel, ignore_errors=True)
        shutil.copytree(theme_quelle, theme_ziel,
                        ignore=shutil.ignore_patterns(".DS_Store"))
        kopiert.append("website-theme/")

    js_ziel = os.path.join(ordner, "js")
    if os.path.isdir(os.path.join(PROJEKT, "files", "js")):
        shutil.rmtree(js_ziel, ignore_errors=True)
        shutil.copytree(os.path.join(PROJEKT, "files", "js"), js_ziel)
    for n in os.listdir(HIER):
        if n.endswith((".py", ".sh", ".plist", ".yml", ".json")):
            shutil.copy(os.path.join(HIER, n), os.path.join(ordner, "werkzeuge"))

    # 5. Lesbare Fassungen fuer unterwegs
    md2html = os.path.join(HIER, "md2html.py")
    if os.path.exists(md2html):
        for n in os.listdir(ordner):
            if n.endswith(".md"):
                subprocess.run([sys.executable, md2html, os.path.join(ordner, n),
                                os.path.join(ordner, n[:-3] + ".html")],
                               capture_output=True)

    # 6. Ein Archiv daraus
    archiv = shutil.make_archive(ordner, "zip", root_dir=a.ziel,
                                 base_dir=os.path.basename(ordner))

    # 7. Zweitkopie ausser Haus
    icloud = os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs"
                                "/Hendlberghof-Backups/uebergabe")
    gespiegelt = False
    if os.path.isdir(os.path.dirname(icloud)) or os.path.isdir(os.path.dirname(os.path.dirname(icloud))):
        try:
            os.makedirs(icloud, exist_ok=True)
            shutil.copy(archiv, icloud)
            gespiegelt = True
        except Exception:
            pass

    dateien = sum(len(f) for _, _, f in os.walk(ordner))
    print(f"Uebergabepaket: {ordner}")
    print(f"  {dateien} Dateien, Archiv {os.path.getsize(archiv)//1024} KB")
    print(f"  Unterlagen: {', '.join(kopiert)}")
    print(f"  Zweitkopie in iCloud: {'ja' if gespiegelt else 'nein'}")
    print("\nEinstieg fuer den Nachfolger: UEBERGABE.md, dann STAND.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/bin/bash
# Monatliches Backup der Hendlberghof Obstdatenbank.
#
# Legt den Datenbestand an drei Orten ab:
#   1. Firestore  - der Live-Stand selbst (nichts zu tun, liegt bei Google)
#   2. Dieser Mac - ~/Hendlberghof-Backups, privat, MIT Bestelldaten
#   3. iCloud     - Zweitkopie ausser Haus, privat
# Die fruehere Ablage auf GitHub ist seit 26.10.2026 abgeschaltet (siehe unten).
#
# Aufruf:  tools/backup_lokal.sh
# Automatisch am 1. jedes Monats um 09:00 ueber ~/Library/LaunchAgents/
# at.hendlberghof.backup.plist (Vorlage: tools/at.hendlberghof.backup.plist).
# War der Mac aus, holt macOS den Lauf nach.
#
# Einrichten auf einem neuen Rechner:
#   git clone <repo> && cd <repo>
#   sed "s#/Users/test/Hendlberghof/github-pages#$PWD#" tools/at.hendlberghof.backup.plist \
#     > ~/Library/LaunchAgents/at.hendlberghof.backup.plist
#   launchctl load ~/Library/LaunchAgents/at.hendlberghof.backup.plist

set -u
# Repo-Wurzel aus dem Ort dieses Skripts ableiten, damit ein Klon an
# beliebiger Stelle funktioniert - im Wiederherstellungsfall zaehlt genau das.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIEL="$HOME/Hendlberghof-Backups"
SKRIPT="$REPO/tools/backup_hendlberghof.py"
LOG="$ZIEL/backup.log"
MONAT=$(date +%Y-%m)

mkdir -p "$ZIEL"
echo "=== Backup $(date '+%Y-%m-%d %H:%M') ===" | tee -a "$LOG"

if [ ! -f "$SKRIPT" ]; then
  echo "FEHLER: $SKRIPT nicht gefunden - Abbruch" | tee -a "$LOG"
  exit 1
fi

# --- 1. Privates Backup auf diesem Mac (mit Bestelldaten) --------------------
echo "-- lokal (mit Bestelldaten)" | tee -a "$LOG"
python3 "$SKRIPT" --ziel "$ZIEL" --daten "$REPO/data" --mit-bestellungen 2>&1 | tee -a "$LOG"

# --- 2. Versioniertes Backup im Repo: ABGESCHALTET (26.10.2026) -------------
# Bis Oktober 2026 legte dieser Schritt eine Kopie ohne Bestelldaten in den
# Ordner backup/ des Repos und pushte sie. Das Repo ist oeffentlich, und die
# Kopie enthielt Erntemengen und andere Betriebsdaten – einmal gepusht, bleiben
# sie in der Git-Historie. Volkmar hat den Schritt am 26.10.2026 abgeschaltet;
# gesichert wird nur noch privat (Schritt 1 hier am Mac, Schritt 5 in iCloud).
echo "-- GitHub-Ablage abgeschaltet (nur private Sicherung)" | tee -a "$LOG"

# --- 3. Planungsunterlagen mitsichern (nur lokal!) ---------------------------
# Plan, Agentenkontext und Projektstaende liegen bewusst NICHT im Repo: Sie
# enthalten Betriebsinterna, die nicht zur Veroeffentlichung bestimmt sind.
# Das Repo ist oeffentlich, und einmal Gepushtes bliebe auch nach dem Loeschen
# in der Historie stehen. Deshalb wandern sie ausschliesslich in die private
# Ablage.
DOK="$ZIEL/dokumente"
mkdir -p "$DOK"
anz=0
for f in "$REPO/../"*.md "$REPO/../files/"*PROJEKTSTATUS*.md; do
  [ -f "$f" ] || continue
  cp "$f" "$DOK/" && anz=$((anz+1))
done
# Zusaetzlich eine lesbare HTML-Fassung: In der Dateien-App am iPhone wird
# Markdown nur als Rohtext angezeigt, HTML dagegen gesetzt dargestellt.
for f in "$DOK"/*.md; do
  [ -f "$f" ] || continue
  python3 "$REPO/tools/md2html.py" "$f" "${f%.md}.html" >/dev/null 2>&1
done
echo "-- Unterlagen: $anz Dokumente nach $DOK (je auch als HTML)" | tee -a "$LOG"

# --- 3b. Geretteter Inhalt der alten Website (nur lokal!) --------------------
# 178 Mediathek-Eintraege, 33 Seiten und die WooCommerce-Produkte, am 16.10.2026
# aus der WordPress-Installation geholt. Rund 420 MB, die es sonst NIRGENDS
# mehr gibt: Die alte Seite wird abgeloest, und mit ihr verschwindet die
# Mediathek. Darunter Dateien, die auf keiner Seite verlinkt sind - etwa das
# Veredelungsvideo von 2018.
#
# Nicht ins Repo: Das Repo ist oeffentlich, und 420 MB Bilder gehoeren ohnehin
# nicht in eine Git-Historie.
#
# rsync statt cp, weil sich nach dem ersten Lauf fast nichts mehr aendert -
# kopiert wird dann nur noch der Unterschied.
# Dazu der ausgewertete Text des Permakulturkonzepts samt gerenderten Karten
# und der Kurzfassung fuer die Website. Die Original-PDFs liegen woanders
# (~/Desktop/Farm/4 PK_Design/); gesichert wird hier die Auswertung, weil die
# Kurzfassung eigene Arbeit ist und nirgends sonst steht.
for name in website-inhalt permakulturkonzept stil werkzeuge; do
  quelle="$REPO/../$name"
  [ -d "$quelle" ] || continue
  # Bewusst OHNE --delete, aus demselben Grund wie bei der iCloud-Spiegelung
  # weiter unten: Die Sicherung darf nur hinzufuegen. Wer im Arbeitsordner
  # versehentlich loescht, soll die Sicherung nicht mitreissen.
  if rsync -a "$quelle/" "$ZIEL/$name/" 2>&1 | tee -a "$LOG"; then
    groesse=$(du -sh "$ZIEL/$name" 2>/dev/null | cut -f1)
    anzahl=$(find "$ZIEL/$name" -type f | wc -l | tr -d ' ')
    echo "-- $name: $anzahl Dateien, $groesse" | tee -a "$LOG"
  else
    echo "-- HINWEIS: Sicherung von $name fehlgeschlagen" | tee -a "$LOG"
  fi
done

# --- 4. Alte lokale Backups aufraeumen: letzte 24 Monate behalten ------------
# Im Repo wird nichts geloescht - dort ist die Historie ja der Sinn der Sache.
ls -1t "$ZIEL"/*_state.json    2>/dev/null | tail -n +25 | xargs -r rm -f
ls -1t "$ZIEL"/*_kataster.xlsx 2>/dev/null | tail -n +25 | xargs -r rm -f

# --- 5. Zweitkopie ausser Haus (iCloud Drive, privat) ------------------------
# Rechner und Time Machine stehen am selben Ort - gegen Diebstahl, Brand oder
# Wasserschaden hilft nur eine Kopie woanders. GitHub scheidet aus, weil hier
# Bestelldaten und Betriebsinterna liegen.
#
# Bewusst OHNE --delete: Die Spiegelung darf nur hinzufuegen. Raeumt Schritt 4
# alte Monate weg, bleiben sie in der Zweitkopie erhalten - und ein Fehler, der
# lokal Dateien loescht, kann die Zweitkopie nicht mitreissen.
ICLOUD_BASIS="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
if [ -d "$ICLOUD_BASIS" ]; then
  ICLOUD="$ICLOUD_BASIS/Hendlberghof-Backups"
  mkdir -p "$ICLOUD"
  if rsync -a --exclude 'launchd.log' "$ZIEL/" "$ICLOUD/" 2>&1 | tee -a "$LOG"; then
    echo "-- Zweitkopie in iCloud Drive" | tee -a "$LOG"
  else
    echo "-- HINWEIS: Spiegelung nach iCloud fehlgeschlagen" | tee -a "$LOG"
  fi
else
  echo "-- HINWEIS: iCloud Drive nicht gefunden - keine Zweitkopie ausser Haus" | tee -a "$LOG"
fi

ANZ=$(ls -1 "$ZIEL"/*_kataster.xlsx 2>/dev/null | wc -l | tr -d ' ')
echo "Fertig. $ANZ Monats-Backups lokal in $ZIEL" | tee -a "$LOG"
echo "" | tee -a "$LOG"

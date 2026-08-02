#!/bin/bash
# Monatliches Backup der Hendlberghof Obstdatenbank.
#
# Legt den Datenbestand an drei Orten ab:
#   1. Firestore  - der Live-Stand selbst (nichts zu tun, liegt bei Google)
#   2. Dieser Mac - ~/Hendlberghof-Backups, privat, MIT Bestelldaten
#   3. GitHub     - versioniert im Repo, OHNE Bestelldaten (das Repo ist oeffentlich)
#
# Punkt 3 lief urspruenglich als GitHub-Action. Das Anlegen der Workflow-Datei
# scheiterte an einer fehlenden Token-Berechtigung, das normale git push
# funktioniert aber. Deshalb erzeugt dieses Skript das Repo-Backup selbst und
# schiebt es hoch - dasselbe Ergebnis ohne Sonderrechte.
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

# --- 2. Versioniertes Backup im Repo (ohne Bestelldaten) --------------------
if [ -d "$REPO/.git" ]; then
  echo "-- GitHub (ohne Bestelldaten)" | tee -a "$LOG"

  # Erst den Stand von GitHub holen, sonst scheitert der Push. --autostash
  # rettet dabei unfertige Aenderungen im Arbeitsbaum.
  git -C "$REPO" pull --quiet --rebase --autostash 2>&1 | tee -a "$LOG"

  mkdir -p "$REPO/backup"
  if python3 "$SKRIPT" --ziel "$REPO/backup" --daten "$REPO/data" 2>&1 | tee -a "$LOG"; then
    git -C "$REPO" add backup/
    # Nur den Backup-Ordner committen - andere Baustellen bleiben unberuehrt
    if git -C "$REPO" diff --staged --quiet -- backup/; then
      echo "   unveraendert - kein Commit noetig" | tee -a "$LOG"
    else
      git -C "$REPO" commit --quiet \
        -m "Backup $MONAT: Firestore-Stand + Excel-Auswertung" -- backup/ 2>&1 | tee -a "$LOG"
      if git -C "$REPO" push --quiet 2>&1 | tee -a "$LOG"; then
        echo "   gepusht" | tee -a "$LOG"
      else
        echo "   HINWEIS: Push fehlgeschlagen (offline?) - Commit liegt lokal bereit" | tee -a "$LOG"
      fi
    fi
  else
    echo "   FEHLER beim Erzeugen des Repo-Backups" | tee -a "$LOG"
  fi
else
  echo "-- kein Git-Repo unter $REPO - GitHub-Ablage uebersprungen" | tee -a "$LOG"
fi

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
echo "-- Unterlagen: $anz Dokumente nach $DOK" | tee -a "$LOG"

# --- 4. Alte lokale Backups aufraeumen: letzte 24 Monate behalten ------------
# Im Repo wird nichts geloescht - dort ist die Historie ja der Sinn der Sache.
ls -1t "$ZIEL"/*_state.json    2>/dev/null | tail -n +25 | xargs -r rm -f
ls -1t "$ZIEL"/*_kataster.xlsx 2>/dev/null | tail -n +25 | xargs -r rm -f

ANZ=$(ls -1 "$ZIEL"/*_kataster.xlsx 2>/dev/null | wc -l | tr -d ' ')
echo "Fertig. $ANZ Monats-Backups lokal in $ZIEL" | tee -a "$LOG"
echo "" | tee -a "$LOG"

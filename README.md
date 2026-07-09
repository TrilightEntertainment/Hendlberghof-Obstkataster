# Hendlberghof Obstdatenbank

Digitales Baumkataster für den Hendlberghof – Baumkataster, Sortenübersicht, Lageplan mit Stecknadeln (inkl. optionaler GPS-Kalibrierung) sowie Daten-Export/Import.

Diese Seite ist eine einzelne, selbstgenügsame HTML-Datei (`index.html`, ~17 MB inkl. eingebetteter Lagekarte) – kein Build-Prozess, keine Server-Abhängigkeiten. Wird über **GitHub Pages** gehostet, damit auch mobile Browser (insb. iOS Safari) die GPS-Funktion nutzen können, die einen sicheren Kontext (HTTPS) voraussetzt.

**Bearbeitungs-Passwort** steht direkt im Quelltext von `index.html` (Konstante `EDIT_PASSWORD`) – bei Bedarf dort anpassen.

Änderungen an den Daten (Positionen, Sukzession, Ernte, Bearbeitungen) werden nur lokal im jeweiligen Browser gespeichert (`localStorage`). Über den Tab „Daten & Sicherung" lassen sich die Ergänzungen als JSON exportieren/importieren, um mehrere Geräte oder Sitzungen abzugleichen.

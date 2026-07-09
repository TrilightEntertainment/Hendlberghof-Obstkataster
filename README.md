# Hendlberghof Obstdatenbank

Digitales Baumkataster für den Hendlberghof – Baumkataster, Sortenübersicht, Lageplan mit Stecknadeln (inkl. optionaler GPS-Kalibrierung) sowie Daten-Export/Import.

Diese Seite ist eine einzelne, selbstgenügsame HTML-Datei (`index.html`, ~17 MB inkl. eingebetteter Lagekarte) – kein Build-Prozess, keine Server-Abhängigkeiten. Wird über **GitHub Pages** gehostet, damit auch mobile Browser (insb. iOS Safari) die GPS-Funktion nutzen können, die einen sicheren Kontext (HTTPS) voraussetzt.

**Bearbeitungs-Login** läuft über Firebase Authentication (E-Mail/Passwort) – Nutzer werden in der Firebase-Konsole unter „Authentication → Users" verwaltet, nicht mehr im Quelltext.

Alle Änderungen (Positionen, Sukzession, Ernte, Bearbeitungen, Verwendung) werden über **Firebase Firestore** (Region: europe-west3, Frankfurt) live zwischen allen Geräten synchronisiert – kein manueller Export/Import mehr nötig. `localStorage` dient weiterhin als lokaler Fallback/Cache, u. a. für den allerersten Start und falls Firestore mal nicht erreichbar ist. Firestore selbst cached zusätzlich automatisch für Offline-Nutzung im Feld.

Firestore-Zugriffsregeln liegen zur Referenz in `firestore.rules` – müssen einmalig manuell in der Firebase-Konsole (Firestore Database → Regeln) veröffentlicht werden: offenes Lesen für alle, Schreiben nur mit gültigem Login.

Die Firebase-Projektkonfiguration (`firebaseConfig` am Ende von `index.html`) enthält nur öffentliche/unkritische Werte (kein Geheimnis) – die eigentliche Absicherung erfolgt über die Firestore-Regeln und die Firebase-Authentication-Logins, nicht über die Geheimhaltung dieser Konfiguration.

# Hendlberghof Obstdatenbank — Styleguide

> minimalistischer Linien-Stil · duenne Konturen statt Flächen  
> Zielgerät: iPhone 8, iOS 16.7.15

---

## 1. Farbpalette

### Kernfarben

| Token | Hex | Verwendung |
|-------|-----|------------|
| `--waldrand` | `#2E3F2A` | Primärfarbe, Headers, Buttons, aktive Ränder |
| `--stroh` | `#D9B458` | Gold-Akzente, aktive Indikatoren, Linien |
| `--kalkstein` | `#F1EDE2` | Seitenhintergrund, Header-Titel |
| `--border` | `#E2DACB` | Alle Ränder |
| `--dachziegel` | `#B2543A` | Accent-Buttons, Pin-Default |
| `--ackerde` | `#3E2B22` | Card-Überschriften, Eingabetext |
| `--wiesengras` | `#6E8A4E` | Mittelgrün |

### Textfarben

| Token | Hex | Verwendung |
|-------|-----|------------|
| `--text` | `#2A231D` | Primärer Text |
| `--muted` | `#7A7168` | Sekundärer Text, Labels |
| `--text-mid` | `#5F5E5A` | Sortenberater Zwischenton |
| `--text-leicht` | `#7A7168` | Heller Text (= `--muted`) |
| Eingabe-Platzhalter | `#8A7F63` | Leere Inputs, Such-Icons |
| Eingabe-Text | `#3E2B22` | Getippter Text |
| Eingabe-Rand | `#C9C0A9` | Formular-Ränder |
| Header-Untertitel | `#B7C4B4` | `.header-sub` |
| Nav inaktiv | `#8FA08C` | Inaktive Tabs |

### Obstarten-Farben

| Frucht | Hex | Verwendung |
|--------|-----|------------|
| Apfel | `#dc2626` | `.pill.apfel`, `.card.apfel` border-left, `.pin.apfel` |
| Birne | `#22c55e` | `.pill.birne`, `.card.birne` border-left, `.pin.birne` |
| Walnuss | `#b98e1a` | `.card.walnuss` border-left, `.pin.walnuss` |

### Flächenfarben

| Token / Hex | Verwendung |
|-------------|------------|
| `#ffffff` | Cards, Modals, Inputs |
| `#faf7ef` | Table-Hover, sekundärer Button-Hover |
| `#f4f2ec` | PDF-Frame-Hintergrund |
| `rgba(30,25,18,.55)` | Overlay-Backdrop |
| `rgba(30,25,18,.7)` | PDF-Overlay-Backdrop |
| `#eaf3de` | Edit-Banner, aktive grüne Flächen |
| `#c9dfae` | Edit-Banner-Rand |
| `#f5f0e1` | Autocomplete-Hover |

### Badges & Hinweise

| Element | Text | Hintergrund | Rand |
|---------|------|-------------|------|
| `.badge-recherche` | `#8a5a00` | `#fff4e0` | `#f0d19a` |
| `.badge-verifiziert` | — | `#e9f3e2` | `#bcd9a8` |
| `.quelle-hinweis` | `#7A7168` | `#fff4e0` | `#f0d19a` |
| `.an-badge` | `#7A5700` | `#FFF3CD` | `#E8D48A` |

### Gefahren-Farben

| Element | Hex |
|---------|-----|
| `.btn.danger` | `#c0392b` |
| `.an-ernte-dot.aktiv` | `#C0392B` |
| Accent-Button Text | `#8a3a24` |
| Accent-Button BG | `#f6e2da` |
| Accent-Button Hover | `#f0d0c4` |

---

## 2. Typografie

### Schriftfamilien

| Familie | Verwendung |
|---------|------------|
| `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Body, Nav, Standard-Text |
| `Georgia, serif` | `header h1`, `.pdf-title` |
| `'Cormorant Garamond', serif` | `.card h3`, `.modal h2`, Sortenberater |

### Schriftgrößen

| Größe | Verwendung |
|-------|------------|
| `8px` | `.an-ernte-dot` |
| `.68rem` | Badges |
| `.7rem` | Sort-Pfeile |
| `.72rem` | Pill, Tabellen-Header, Labels |
| `11px` | Header-Untertitel, kleine Buttons |
| `12px` | Inputs, Selects, `.btn.field` |
| `.82rem` | Hinweise, Autocomplete-Items |
| `.85rem` | Table (mobile), Snippets |
| `.88rem` | `.btn` Standard, Edit-Form Inputs |
| `.9rem` | Tabellen-Zellen |
| `.92rem` | Header-Paragraph |
| `.98rem` | `.pdf-title` |
| `1rem` | Sortenberater Select |
| `1.05rem` | `.sb-art`, `.sbr-btn` |
| `1.15rem` | `.sb-sorte-name` |
| `1.3rem` | `.card h3` |
| `1.4rem` | Modal-Schließen-Button |
| `1.5rem` | Header-Titel (mobile) |
| `1.7rem` | Modal-Überschrift |

### Schriftgewichte

| Weight | Verwendung |
|--------|------------|
| `400` | Header-Titel, Nav-Buttons, Pill-Standard |
| `500` | `.sbr-tab`, `.sb-field label`, `.sl-filter-btn` |
| `600` | Nav aktiv, `.btn`, `.pill`, Tabellen-Header, `.sb-title` |
| `700` | Badges, Sort-Pfeile, `.section-title`, `.edit-form label` |

### Textmuster

```css
/* Section-Titel */
.section-title {
  font-weight: 700;
  color: var(--waldrand);
  font-size: .85rem;
  text-transform: uppercase;
  letter-spacing: .5px;
  border-bottom: 1px solid var(--stroh);
  padding-bottom: 4px;
  margin: 18px 0 6px;
}

/* Feld-Label */
.field b {
  display: block;
  color: var(--muted);
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .4px;
  margin-bottom: 2px;
}

/* Edit-Form Label */
.edit-form label {
  font-size: .75rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .4px;
  display: block;
  margin-bottom: 3px;
}
```

---

## 3. Abstandssystem

### Padding

| Wert | Verwendung |
|------|------------|
| `2px 7px` – `2px 9px` | Badges, Pills |
| `5px 6px` – `5px 13px` | Kleine Actions-Buttons |
| `6px 12px` – `6px 16px` | Banner |
| `7px 14px` – `7px 16px` | Toolbar-Buttons |
| `8px 10px` – `8px 14px` | Inputs, Selects, Tabellen-Zellen |
| `9px 16px` | `.btn` Standard |
| `10px 14px` – `10px 12px` | Tabellen-Header |
| `11px 14px` – `11px 28px` | Sortenberater-Buttons |
| `12px 14px` – `12px 18px` | Nav-Buttons |
| `14px 16px` – `16px 18px` | Cards |
| `18px 28px` – `22px 28px` | Header, Main |
| `26px 28px` | Modal |

### Gap

| Wert | Verwendung |
|------|------------|
| `2px` | `.an-ernte-bar` |
| `4px` | Nav, Badges |
| `5px` | ABC/Monat-Buttons |
| `6px` | AddLog, Sortenberater-Fields |
| `8px` | Grids, Edit-Actions, Edit-Form |
| `10px` | Toolbar, Log-Liste |
| `12px` | Auswahl-Bar, Sortenberater-Grid |
| `14px` | Cards-Grid |
| `20px` | `.grid2` column-gap |

### Margin

| Wert | Verwendung |
|------|------------|
| `0` | Body, Header-Elemente |
| `2px` | Ernte-Bar, Ernte-Zeile |
| `4px 0` | Feld-Beschriftungen |
| `8px` | Card-Meta, Ernte-Zeile |
| `14px 0` | Grids, Edit-Form |
| `18px 0 6px` | Section-Titel |
| `20px` | Footer |

---

## 4. Border-Radius

| Radius | Verwendung |
|--------|------------|
| `3px` | `.an-ernte-dot` |
| `4px` | `.an-pdf-link` |
| `6px` | `.idbadge`, Auswahl-Bar-Buttons, ABC/Monat-Buttons |
| `7px` | Inputs, Selects, `.btn.field`, Autocomplete-Dropdown |
| `8px` | Card-Innenleben, Hinweise, Edit-Form-Inputs |
| `10px` | `var(--radius)` — `.btn`, `.table-wrap`, `.sb-art`, `.sbr-btn`, Toolbar |
| `12px` | Cards, Map, PDF-Box, `.sl-card` |
| `14px` | Modal |
| `20px` | Pills, Badges, `.arche-link`, `.btn-verify`, `.pdf-act`, `.sb-tag` |
| `50%` | Pins (Kreise), `.sl-card-check` |

---

## 5. Schatten

| Schatten | Verwendung |
|----------|------------|
| `0 2px 8px rgba(0,0,0,.15)` | `.map-wrap` |
| `0 1px 4px rgba(0,0,0,.4)` | `.pin` |
| `0 0 0 4px rgba(217,180,88,.5)` | `.pin.dragging` |
| `0 4px 12px rgba(0,0,0,.12)` | `.sorte-ac-list` |
| `0 2px 8px rgba(59,109,17,.08)` | `.sl-card:hover` |

---

## 6. Buttons

### `.btn` — Primär (Outline)

```css
background: transparent;
color: var(--waldrand);        /* #2E3F2A */
border: 1px solid var(--waldrand);
padding: 9px 16px;
border-radius: 10px;
font-size: .88rem;
font-weight: 600;
/* Hover: background: rgba(46,63,42,.08); */
```

### `.btn.secondary`

```css
color: var(--muted);           /* #7A7168 */
border: 1px solid var(--border); /* #E2DACB */
/* Hover: background: #faf7ef; color: var(--waldrand); border-color: var(--waldrand); */
```

### `.btn.accent`

```css
background: #f6e2da;
color: #8a3a24;
border: 1px solid var(--dachziegel); /* #B2543A */
/* Hover: background: #f0d0c4; */
```

### `.btn.field`

```css
color: #8A7F63;
border: 1px solid #C9C0A9;
padding: 8px 14px;
font-size: 12px;
font-weight: 400;
border-radius: 7px;
/* Hover: background: #faf7ef; */
```

### `.btn.danger`

```css
background: #c0392b;
color: #fff;
```

### `.btn-login-toggle.field`

```css
color: #28362A;
border-color: #28362A;
font-weight: 500;
```

### `.btn-verify`

```css
border: 1px solid var(--waldrand);
color: var(--waldrand);
padding: 5px 12px;
border-radius: 20px;
font-size: .78rem;
font-weight: 600;
/* .done: background: #e9f3e2; */
```

### `.sbr-btn` — Sortenberater CTA

```css
padding: 11px 28px;
background: var(--gruen);       /* #2E3F2A */
color: #fff;
border: none;
border-radius: 10px;
font-family: 'Cormorant Garamond', serif;
font-size: 1.05rem;
font-weight: 600;
/* Hover: background: var(--gruen-mid); #6E8A4E */
```

---

## 7. Formulare

### Input / Select (Standard)

```css
padding: 8px 14px;
border: 1px solid #C9C0A9;
border-radius: 7px;
font-size: 12px;
font-family: inherit;
background: transparent;
color: #8A7F63;              /* Platzhalter */
color: #3E2B22;              /* Getippt (nur input) */
```

### Search Input

```css
width: 100%;
padding-left: 34px;          /* Platz für Icon */
```

### Edit-Form Inputs

```css
width: 100%;
padding: 8px 10px;
border: 1px solid var(--border);
border-radius: 8px;
font-size: .88rem;
background: #fff;
```

### Textarea

```css
min-height: 70px;
resize: vertical;
```

### Autocomplete-Dropdown

```css
position: absolute;
top: 100%; left: 0; right: 0;
background: #fff;
border: 1px solid #C9C0A9;
border-radius: 7px;
max-height: 180px;
overflow-y: auto;
box-shadow: 0 4px 12px rgba(0,0,0,.12);

/* Items */
padding: 8px 12px;
font-size: .82rem;
color: #3E2B22;
border-bottom: 1px solid #f0ede5;
/* Hover: background: #f5f0e1; */
```

### Edit-Form Grid

```css
display: grid;
grid-template-columns: 1fr 1fr;
gap: 8px 16px;
margin: 14px 0;
/* .full { grid-column: 1 / -1; } */
```

---

## 8. Cards & Container

### `.card`

```css
background: #fff;
border-radius: 12px;
padding: 16px 18px;
border: 1px solid var(--border);
border-left: 3px solid #dc2626;  /* default: Apfel */
/* Hover: border-color: var(--waldrand); */
```

**Varianten:** `.card.apfel` (rot), `.card.birne` (grün), `.card.walnuss` (gold)

```css
.card h3 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.3rem;
  color: var(--ackerde);         /* #3E2B22 */
  margin: 0 0 6px;
}
.card .meta { font-size: .78rem; color: var(--muted); margin-bottom: 8px; }
.card .snippet { font-size: .85rem; color: var(--text); line-height: 1.4; }
```

### `.cards` Grid

```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
gap: 14px;
```

### `.table-wrap`

```css
overflow-x: auto;
border-radius: 10px;
border: 1px solid var(--border);
```

### `.modal`

```css
background: #fff;
border-radius: 14px;
max-width: 700px;
width: 100%;
max-height: 88vh;
overflow-y: auto;
padding: 26px 28px;
border: 1px solid var(--border);
```

### `.overlay`

```css
position: fixed;
inset: 0;
background: rgba(30,25,18,.55);
padding: 20px;
z-index: 50;
```

### `.pdf-box`

```css
background: #fff;
border-radius: 12px;
max-width: 920px;
height: 92vh;
border: 1px solid var(--border);
```

### `.map-wrap`

```css
border-radius: 12px;
overflow: hidden;
background: #000;
box-shadow: 0 2px 8px rgba(0,0,0,.15);
```

### `.hint`

```css
font-size: .82rem;
color: var(--muted);
background: #faf7ef;
border: 1px dashed var(--border);
padding: 8px 12px;
border-radius: 8px;
```

### `.quelle-hinweis`

```css
font-size: .78rem;
color: var(--muted);
background: #fff4e0;
border: 1px dashed #f0d19a;
padding: 8px 12px;
border-radius: 8px;
```

### `.edit-mode-banner`

```css
background: #eaf3de;
color: var(--waldrand);
font-size: .82rem;
font-weight: 600;
padding: 6px 16px;
border-bottom: 1px solid #c9dfae;
```

---

## 9. Tabellen

```css
table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
}

thead th {
  text-align: left;
  color: var(--muted);
  padding: 10px 12px;
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .5px;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  cursor: pointer;
  white-space: nowrap;
}
/* Hover: color: var(--waldrand); */
/* .sorted: color: var(--waldrand); .arrow color: var(--stroh); */

tbody td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  font-size: .9rem;
}
tbody tr { cursor: pointer; transition: .1s; }
tbody tr:hover { background: #faf7ef; }
```

---

## 10. Layout

### Header

```css
padding: 22px 28px 18px;
background: #28362A;
color: #F1EDE2;
```

### Nav

```css
background: #28362A;
padding: 0 20px;
gap: 4px;
display: flex;
```

```css
nav button {
  padding: 12px 18px;
  font-size: 13px;
  font-weight: 400;        /* aktiv: 600 */
  color: #8FA08C;          /* aktiv: #F1EDE2 */
  border-bottom: 2px solid transparent; /* aktiv: var(--stroh) */
  transition: .15s;
}
```

### Main

```css
padding: 22px 28px 60px;
max-width: 1300px;
margin: 0 auto;
```

### Toolbar

```css
display: flex;
flex-wrap: wrap;
gap: 10px;
margin-bottom: 18px;
align-items: center;
```

### Grids

```css
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 20px;
  margin: 14px 0;
}
```

### Footer

```css
text-align: center;
padding: 20px;
color: var(--muted);
font-size: .78rem;
```

---

## 11. Sortenberater

### Farben (scoped)

```css
--gruen:      #2E3F2A;
--gruen-hell: #eaf3de;
--gruen-mid:  #6E8A4E;
--braun:      #854F0B;
--braun-hell: #FAEEDA;
--rand:       #E2DACB;
--blau:       #185FA5;
--blau-hell:  #E6F1FB;
--lila:       #993556;
--lila-hell:  #FBEAF0;
```

### Tab-Farben

```css
.sb-tag.tg { background: var(--gruen-hell); color: var(--gruen); }
.sb-tag.ta { background: var(--braun-hell); color: var(--braun); }
.sb-tag.tb { background: var(--blau-hell);  color: var(--blau); }
.sb-tag.tp { background: var(--lila-hell);  color: var(--lila); }
```

### Ernte-Balken

```css
.an-ernte-dot {
  width: 14px; height: 14px; border-radius: 3px;
  font-size: 8px; font-weight: 700;
}
.an-ernte-dot.aktiv   { background: #C0392B; color: #fff; }
.an-ernte-dot.lager   { background: #FAEEDA; border: 1px solid #854F0B; color: #854F0B; }
.an-ernte-dot.inaktiv { background: var(--erde-hell); border: 1px solid var(--rand); }
.an-ernte-dot.genuss  { background: #EAF3DE; border: 1px solid #3B6D11; color: #3B6D11; }
```

### Auswahlliste

```css
.sl-card {
  background: #fff;
  border: 1.5px solid var(--rand);
  border-radius: 12px;
  padding: 1rem 1.2rem;
  transition: all .15s;
}
.sl-card:hover { border-color: var(--gruen-mid); box-shadow: 0 2px 8px rgba(59,109,17,.08); }
.sl-card.selected { border-color: var(--gruen); border-width: 2px; background: var(--gruen-hell); }
```

---

## 12. Transitions & Animationen

### Transitions

| Dauer | Verwendung |
|-------|------------|
| `.1s` | `tbody tr` |
| `.12s` | `border-color` (Card, Arche-Link) |
| `.15s` | Nav-Buttons, Tabs, Pills, `.sbr-btn`, Filter |
| `.3s ease` | Pin-Transform, Pin-Box-Shadow |

### Keyframes

```css
@keyframes pin-blink {
  0%    { transform: translate(-50%,-50%) scale(1);    outline-width: 0; }
  16.6% { transform: translate(-50%,-50%) scale(1.6);  outline-width: 3px; }
  33.3% { transform: translate(-50%,-50%) scale(1);    outline-width: 0; }
  50%   { transform: translate(-50%,-50%) scale(1.6);  outline-width: 3px; }
  66.6% { transform: translate(-50%,-50%) scale(1);    outline-width: 0; }
  83.3% { transform: translate(-50%,-50%) scale(1.6);  outline-width: 3px; }
  100%  { transform: translate(-50%,-50%) scale(1.6);  outline-width: 3px; }
}
/* Dauer: 1.8s, easing: ease-in-out, iteration: 1 forwards */
```

---

## 13. Media Queries

### `@media (max-width: 640px)` — Mobile

```css
/* Header */
header { padding: 16px 16px 14px; }
header h1 { font-size: 1.5rem; }

/* Nav */
nav { padding: 0 10px; overflow-x: auto; }
nav button { padding: 10px 12px; font-size: .85rem; white-space: nowrap; }

/* Main */
main { padding: 14px 12px 40px; }

/* Toolbar — 3 Spalten */
.toolbar { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.toolbar > * { width: 100%; }
.toolbar .search-wrap { grid-column: 1 / -1; }

/* Inputs */
input[type=text] { min-width: 0; }

/* Tabelle */
table { font-size: .8rem; }
thead th, tbody td { padding: 8px; }

/* PDF Vollbild */
.pdf-overlay { padding: 0; }
.pdf-box { height: 100vh; max-width: none; border-radius: 0; }
.pdf-title { font-size: .85rem; width: 100%; }
```

### `@media (max-width: 520px)` — Sortenberater

```css
.sb-grid { grid-template-columns: 1fr; }
.sl-grid { grid-template-columns: 1fr; }
```

---

## 14. Icon-Stil

- SVG-Linien-Icons statt Emojis
- Stroke-basiert: `stroke="currentColor"`, `fill="none"`
- Standard: `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
- Braune Silhouetten (`fill="#8B5E3C"`, `stroke="none"`) für Baum/Keimling-Icons
- Grösse: meist `13×13px` (Buttons), `20×20px` (Titel)
- `vertical-align: -2px` für Inline-Ausrichtung mit Text

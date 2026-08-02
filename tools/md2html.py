#!/usr/bin/env python3
"""Markdown -> HTML fuer die Planungsunterlagen. Bewusst klein gehalten:
deckt genau das ab, was in den Dokumenten vorkommt (Ueberschriften, Tabellen,
Listen, Codebloecke, Zitate, Trennlinien, Auszeichnungen im Fliesstext)."""
import html, re, sys

def inline(t):
    t = html.escape(t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'~~([^~]+)~~', r'<del>\1</del>', t)
    t = re.sub(r'(?<![\*\w])\*([^*\n]+)\*(?!\*)', r'<em>\1</em>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t)
    # Erledigt-Kaestchen. Nach den Links, damit [text](url) nicht getroffen wird.
    t = t.replace('[x]', '<span class="erledigt">&#9745;</span>')
    t = t.replace('[ ]', '<span class="offen">&#9744;</span>')
    return t

def konvertiere(md):
    zeilen = md.split('\n')
    out, i = [], 0
    listenstapel = []          # offene <ul>/<ol>

    def listen_schliessen(bis=0):
        while len(listenstapel) > bis:
            out.append('</%s>' % listenstapel.pop())

    while i < len(zeilen):
        z = zeilen[i]

        # Codeblock
        if z.startswith('```'):
            listen_schliessen()
            sprache = z[3:].strip()
            i += 1
            block = []
            while i < len(zeilen) and not zeilen[i].startswith('```'):
                block.append(html.escape(zeilen[i])); i += 1
            i += 1
            out.append('<pre class="lang-%s"><code>%s</code></pre>'
                       % (html.escape(sprache), '\n'.join(block)))
            continue

        # Tabelle: Kopfzeile + Trennzeile aus |---|
        if z.lstrip().startswith('|') and i + 1 < len(zeilen) \
           and re.match(r'^\s*\|[\s:|-]+\|\s*$', zeilen[i+1]):
            listen_schliessen()
            def zellen(r):
                r = r.strip()
                if r.startswith('|'): r = r[1:]
                if r.endswith('|'):   r = r[:-1]
                return [c.strip() for c in r.split('|')]
            kopf = zellen(z)
            i += 2
            rumpf = []
            while i < len(zeilen) and zeilen[i].lstrip().startswith('|'):
                rumpf.append(zellen(zeilen[i])); i += 1
            out.append('<div class="tabelle"><table><thead><tr>'
                       + ''.join('<th>%s</th>' % inline(c) for c in kopf)
                       + '</tr></thead><tbody>')
            for r in rumpf:
                out.append('<tr>' + ''.join('<td>%s</td>' % inline(c) for c in r) + '</tr>')
            out.append('</tbody></table></div>')
            continue

        # Trennlinie
        if re.match(r'^\s*---+\s*$', z):
            listen_schliessen(); out.append('<hr>'); i += 1; continue

        # Ueberschrift
        m = re.match(r'^(#{1,6})\s+(.*)$', z)
        if m:
            listen_schliessen()
            stufe = len(m.group(1))
            text = m.group(2)
            anker = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:60]
            out.append('<h%d id="%s">%s</h%d>' % (stufe, anker, inline(text), stufe))
            i += 1; continue

        # Zitat
        if z.lstrip().startswith('> '):
            listen_schliessen()
            block = []
            while i < len(zeilen) and zeilen[i].lstrip().startswith('> '):
                block.append(zeilen[i].lstrip()[2:]); i += 1
            out.append('<blockquote>%s</blockquote>' % inline(' '.join(block)))
            continue

        # Liste
        m = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', z)
        if m:
            tiefe = len(m.group(1)) // 2
            art = 'ul' if m.group(2) in ('-', '*') else 'ol'
            while len(listenstapel) > tiefe + 1:
                out.append('</%s>' % listenstapel.pop())
            if len(listenstapel) < tiefe + 1:
                out.append('<%s>' % art); listenstapel.append(art)
            inhalt = [m.group(3)]
            i += 1
            # Fortsetzungszeilen einer Listenposition
            while i < len(zeilen) and zeilen[i].strip() \
                  and not re.match(r'^(\s*)([-*]|\d+\.)\s+', zeilen[i]) \
                  and not zeilen[i].startswith('#') \
                  and not zeilen[i].lstrip().startswith('|') \
                  and zeilen[i].startswith('  '):
                inhalt.append(zeilen[i].strip()); i += 1
            text = ' '.join(inhalt)
            klasse = ' class="aufgabe"' if text[:3] in ('[x]', '[ ]') else ''
            out.append('<li%s>%s</li>' % (klasse, inline(text)))
            continue

        # Leerzeile
        if not z.strip():
            listen_schliessen(); i += 1; continue

        # Absatz
        listen_schliessen()
        absatz = [z]
        i += 1
        while i < len(zeilen) and zeilen[i].strip() \
              and not zeilen[i].startswith('#') \
              and not zeilen[i].startswith('```') \
              and not zeilen[i].lstrip().startswith('|') \
              and not re.match(r'^\s*---+\s*$', zeilen[i]) \
              and not re.match(r'^(\s*)([-*]|\d+\.)\s+', zeilen[i]):
            absatz.append(zeilen[i]); i += 1
        out.append('<p>%s</p>' % inline(' '.join(absatz)))

    listen_schliessen()
    return '\n'.join(out)


KOPF = """<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>%(titel)s</title>
<style>
:root{--gruen:#28362A;--gold:#D9B458;--papier:#F1EDE2;--rand:#E2DACB;--muted:#5F5E5A}
*{box-sizing:border-box}
body{margin:0;background:var(--papier);color:var(--gruen);
     font:16px/1.65 "DM Sans",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.blatt{max-width:52rem;margin:0 auto;padding:3rem 1.5rem 6rem}
h1,h2,h3,h4{font-family:Georgia,serif;font-weight:600;line-height:1.25}
h1{font-size:2rem;margin:0 0 .3rem;border-bottom:2px solid var(--gold);padding-bottom:.6rem}
h2{font-size:1.5rem;margin:3rem 0 1rem;padding-top:1.2rem;border-top:1px solid var(--rand)}
h3{font-size:1.15rem;margin:2rem 0 .7rem;color:#2E3F2A}
h4{font-size:1rem;margin:1.4rem 0 .5rem}
p{margin:.8rem 0}
a{color:#8B5E3C}
code{background:#E8E2D4;padding:.12em .38em;border-radius:3px;
     font:.88em/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:#FFFDF8;border:1px solid var(--rand);border-left:3px solid var(--gold);
    border-radius:4px;padding:.9rem 1.1rem;overflow-x:auto}
pre code{background:none;padding:0;font-size:.85rem;line-height:1.55}
blockquote{margin:1rem 0;padding:.6rem 1.1rem;border-left:3px solid var(--gold);
           background:#FBF8F0;color:var(--muted)}
hr{border:0;border-top:1px solid var(--rand);margin:2.5rem 0}
.tabelle{overflow-x:auto;margin:1.2rem 0}
table{border-collapse:collapse;width:100%%;font-size:.93rem}
th{background:var(--gruen);color:#F1EDE2;font-weight:600;text-align:left;
   font-family:Georgia,serif}
th,td{border:1px solid var(--rand);padding:.5rem .7rem;vertical-align:top}
tbody tr:nth-child(even){background:#FAF7EF}
ul,ol{margin:.7rem 0;padding-left:1.4rem}
li{margin:.35rem 0}
del{color:var(--muted)}
li.aufgabe{list-style:none;margin-left:-1.2rem}
.erledigt{color:#6E8A4E;font-size:1.15em;margin-right:.25em}
.offen{color:var(--muted);font-size:1.15em;margin-right:.25em}
td .erledigt,td .offen{margin-right:0}
.fuss{margin-top:4rem;padding-top:1rem;border-top:1px solid var(--rand);
      color:var(--muted);font-size:.85rem}
@media (prefers-color-scheme:dark){
  :root{--gruen:#DDE4DA;--papier:#1B211C;--rand:#39423A;--muted:#9AA396}
  body{background:var(--papier);color:var(--gruen)}
  h3{color:#B7C4B4}
  code{background:#2A322B}
  pre{background:#232A24}
  blockquote{background:#232A24}
  th{background:#2E3F2A;color:#F1EDE2}
  tbody tr:nth-child(even){background:#212821}
  a{color:#D9B458}
}
@media print{body{background:#fff}.blatt{padding:0}h2{page-break-after:avoid}}
</style></head><body><div class="blatt">
"""

FUSS = """<div class="fuss">%(quelle)s · erzeugt %(datum)s ·
Nicht zur Veroeffentlichung bestimmt.</div></div></body></html>"""

if __name__ == '__main__':
    from datetime import datetime
    quelle, ziel = sys.argv[1], sys.argv[2]
    md = open(quelle, encoding='utf-8').read()
    titel = next((l[2:].strip() for l in md.split('\n') if l.startswith('# ')), 'Dokument')
    with open(ziel, 'w', encoding='utf-8') as f:
        f.write(KOPF % {'titel': html.escape(titel)})
        f.write(konvertiere(md))
        f.write(FUSS % {'quelle': html.escape(quelle.split('/')[-1]),
                        'datum': datetime.now().strftime('%d.%m.%Y %H:%M')})
    print(f"{ziel}  ({len(open(ziel, encoding='utf-8').read())//1024} KB)")

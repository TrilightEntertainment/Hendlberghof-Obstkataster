"""Entzerrt die Foto-Collage mit den Pflanzreihen (assets/images/lageplan.jpg)
wie ein Gummituch auf die Karte und zerlegt sie in Web-Mercator-Kacheln.

Passpunkte: tools/foto_passpunkte.json (Bildpunkt im Foto -> GK East in Meter).
Zwischen den Passpunkten wird mit einem Dünnplatten-Spline gedehnt. Gezeigt
wird nur der Bereich nahe der Passpunkte – am Rand ist die Collage nicht
maßstabstreu (anderes Foto, Wald).

Aufruf: python3 tools/foto_entzerren.py <Foto> <Zielordner> [min_zoom] [max_zoom]
Ohne Zielordner: nur Umrechnung prüfen.
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gk_wgs import gk_zu_wgs, wgs_zu_gk  # noqa: E402
from tps import TPS  # noqa: E402
from ortho_kacheln import kachel_zu_wgs, wgs_zu_kachel  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
HIER = os.path.dirname(os.path.abspath(__file__))
KACHEL = 256
ZELLE = 32
RAND_M = 14   # so weit über die äußersten Passpunkte hinaus wird das Foto gezeigt


def lade_passpunkte():
    d = json.load(open(os.path.join(HIER, 'foto_passpunkte.json')))
    foto = [tuple(v[0]) for v in d['punkte'].values()]
    gk = [tuple(v[1]) for v in d['punkte'].values()]
    lam = d['glaettung']
    return foto, gk, TPS(foto, gk, lam, 1000, 100), TPS(gk, foto, lam, 100, 1000)


def huelle(pkte):
    p = sorted(set(pkte))
    def kreuz(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    unten, oben = [], []
    for q in p:
        while len(unten) >= 2 and kreuz(unten[-2], unten[-1], q) <= 0:
            unten.pop()
        unten.append(q)
    for q in reversed(p):
        while len(oben) >= 2 and kreuz(oben[-2], oben[-1], q) <= 0:
            oben.pop()
        oben.append(q)
    return unten[:-1] + oben[:-1]


def main():
    foto_pfad = sys.argv[1]
    ziel = sys.argv[2] if len(sys.argv) > 2 else None
    zmin = int(sys.argv[3]) if len(sys.argv) > 3 else 16
    zmax = int(sys.argv[4]) if len(sys.argv) > 4 else 21
    foto, gk, f2g, g2f = lade_passpunkte()
    rest = sorted(math.dist(f2g(f), g) for f, g in zip(foto, gk))
    print(f'{len(foto)} Passpunkte, Restfehler Median {rest[len(rest) // 2]:.2f} m, größter {rest[-1]:.2f} m')
    if not ziel:
        return

    bild = Image.open(foto_pfad).convert('RGB')
    w, h = bild.size
    # Maske: Hülle der Passpunkte (in GK) mit Rand, ins Foto zurückgerechnet
    hu = huelle(gk)
    cx = sum(p[0] for p in hu) / len(hu)
    cy = sum(p[1] for p in hu) / len(hu)
    weit = []
    for p in hu:
        d = math.dist(p, (cx, cy))
        weit.append((cx + (p[0] - cx) * (d + RAND_M) / d, cy + (p[1] - cy) * (d + RAND_M) / d))
    dicht = []
    for a, b in zip(weit, weit[1:] + weit[:1]):
        n = max(1, int(math.dist(a, b) / 3))
        dicht += [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(n)]
    maske = Image.new('L', (w // 4, h // 4), 0)
    ImageDraw.Draw(maske).polygon([(x / 4, y / 4) for x, y in (g2f(p) for p in dicht)], fill=255)
    weiss = bild.reduce(4).convert('L').point(lambda v: 0 if v >= 250 else 255)
    maske = Image.composite(maske, Image.new('L', maske.size, 0), weiss).filter(ImageFilter.GaussianBlur(3))
    bild.putalpha(maske.resize((w, h), Image.BILINEAR))

    ll = [gk_zu_wgs(*p) for p in weit]
    lat_s, lat_n = min(p[0] for p in ll), max(p[0] for p in ll)
    lng_w, lng_o = min(p[1] for p in ll), max(p[1] for p in ll)
    print(f'Bereich {lat_s:.6f}–{lat_n:.6f} N, {lng_w:.6f}–{lng_o:.6f} O', flush=True)

    gesamt = 0
    for z in range(zmax, zmin - 1, -1):
        m_je_px = 156543.03392 * math.cos(math.radians((lat_s + lat_n) / 2)) / 2 ** z
        faktor = min(1.0, 0.065 / m_je_px * 1.5)
        q = bild if faktor >= 1 else bild.resize((max(1, round(w * faktor)), max(1, round(h * faktor))), Image.LANCZOS)
        fx, fy = q.size[0] / w, q.size[1] / h
        x0, y0 = wgs_zu_kachel(lat_n, lng_w, z)
        x1, y1 = wgs_zu_kachel(lat_s, lng_o, z)
        anzahl = 0
        schritte = KACHEL // ZELLE
        for tx in range(int(x0), int(x1) + 1):
            for ty in range(int(y0), int(y1) + 1):
                gitter = {}
                for i in range(schritte + 1):
                    for j in range(schritte + 1):
                        lat, lng = kachel_zu_wgs(tx + i / schritte, ty + j / schritte, z)
                        px, py = g2f(wgs_zu_gk(lat, lng))
                        gitter[i, j] = (px * fx, py * fy)
                netz = []
                for i in range(schritte):
                    for j in range(schritte):
                        ol, ul, ur, orr = gitter[i, j], gitter[i, j + 1], gitter[i + 1, j + 1], gitter[i + 1, j]
                        netz.append(((i * ZELLE, j * ZELLE, (i + 1) * ZELLE, (j + 1) * ZELLE), (*ol, *ul, *ur, *orr)))
                k = q.transform((KACHEL, KACHEL), Image.MESH, netz, resample=Image.BICUBIC)
                if k.getchannel('A').getextrema()[1] < 8:
                    continue
                pfad = os.path.join(ziel, str(z), str(tx))
                os.makedirs(pfad, exist_ok=True)
                k.save(os.path.join(pfad, f'{ty}.webp'), 'WEBP', quality=78, method=6)
                anzahl += 1
        gesamt += anzahl
        print(f'Zoom {z}: {anzahl} Kacheln', flush=True)
    print(f'Fertig: {gesamt} Kacheln in {ziel}')


if __name__ == '__main__':
    main()

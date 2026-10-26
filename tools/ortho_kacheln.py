"""Zerlegt das Luftbild der Vermessung 2023 (GeoTIFF, EPSG:31256) in Kartenkacheln
im Web-Mercator-Schema {z}/{x}/{y}, wie Leaflet und basemap.at sie verwenden.

Ohne GDAL: Für jede Kachel werden die vier Ecken nach GK East umgerechnet und
der Bildausschnitt mit Pillow (QUAD) entzerrt. Über 15 m Kachelbreite ist die
Abbildung so gut wie linear; der Fehler liegt weit unter einem Bildpunkt.

Aufruf: python3 tools/ortho_kacheln.py <GeoTIFF> <Zielordner> [min_zoom] [max_zoom]
"""
import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gk_wgs import gk_zu_wgs, wgs_zu_gk  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
KACHEL = 256
QUALITAET = 78


def kachel_zu_wgs(x, y, z):
    n = 2 ** z
    lng = x / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lng


def wgs_zu_kachel(lat, lng, z):
    n = 2 ** z
    x = (lng + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def main():
    quelle, ziel = sys.argv[1], sys.argv[2]
    zmin = int(sys.argv[3]) if len(sys.argv) > 3 else 16
    zmax = int(sys.argv[4]) if len(sys.argv) > 4 else 21

    bild = Image.open(quelle)
    e0, n0 = bild.tag_v2[33922][3], bild.tag_v2[33922][4]
    gr = bild.tag_v2[33550][0]
    breite, hoehe = bild.size
    print(f'Luftbild {breite}×{hoehe}, {gr * 100:.1f} cm je Bildpunkt', flush=True)
    bild = bild.convert('RGBA')

    ecken = [gk_zu_wgs(e0 + dx * breite * gr, n0 - dy * hoehe * gr) for dx in (0, 1) for dy in (0, 1)]
    lat_s, lat_n = min(p[0] for p in ecken), max(p[0] for p in ecken)
    lng_w, lng_o = min(p[1] for p in ecken), max(p[1] for p in ecken)
    print(f'Bereich {lat_s:.6f}–{lat_n:.6f} N, {lng_w:.6f}–{lng_o:.6f} O', flush=True)

    gesamt = 0
    for z in range(zmax, zmin - 1, -1):
        # Quelle auf ungefähr die Kachel-Auflösung verkleinern, damit QUAD sauber mittelt
        m_je_px = 156543.03392 * math.cos(math.radians((lat_s + lat_n) / 2)) / 2 ** z
        faktor = min(1.0, gr / m_je_px * 1.5)
        q = bild if faktor >= 1 else bild.resize((max(1, round(breite * faktor)), max(1, round(hoehe * faktor))), Image.LANCZOS)
        fx, fy = q.size[0] / breite, q.size[1] / hoehe

        def zu_px(lat, lng):
            e, n = wgs_zu_gk(lat, lng)
            return (e - e0) / gr * fx, (n0 - n) / gr * fy

        x0, y0 = wgs_zu_kachel(lat_n, lng_w, z)
        x1, y1 = wgs_zu_kachel(lat_s, lng_o, z)
        anzahl = 0
        for tx in range(int(x0), int(x1) + 1):
            for ty in range(int(y0), int(y1) + 1):
                # QUAD erwartet die Quellecken oben-links, unten-links, unten-rechts, oben-rechts
                ol = zu_px(*kachel_zu_wgs(tx, ty, z))
                ul = zu_px(*kachel_zu_wgs(tx, ty + 1, z))
                ur = zu_px(*kachel_zu_wgs(tx + 1, ty + 1, z))
                orr = zu_px(*kachel_zu_wgs(tx + 1, ty, z))
                k = q.transform((KACHEL, KACHEL), Image.QUAD, data=(*ol, *ul, *ur, *orr), resample=Image.BICUBIC)
                if k.getchannel('A').getextrema()[1] == 0:
                    continue
                pfad = os.path.join(ziel, str(z), str(tx))
                os.makedirs(pfad, exist_ok=True)
                k.save(os.path.join(pfad, f'{ty}.webp'), 'WEBP', quality=QUALITAET, method=6)
                anzahl += 1
        gesamt += anzahl
        print(f'Zoom {z}: {anzahl} Kacheln', flush=True)
    print(f'Fertig: {gesamt} Kacheln in {ziel}')


if __name__ == '__main__':
    main()

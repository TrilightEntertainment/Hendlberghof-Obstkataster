"""Höhenlinien der Vermessung 2023 (GeoPackage, EPSG:31256) für die Karte.

Liest die Linien ohne Zusatzbibliotheken (SQLite + WKB), nimmt die 5-m- und
10-m-Linien, vereinfacht sie und rechnet nach WGS84 um.
Aufruf: python3 tools/hoehenlinien.py <gpkg> <ziel.json>
"""
import json
import math
import os
import sqlite3
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gk_wgs import gk_zu_wgs  # noqa: E402

TOLERANZ_M = 0.4
MIN_LAENGE_M = 6


def wkb_linien(b):
    """GeoPackage-Geometrie -> Liste von Linien [(x, y), ...]."""
    flags = b[3]
    env = (flags >> 1) & 7
    pos = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
    linien = []

    def lies(pos):
        ordnung = '<' if b[pos] == 1 else '>'
        typ = struct.unpack(ordnung + 'I', b[pos + 1:pos + 5])[0]
        pos += 5
        dim = 3 if (typ >= 1000 and typ < 2000) or typ & 0x80000000 else 2
        typ = typ % 1000 if typ < 0x80000000 else typ & 0xFFFF
        if typ == 2:
            n = struct.unpack(ordnung + 'I', b[pos:pos + 4])[0]
            pos += 4
            pts = [struct.unpack(ordnung + 'd' * dim, b[pos + i * 8 * dim:pos + (i + 1) * 8 * dim])[:2] for i in range(n)]
            linien.append(pts)
            return pos + n * 8 * dim
        if typ == 5:
            n = struct.unpack(ordnung + 'I', b[pos:pos + 4])[0]
            pos += 4
            for _ in range(n):
                pos = lies(pos)
            return pos
        raise ValueError(f'Geometrietyp {typ} nicht erwartet')
    lies(pos)
    return linien


def vereinfachen(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    L = math.dist(a, b) or 1e-9
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        return vereinfachen(pts[:idx + 1], tol)[:-1] + vereinfachen(pts[idx:], tol)
    return [a, b]


def main():
    db = sqlite3.connect(sys.argv[1])
    linien = {}
    for geo, hoehe, ebene in db.execute("select geometry, ELEVATION, LAYER from vector_features"):
        if '5m' not in ebene:
            continue
        h = int(round(hoehe))
        if h % 5:
            continue
        for l in wkb_linien(geo):
            if sum(math.dist(p, q) for p, q in zip(l, l[1:])) < MIN_LAENGE_M:
                continue
            v = vereinfachen(l, TOLERANZ_M)
            linien.setdefault(h, []).append([[round(c, 6) for c in gk_zu_wgs(*p)] for p in v])
    aus = {'quelle': 'Höhenlinien der Vermessung 2023 (Hendlberghof_Contours_1-5-10m_31256.gpkg), 5-m-Abstand, vereinfacht auf 0,4 m',
           'linien': [{'h': h, 'geo': ls} for h, ls in sorted(linien.items())]}
    json.dump(aus, open(sys.argv[2], 'w'), separators=(',', ':'))
    n = sum(len(x['geo']) for x in aus['linien'])
    p = sum(len(g) for x in aus['linien'] for g in x['geo'])
    print(f'{len(aus["linien"])} Höhen ({min(linien)}–{max(linien)} m), {n} Linien, {p} Punkte, {os.path.getsize(sys.argv[2]) // 1024} KB')


if __name__ == '__main__':
    main()

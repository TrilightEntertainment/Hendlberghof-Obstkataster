"""Höhenlinien aus dem Geländemodell des BEV (ALS-DTM, 1 m, Boden ohne Bäume und Häuser).

Lizenz CC BY 4.0, Quelle: BEV – Bundesamt für Eich- und Vermessungswesen.
Die Kachel ist 8 GB groß, ist aber ein Cloud-Optimized GeoTIFF: Per Range-Abfrage
kommen nur die 512er-Blöcke rund um den Hof (LZW, Gleitkomma-Prädiktor). Danach
leicht geglättet, Höhenlinien per Marching Squares, vereinfacht, nach WGS84.
Ohne Zusatzbibliotheken.
Aufruf: python3 tools/hoehenlinien_bev.py data/hoehenlinien.json
"""
import json
import math
import os
import struct
import sys
import urllib.request

STICHTAG = '20250915'
URL = f'https://data.bev.gv.at/download/ALS/DTM/{STICHTAG}/ALS_DTM_CRS3035RES50000mN2750000E4750000.tif'
# Ausschnitt in EPSG:3035 (Meter): Hof samt rund 150 m Rand
XMIN, YMIN, XMAX, YMAX = 4755850, 2789750, 4756650, 2790700
ABSTAND = 5
TOLERANZ_M = 0.4
MIN_LAENGE_M = 8

# ---------- EPSG:3035 (LAEA Europa, GRS80) ----------
_A = 6378137.0
_F = 1 / 298.257222101
_E2 = 2 * _F - _F * _F
_E = math.sqrt(_E2)
_LAT0, _LON0, _FE, _FN = math.radians(52), math.radians(10), 4321000, 3210000


def _q(p):
    s = math.sin(p)
    return (1 - _E2) * (s / (1 - _E2 * s * s) - 1 / (2 * _E) * math.log((1 - _E * s) / (1 + _E * s)))


_QP = _q(math.pi / 2)
_RQ = _A * math.sqrt(_QP / 2)
_B0 = math.asin(_q(_LAT0) / _QP)
_D = _A * (math.cos(_LAT0) / math.sqrt(1 - _E2 * math.sin(_LAT0) ** 2)) / (_RQ * math.cos(_B0))


def laea_zu_wgs(x, y):
    X, Y = (x - _FE) / _D, (y - _FN) * _D
    rho = math.hypot(X, Y)
    c = 2 * math.asin(rho / (2 * _RQ))
    b = math.asin(math.cos(c) * math.sin(_B0) + Y * math.sin(c) * math.cos(_B0) / rho)
    lon = _LON0 + math.atan2(X * math.sin(c), rho * math.cos(_B0) * math.cos(c) - Y * math.sin(_B0) * math.sin(c))
    e2 = _E2
    lat = (b + (e2 / 3 + 31 * e2**2 / 180 + 517 * e2**3 / 5040) * math.sin(2 * b)
           + (23 * e2**2 / 360 + 251 * e2**3 / 3780) * math.sin(4 * b) + (761 * e2**3 / 45360) * math.sin(6 * b))
    return math.degrees(lat), math.degrees(lon)


# ---------- Ausschnitt aus dem COG ----------
def _bytes(a, n):
    r = urllib.request.Request(URL, headers={'Range': f'bytes={a}-{a + n - 1}', 'User-Agent': 'hendlberghof-kataster/1.0'})
    return urllib.request.urlopen(r, timeout=120).read()


def _lzw(d):
    out = bytearray()
    tab = [bytes([i]) for i in range(256)] + [b'', b'']
    bits, pos, prev = 9, 0, None
    while pos + bits <= len(d) * 8:
        bi = pos >> 3
        chunk = int.from_bytes(d[bi:bi + 4].ljust(4, b'\0'), 'big')
        code = (chunk >> (32 - (pos & 7) - bits)) & ((1 << bits) - 1)
        pos += bits
        if code == 256:
            tab, bits, prev = tab[:258], 9, None
            continue
        if code == 257:
            break
        if prev is None:
            s = tab[code]
        else:
            s = tab[code] if code < len(tab) else prev + prev[:1]
            tab.append(prev + s[:1])
        out += s
        prev = s
        if len(tab) + 1 >= (1 << bits) and bits < 12:
            bits += 1
    return bytes(out)


def ausschnitt():
    kopf = _bytes(0, 16)
    assert kopf[:4] == b'II+\x00', 'BigTIFF (little endian) erwartet'
    ifd_off = struct.unpack('<Q', kopf[8:16])[0]
    ifd = _bytes(ifd_off, 8 + 40 * 20)
    tags = {}
    for i in range(struct.unpack('<Q', ifd[:8])[0]):
        e = ifd[8 + i * 20:28 + i * 20]
        tag, typ = struct.unpack('<HH', e[:4])
        tags[tag] = (struct.unpack('<Q', e[4:12])[0], e[12:])

    def wert(tag, fmt, sz):
        c, v = tags[tag]
        roh = v[:c * sz] if c * sz <= 8 else _bytes(struct.unpack('<Q', v)[0], c * sz)
        return struct.unpack('<' + fmt * c, roh)
    assert wert(259, 'H', 2)[0] == 5 and wert(317, 'H', 2)[0] == 3, 'LZW mit Gleitkomma-Prädiktor erwartet'
    breite_ges, tw = wert(256, 'H', 2)[0], wert(322, 'H', 2)[0]
    x0, y0 = wert(33922, 'd', 8)[3:5]
    px = wert(33550, 'd', 8)[0]
    offs, laengen = wert(324, 'Q', 8), wert(325, 'I', 4)
    c0, c1 = int((XMIN - x0) / px), int((XMAX - x0) / px) + 1
    r0, r1 = int((y0 - YMAX) / px), int((y0 - YMIN) / px) + 1
    tpr = (breite_ges + tw - 1) // tw
    gitter = [[None] * (c1 - c0) for _ in range(r1 - r0)]
    for ty in range(r0 // tw, (r1 - 1) // tw + 1):
        for tx in range(c0 // tw, (c1 - 1) // tw + 1):
            i = ty * tpr + tx
            roh = _lzw(_bytes(offs[i], laengen[i]))
            for r in range(tw):
                R = ty * tw + r - r0
                if not 0 <= R < len(gitter):
                    continue
                z = bytearray(roh[r * tw * 4:(r + 1) * tw * 4])
                for k in range(1, len(z)):
                    z[k] = (z[k] + z[k - 1]) & 255
                for c in range(tw):
                    C = tx * tw + c - c0
                    if 0 <= C < len(gitter[0]):
                        v = struct.unpack('>f', bytes((z[c], z[tw + c], z[2 * tw + c], z[3 * tw + c])))[0]
                        gitter[R][C] = v if v > -9000 else None
    # Pixelmitte in Meter
    return gitter, x0 + (c0 + 0.5) * px, y0 - (r0 + 0.5) * px, px


def glaetten(g):
    """3×3-Mittel, nimmt das Rauschen der Laserpunkte aus den Linien."""
    H, W = len(g), len(g[0])
    aus = [[None] * W for _ in range(H)]
    for r in range(H):
        for c in range(W):
            werte = [g[i][k] for i in range(max(0, r - 1), min(H, r + 2)) for k in range(max(0, c - 1), min(W, c + 2)) if g[i][k] is not None]
            aus[r][c] = sum(werte) / len(werte) if werte else None
    return aus


# ---------- Marching Squares ----------
def linien(g, h):
    H, W = len(g), len(g[0])
    kanten = {}

    def punkt(a, b):
        (ra, ca), (rb, cb) = a, b
        va, vb = g[ra][ca], g[rb][cb]
        t = (h - va) / (vb - va)
        return (ra + (rb - ra) * t, ca + (cb - ca) * t)
    segmente = []
    for r in range(H - 1):
        for c in range(W - 1):
            ecken = ((r, c), (r, c + 1), (r + 1, c + 1), (r + 1, c))
            v = [g[i][k] for i, k in ecken]
            if None in v:
                continue
            idx = sum(1 << n for n in range(4) if v[n] >= h)
            if idx in (0, 15):
                continue
            seiten = [(ecken[n], ecken[(n + 1) % 4]) for n in range(4) if (v[n] >= h) != (v[(n + 1) % 4] >= h)]
            if len(seiten) == 4:   # Sattel: nach Mittelwert verbinden
                mitte = sum(v) / 4 >= h
                paare = [(0, 1), (2, 3)] if (v[0] >= h) == mitte else [(0, 3), (1, 2)]
            else:
                paare = [(0, 1)]
            for a, b in paare:
                segmente.append((tuple(sorted(seiten[a])), tuple(sorted(seiten[b]))))
    for s in segmente:
        for k in s:
            kanten.setdefault(k, []).append(s)
    benutzt, ergebnis = set(), []
    for s in segmente:
        if id(s) in benutzt:
            continue
        benutzt.add(id(s))
        kette = [s[0], s[1]]
        for richtung in (1, 0):
            while True:
                ende = kette[-1] if richtung else kette[0]
                weiter = [t for t in kanten[ende] if id(t) not in benutzt]
                if not weiter:
                    break
                t = weiter[0]
                benutzt.add(id(t))
                neu = t[1] if t[0] == ende else t[0]
                if richtung:
                    kette.append(neu)
                else:
                    kette.insert(0, neu)
        ergebnis.append([punkt(*k) for k in kette])
    return ergebnis


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
    roh, x0, y0, px = ausschnitt()
    g = glaetten(roh)
    werte = [v for z in g for v in z if v is not None]
    linien_je_hoehe = {}
    for h in range(int(math.ceil(min(werte) / ABSTAND)) * ABSTAND, int(max(werte)) + 1, ABSTAND):
        for l in linien(g, h):
            meter = [(x0 + c * px, y0 - r * px) for r, c in l]
            if sum(math.dist(p, q) for p, q in zip(meter, meter[1:])) < MIN_LAENGE_M:
                continue
            v = vereinfachen(meter, TOLERANZ_M)
            linien_je_hoehe.setdefault(h, []).append([[round(k, 6) for k in laea_zu_wgs(*p)] for p in v])
    aus = {'quelle': f'Geländemodell BEV ALS-DTM 1 m, Stichtag {STICHTAG[:4]}-{STICHTAG[4:6]}-{STICHTAG[6:]}, '
                     f'CC BY 4.0 (BEV – Bundesamt für Eich- und Vermessungswesen); {ABSTAND}-m-Abstand, vereinfacht auf {TOLERANZ_M} m',
           'linien': [{'h': h, 'geo': ls} for h, ls in sorted(linien_je_hoehe.items())]}
    json.dump(aus, open(sys.argv[1], 'w'), separators=(',', ':'))
    n = sum(len(x['geo']) for x in aus['linien'])
    p = sum(len(q) for x in aus['linien'] for q in x['geo'])
    print(f'{len(aus["linien"])} Höhen ({min(linien_je_hoehe)}–{max(linien_je_hoehe)} m), {n} Linien, {p} Punkte, {os.path.getsize(sys.argv[1]) // 1024} KB')


if __name__ == '__main__':
    main()

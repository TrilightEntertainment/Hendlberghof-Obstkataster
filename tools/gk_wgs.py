"""Umrechnung MGI / Austria GK East (EPSG:31256) <-> WGS84, ohne Zusatzbibliotheken.

Transversale Mercator auf dem Bessel-Ellipsoid, dann 7-Parameter-Helmert
(Werte aus dem GeoTIFF der Vermessung 2023, entsprechen PROJ +towgs84).
Genauigkeit der Helmert-Transformation in Österreich: etwa 1 m.
"""
import math

BESSEL = (6377397.155, 1 / 299.1528128)
WGS84 = (6378137.0, 1 / 298.257223563)
LON0 = math.radians(16 + 20 / 60)
FN = -5000000.0
TOWGS84 = (577.326, 90.129, 463.919, 5.137, 1.474, 5.297, 2.4232)


def _tm_konst(a, f):
    n = f / (2 - f)
    A = a / (1 + n) * (1 + n**2 / 4 + n**4 / 64)
    alpha = (n / 2 - 2 * n**2 / 3 + 5 * n**3 / 16,
             13 * n**2 / 48 - 3 * n**3 / 5,
             61 * n**3 / 240)
    beta = (n / 2 - 2 * n**2 / 3 + 37 * n**3 / 96,
            n**2 / 48 + n**3 / 15,
            17 * n**3 / 480)
    delta = (2 * n - 2 * n**2 / 3 - 2 * n**3,
             7 * n**2 / 3 - 8 * n**3 / 5,
             56 * n**3 / 15)
    return n, A, alpha, beta, delta


_N, _A, _ALPHA, _BETA, _DELTA = _tm_konst(*BESSEL)


def gk_zu_bessel(e, n):
    xi = (n - FN) / _A
    eta = e / _A
    xi_ = xi - sum(_BETA[j] * math.sin(2 * (j + 1) * xi) * math.cosh(2 * (j + 1) * eta) for j in range(3))
    eta_ = eta - sum(_BETA[j] * math.cos(2 * (j + 1) * xi) * math.sinh(2 * (j + 1) * eta) for j in range(3))
    chi = math.asin(math.sin(xi_) / math.cosh(eta_))
    phi = chi + sum(_DELTA[j] * math.sin(2 * (j + 1) * chi) for j in range(3))
    lam = LON0 + math.atan2(math.sinh(eta_), math.cos(xi_))
    return phi, lam


def bessel_zu_gk(phi, lam):
    n = _N
    t = math.sinh(math.atanh(math.sin(phi)) - 2 * math.sqrt(n) / (1 + n) * math.atanh(2 * math.sqrt(n) / (1 + n) * math.sin(phi)))
    xi_ = math.atan2(t, math.cos(lam - LON0))
    eta_ = math.atanh(math.sin(lam - LON0) / math.sqrt(1 + t * t))
    xi = xi_ + sum(_ALPHA[j] * math.sin(2 * (j + 1) * xi_) * math.cosh(2 * (j + 1) * eta_) for j in range(3))
    eta = eta_ + sum(_ALPHA[j] * math.cos(2 * (j + 1) * xi_) * math.sinh(2 * (j + 1) * eta_) for j in range(3))
    return _A * eta, FN + _A * xi


def _geo_zu_xyz(phi, lam, ell, h=0.0):
    a, f = ell
    e2 = f * (2 - f)
    N = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    return ((N + h) * math.cos(phi) * math.cos(lam),
            (N + h) * math.cos(phi) * math.sin(lam),
            (N * (1 - e2) + h) * math.sin(phi))


def _xyz_zu_geo(x, y, z, ell):
    a, f = ell
    e2 = f * (2 - f)
    lam = math.atan2(y, x)
    p = math.hypot(x, y)
    phi = math.atan2(z, p * (1 - e2))
    for _ in range(6):
        N = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
        h = p / math.cos(phi) - N
        phi = math.atan2(z, p * (1 - e2 * N / (N + h)))
    return phi, lam


def _helmert(x, y, z, vorwaerts=True):
    dx, dy, dz, rx, ry, rz, s = TOWGS84
    k = math.pi / (180 * 3600)
    rx, ry, rz, m = rx * k, ry * k, rz * k, 1 + s * 1e-6
    if vorwaerts:  # Position-Vector-Konvention wie PROJ towgs84
        return (dx + m * (x - rz * y + ry * z),
                dy + m * (rz * x + y - rx * z),
                dz + m * (-ry * x + rx * y + z))
    x, y, z = x - dx, y - dy, z - dz
    x, y, z = x / m, y / m, z / m
    return (x + rz * y - ry * z, -rz * x + y + rx * z, ry * x - rx * y + z)


def gk_zu_wgs(e, n):
    """GK East (Meter) -> (Breite, Länge) WGS84 in Grad."""
    phi, lam = gk_zu_bessel(e, n)
    phi, lam = _xyz_zu_geo(*_helmert(*_geo_zu_xyz(phi, lam, BESSEL)), WGS84)
    return math.degrees(phi), math.degrees(lam)


def wgs_zu_gk(lat, lng):
    """(Breite, Länge) WGS84 in Grad -> GK East (Rechtswert, Hochwert) in Meter."""
    phi, lam = _xyz_zu_geo(*_helmert(*_geo_zu_xyz(math.radians(lat), math.radians(lng), WGS84), vorwaerts=False), BESSEL)
    return bessel_zu_gk(phi, lam)


if __name__ == '__main__':
    # Selbsttest: Hin- und Rückweg über das Luftbild der Vermessung 2023
    for e, n in [(-36515.55, 326103.69), (-36198.70, 325664.75), (-36357.0, 325884.0)]:
        lat, lng = gk_zu_wgs(e, n)
        e2, n2 = wgs_zu_gk(lat, lng)
        print(f'{e:.2f} {n:.2f} -> {lat:.7f} {lng:.7f} -> Abweichung {math.hypot(e - e2, n - n2) * 1000:.3f} mm')

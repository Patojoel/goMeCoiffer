"""Génère les 3 concepts de logo GoMeCoiffer (symboles + lockups) en SVG noir. v2."""
import math
import os
import sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)


def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def u(deg):
    a = math.radians(deg)
    return math.cos(a), -math.sin(a)  # y écran vers le bas


def add(p, v, k=1.0):
    return p[0] + v[0] * k, p[1] + v[1] * k


def P(p):
    return f"{f(p[0])} {f(p[1])}"


def svg(body, w=256, h=256):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f"{body}</svg>\n")


def save(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(content)


def arc(r, end, large, sweep):
    return f"A{f(r)} {f(r)} 0 {large} {sweep} {P(end)}"


# ---------------------------------------------------------------- A : G-boucle
def concept_a(cx=128.0, cy=128.0, R=86.0, w=36.0, t_deg=38.0, j_deg=-30.0):
    """G dont la barre s'enroule en boucle de cheveu crépu.
    Ligne médiane : arc R autour de O1 du terminal (t_deg) jusqu'à j_deg (anti-horaire, par le haut),
    puis demi-cercle de rayon R/2 autour de O2 (milieu de O1 et du point de jonction) qui finit au centre O1."""
    h = w / 2
    O1 = (cx, cy)
    r2 = R / 2
    O2 = add(O1, u(j_deg), r2)
    jo, ji = add(O1, u(j_deg), R + h), add(O1, u(j_deg), R - h)
    to, ti = add(O1, u(t_deg), R + h), add(O1, u(t_deg), R - h)
    # demi-cercle autour de O2, par sa moitié droite/haute (anti-horaire depuis j_deg)
    mid = j_deg + 90
    end = j_deg + 180
    d = f"M{P(to)}"
    d += arc(R + h, jo, 1, 0)                                   # bord extérieur du G
    d += arc(r2 + h, add(O2, u(mid), r2 + h), 0, 0)             # bord extérieur de la boucle
    d += arc(r2 + h, add(O2, u(end), r2 + h), 0, 0)
    d += arc(h, add(O1, u(end + 90), h), 0, 0)                  # bout arrondi au centre
    d += arc(h, add(O2, u(end), r2 - h), 0, 0)
    d += arc(r2 - h, add(O2, u(mid), r2 - h), 0, 1)             # bord intérieur de la boucle
    d += arc(r2 - h, ji, 0, 1)
    d += arc(R - h, ti, 1, 1)                                   # bord intérieur du G
    d += "Z"
    return f'<path d="{d}" fill="#000"/>'


# ---------------------------------------------------------------- B : Peigne-repère
def rrect(x, y, w, h, rx):
    return (f"M{f(x + rx)} {f(y)}H{f(x + w - rx)}A{f(rx)} {f(rx)} 0 0 1 {f(x + w)} {f(y + rx)}"
            f"V{f(y + h - rx)}A{f(rx)} {f(rx)} 0 0 1 {f(x + w - rx)} {f(y + h)}"
            f"H{f(x + rx)}A{f(rx)} {f(rx)} 0 0 1 {f(x)} {f(y + h - rx)}"
            f"V{f(y + rx)}A{f(rx)} {f(rx)} 0 0 1 {f(x + rx)} {f(y)}Z")


def circle(c, r, cw=True):
    s = 1 if cw else 0
    a = (c[0] - r, c[1])
    return f"M{P(a)}a{f(r)} {f(r)} 0 1 {s} {f(2 * r)} 0a{f(r)} {f(r)} 0 1 {s} {f(-2 * r)} 0Z"


def concept_b():
    """Peigne afro dont le manche est un repère de carte : le salon près de chez toi."""
    pc, R, hole = (128.0, 70.0), 46.0, 17.0
    tip = (128.0, 150.0)
    # tangentes du cercle vers la pointe
    dist = tip[1] - pc[1]
    alpha = math.degrees(math.acos(R / dist))  # angle entre l'axe vertical-bas et le rayon tangent
    # rayon tangent à droite : direction -90 + alpha (vers le bas, décalé à droite)
    right = add(pc, u(-90 + alpha), R)
    left = add(pc, u(-90 - alpha), R)
    pin = (f"M{P(right)}L{P(tip)}L{P(left)}"
           f"A{f(R)} {f(R)} 0 1 1 {P(right)}Z")
    pin_hole = circle(pc, hole, cw=False)
    # tête + dents en un seul contour : coins hauts arrondis, dents à bout rond
    x0, w, top, band, bottom, tw, n, rt = 44.0, 168.0, 124.0, 32.0, 232.0, 24.0, 4, 16.0
    gap = (w - n * tw) / (n - 1)
    d = f"M{f(x0)} {f(top + rt)}A{f(rt)} {f(rt)} 0 0 1 {f(x0 + rt)} {f(top)}H{f(x0 + w - rt)}"
    d += f"A{f(rt)} {f(rt)} 0 0 1 {f(x0 + w)} {f(top + rt)}"
    for i in reversed(range(n)):
        xl = x0 + i * (tw + gap)
        xr = xl + tw
        d += f"L{f(xr)} {f(bottom - tw / 2)}A{f(tw / 2)} {f(tw / 2)} 0 0 1 {f(xl)} {f(bottom - tw / 2)}"
        if i > 0:
            d += f"L{f(xl)} {f(top + band)}L{f(xl - gap)} {f(top + band)}"
    d += "Z"
    return f'<path d="{pin}{pin_hole}{d}" fill="#000"/>'


# ---------------------------------------------------------------- C : Ciseaux-coche
def blade(p, deg, length, hw, tw=5.0):
    """Lame : trait effilé du pivot (demi-largeur hw) à la pointe (demi-largeur tw, bout rond)."""
    ud = u(deg)
    n = (-ud[1], ud[0])
    e = add(p, ud, length)
    a, b = add(p, n, hw), add(e, n, tw)
    c, d_ = add(e, n, -tw), add(p, n, -hw)
    back = add(p, ud, -hw)
    return (f"M{P(a)}L{P(b)}A{f(tw)} {f(tw)} 0 0 0 {P(c)}L{P(d_)}"
            f"A{f(hw)} {f(hw)} 0 0 0 {P(back)}A{f(hw)} {f(hw)} 0 0 0 {P(a)}Z")


def shank_ring(p, deg, length, sw, ro, ri):
    ud = u(deg)
    n = (-ud[1], ud[0])
    c = add(p, ud, length)
    q = add(p, ud, length - ri)
    d = (f"M{P(add(p, n, sw))}L{P(add(q, n, sw))}L{P(add(q, n, -sw))}L{P(add(p, n, -sw))}Z")
    return d, c


def concept_c(px=120.0, py=146.0):
    p = (px, py)
    d1 = blade(p, 135, 62, 16)     # petite branche de la coche (45°)
    d2 = blade(p, 60, 130, 16)     # grande branche de la coche (60°)
    s1, c1 = shank_ring(p, -45, 62, 8, 25, 13)
    s2, c2 = shank_ring(p, 240, 62, 8, 25, 13)
    rings = circle(c1, 25) + circle(c1, 13, cw=False) + circle(c2, 25) + circle(c2, 13, cw=False)
    return "".join(f'<path d="{d}" fill="#000"/>' for d in (d1, d2, s1, s2, rings))


# ---------------------------------------------------------------- lockups (texte vivant : exploration)
def lockup(symbol_body, font, weight, spacing, split=False):
    if split:
        txt = (f'<tspan font-weight="{weight}">GoMe</tspan>'
               f'<tspan font-weight="400">Coiffer</tspan>')
    else:
        txt = "GoMeCoiffer"
    body = (f'<g>{symbol_body}</g>'
            f'<text x="292" y="164" font-family="{font}" font-size="104" font-weight="{weight}" '
            f'letter-spacing="{spacing}" fill="#000">{txt}</text>')
    return svg(body, 1000, 256)


A = concept_a()
B = concept_b()
Cc = concept_c()
save("a-symbol.svg", svg(A))
save("b-symbol.svg", svg(B))
save("c-symbol.svg", svg(Cc))
save("a-lockup.svg", lockup(A, "Century Gothic, Segoe UI, sans-serif", 700, -2))
save("b-lockup.svg", lockup(B, "Bahnschrift, Segoe UI, sans-serif", 700, -1, split=True))
save("c-lockup.svg", lockup(Cc, "Segoe UI, sans-serif", 700, -3, split=True))
print("ok")


# ================================================================ v5 : G-boucle + m en exposant
def m_glyph(x0, yb, r, s, h, round_caps=True):
    """m minuscule construit (pas de <text>) : 3 fûts, 2 arches demi-circulaires de rayon r (ligne médiane).
    x0 = axe du 1er fût, yb = ligne de base (bas des fûts, hors bout rond), h = hauteur de la ligne médiane."""
    hs = s / 2
    cy = yb - h + r                      # centre des arches
    R_out = r + hs
    ri = r - hs
    xs = [x0, x0 + 2 * r, x0 + 4 * r]
    top_mid = (x0 + 2 * r, cy - math.sqrt(R_out ** 2 - r ** 2))

    def foot(x_from, x_to):
        if round_caps:
            return f"A{f(hs)} {f(hs)} 0 0 1 {f(x_to)} {f(yb)}"
        return f"L{f(x_to)} {f(yb)}"

    d = f"M{f(xs[0] - hs)} {f(yb)}V{f(cy)}"
    d += f"A{f(R_out)} {f(R_out)} 0 0 1 {P(top_mid)}"
    d += f"A{f(R_out)} {f(R_out)} 0 0 1 {f(xs[2] + hs)} {f(cy)}"
    d += f"V{f(yb)}" + foot(xs[2] + hs, xs[2] - hs)
    d += f"V{f(cy)}A{f(ri)} {f(ri)} 0 0 0 {f(xs[1] + hs)} {f(cy)}"
    d += f"V{f(yb)}" + foot(xs[1] + hs, xs[1] - hs)
    d += f"V{f(cy)}A{f(ri)} {f(ri)} 0 0 0 {f(xs[0] + hs)} {f(cy)}"
    d += f"V{f(yb)}" + foot(xs[0] + hs, xs[0] - hs)
    d += "Z"
    return f'<path d="{d}" fill="#000"/>'


# V1 : exposant classique, fûts droits (même famille que le G : coupe nette)
GA1 = concept_a(cx=94, cy=152, R=68, w=28)
M1 = m_glyph(x0=172, yb=86, r=16, s=17, h=54, round_caps=False)
save("a1-symbol.svg", svg(GA1 + M1))
# V2 : exposant plus serré contre le G, bouts ronds comme la fin de la boucle
GA2 = concept_a(cx=94, cy=152, R=68, w=28)
M2 = m_glyph(x0=172, yb=82, r=16, s=17, h=50, round_caps=True)
save("a2-symbol.svg", svg(GA2 + M2))
for k, body in (("a1", GA1 + M1), ("a2", GA2 + M2)):
    save(f"{k}-lockup.svg", lockup(body, "Century Gothic, Segoe UI, sans-serif", 700, -2))

"""Génère les fichiers maîtres du logo GoMeCoiffer (direction « G-boucle + m en exposant, bouts ronds »).

Usage : python kit.py <dossier-de-sortie> <chemin-police-Outfit-variable.ttf>
Dépendance : fontTools (pip install fonttools). La géométrie du symbole vient de gen.py (même dossier).
"""
import os
import sys
import tempfile

from fontTools.pens.boundsPen import ControlBoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT, FONT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# gen.py écrit ses concepts au chargement : on le redirige vers un dossier jetable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_argv = sys.argv
sys.argv = ["gen.py", tempfile.mkdtemp()]
import gen  # noqa: E402

sys.argv = _argv

# ---------------------------------------------------------------- palette
NAVY = "#17213B"     # Bleu nuit
TERRA = "#D2603A"    # Terre cuite
IVORY = "#F6EFE6"    # Ivoire

# ---------------------------------------------------------------- symbole (géométrie validée, concept C)
G_D = gen.concept_a(cx=94, cy=152, R=68, w=28).split('d="')[1].split('"')[0]
M_D = gen.m_glyph(x0=172, yb=82, r=16, s=17, h=50, round_caps=True).split('d="')[1].split('"')[0]
SYM_BOX = (12.0, 23.5, 244.5, 234.0)          # boîte d'encre du symbole (x0, y0, x1, y1)
G_CENTER_Y = 152.0
# version petite taille : le G seul, trait plus épais pour tenir à 16 px
G_SMALL_D = gen.concept_a(cx=128, cy=128, R=84, w=40).split('d="')[1].split('"')[0]


def symbol_paths(g_fill, m_fill, dx=0.0, dy=0.0, k=1.0):
    t = f' transform="translate({gen.f(dx)} {gen.f(dy)}) scale({gen.f(k)})"' if (dx or dy or k != 1) else ""
    return (f'<g{t}><path d="{G_D}" fill="{g_fill}"/>'
            f'<path d="{M_D}" fill="{m_fill}"/></g>')


# ---------------------------------------------------------------- nom vectorisé (Outfit SemiBold, crénage GPOS)
font = instantiateVariableFont(TTFont(FONT), {"wght": 600})
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
UPM = font["head"].unitsPerEm
CAP = font["OS/2"].sCapHeight


def _class_of(class_def, g):
    return class_def.classDefs.get(g, 0) if class_def else 0


def kerning(left, right):
    """Ajustement d'approche GPOS (PairPos format 1 et 2) entre deux glyphes, en unités de la police."""
    if "GPOS" not in font:
        return 0
    total = 0
    for lookup in font["GPOS"].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            if lookup.LookupType == 9:
                if sub.ExtSubTable.LookupType != 2:
                    continue
                sub = sub.ExtSubTable
            elif lookup.LookupType != 2:
                continue
            cov = sub.Coverage.glyphs
            if left not in cov:
                continue
            if sub.Format == 1:
                for rec in sub.PairSet[cov.index(left)].PairValueRecord:
                    if rec.SecondGlyph == right and rec.Value1 is not None:
                        total += getattr(rec.Value1, "XAdvance", 0) or 0
                        break
            elif sub.Format == 2:
                c1, c2 = _class_of(sub.ClassDef1, left), _class_of(sub.ClassDef2, right)
                v = sub.Class1Record[c1].Class2Record[c2].Value1
                total += (getattr(v, "XAdvance", 0) or 0) if v is not None else 0
    return total


def wordmark(segments, cap_px, x, baseline, tracking_em=-0.01):
    """segments = [(texte, couleur)] -> (svg, x_fin_encre, (x0, y0, x1, y1))."""
    s = cap_px / CAP
    hmtx = font["hmtx"]
    out, prev = [], None
    pen_x = x
    bx0 = by0 = float("inf")
    bx1 = by1 = float("-inf")
    for text, color in segments:
        sp = SVGPathPen(glyphs)
        for ch in text:
            g = cmap[ord(ch)]
            if prev is not None:
                pen_x += (kerning(prev, g) + tracking_em * UPM) * s
            tp = TransformPen(sp, (s, 0, 0, -s, pen_x, baseline))
            glyphs[g].draw(tp)
            bp = ControlBoundsPen(glyphs)
            glyphs[g].draw(bp)
            if bp.bounds:
                gx0, gy0, gx1, gy1 = bp.bounds
                bx0 = min(bx0, pen_x + gx0 * s)
                bx1 = max(bx1, pen_x + gx1 * s)
                by0 = min(by0, baseline - gy1 * s)
                by1 = max(by1, baseline - gy0 * s)
            pen_x += hmtx[g][0] * s
            prev = g
        out.append(f'<path d="{sp.getCommands()}" fill="{color}"/>')
    return "".join(out), (bx0, by0, bx1, by1)


def name_segments(navy, terra):
    return [("Go", navy), ("Me", terra), ("Coiffer", navy)]


def doc(body, w, h, title, bg=None):
    rect = f'<rect width="{gen.f(w)}" height="{gen.f(h)}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {gen.f(w)} {gen.f(h)}" '
            f'width="{gen.f(w)}" height="{gen.f(h)}"><title>{title}</title>{rect}{body}</svg>\n')


def save(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(content)


TITLE = "GoMeCoiffer"
MARGIN = 12.0

VERSIONS = (
    ("", NAVY, TERRA, NAVY, None),             # fond blanc / ivoire
    ("-reversed", IVORY, TERRA, IVORY, None),  # fond bleu nuit / noir
    ("-on-terra", NAVY, IVORY, NAVY, None),    # fond terre cuite : le m passe en ivoire
)
for suffix, g_col, m_col, n_col, bg in VERSIONS:
    # symbole
    save(f"gomecoiffer-symbol{suffix}.svg", doc(symbol_paths(g_col, m_col), 256, 256, TITLE, bg))
    save(f"gomecoiffer-symbol-small{suffix}.svg",
         doc(f'<path d="{G_SMALL_D}" fill="{g_col}"/>', 256, 256, TITLE, bg))

    # horizontal : nom centré sur le G (pas sur l'exposant)
    cap_h = 70.0
    x_text = SYM_BOX[2] + 16
    wm, bb = wordmark(name_segments(n_col, m_col), cap_h, x_text, G_CENTER_Y + cap_h / 2)
    width = bb[2] + MARGIN
    save(f"gomecoiffer-horizontal{suffix}.svg",
         doc(symbol_paths(g_col, m_col) + wm, width, 256, TITLE, bg))

    # empilé : symbole centré au-dessus du nom
    cap_s = 62.0
    wm0, bb0 = wordmark(name_segments(n_col, m_col), cap_s, 0, 0)
    wm_w = bb0[2] - bb0[0]
    sym_w = SYM_BOX[2] - SYM_BOX[0]
    W = max(wm_w, sym_w) + 2 * MARGIN
    sym_dx = W / 2 - 108.0  # centre optique : le corps du G (x=94) décalé vers l'exposant
    base = SYM_BOX[3] + 44 + cap_s
    wm, bb = wordmark(name_segments(n_col, m_col), cap_s, (W - wm_w) / 2 - bb0[0], base)
    H = bb[3] + MARGIN + 8
    save(f"gomecoiffer-stacked{suffix}.svg",
         doc(symbol_paths(g_col, m_col, dx=sym_dx) + wm, W, H, TITLE, bg))

    # nom seul
    wm0, bb0 = wordmark(name_segments(n_col, m_col), 100, 0, 0)
    wm, bb = wordmark(name_segments(n_col, m_col), 100, MARGIN - bb0[0], MARGIN - bb0[1])
    save(f"gomecoiffer-wordmark{suffix}.svg",
         doc(wm, bb[2] + MARGIN, bb[3] + MARGIN, TITLE, bg))

# favicon SVG adaptatif (clair / sombre) à partir du G seul
WEB = os.path.join(os.path.dirname(os.path.abspath(OUT)), "web")
os.makedirs(WEB, exist_ok=True)
with open(os.path.join(WEB, "favicon.svg"), "w", encoding="utf-8") as fh:
    fh.write(
     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>GoMeCoiffer</title>'
     f'<style>path{{fill:{NAVY}}}@media (prefers-color-scheme: dark){{path{{fill:{IVORY}}}}}</style>'
     f'<path d="{G_SMALL_D}"/></svg>\n')
print("ok")

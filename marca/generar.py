#!/usr/bin/env python3
"""ORDEVA · genera la identidad visual en SVG (vectorial) a partir del logo del dueño.

El isotipo es la «O» circular con el corte diagonal «/» (anillo con dos interrupciones diagonales y centro vacío),
reconstruida con medidas del logo original (1000 × 1000): «O» de 500 × 506 centrada, hueco de 224 × 278, corte de
47 de ancho a 45°. Las letras («ORDEVA» y «TU NEGOCIO EN ORDEN») son la fuente Inter (licencia OFL) convertida a
trazos: se ven igual en todos los equipos, sin depender de las fuentes instaladas.

Uso:  python3 marca/generar.py        (necesita fontTools y las fuentes Inter del sistema)
Luego: node marca/png.js             (los PNG: favicon, iconos de la app, PWA y Android)
"""
import math, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

AQUI = os.path.dirname(os.path.abspath(__file__))
FUENTES = '/usr/share/fonts/opentype/inter/'


def superelipse(cx, cy, a, b, n, pasos=96):
    pts = []
    for i in range(pasos):
        t = 2 * math.pi * i / pasos
        c, s = math.cos(t), math.sin(t)
        pts.append((cx + a * math.copysign(abs(c) ** (2 / n), c), cy + b * math.copysign(abs(s) ** (2 / n), s)))
    return 'M' + ' L'.join('%.1f %.1f' % p for p in pts) + ' Z'


# Geometría del isotipo en el espacio del logo original (1000 × 1000).
EXT = superelipse(500, 499, 250, 253, 2.08)
INT = superelipse(500, 499, 112, 139, 2.35)
CORTE = '<rect x="476.5" y="180" width="47" height="640" transform="rotate(45 500 500)"/>'
ISO_CAJA = (250, 246, 500, 506)          # x, y, ancho, alto de la «O» sola


def grupo_iso(color, id_mask):
    return ('<mask id="%s" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="#fff"/>'
            '<g fill="#000">%s</g></mask><path fill="%s" fill-rule="evenodd" mask="url(#%s)" d="%s %s"/>' % (id_mask, CORTE, color, id_mask, EXT, INT))


def svg(vb, cuerpo, titulo='ORDEVA'):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" role="img" aria-label="%s"><title>%s</title>%s</svg>\n'
            % (' '.join('%g' % v for v in vb), titulo, titulo, cuerpo))


def texto(cadena, archivo, alto_mayus, espacio_em, x0=0, y_base=0):
    """Trazos de `cadena` con mayúsculas de `alto_mayus` de alto. Devuelve (path d, ancho)."""
    f = TTFont(os.path.join(FUENTES, archivo))
    gs, cmap = f.getGlyphSet(), f.getBestCmap()
    upm = f['head'].unitsPerEm
    cap = getattr(f['OS/2'], 'sCapHeight', 0) or upm * 0.727
    esc = alto_mayus / cap
    x, ds = x0, []
    for i, ch in enumerate(cadena):
        g = gs[cmap[ord(ch)]]
        pen = SVGPathPen(gs)
        g.draw(TransformPen(pen, (esc, 0, 0, -esc, x, y_base)))
        ds.append(pen.getCommands())
        x += g.width * esc + (espacio_em * upm * esc if i < len(cadena) - 1 else 0)
    return ' '.join(ds), x - x0


def iso_en(x, y, alto, color, id_mask):
    """El isotipo (solo la «O») con `alto` de alto, con su esquina en (x, y)."""
    e = alto / ISO_CAJA[3]
    return '<g transform="translate(%g %g) scale(%g) translate(%g %g)">%s</g>' % (x, y, e, -ISO_CAJA[0], -ISO_CAJA[1], grupo_iso(color, id_mask))


def escribir(nombre, contenido):
    with open(os.path.join(AQUI, nombre), 'w') as fh:
        fh.write(contenido)


def main():
    for color, sufijo in (('#000', 'negro'), ('#fff', 'blanco')):
        # Isotipo solo (para fondos claros: negro; para fondos oscuros: blanco)
        escribir('ordeva-isotipo-%s.svg' % sufijo, svg(ISO_CAJA, grupo_iso(color, 'm')))
        # Horizontal: isotipo + ORDEVA + TU NEGOCIO EN ORDEN
        H = 200
        d1, w1 = texto('ORDEVA', 'Inter-Bold.otf', 112, 0.04, x0=H * ISO_CAJA[2] / ISO_CAJA[3] + 56, y_base=128)
        d2, w2 = texto('TU NEGOCIO EN ORDEN', 'Inter-Medium.otf', 30, 0.22, x0=H * ISO_CAJA[2] / ISO_CAJA[3] + 60, y_base=184)
        ancho = H * ISO_CAJA[2] / ISO_CAJA[3] + 60 + max(w1, w2) + 4
        escribir('ordeva-logo-horizontal-%s.svg' % sufijo, svg((0, 0, round(ancho), H),
                 iso_en(0, 0, H, color, 'm') + '<path fill="%s" d="%s"/><path fill="%s" d="%s"/>' % (color, d1, color, d2)))
        # Navegación: isotipo + ORDEVA (sin eslogan), compacto
        d3, w3 = texto('ORDEVA', 'Inter-Bold.otf', 70, 0.04, x0=100 * ISO_CAJA[2] / ISO_CAJA[3] + 28, y_base=85)
        escribir('ordeva-logo-nav-%s.svg' % sufijo, svg((0, 0, round(100 * ISO_CAJA[2] / ISO_CAJA[3] + 28 + w3 + 2), 100),
                 iso_en(0, 0, 100, color, 'm') + '<path fill="%s" d="%s"/>' % (color, d3)))
        # Vertical: isotipo arriba, ORDEVA y el eslogan debajo, centrados
        dv1, wv1 = texto('ORDEVA', 'Inter-Bold.otf', 112, 0.04)
        dv2, wv2 = texto('TU NEGOCIO EN ORDEN', 'Inter-Medium.otf', 30, 0.22)
        A = max(wv1, wv2) + 8
        isoh = 300; isow = isoh * ISO_CAJA[2] / ISO_CAJA[3]
        escribir('ordeva-logo-vertical-%s.svg' % sufijo, svg((0, 0, round(A), 560),
                 iso_en((A - isow) / 2, 0, isoh, color, 'm')
                 + '<path fill="%s" transform="translate(%g 470)" d="%s"/>' % (color, (A - wv1) / 2, dv1)
                 + '<path fill="%s" transform="translate(%g 548)" d="%s"/>' % (color, (A - wv2) / 2, dv2)))
    # Icono de la app (como el logo original: «O» blanca sobre cuadro negro redondeado) y su versión clara
    escribir('ordeva-icono.svg', svg((0, 0, 1000, 1000), '<rect width="1000" height="1000" rx="125" fill="#000"/>' + grupo_iso('#fff', 'm')))
    escribir('ordeva-icono-claro.svg', svg((0, 0, 1000, 1000), '<rect width="1000" height="1000" rx="125" fill="#fff"/>' + grupo_iso('#000', 'm')))
    # Icono «maskable» (PWA / Android adaptable): fondo completo y la «O» dentro de la zona segura (80 % del centro)
    escribir('ordeva-icono-maskable.svg', svg((0, 0, 1000, 1000), '<rect width="1000" height="1000" fill="#000"/>'
             '<g transform="translate(500 500) scale(.82) translate(-500 -500)">' + grupo_iso('#fff', 'm') + '</g>'))
    # Primer plano del icono adaptable de Android (fondo transparente; el fondo negro lo pone el sistema)
    escribir('ordeva-android-primer-plano.svg', svg((0, 0, 1000, 1000),
             '<g transform="translate(500 500) scale(.82) translate(-500 -500)">' + grupo_iso('#fff', 'm') + '</g>'))
    print('Listo: SVG de ORDEVA en', AQUI)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""ORDEVA · Genera lib/catalogo-co.json: productos colombianos por código de barras (para reconocerlos sin internet).

Fuentes libres (licencia ODbL: se cita la fuente en la app y el catálogo sigue siendo libre):
  • Open Food Facts (search.openfoodfacts.org): todos los códigos 770… (GS1 Colombia) y los vendidos en Colombia.
  • Open Beauty Facts y Open Products Facts: los vendidos en Colombia (aseo, belleza, hogar).
Uso:  python3 puente/catalogo-co/generar.py   (tarda unos minutos; respeta los límites de las bases)
Cada producto: [nombre, marca, contenido, categoría, presentación]. No guarda precios (cambian por tienda).
"""
import json, re, sys, time, urllib.request, urllib.parse, datetime, os

UA = {'User-Agent': 'ORDEVA-catalogo/1.67 (+https://github.com/cristhianlujan45-blip/ORDEVA)'}
SALIDA = os.path.join(os.path.dirname(__file__), '..', '..', 'lib', 'catalogo-co.json')

def pedir(url, intentos=4):
    for i in range(intentos):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            print('  reintento', i + 1, str(e)[:80], file=sys.stderr); time.sleep(4 * (i + 1))
    return None

CAMPOS = 'code,product_name,product_name_es,generic_name_es,brands,quantity,categories_tags'
def search_a_licious(q):
    out, pagina = [], 1
    while True:
        u = 'https://search.openfoodfacts.org/search?' + urllib.parse.urlencode({'q': q, 'page_size': 100, 'page': pagina, 'fields': CAMPOS})
        d = pedir(u)
        if not d or not d.get('hits'): break
        out += d['hits']; print(f'  {q[:30]} página {pagina}/{d.get("page_count")} → {len(out)}', file=sys.stderr)
        if pagina >= (d.get('page_count') or 1) or pagina >= 100: break
        pagina += 1; time.sleep(0.7)
    return out

def v2(base, pais='colombia'):
    out, pagina = [], 1
    while True:
        u = f'https://{base}/api/v2/search?' + urllib.parse.urlencode({'countries_tags_en': pais, 'page_size': 100, 'page': pagina, 'fields': CAMPOS})
        d = pedir(u)
        if not d or not d.get('products'): break
        out += d['products']; print(f'  {base} página {pagina} → {len(out)}', file=sys.stderr)
        if len(out) >= (d.get('count') or 0) or pagina >= 60: break
        pagina += 1; time.sleep(6)          # la API v2 pide pocas búsquedas por minuto
    return out

# ---- Categoría en español (de la más específica a la más general) ----
CATS = [
    ('energy-drinks', 'Energizantes'), ('beers', 'Cervezas'), ('wines', 'Vinos'), ('spirits', 'Licores'), ('alcoholic-beverages', 'Licores'),
    ('carbonated-drinks', 'Gaseosas'), ('sodas', 'Gaseosas'), ('waters', 'Aguas'), ('fruit-juices', 'Jugos'), ('juices', 'Jugos'), ('nectars', 'Jugos'),
    ('coffees', 'Café'), ('teas', 'Té y aromáticas'), ('herbal-teas', 'Té y aromáticas'), ('hot-chocolate', 'Chocolate de mesa'), ('cocoa-and-its-products', 'Chocolate de mesa'),
    ('dairy-drinks', 'Lácteos'), ('yogurts', 'Lácteos'), ('cheeses', 'Lácteos'), ('milks', 'Lácteos'), ('dairies', 'Lácteos'),
    ('chips-and-fries', 'Snacks'), ('crisps', 'Snacks'), ('salty-snacks', 'Snacks'), ('popcorn', 'Snacks'), ('nuts', 'Snacks'),
    ('chocolates', 'Dulces y chocolates'), ('candies', 'Dulces y chocolates'), ('confectioneries', 'Dulces y chocolates'), ('chewing-gum', 'Dulces y chocolates'),
    ('biscuits', 'Galletas'), ('cookies', 'Galletas'), ('crackers', 'Galletas'), ('cakes', 'Panadería'), ('breads', 'Panadería'),
    ('breakfast-cereals', 'Cereales'), ('pastas', 'Pastas'), ('rices', 'Granos y arroz'), ('legumes', 'Granos y arroz'), ('flours', 'Harinas'),
    ('sugars', 'Azúcar y endulzantes'), ('sweeteners', 'Azúcar y endulzantes'), ('salts', 'Salsas y condimentos'), ('condiments', 'Salsas y condimentos'),
    ('sauces', 'Salsas y condimentos'), ('spices', 'Salsas y condimentos'), ('vegetable-oils', 'Aceites'), ('fats', 'Aceites'),
    ('sausages', 'Carnes y embutidos'), ('meats', 'Carnes y embutidos'), ('seafood', 'Pescados y enlatados'), ('canned-foods', 'Pescados y enlatados'),
    ('frozen-foods', 'Congelados'), ('ice-creams', 'Helados'), ('baby-foods', 'Bebés'), ('soups', 'Sopas y caldos'), ('broths', 'Sopas y caldos'),
    ('jams', 'Dulces y chocolates'), ('desserts', 'Postres'), ('snacks', 'Snacks'), ('beverages', 'Bebidas'),
]
def categoria(tags, base):
    tags = [t.split(':', 1)[-1] for t in (tags or [])]
    for k, nombre in CATS:
        if any(t == k or t.endswith('-' + k) for t in tags): return nombre
    if base == 'beauty': return 'Cuidado personal'
    if base == 'products': return 'Aseo y hogar'
    return 'Despensa' if tags else ''

# Por el nombre, cuando la base no trae categoría (palabras de cómo se venden en Colombia).
NOMBRES = [
    (r'\b(cerveza|aguila|águila|poker|club colombia|costeña|pilsen|budweiser|coronita)\b', 'Cervezas'), (r'\b(aguardiente|ron|whisky|vodka|tequila|vino)\b', 'Licores'),
    (r'\b(energ[eé]tic|vive 100|speed max|red bull|monster)\w*', 'Energizantes'), (r'\b(gaseosa|coca[- ]?cola|soda|postob[oó]n|pepsi|sprite|quatro|ginger|kola rom[aá]n|bretaña)\b', 'Gaseosas'),
    (r'\bagua\b', 'Aguas'), (r'\b(jugo|n[eé]ctar|hit|tutti frutti|frutto|del valle)\b', 'Jugos'), (r'\b(t[eé]|aromática|aromatica|infusi[oó]n)\b', 'Té y aromáticas'),
    (r'\b(caf[eé]|tinto|nescaf[eé]|sello rojo|colcaf[eé]|[aá]guila roja)\b', 'Café'), (r'\b(chocolate de mesa|corona|luker|chocolisto|milo)\b', 'Chocolate de mesa'),
    (r'\b(leche|yogur|yogurt|kumis|queso|mantequilla|arequipe|crema de leche|kefir|alpina|colanta)\b', 'Lácteos'),
    (r'\b(papas|papitas|chips|platanitos|tostacos|doritos|cheetos|de todito|detodito|choclitos|rizadas|natuchips|man[ií]|crispetas|maicitos)\b', 'Snacks'),
    (r'\b(galleta|galletas|wafer|festival|ducales|saltin|oreo|tosh|club social)\b', 'Galletas'),
    (r'\b(chocolatina|chocolate|bombom|bon bon bum|chicle|confite|caramelo|gomas|masmelo|chocoramo|jet|jumbo|gol|cocosette|mermelada|bocadillo)\b', 'Dulces y chocolates'),
    (r'\b(pan|tostadas|ponqu[eé]|ponque|mantecada|brownie|bimbo|ramo|arepa)\b', 'Panadería'), (r'\b(cereal|avena|granola|zucaritas|choco krispis)\b', 'Cereales'),
    (r'\b(sopa|crema de)\b', 'Sopas y caldos'),
    (r'\b(pasta|spaghetti|espagueti|fideos|macarr[oó]n|conchitas|doria|la muñeca)\b', 'Pastas'), (r'\b(arroz|fr[ií]jol|frijol|lenteja|garbanzo|arveja)\b', 'Granos y arroz'),
    (r'\b(harina|maizena|f[eé]cula)\b', 'Harinas'), (r'\b(az[uú]car|panela|endulzante|stevia)\b', 'Azúcar y endulzantes'),
    (r'\b(aceite|margarina|manteca)\b', 'Aceites'), (r'\b(sal|salsa|mayonesa|ketchup|mostaza|vinagre|sazonador|caldo|cubo|ricostilla|maggi|adobo|comino|color)\b', 'Salsas y condimentos'),
    (r'\b(at[uú]n|sardina|salchicha|jam[oó]n|mortadela|chorizo|salchich[oó]n|zenú|zenu|ranchera)\b', 'Carnes y embutidos'),
    (r'\b(helado|paleta)\b', 'Helados'),
    (r'\b(jab[oó]n|detergente|suavizante|cloro|limpiador|lavaloza|desinfectante|ambientador|fab|ariel|axion|blancox|papel higi[eé]nico|servilleta)\b', 'Aseo y hogar'),
    (r'\b(champ[uú]|shampoo|acondicionador|crema dental|cepillo|desodorante|toalla(s)? higi[eé]nica|pañal|crema|protector solar|maquillaje|labial|colgate)\b', 'Cuidado personal'),
]
def por_nombre(nom):
    t = (nom or '').lower()
    for r, n in NOMBRES:
        if re.search(r, t): return n
    return ''

PRES = [(r'\bsix\s*pack\b|\bx\s*6\b', 'Six pack'), (r'\blata\b', 'Lata'), (r'\bbotell[ao]n?\b|\bpet\b', 'Botella'), (r'\bbolsa\b', 'Bolsa'),
        (r'\bdoy\s*pack\b', 'Doypack'), (r'\bsobres?\b', 'Sobre'), (r'\bfrasco\b', 'Frasco'), (r'\btarro\b', 'Tarro'), (r'\bcaja\b', 'Caja'),
        (r'\btetra\s*pak\b|\btetrapack\b', 'Caja (Tetra Pak)'), (r'\bvaso\b', 'Vaso'), (r'\bbarra\b', 'Barra'), (r'\bpaquete\b|\bpaq\b', 'Paquete'),
        (r'\bpote\b', 'Pote'), (r'\bgarraf[oó]n\b', 'Garrafón'), (r'\bbloque\b', 'Bloque')]
def presentacion(*txt):
    t = ' '.join(x for x in txt if x).lower()
    for r, n in PRES:
        if re.search(r, t): return n
    return ''

def limpio(s, n=90):
    s = re.sub(r'\s+', ' ', str(s or '')).strip(' ,;-')
    return s[:n]

UNI = r'(kilogramos?|kilos?|kgs?|gramos?|grs?|g|mililitros?|mls?|cc|litros?|lts?|l|onzas?|oz|libras?|lbs?|unidades?|und|uds?)'
def _uni(u):
    u = u.lower()
    if u.startswith('k'): return 'kg'
    if u in ('cc',) or u.startswith('mil') or u.startswith('ml'): return 'ml'
    if u.startswith('g'): return 'g'
    if u.startswith('l') and u.startswith('lb') or u.startswith('libra'): return 'lb'
    if u.startswith('l'): return 'L'
    if u.startswith('o'): return 'oz'
    return 'und'
def contenido(q, nombre=''):
    """«400 ml», «1,5 L», «135 g», «1 libra (500 g)», «6 und». Del campo de cantidad o, si no hay, del nombre."""
    for t in (q, nombre):
        t = limpio(t, 60)
        if not t: continue
        m = re.search(r'(?i)(?:x\s*)?(\d+(?:[.,]\d+)?)\s*' + UNI + r'\b\.?', t)
        if not m: continue
        n, u = m.group(1).replace(',', '.'), _uni(m.group(2))
        try: v = float(n)
        except ValueError: continue
        if v <= 0 or v > 100000: continue
        n = ('%g' % v).replace('.', ',')
        if u == 'lb': return n + (' libra' if v == 1 else ' libras') + ' (' + ('%g' % (v * 500)) + ' g)'
        return n + ' ' + u
    return limpio(q, 30)

CRUDO = os.environ.get('CRUDO')   # CRUDO=/ruta.json: guarda lo descargado (o lo reutiliza si ya existe) para reprocesar sin bajar todo
def descargar():
    if CRUDO and os.path.exists(CRUDO):
        print('Usando lo descargado en', CRUDO, file=sys.stderr); return json.load(open(CRUDO))
    d = {'food770': search_a_licious('code:770*'), 'foodco': search_a_licious('countries_tags:"en:colombia"'),
         'beauty': v2('world.openbeautyfacts.org'), 'products': v2('world.openproductsfacts.org')}
    if CRUDO: json.dump(d, open(CRUDO, 'w'))
    return d

def main():
    prods = {}
    def meter(lista, base):
        nuevos = 0
        for p in lista:
            cod = re.sub(r'\D', '', str(p.get('code') or ''))
            if not (8 <= len(cod) <= 14) or set(cod) == {'0'}: continue
            nom = limpio(p.get('product_name_es') or p.get('product_name'))
            if len(nom) < 2: continue
            marca = p.get('brands'); marca = limpio((marca if isinstance(marca, str) else ','.join(marca or [])).split(',')[0], 40)
            fila = [nom, marca, contenido(p.get('quantity'), nom), categoria(p.get('categories_tags'), base) or por_nombre(nom), presentacion(nom, p.get('generic_name_es'))]
            while fila and not fila[-1]: fila.pop()
            if cod not in prods: nuevos += 1
            if cod not in prods or len(fila) > len(prods[cod]): prods[cod] = fila
        print(f'{base}: +{nuevos} (total {len(prods)})', file=sys.stderr)
    d = descargar()
    meter(d['food770'], 'food'); meter(d['foodco'], 'food'); meter(d['beauty'], 'beauty'); meter(d['products'], 'products')
    out = {'v': datetime.date.today().isoformat(), 'n': len(prods),
           'fuente': 'Open Food Facts, Open Beauty Facts y Open Products Facts (ODbL, openfoodfacts.org)',
           'campos': ['nombre', 'marca', 'contenido', 'categoria', 'presentacion'], 'p': dict(sorted(prods.items()))}
    with open(SALIDA, 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('Listo:', len(prods), 'productos →', os.path.relpath(SALIDA), os.path.getsize(SALIDA) // 1024, 'KB', file=sys.stderr)

if __name__ == '__main__': main()

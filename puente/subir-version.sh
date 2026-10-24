#!/usr/bin/env bash
# Sube la versión de ORDEVA en TODOS los lugares a la vez (si falta uno, la app pide «Actualizar» o mezcla archivos):
#   MESORA_VERSION (app/*.js), ?v= de los archivos de app/ en index.html, version.txt y ADMIN_VERSION (admin.html).
# Uso: bash puente/subir-version.sh 1.59.1        (la fecha es la de hoy)
# Después: pruebas/modulos.test.js revisa que todo quedó igual.
set -euo pipefail
cd "$(dirname "$0")/.."
NUEVA="${1:?Uso: bash puente/subir-version.sh 1.2.3}"
[[ "$NUEVA" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Versión inválida: $NUEVA"; exit 1; }
FECHA="$(date +%Y-%m-%d)"
TXT="$FECHA · v$NUEVA"
grep -l "const MESORA_VERSION = '" app/*.js index.html 2>/dev/null | while read -r f; do
  sed -i "s/const MESORA_VERSION = '[^']*'/const MESORA_VERSION = '$TXT'/" "$f"
done
sed -i -E "s#(src=\"app/[^\"?]+\.js)\?v=[0-9.]+\"#\1?v=$NUEVA\"#g" index.html
sed -i "s/var ADMIN_VERSION = '[^']*'/var ADMIN_VERSION = '$TXT'/" admin.html
printf '%s\n' "$TXT" > version.txt
echo "Listo: $TXT"
grep -c "?v=$NUEVA\"" index.html | xargs echo "  archivos de app/ con ?v=$NUEVA:"

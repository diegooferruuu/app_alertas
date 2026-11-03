#!/usr/bin/env bash
# Corre una consulta de tools/campo en la base del servidor, en solo lectura.
#
#   tools/campo/consultar.sh antes.sql
#   tools/campo/consultar.sh antes.sql lat=-17.3935 lng=-66.1570
#   tools/campo/consultar.sh campo.sql desde="2026-11-08 10:00" hasta="2026-11-08 11:30"
#
# Cada nombre=valor se pasa a psql como -v. La sesión se abre con
# `default_transaction_read_only`, además del BEGIN READ ONLY de cada archivo:
# aunque una consulta tuviera un error, no puede escribir nada.
#
# Con CAMPO_LOCAL=1 corre contra la base de pruebas local (app_alertas_test),
# que es como se ensayan las consultas sin tocar el servidor.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: tools/campo/consultar.sh <antes.sql|campo.sql> [nombre=valor ...]" >&2
  exit 2
fi
archivo="$(cd "$(dirname "$0")" && pwd)/$1"
shift
[ -f "$archivo" ] || { echo "No existe $archivo" >&2; exit 2; }

# Las variables viajan como argumentos de psql, citadas para el shell que las
# recibe del otro lado (el de ssh o el de bash -c): un valor con espacios, como
# una fecha con hora, llega entero.
variables=""
for par in "$@"; do
  variables+=" -v $(printf '%q' "$par")"
done

psql_solo_lectura="sh -c 'PGOPTIONS=\"-c default_transaction_read_only=on\" psql -X -q -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\${BASE:-\$POSTGRES_DB}\" \"\$@\"' _$variables"

if [ "${CAMPO_LOCAL:-}" = 1 ]; then
  bash -c "docker exec -i -e BASE=app_alertas_test app_alertas_postgres $psql_solo_lectura" < "$archivo"
else
  ssh oracle "cd ~/alertas/deploy && sudo docker compose exec -T db $psql_solo_lectura" < "$archivo"
fi

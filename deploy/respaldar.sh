#!/usr/bin/env bash
# Respaldo diario de la base de la beta.
#
# En el servidor se instala una copia fuera del repositorio y la corre cron:
#
#   30 3 * * *  $HOME/respaldos/respaldar.sh >> $HOME/respaldos/respaldo.log 2>&1
#
# Es un volcado en el formato propio de Postgres (`-Fc`): guarda todo, también
# los disparadores que hacen de solo inserción las declaraciones, y se restaura
# con pg_restore:
#
#   sudo docker compose -p alertas-beta -f $HOME/alertas/deploy/docker-compose.yml \
#     exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean' < archivo.dump
#
# Se conservan 14 días. Los respaldos viven en el mismo disco que la base:
# protegen de un borrado o de una migración mala, no de perder el servidor.
set -euo pipefail

DESTINO="$HOME/respaldos"
COMPOSE="$HOME/alertas/deploy/docker-compose.yml"
mkdir -p "$DESTINO"

ARCHIVO="$DESTINO/alertas-$(date +%Y%m%d-%H%M).dump"

# Primero a un temporal: un volcado cortado a la mitad nunca queda con el
# nombre de uno bueno.
sudo docker compose -p alertas-beta -f "$COMPOSE" exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$ARCHIVO.tmp"
mv "$ARCHIVO.tmp" "$ARCHIVO"

find "$DESTINO" -name 'alertas-*.dump' -mtime +14 -delete
echo "$(date '+%F %T') respaldo listo: $(basename "$ARCHIVO") ($(du -h "$ARCHIVO" | cut -f1))"

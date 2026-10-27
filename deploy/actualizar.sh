#!/usr/bin/env bash
# Actualiza la beta en el servidor con lo último de la rama que tenga clonada.
#
#   ssh oracle '~/alertas/deploy/actualizar.sh'
#
# Trae los cambios, reconstruye solo lo que cambió y reinicia. Las migraciones
# corren solas antes de que arranque el backend nuevo: si una falla, Compose no
# lo arranca, y el error queda en `sudo docker compose logs migraciones`.
set -euo pipefail
cd "$(dirname "$0")"

git pull --ff-only
sudo docker compose up -d --build

# Las imágenes viejas de cada reconstrucción ocupan disco sin servir de nada.
sudo docker image prune -f > /dev/null

sudo docker compose ps --format '{{.Service}}: {{.Status}}'

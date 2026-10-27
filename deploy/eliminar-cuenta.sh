#!/usr/bin/env bash
# Elimina una cuenta a pedido, para quien ya no tiene la app (lo exige Google
# Play). Antes de correrlo, comprueba que el correo del pedido llegó DESDE la
# dirección de la cuenta: es lo único que prueba que lo pide su dueño.
#
#   ssh oracle '~/alertas/deploy/eliminar-cuenta.sh persona@correo.com'
#
# Hace lo mismo que «Eliminar mi cuenta» en la app: borra los datos personales
# y conserva el hash del carnet, las denuncias, las declaraciones y las faltas.
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -ne 1 ]; then
  echo "Uso: $0 <correo de la cuenta>"
  exit 2
fi

sudo docker compose exec -T backend node dist/cli/eliminar-cuenta.js "$1"

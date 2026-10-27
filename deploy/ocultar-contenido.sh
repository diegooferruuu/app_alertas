#!/usr/bin/env bash
# Oculta la foto y el relato de una alerta a quien no la presentó, tras un
# reporte de contenido (lo exige la política de contenido de Google Play).
#
#   ssh oracle '~/alertas/deploy/ocultar-contenido.sh <id de la alerta> "motivo"'
#
# No borra nada, no cierra la alerta y no sanciona a nadie: el nombre y las
# señas siguen a la vista y la declaración jurada queda intacta. Es de solo
# inserción, así que tampoco se puede deshacer en silencio: queda cuándo y por
# qué. El aviso por correo de cada reporte trae el comando con el id.
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -ne 2 ] || [ -z "$2" ]; then
  echo "Uso: $0 <id de la alerta> \"motivo\""
  exit 2
fi
if ! [[ "$1" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "«$1» no es el id de una alerta."
  exit 2
fi

# Los valores van como variables de psql (:'id', :'motivo'), que las cita él:
# un motivo con comillas no puede romper la consulta.
sudo docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v id="$1" -v motivo="$2"' \
  _ "$1" "$2" <<'SQL'
INSERT INTO ocultamientos_contenido (denuncia_id, motivo)
VALUES (:'id', :'motivo')
ON CONFLICT (denuncia_id) DO NOTHING
RETURNING 'Contenido ocultado' AS resultado;
SQL

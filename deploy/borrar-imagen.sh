#!/usr/bin/env bash
# Borra del todo la foto de una alerta, para el material de abuso sexual
# infantil confirmado (estándares de seguridad infantil de Google Play,
# publicados en /seguridad-infantil).
#
#   ssh oracle '~/alertas/deploy/borrar-imagen.sh <id de la alerta> "motivo"'
#
# Ocultar no basta: `ocultar-contenido.sh` deja la imagen guardada, y ese
# material no puede quedarse en el servidor. Esto la oculta y además borra sus
# filas de `fotografias_denuncia`, en una sola transacción. La alerta, su
# declaración jurada y la cuenta que la publicó se quedan (I7): son lo que se
# entrega a la autoridad. La foto no entra en el contenido sellado, así que la
# cadena de declaraciones sigue verificable.
#
# No se puede deshacer. Los respaldos hechos mientras la imagen estaba la
# siguen teniendo.
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

# Los valores van como variables de psql (:'id', :'motivo'), que las cita él.
# Si el id no es de ninguna alerta, la llave foránea del ocultamiento lo
# rechaza y no se borra nada.
sudo docker compose exec -T db sh -c \
  'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v id="$1" -v motivo="$2"' \
  _ "$1" "$2" <<'SQL'
BEGIN;
INSERT INTO ocultamientos_contenido (denuncia_id, motivo)
VALUES (:'id', :'motivo')
ON CONFLICT (denuncia_id) DO NOTHING;
WITH borradas AS (
  DELETE FROM fotografias_denuncia WHERE denuncia_id = :'id' RETURNING 1
)
SELECT 'Imágenes borradas: ' || count(*) FROM borradas;
COMMIT;
SQL

cat <<'FIN'
Ahora denúncialo, con el id de la alerta:
  · Policía Boliviana (FELCC).
  · CyberTipline del NCMEC: https://report.cybertip.org/
FIN

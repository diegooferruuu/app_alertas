#!/usr/bin/env bash
# Crea la cuenta con que los revisores de Google Play prueban la app
# (Play Console → Contenido de la app → Acceso a la app).
#
#   ssh oracle '~/alertas/deploy/crear-cuenta-revision.sh'
#
# Los revisores no pueden registrar un carnet boliviano, así que la cuenta nace
# con el documento ya registrado, con un número de 12 cifras que ningún carnet
# real tiene. La contraseña se genera aquí y queda solo en el servidor, en
# ~/revisores-play.txt (permisos 600): no pasa por el repositorio ni por un chat.
# Léela con:   ssh oracle 'cat ~/revisores-play.txt'
#
# Correrlo de nuevo no crea otra: si el archivo existe, no hace nada.
set -euo pipefail
cd "$(dirname "$0")"

ARCHIVO="$HOME/revisores-play.txt"
if [ -f "$ARCHIVO" ]; then
  echo "La cuenta de revisión ya existe: sus datos están en $ARCHIVO"
  exit 0
fi

CORREO=revisor@alertatemprana.test
# Mayúscula, minúscula y número: cumple las reglas del formulario de registro.
CLAVE="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | cut -c1-14)Aa7"
HASH=$(sudo docker compose exec -T backend node -e \
  'require("bcryptjs").hash(process.argv[1], 10).then((h) => process.stdout.write(h))' "$CLAVE")
CI_HASH=$(printf '%s' 999999999901 | sha256sum | cut -d' ' -f1)

# Los valores van como variables de psql, que las cita él.
sudo docker compose exec -T db sh -c \
  'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v correo="$1" -v hash="$2" -v ci="$3"' \
  _ "$CORREO" "$HASH" "$CI_HASH" <<'SQL'
INSERT INTO users (full_name, primer_nombre, primer_apellido, segundo_apellido, email, phone,
                   password_hash, documento_registrado, ci_hash, documento_registrado_en, nombre_documento)
VALUES ('Revisor Google Play', 'Revisor', 'Google', 'Play', :'correo', '70000000',
        :'hash', true, :'ci', now(), 'Revisor Google Play');
SQL

umask 077
printf 'Cuenta de revisión de Google Play (Contenido de la app → Acceso a la app)\nCorreo: %s\nContraseña: %s\n' \
  "$CORREO" "$CLAVE" > "$ARCHIVO"
echo "Cuenta de revisión creada. Sus datos están en $ARCHIVO"

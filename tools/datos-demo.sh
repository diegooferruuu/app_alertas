#!/bin/zsh
# Prepara datos para una demostración.
#
#   ./tools/datos-demo.sh
#
# Crea tres cuentas con documento registrado y una denuncia ya firmada, para no
# depender del OCR en vivo. Es repetible: borra lo de la corrida anterior.
#
# Contraseña de las tres cuentas: Demo1234
set -euo pipefail

API=${API:-http://localhost:3000/api}
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export PGPASSWORD=$(grep -E "^DB_PASSWORD=" "$RAIZ/.env" | cut -d= -f2-)

psqlq() { psql -q -t -A -h localhost -p 5432 -U postgres -d app_alertas "$@" }
hash() { printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1 }

registrar() { # nombre email -> token
  curl -s -X POST "$API/auth/register" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$2\",\"password\":\"Demo1234\",\"full_name\":\"$1\",\"phone\":\"70000000\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])'
}

# El registro de documento pasa por OCR. Aquí se escribe directo el estado que
# ese flujo deja, para que la demostración no dependa de la calidad de una foto.
sellar() { # email ci nombre
  psqlq -c "UPDATE users SET documento_registrado=true, ci_hash='$(hash $2)',
              nombre_documento='$3', full_name='$3', documento_registrado_en=now()
            WHERE email='$1'" > /dev/null
}

echo "→ Limpiando datos de demostraciones anteriores…"
psqlq -c "ALTER TABLE declaraciones_juradas DISABLE TRIGGER trg_declaraciones_solo_insercion" >/dev/null
psqlq -c "DELETE FROM solicitudes_constancia WHERE solicitante_id IN (SELECT id FROM users WHERE email LIKE '%@demo.bo')" >/dev/null
psqlq -c "DELETE FROM desactivaciones WHERE ci_hash_denunciante IN (SELECT ci_hash FROM users WHERE email LIKE '%@demo.bo')" >/dev/null
psqlq -c "DELETE FROM declaraciones_juradas WHERE denuncia_id IN (SELECT d.id FROM denuncias d JOIN users u ON u.id=d.denunciante_id WHERE u.email LIKE '%@demo.bo')" >/dev/null
psqlq -c "DELETE FROM documentos_bloqueados WHERE usuario_id IN (SELECT id FROM users WHERE email LIKE '%@demo.bo')" >/dev/null
psqlq -c "DELETE FROM users WHERE email LIKE '%@demo.bo'" >/dev/null
psqlq -c "ALTER TABLE declaraciones_juradas ENABLE TRIGGER trg_declaraciones_solo_insercion" >/dev/null

echo "→ Creando cuentas…"
TOK_ANA=$(registrar "Ana Quispe Vargas" "ana@demo.bo")
registrar "Luis Mamani Choque" "luis@demo.bo" > /dev/null
registrar "Caro Vaca Ortiz"    "caro@demo.bo" > /dev/null
sellar "ana@demo.bo"  1000001 "Ana Quispe Vargas"
sellar "luis@demo.bo" 2000002 "Luis Mamani Choque"
sellar "caro@demo.bo" 3000003 "Caro Vaca Ortiz"

echo "→ Creando una denuncia ya firmada (Ana reporta a Luis)…"
DEN=$(curl -s -X POST "$API/denuncias" -H "Authorization: Bearer $TOK_ANA" \
  -H 'Content-Type: application/json' -d '{
    "nombre_persona_buscada":"Luis Mamani",
    "ci_persona_buscada":"2000002",
    "description":"Salio de casa el martes por la manana y no regreso.",
    "latitude":-16.5,"longitude":-68.15}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

VERSION=$(curl -s "$API/declaraciones/texto-legal" -H "Authorization: Bearer $TOK_ANA" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["version_id"])')
curl -s -o /dev/null -X POST "$API/declaraciones/denuncias/$DEN/firmar" \
  -H "Authorization: Bearer $TOK_ANA" -H 'Content-Type: application/json' \
  -d "{\"version_texto_legal_id\":\"$VERSION\",\"vinculo_declarado\":\"MADRE\",\"nombre_escrito\":\"Ana Quispe Vargas\"}"

cat <<FIN

╭──────────────────────────────────────────────────────────────╮
│  Datos de demostración listos                                │
╰──────────────────────────────────────────────────────────────╯

  Contraseña de todas las cuentas:  Demo1234

  ana@demo.bo    Ana Quispe Vargas    CI 1000001   (denunciante)
  luis@demo.bo   Luis Mamani Choque   CI 2000002   (persona reportada)
  caro@demo.bo   Caro Vaca Ortiz      CI 3000003   (vecina, libre)

  Ya existe una denuncia de Ana contra Luis, firmada y difundiéndose.
  · Entra como luis@demo.bo para ver "Alertas sobre mí" y retirarla.
  · Entra como caro@demo.bo para crear una denuncia desde cero.

FIN

#!/bin/zsh
# Prepara datos para una demostración y para las capturas de la tesis.
#
#   pnpm seed:demo        (o ./tools/datos-demo.sh)
#
# Crea seis cuentas con documento registrado y seis denuncias ya firmadas en el
# área metropolitana de Cochabamba —cinco difundiéndose y una vencida—, para no
# depender del OCR en vivo. Es repetible: borra lo de la corrida anterior.
#
# Todo es inventado: nombres, carnets y casos. Los carnets son números que
# nadie usa en las pruebas (1000001, 8100001…) y la foto de los adultos es la
# silueta de `deploy/muestra/persona-de-ejemplo.jpg`, rotulada «EJEMPLO»: no
# hay en ningún lado la cara de una persona real. La de un menor no lleva foto,
# como en cualquier alerta.
#
# Contraseña de todas las cuentas: Demo1234
set -euo pipefail

API=${API:-http://localhost:3000/api}

# Solo contra una máquina de desarrollo. La contraseña de estas cuentas está
# escrita aquí y en el repositorio, y el guion desactiva los disparadores de solo
# inserción para limpiar: contra el servidor de la beta, cualquiera entraría con
# esas cuentas, y la limpieza tocaría datos de personas reales.
case "$API" in
  http://localhost*|http://127.0.0.1*|http://192.168.*|http://10.*|http://172.*) ;;
  *)
    echo "Este guion es solo para una máquina de desarrollo, no para $API." >&2
    echo "En el servidor, la alerta de muestra es deploy/alerta-de-muestra.sh." >&2
    exit 2
    ;;
esac
# La base contra la que corre el servidor de `API`. Cambiarla sirve para ensayar
# el guion contra la base de pruebas sin tocar la de desarrollo.
BASE=${BASE_DEMO:-app_alertas}
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export PGPASSWORD=$(grep -E "^DB_PASSWORD=" "$RAIZ/.env" | cut -d= -f2-)

# Documento con el que se hacen las pruebas manuales desde el teléfono.
#
# Se borra en cada corrida junto con las cuentas de demostración. Sin esto, el
# segundo intento de registrar ese carnet choca con la unicidad de `ci_hash`
# —«este documento ya está registrado en otra cuenta»— y hay que ir a limpiar a
# mano antes de cada prueba.
CI_PRUEBAS=${CI_PRUEBAS:-8737666}

# Punto donde ocurre todo en la demostración.
#
# Es el mismo para la denuncia de prueba y para la ubicación que se le fija al
# simulador de iOS: si no coincidieran, el teléfono quedaría fuera del radio y no
# llegaría ninguna alerta, que es un fallo silencioso y difícil de ver.
LAT_DEMO=${LAT_DEMO:--17.38187981896557}
LON_DEMO=${LON_DEMO:--66.15198734651142}

# La denuncia vencida va una celda al norte de ese punto, ~1,1 km.
#
# El servidor no guarda el punto exacto sino el centro de su celda de 0,01° (ver
# `zona-avistamiento.ts`), así que un desplazamiento menor podía caer en la misma
# celda y dejar las dos marcas una encima de la otra. Una celda queda además lo
# bastante cerca para salir en el mismo mapa cuando se vuelva a mostrar. Se deriva
# del punto y no se fija aparte para que lo siga si se cambia `LAT_DEMO`.
LAT_VENCIDA=$(printf '%.7f' $(( LAT_DEMO + 0.01 )))
LON_VENCIDA=$LON_DEMO

# Foto de las alertas de adultos: la silueta de muestra, en base64.
FOTO_DEMO=$(base64 < "$RAIZ/deploy/muestra/persona-de-ejemplo.jpg" | tr -d '\n')

psqlq() { psql -q -t -A -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d "$BASE" "$@" }
hash() { printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1 }

# El nombre va desglosado: el servidor compone con él el `full_name` de la cuenta
# y rechaza un `full_name` que llegue del cliente.
registrar() { # primer_nombre primer_apellido segundo_apellido email -> token
  curl -s -X POST "$API/auth/register" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$4\",\"password\":\"Demo1234\",\"phone\":\"70000000\",
         \"primer_nombre\":\"$1\",\"primer_apellido\":\"$2\",\"segundo_apellido\":\"$3\"}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])'
}

# El registro de documento pasa por OCR. Aquí se escribe directo el estado que
# ese flujo deja, para que la demostración no dependa de la calidad de una foto.
#
# `nombre_documento` copia el `full_name` que ya compuso el servidor: ese paso no
# cambia el nombre de la cuenta, solo deja constancia de contra qué se contrastó.
sellar() { # email ci
  psqlq -c "UPDATE users SET documento_registrado=true, ci_hash='$(hash $2)',
              nombre_documento=full_name, documento_registrado_en=now()
            WHERE email='$1'" > /dev/null
}

# Borra unas cuentas y todo su rastro. Recibe una condición SQL sobre `users`.
#
# El orden no es negociable y lo impone el esquema: las declaraciones, las
# prolongaciones, los cierres y las faltas apuntan a `denuncias` con NO ACTION, y
# las faltas, las prolongaciones y las claves de firma apuntan a `users` igual.
# Borrar al usuario —que arrastra sus denuncias en cascada— falla si esas filas
# siguen ahí. Van primero.
#
# Se limpia por dos caminos a la vez, y hacen falta los dos: por identificador
# de usuario y por hash de documento. Hay rastro que no cuelga de ninguna llave
# foránea —un cierre guarda hashes, no identificadores— y hay denuncias donde la
# persona no es quien denunció sino la buscada; esas pueden ser de otra cuenta,
# y su rastro también se va.
#
# Declaraciones, prolongaciones, cierres, faltas y claves son de solo inserción y
# un disparador lo impone. Se desactivan a propósito y solo aquí, **dentro de la
# misma transacción**: si algo falla, el ROLLBACK los deja activos. Esto es un
# guion de datos de prueba, no una ruta de la aplicación: ningún código del
# sistema puede borrar nada de eso.
limpiar_usuarios() { # <condición SQL sobre users>
  local cond="$1"
  local ids="SELECT id FROM users WHERE $cond"
  local hashes="SELECT ci_hash FROM users WHERE $cond AND ci_hash IS NOT NULL"
  local suyas="SELECT id FROM denuncias WHERE denunciante_id IN ($ids)"
  local sobre_ellas="SELECT id FROM denuncias WHERE ci_hash_persona_buscada IN ($hashes)"

  psqlq > /dev/null <<SQL
BEGIN;
ALTER TABLE declaraciones_juradas DISABLE TRIGGER trg_declaraciones_solo_insercion;
ALTER TABLE prolongaciones DISABLE TRIGGER trg_prolongaciones_solo_insercion;
ALTER TABLE cierres DISABLE TRIGGER trg_cierres_solo_insercion;
ALTER TABLE faltas DISABLE TRIGGER trg_faltas_solo_insercion;
ALTER TABLE claves_dispositivo DISABLE TRIGGER trg_claves_dispositivo_solo_insercion;

DELETE FROM solicitudes_constancia
 WHERE solicitante_id IN ($ids) OR denuncia_id IN ($suyas) OR denuncia_id IN ($sobre_ellas);
DELETE FROM cierres
 WHERE ci_hash_denunciante IN ($hashes) OR ci_hash_persona_buscada IN ($hashes)
    OR denuncia_id IN ($suyas);
DELETE FROM faltas
 WHERE usuario_id IN ($ids) OR denuncia_id IN ($suyas) OR denuncia_id IN ($sobre_ellas);
DELETE FROM declaraciones_juradas
 WHERE usuario_id IN ($ids) OR denuncia_id IN ($suyas) OR denuncia_id IN ($sobre_ellas);
DELETE FROM prolongaciones
 WHERE usuario_id IN ($ids) OR denuncia_id IN ($suyas) OR denuncia_id IN ($sobre_ellas);
DELETE FROM claves_dispositivo WHERE usuario_id IN ($ids);
DELETE FROM documentos_bloqueados WHERE usuario_id IN ($ids) OR ci_hash IN ($hashes);

-- Las denuncias donde la persona es la buscada no cuelgan de ella por llave
-- foránea, así que no se van en cascada al borrar el usuario.
DELETE FROM denuncias WHERE ci_hash_persona_buscada IN ($hashes);

-- Y al final el usuario. Arrastra en cascada sus denuncias, dispositivos y
-- tokens de sesión; las denuncias, sus emisiones, fotos y usos de canal.
DELETE FROM users WHERE $cond;

ALTER TABLE declaraciones_juradas ENABLE TRIGGER trg_declaraciones_solo_insercion;
ALTER TABLE prolongaciones ENABLE TRIGGER trg_prolongaciones_solo_insercion;
ALTER TABLE cierres ENABLE TRIGGER trg_cierres_solo_insercion;
ALTER TABLE faltas ENABLE TRIGGER trg_faltas_solo_insercion;
ALTER TABLE claves_dispositivo ENABLE TRIGGER trg_claves_dispositivo_solo_insercion;
COMMIT;
SQL
}

echo "→ Limpiando datos de demostraciones anteriores…"
limpiar_usuarios "email LIKE '%@demo.bo'"

echo "→ Limpiando la cuenta de pruebas del carnet $CI_PRUEBAS…"
limpiar_usuarios "ci_hash = '$(hash $CI_PRUEBAS)'" 

# Presenta una denuncia y devuelve su identificador.
#
#   denunciar <token> <lat> <lon> <horas desde que se la vio> <foto: si|no> <campos JSON>
#
# Formulario de campos cerrados: sin relato libre. La circunstancia se elige de
# una lista, no se narra. Si el servidor la rechaza, se dice por qué y se para:
# seguir con un identificador vacío firmaría nada y fallaría lejos de la causa.
denunciar() {
  local foto=""
  [[ "$5" == si ]] && foto=",\"fotografia_base64\":\"$FOTO_DEMO\""
  curl -s -X POST "$API/denuncias" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' -d "{$6,
      \"latitude\":$2,\"longitude\":$3,
      \"ultimo_avistamiento_en\":\"$(date -u -v-${4}H '+%Y-%m-%dT%H:%M:%S.000Z')\"$foto}" \
    | python3 -c 'import sys,json
d=json.load(sys.stdin)
if "id" not in d: sys.exit("La denuncia no se creó: " + json.dumps(d, ensure_ascii=False))
print(d["id"])'
}

# Desde la H6.3 la declaración lleva la firma Ed25519 del teléfono: el guion
# firma igual que la app. El nombre escrito tiene que ser el de la cuenta.
firmar() { # token denuncia vínculo nombre
  node "$RAIZ/tools/firmar-como-telefono.mjs" "$API" "$1" "$2" "$3" "$4" > /dev/null
}

# Zonas del área metropolitana. El servidor no guarda el punto sino el centro
# de su celda de ~1 km, así que basta con caer en la zona.
LA_CANCHA="-17.4030 -66.1570"
SACABA="-17.4040 -66.0400"
TIQUIPAYA="-17.3375 -66.2160"
QUILLACOLLO="-17.3925 -66.2780"

echo "→ Creando cuentas…"
TOK_ANA=$(registrar "Ana" "Quispe" "Vargas" "ana@demo.bo")
registrar "Luis" "Mamani" "Choque" "luis@demo.bo" > /dev/null
TOK_CARO=$(registrar "Caro" "Vaca" "Ortiz" "caro@demo.bo")
TOK_MARCO=$(registrar "Marco" "Rojas" "Céspedes" "marco@demo.bo")
TOK_ELENA=$(registrar "Elena" "Torrico" "Meneses" "elena@demo.bo")
TOK_WILMA=$(registrar "Wilma" "Gutiérrez" "Rocha" "wilma@demo.bo")
sellar "ana@demo.bo"   1000001
sellar "luis@demo.bo"  2000002
sellar "caro@demo.bo"  3000003
sellar "marco@demo.bo" 5000005
sellar "elena@demo.bo" 6000006
sellar "wilma@demo.bo" 7000007

echo "→ Ana reporta a su hijo Luis, en el centro…"
DEN=$(denunciar "$TOK_ANA" $LAT_DEMO $LON_DEMO 48 si '
  "nombre_persona_buscada":"Luis Mamani Choque", "ci_persona_buscada":"2000002",
  "fecha_nacimiento":"1988-07-03", "sexo":"MASCULINO", "estatura_rango":"DE_170_A_180",
  "contextura":"MEDIA", "color_piel":"TRIGUENA", "color_cabello":"NEGRO",
  "color_ojos":"CAFES_OSCUROS", "senas_particulares":["CICATRIZ"],
  "prenda_superior":"CHOMPA", "color_prenda_superior":"AZUL",
  "prenda_inferior":"PANTALON_JEAN", "color_prenda_inferior":"NEGRO", "calzado":"ZAPATILLAS",
  "circunstancia":"SALIO_DE_CASA", "condicion_relevante":["REQUIERE_MEDICACION"]')
firmar "$TOK_ANA" "$DEN" MADRE "Ana Quispe Vargas"

echo "→ Marco reporta a su madre, Rosa, en La Cancha…"
DEN_ROSA=$(denunciar "$TOK_MARCO" ${=LA_CANCHA} 5 si '
  "nombre_persona_buscada":"Rosa Céspedes Flores", "ci_persona_buscada":"8100001",
  "fecha_nacimiento":"1958-02-11", "sexo":"FEMENINO", "estatura_rango":"DE_150_A_160",
  "contextura":"DELGADA", "color_piel":"TRIGUENA", "color_cabello":"CANOSO",
  "color_ojos":"CAFES_OSCUROS", "senas_particulares":["LENTES"],
  "prenda_superior":"CHOMPA", "color_prenda_superior":"ROSADO",
  "prenda_inferior":"POLLERA", "color_prenda_inferior":"AZUL", "calzado":"SANDALIAS",
  "circunstancia":"EXTRAVIO_EN_VIA_PUBLICA", "condicion_relevante":["DIFICULTAD_DE_ORIENTACION"]')
firmar "$TOK_MARCO" "$DEN_ROSA" HIJO_A "Marco Rojas Céspedes"

echo "→ Elena reporta a su hijo Kevin, de 15 años, en Sacaba (sin foto: es menor)…"
DEN_KEVIN=$(denunciar "$TOK_ELENA" ${=SACABA} 6 no '
  "nombre_persona_buscada":"Kevin Arnez Torrico", "ci_persona_buscada":"8100002",
  "fecha_nacimiento":"2011-06-03", "sexo":"MASCULINO", "estatura_rango":"DE_160_A_170",
  "contextura":"DELGADA", "color_piel":"MORENA", "color_cabello":"NEGRO",
  "color_ojos":"NEGROS", "prenda_superior":"POLERON", "color_prenda_superior":"GRIS",
  "prenda_inferior":"PANTALON_DEPORTIVO", "color_prenda_inferior":"AZUL", "calzado":"ZAPATILLAS",
  "circunstancia":"NO_REGRESO_DE_TRABAJO_O_ESTUDIO"')
firmar "$TOK_ELENA" "$DEN_KEVIN" MADRE "Elena Torrico Meneses"

echo "→ Wilma reporta a su esposo, Wilfredo, en Quillacollo…"
DEN_WILFREDO=$(denunciar "$TOK_WILMA" ${=QUILLACOLLO} 20 si '
  "nombre_persona_buscada":"Wilfredo Choque Gutiérrez", "ci_persona_buscada":"8100004",
  "fecha_nacimiento":"1981-04-17", "sexo":"MASCULINO", "estatura_rango":"DE_160_A_170",
  "contextura":"GRUESA", "color_piel":"MORENA", "color_cabello":"NEGRO",
  "color_ojos":"CAFES_OSCUROS", "senas_particulares":["CICATRIZ","TATUAJE"],
  "prenda_superior":"CHAQUETA", "color_prenda_superior":"VERDE",
  "prenda_inferior":"PANTALON_TELA", "color_prenda_inferior":"CAFE", "calzado":"ZAPATOS",
  "circunstancia":"PERDIDA_DE_CONTACTO", "condicion_relevante":["REQUIERE_MEDICACION"]')
firmar "$TOK_WILMA" "$DEN_WILFREDO" CONYUGE "Wilma Gutiérrez Rocha"

echo "→ Caro reporta a su amiga Daniela, en Tiquipaya (no familiar: 12 h)…"
DEN_DANIELA=$(denunciar "$TOK_CARO" ${=TIQUIPAYA} 3 si '
  "nombre_persona_buscada":"Daniela Soria Pinto", "ci_persona_buscada":"8100003",
  "fecha_nacimiento":"2004-09-21", "sexo":"FEMENINO", "estatura_rango":"DE_150_A_160",
  "contextura":"MEDIA", "color_piel":"TRIGUENA", "color_cabello":"CASTANO_OSCURO",
  "color_ojos":"CAFES_OSCUROS", "senas_particulares":["TATUAJE"],
  "prenda_superior":"CASACA", "color_prenda_superior":"NEGRO",
  "prenda_inferior":"PANTALON_JEAN", "color_prenda_inferior":"AZUL", "calzado":"BOTAS",
  "circunstancia":"NO_LLEGO_A_DESTINO"')
firmar "$TOK_CARO" "$DEN_DANIELA" TERCERO_NO_FAMILIAR "Caro Vaca Ortiz"

echo "→ Creando una denuncia que ya venció (Caro reporta a su padre)…"
# Mostrar la caducidad exige una alerta que haya cumplido su plazo, y 24 horas no
# se pueden esperar en una demostración.
#
# Se firma como cualquier otra y después se adelanta `expira_en`, que es lo único
# que mide el plazo, junto con el estado que el planificador escribiría al verla
# vencida. Las fechas de presentación y de firma no se tocan: la de firma está
# sellada en la cadena de hashes, y antedatarla rompería la constancia. Por eso
# figura presentada y vencida el mismo día.
#
# Nadie recibe aviso. El padre no tiene cuenta, así que no hay a quién decirle
# que lo reportaron, y la alerta de la firma no sale: se vence en la misma
# fracción de segundo, y el worker, que pasa cada minuto, relee el estado antes
# de enviar y la descarta.
DEN_VENCIDA=$(denunciar "$TOK_CARO" $LAT_VENCIDA $LON_VENCIDA 24 si '
  "nombre_persona_buscada":"Jorge Vaca Saavedra", "ci_persona_buscada":"4000004",
  "fecha_nacimiento":"1948-05-14", "sexo":"MASCULINO", "estatura_rango":"DE_160_A_170",
  "contextura":"DELGADA", "color_piel":"TRIGUENA", "color_cabello":"CANOSO",
  "color_ojos":"CAFES_OSCUROS", "senas_particulares":["LENTES"],
  "prenda_superior":"ABRIGO", "color_prenda_superior":"CAFE",
  "prenda_inferior":"PANTALON_TELA", "color_prenda_inferior":"GRIS", "calzado":"ZAPATOS",
  "circunstancia":"EXTRAVIO_EN_VIA_PUBLICA", "condicion_relevante":["DIFICULTAD_DE_ORIENTACION"]')
firmar "$TOK_CARO" "$DEN_VENCIDA" HIJO_A "Caro Vaca Ortiz"

VENCIDA=$(psqlq -c "UPDATE denuncias SET expira_en = now(), estado = 'CADUCADA'
                     WHERE id = '$DEN_VENCIDA' AND estado = 'ACTIVA' RETURNING id")
if [[ "$VENCIDA" != "$DEN_VENCIDA" ]]; then
  echo "  No se pudo dejar vencida la denuncia de Caro: no quedó difundiéndose al firmarla." >&2
  exit 1
fi

# Se le fija al simulador la misma coordenada que la denuncia.
#
# Sin esto el simulador reporta Cupertino y queda a 9 000 km del radio: la alerta
# se emite, no encuentra destinatarios y no hay ningún error que lo explique.
#
# No es fatal si falla: el simulador es opcional y el resto de la demostración
# funciona igual desde un teléfono físico.
if xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
  echo "→ Fijando la ubicación del simulador en $LAT_DEMO, $LON_DEMO…"
  xcrun simctl location booted set "$LAT_DEMO,$LON_DEMO" 2>/dev/null \
    || echo "  (no se pudo; fíjala a mano en Features → Location → Custom)"
else
  echo "→ Sin simulador arrancado; su ubicación se fija sola la próxima vez."
fi

cat <<FIN

╭──────────────────────────────────────────────────────────────╮
│  Datos de demostración listos                                │
╰──────────────────────────────────────────────────────────────╯

  Contraseña de todas las cuentas:  Demo1234

  ana@demo.bo    Ana Quispe Vargas       CI 1000001   (denunciante)
  luis@demo.bo   Luis Mamani Choque      CI 2000002   (persona reportada)
  caro@demo.bo   Caro Vaca Ortiz         CI 3000003   (vecina, con una alerta vencida)
  marco@demo.bo  Marco Rojas Céspedes    CI 5000005   (denunciante)
  elena@demo.bo  Elena Torrico Meneses   CI 6000006   (denunciante)
  wilma@demo.bo  Wilma Gutiérrez Rocha   CI 7000007   (denunciante)

  Hay seis denuncias, firmadas desde «el teléfono» de quien las presentó:
  · Centro: Ana sobre su hijo Luis Mamani Choque, 38 años.
  · La Cancha: Marco sobre su madre, Rosa Céspedes Flores, 68 años.
  · Sacaba: Elena sobre su hijo Kevin Arnez Torrico, 15 años. Sin foto: es menor.
  · Quillacollo: Wilma sobre su esposo, Wilfredo Choque Gutiérrez, 45 años.
  · Tiquipaya: Caro sobre su amiga Daniela Soria Pinto, 22 años (vence en 12 h).
  · Caro sobre su padre, Jorge Vaca Saavedra, que no tiene cuenta. Ya venció: no
    aparece en el mapa ni en la lista.
  Las fotos de los adultos son la silueta rotulada «EJEMPLO».

  · caro@demo.bo: ve la de Ana en el mapa y prueba «Vi a esta persona». En
    «Mis denuncias», la de su padre figura como «Alerta vencida»: «Volver a
    mostrar la alerta» la devuelve al mapa otras 24 horas sin notificar a nadie.
  · luis@demo.bo: «Alertas sobre mí» → «Esta denuncia es falsa». Después, en
    ana@demo.bo, «Mi situación» muestra la falta y los 7 días sin denunciar.
  · ana@demo.bo: «Prolongar la alerta» o «La encontramos» en su denuncia, o
    una denuncia nueva firmada con el desbloqueo del teléfono.
  · luis@demo.bo (o ana@demo.bo, solo la suya): pedir la constancia y
    verificarla con  node tools/verificar-constancia.mjs constancia.json

  Todo ocurre en $LAT_DEMO, $LON_DEMO; la denuncia vencida, 1 km al norte.
  Para recibir la alerta hay que estar dentro del radio (2 km) y con otra
  cuenta: al denunciante nunca se le alerta de su propia denuncia.

FIN

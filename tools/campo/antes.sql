-- Antes de firmar: ¿cada teléfono quedó dentro o fuera, como estaba previsto?
--
-- Solo lectura. Muestra, por dispositivo de las cuentas de prueba, la hora de
-- su última ubicación y la distancia al centro de la zona del caso, y dice si
-- la alerta le llegaría. Lo decide igual que `AlertasService.destinatariosDe`:
-- dispositivo registrado, ubicación de menos de 72 h dentro del radio, cuenta
-- no suspendida y que no sea la que firma.
--
-- El centro es el de la última denuncia sin firmar de la cuenta que firma. Si
-- todavía no la creaste, pásalo con -v lat=… -v lng=…: se reduce a su celda
-- igual que en el servidor.
--
-- Variables (todas opcionales):
--   emisor   correo de la cuenta que firma       (revisor@alertatemprana.test)
--   cuentas  patrón de las cuentas de prueba     (campo%@alertatemprana.test)
--   radio    radio de la alerta en metros        (2000: vínculo familiar)
--   lat, lng centro, si no hay denuncia sin firmar
--
-- Uso en el servidor: ver tools/campo/guia-prueba-de-campo.md, paso 2.

\if :{?emisor}
\else
  \set emisor revisor@alertatemprana.test
\endif
\if :{?cuentas}
\else
  \set cuentas campo%@alertatemprana.test
\endif
\if :{?radio}
\else
  \set radio 2000
\endif
\if :{?lat}
\else
  \set lat ''
\endif
\if :{?lng}
\else
  \set lng ''
\endif

BEGIN TRANSACTION READ ONLY;
SET LOCAL TIME ZONE 'America/La_Paz';
\pset footer off

\echo '== Caso: el centro desde el que se mide'
WITH caso AS (
  SELECT d.nombre_persona_buscada, d.latitude, d.longitude, d.created_at
  FROM denuncias d
  JOIN users e ON e.id = d.denunciante_id
  WHERE e.email = :'emisor'
    AND d.nivel_confianza = 'REGISTRADA'
    AND d.estado = 'ACTIVA'
  ORDER BY d.created_at DESC
  LIMIT 1
)
SELECT CASE WHEN :'lat' <> '' THEN 'el dado con -v lat y lng' ELSE 'la última denuncia sin firmar' END AS origen,
       CASE WHEN :'lat' <> '' THEN NULL ELSE (SELECT nombre_persona_buscada FROM caso) END AS caso,
       CASE WHEN :'lat' <> '' THEN round(((floor(NULLIF(:'lat', '')::float8 / 0.01) + 0.5) * 0.01)::numeric, 7)
            ELSE (SELECT latitude FROM caso)::numeric END AS centro_lat,
       CASE WHEN :'lng' <> '' THEN round(((floor(NULLIF(:'lng', '')::float8 / 0.01) + 0.5) * 0.01)::numeric, 7)
            ELSE (SELECT longitude FROM caso)::numeric END AS centro_lng,
       :radio AS radio_m;

\echo '== Teléfonos de prueba'
WITH caso AS (
  SELECT d.latitude, d.longitude
  FROM denuncias d
  JOIN users e ON e.id = d.denunciante_id
  WHERE e.email = :'emisor'
    AND d.nivel_confianza = 'REGISTRADA'
    AND d.estado = 'ACTIVA'
  ORDER BY d.created_at DESC
  LIMIT 1
),
centro AS (
  SELECT ST_SetSRID(ST_MakePoint(
           coalesce((floor(NULLIF(:'lng', '')::float8 / 0.01) + 0.5) * 0.01, (SELECT longitude FROM caso)),
           coalesce((floor(NULLIF(:'lat', '')::float8 / 0.01) + 0.5) * 0.01, (SELECT latitude FROM caso))
         ), 4326)::geography AS punto
),
telefonos AS (
  SELECT split_part(u.email, '@', 1) AS cuenta,
         x.id AS dispositivo_id,
         x.plataforma,
         u.estado_cuenta,
         u.last_location_at,
         c.punto IS NULL AS sin_centro,
         ST_Distance(u.last_location, c.punto) AS distancia
  FROM users u
  CROSS JOIN centro c
  LEFT JOIN dispositivos x ON x.usuario_id = u.id
  WHERE u.email LIKE :'cuentas'
    AND u.email <> :'emisor'
)
SELECT cuenta,
       coalesce(left(dispositivo_id::text, 8), 'NINGUNO') AS dispositivo,
       plataforma,
       to_char(last_location_at, 'HH24:MI:SS') AS ubicacion_a_las,
       round(extract(epoch FROM now() - last_location_at) / 60) AS hace_min,
       round(distancia) AS distancia_m,
       CASE WHEN sin_centro THEN 'SIN CENTRO: crea la denuncia o pasa -v lat y lng'
            WHEN distancia IS NULL THEN 'SIN UBICACIÓN'
            WHEN distancia < 1000 THEN 'dentro'
            WHEN distancia > 3500 THEN 'fuera'
            WHEN distancia <= :radio THEN 'BORDE, la recibiría'
            ELSE 'BORDE, no la recibiría' END AS posicion,
       CASE WHEN dispositivo_id IS NULL THEN 'no: sin dispositivo'
            WHEN sin_centro THEN '?'
            WHEN distancia IS NULL THEN 'no: sin ubicación'
            WHEN last_location_at <= now() - interval '72 hours' THEN 'no: ubicación vieja'
            WHEN estado_cuenta = 'SUSPENDIDA' THEN 'no: suspendida'
            WHEN distancia > :radio THEN 'no: fuera del radio'
            ELSE 'SÍ' END AS recibiria
FROM telefonos
ORDER BY distancia NULLS LAST, cuenta;

\echo '== Otras cuentas que la alerta alcanzaría (tiene que ser 0)'
WITH caso AS (
  SELECT d.latitude, d.longitude
  FROM denuncias d
  JOIN users e ON e.id = d.denunciante_id
  WHERE e.email = :'emisor'
    AND d.nivel_confianza = 'REGISTRADA'
    AND d.estado = 'ACTIVA'
  ORDER BY d.created_at DESC
  LIMIT 1
),
centro AS (
  SELECT ST_SetSRID(ST_MakePoint(
           coalesce((floor(NULLIF(:'lng', '')::float8 / 0.01) + 0.5) * 0.01, (SELECT longitude FROM caso)),
           coalesce((floor(NULLIF(:'lat', '')::float8 / 0.01) + 0.5) * 0.01, (SELECT latitude FROM caso))
         ), 4326)::geography AS punto
)
SELECT count(DISTINCT u.id) AS cuentas
FROM users u
CROSS JOIN centro c
JOIN dispositivos x ON x.usuario_id = u.id
WHERE u.email NOT LIKE :'cuentas'
  AND u.email <> :'emisor'
  AND u.last_location IS NOT NULL
  AND u.last_location_at > now() - interval '72 hours'
  AND u.estado_cuenta <> 'SUSPENDIDA'
  AND ST_DWithin(u.last_location, c.punto, :radio);

\echo '== Cuenta que firma'
SELECT u.documento_registrado,
       u.estado_cuenta,
       (SELECT count(*) FROM faltas f WHERE f.usuario_id = u.id) AS faltas,
       (SELECT count(*) FROM denuncias d
         WHERE d.denunciante_id = u.id AND d.nivel_confianza <> 'REGISTRADA'
           AND d.estado = 'ACTIVA' AND d.expira_en > now()) AS difundiendose,
       2 AS limite,
       (SELECT count(*) FROM denuncias d
         WHERE d.denunciante_id = u.id AND d.nivel_confianza = 'REGISTRADA'
           AND d.estado = 'ACTIVA') AS sin_firmar
FROM users u
WHERE u.email = :'emisor';

ROLLBACK;

-- Resultados de la prueba de campo, desde el servidor.
--
-- Solo lectura. Para cada alerta firmada por la cuenta de la prueba dentro de
-- la ventana: la hora de la firma, el radio, los destinatarios y las entregas, y
-- los segundos entre la firma y la aceptación de la pasarela (Expo). No usa el
-- recibo: el servidor lo pide 15 minutos después de enviar, por diseño, así que
-- no mide la entrega. Después, cada teléfono de prueba con su distancia, su
-- estado y sus segundos hasta la aceptación.
--
-- La aceptación es lo más cerca del teléfono que el servidor puede medir: dice
-- que Expo tomó el mensaje. Lo que tarda en aparecer en la pantalla se anota a
-- mano (la latencia percibida).
--
-- Variables:
--   desde, hasta  la ventana, en hora de Bolivia     (obligatorias)
--   emisor        correo de la cuenta que firma       (revisor@alertatemprana.test)
--   cuentas       patrón de las cuentas de prueba     (campo%@alertatemprana.test)
--
-- Uso en el servidor: ver tools/campo/guia-prueba-de-campo.md, paso 6.

\if :{?desde}
\else
  \echo 'Falta la ventana: -v desde="2026-11-08 10:00" -v hasta="2026-11-08 12:00"'
  \quit
\endif
\if :{?hasta}
\else
  \echo 'Falta la ventana: -v desde="2026-11-08 10:00" -v hasta="2026-11-08 12:00"'
  \quit
\endif
\if :{?emisor}
\else
  \set emisor revisor@alertatemprana.test
\endif
\if :{?cuentas}
\else
  \set cuentas campo%@alertatemprana.test
\endif

BEGIN TRANSACTION READ ONLY;
SET LOCAL TIME ZONE 'America/La_Paz';
\pset footer off

\echo '== Por emisión (Tabla 21)'
WITH s AS (
  SELECT row_number() OVER (ORDER BY em.creada_en) AS n,
         em.id, em.creada_en, em.emitida_en, em.radio_m, em.destinatarios,
         d.nombre_persona_buscada AS caso,
         (SELECT min(dj.firmada_en) FROM declaraciones_juradas dj
           WHERE dj.denuncia_id = em.denuncia_id AND dj.tipo = 'original') AS firmada_en
  FROM emisiones_alerta em
  JOIN denuncias d ON d.id = em.denuncia_id
  JOIN users e ON e.id = d.denunciante_id
  WHERE em.motivo = 'firma'
    AND e.email = :'emisor'
    AND em.creada_en >= (:'desde')::timestamptz
    AND em.creada_en <  (:'hasta')::timestamptz
)
SELECT s.n,
       to_char(s.firmada_en, 'YYYY-MM-DD HH24:MI:SS') AS firma,
       s.caso,
       s.radio_m,
       s.destinatarios,
       count(x.id) AS entregas,
       count(x.id) FILTER (WHERE x.ticket_id IS NOT NULL) AS aceptadas,
       count(x.id) FILTER (WHERE u.email NOT LIKE :'cuentas') AS a_otras_cuentas,
       round(extract(epoch FROM s.emitida_en - s.firmada_en)::numeric, 1) AS s_firma_a_emision,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM x.actualizada_en - s.firmada_en))
             FILTER (WHERE x.ticket_id IS NOT NULL)::numeric, 1) AS s_aceptacion_mediana,
       round(max(extract(epoch FROM x.actualizada_en - s.firmada_en))
             FILTER (WHERE x.ticket_id IS NOT NULL)::numeric, 1) AS s_aceptacion_max
FROM s
LEFT JOIN entregas_alerta x ON x.emision_id = s.id
LEFT JOIN users u ON u.id = x.usuario_id
GROUP BY s.n, s.firmada_en, s.emitida_en, s.caso, s.radio_m, s.destinatarios
ORDER BY s.n;

\echo '== Por teléfono de prueba (Anexo 11)'
\echo '   Sin entrega: la distancia es la de su ubicación de ahora, no la del momento de la firma.'
WITH s AS (
  SELECT row_number() OVER (ORDER BY em.creada_en) AS n,
         em.id, em.radio_m, d.latitude, d.longitude,
         (SELECT min(dj.firmada_en) FROM declaraciones_juradas dj
           WHERE dj.denuncia_id = em.denuncia_id AND dj.tipo = 'original') AS firmada_en
  FROM emisiones_alerta em
  JOIN denuncias d ON d.id = em.denuncia_id
  JOIN users e ON e.id = d.denunciante_id
  WHERE em.motivo = 'firma'
    AND e.email = :'emisor'
    AND em.creada_en >= (:'desde')::timestamptz
    AND em.creada_en <  (:'hasta')::timestamptz
),
telefonos AS (
  SELECT u.id AS usuario_id, split_part(u.email, '@', 1) AS cuenta, x.id AS dispositivo_id,
         u.last_location
  FROM users u
  JOIN dispositivos x ON x.usuario_id = u.id
  WHERE u.email LIKE :'cuentas'
    AND u.email <> :'emisor'
)
SELECT s.n,
       t.cuenta,
       left(t.dispositivo_id::text, 8) AS dispositivo,
       coalesce(x.distancia_m,
                round(ST_Distance(t.last_location,
                      ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography))) AS distancia_m,
       CASE WHEN x.id IS NULL THEN 'sin entrega' ELSE x.estado END AS estado,
       CASE WHEN x.ticket_id IS NOT NULL
            THEN round(extract(epoch FROM x.actualizada_en - s.firmada_en)::numeric, 1) END AS s_hasta_aceptacion,
       CASE WHEN x.estado IN ('fallida', 'no_despachada', 'sin_recibo')
            THEN split_part(coalesce(x.resultado_recibo, x.resultado_pasarela, 'sin detalle'), ':', 1) END AS error
FROM s
CROSS JOIN telefonos t
LEFT JOIN entregas_alerta x ON x.emision_id = s.id AND x.dispositivo_id = t.dispositivo_id
ORDER BY s.n, distancia_m NULLS LAST, t.cuenta;

ROLLBACK;

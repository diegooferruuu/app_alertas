-- Métricas de entrega de alertas, para el capítulo de validación.
--
-- Uso:
--   docker exec -i app_alertas_postgres psql -U postgres -d app_alertas < tools/metricas-entrega.sql
--
-- Qué se puede afirmar y qué no: `despachada` quiere decir que Apple o Google
-- recibieron la notificación, según el recibo de Expo. El último tramo, hasta
-- el teléfono, no lo informa nadie. La tasa de despacho es lo más cerca de la
-- entrega real que permite medir la pasarela, y así hay que llamarla.

\echo '1. Cómo terminó cada notificación'
SELECT estado,
       count(*) AS entregas,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS porcentaje
  FROM entregas_alerta
 GROUP BY estado
 ORDER BY entregas DESC;

\echo '2. Tasa de despacho, sobre lo que tiene resultado conocido'
-- Fuera del denominador quedan lo pendiente (encolada, aceptada) y lo
-- desconocido (sin_recibo). Se informan al lado para que no se escondan.
SELECT count(*) FILTER (WHERE estado = 'despachada') AS despachadas,
       count(*) FILTER (WHERE estado IN ('despachada', 'no_despachada', 'fallida')) AS con_resultado,
       round(100.0 * count(*) FILTER (WHERE estado = 'despachada')
             / nullif(count(*) FILTER (WHERE estado IN ('despachada', 'no_despachada', 'fallida')), 0), 1)
         AS tasa_despacho_pct,
       count(*) FILTER (WHERE estado = 'sin_recibo') AS sin_recibo,
       count(*) FILTER (WHERE estado IN ('encolada', 'aceptada')) AS pendientes
  FROM entregas_alerta;

\echo '3. Latencia: desde que se firmó la denuncia hasta que Expo aceptó la notificación'
-- La emisión se encola en la misma transacción que la firma, así que su
-- `creada_en` es el momento de la firma. `actualizada_en` de la entrega es
-- cuándo aceptó Expo: el recibo, que llega después, no la mueve.
SELECT count(*) AS notificaciones,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY e.actualizada_en - em.creada_en) AS mediana,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY e.actualizada_en - em.creada_en) AS p95,
       max(e.actualizada_en - em.creada_en) AS maxima
  FROM entregas_alerta e
  JOIN emisiones_alerta em ON em.id = e.emision_id
 WHERE e.estado IN ('aceptada', 'despachada', 'no_despachada', 'sin_recibo');

\echo '4. Segmentación: nadie notificado fuera del radio de su emisión'
-- Los avisos directos a la persona reportada no tienen radio y no entran.
SELECT count(*) AS entregas_con_radio,
       count(*) FILTER (WHERE e.distancia_m > em.radio_m) AS fuera_del_radio
  FROM entregas_alerta e
  JOIN emisiones_alerta em ON em.id = e.emision_id
 WHERE em.radio_m IS NOT NULL;

\echo '5. Intención de reporte de avistamiento, por alerta y canal'
-- Cuenta toques en «Llamar» y «Enviar por WhatsApp», no reportes entregados:
-- lo que pasa después del toque ocurre fuera del sistema. Sin quién ni dónde
-- (I2), y con la hora al minuto. Se compara con cuántos recibieron la alerta.
SELECT u.denuncia_id,
       count(*) FILTER (WHERE u.canal = 'LLAMADA') AS llamadas,
       count(*) FILTER (WHERE u.canal = 'MENSAJE') AS mensajes,
       (SELECT count(*) FROM entregas_alerta e
          JOIN emisiones_alerta em ON em.id = e.emision_id
         WHERE em.denuncia_id = u.denuncia_id
           AND e.estado IN ('aceptada', 'despachada')) AS notificados
  FROM usos_canal_avistamiento u
 GROUP BY u.denuncia_id
 ORDER BY min(u.creado_en);

\echo '6. Tiempo desde que se difundió la alerta hasta «La encontramos»'
-- Solo las que su autor dio por terminadas después de difundirse. Mide lo que
-- el sistema sabe: cuándo lo informó quien denunció, no cuándo apareció la
-- persona. La emisión de la firma se encola en la misma transacción que la
-- firma, así que su `creada_en` es el momento en que empezó la difusión.
SELECT count(*) AS casos,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY d.cerrada_en - f.difundida_en) AS mediana,
       max(d.cerrada_en - f.difundida_en) AS maxima
  FROM denuncias d
  JOIN LATERAL (SELECT min(em.creada_en) AS difundida_en
                  FROM emisiones_alerta em
                 WHERE em.denuncia_id = d.id AND em.motivo = 'firma') f ON true
 WHERE d.estado = 'CERRADA' AND f.difundida_en IS NOT NULL;

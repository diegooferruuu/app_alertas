#!/usr/bin/env bash
# Deja a la vista una alerta de muestra para el revisor de Google Play.
#
#   ssh oracle '~/alertas/deploy/alerta-de-muestra.sh'
#
# «Reportar contenido inapropiado» solo aparece en la alerta de otra cuenta. Sin
# ninguna en el servidor, el revisor no encuentra el sistema de reportes que pide
# la política de contenido generado por usuarios.
#
# La presenta una cuenta propia con el documento ya registrado (carnet de 12
# cifras, como la de revisión) y sin contraseña usable: nadie entra con ella. La
# persona se llama «Persona de Ejemplo», la foto es una silueta, y la zona está en
# medio del Salar de Uyuni, donde la única notificación no encuentra a nadie.
#
# Correrlo de nuevo no duplica nada: si le quedan menos de 12 horas la prolonga
# sin notificar, y cuando se acaban las prolongaciones la da por encontrada y
# presenta otra. Córrelo antes de mandar la app a revisión. Mientras dure la
# revisión, cada 6 horas la mantiene siempre a la vista.
set -euo pipefail
cd "$(dirname "$0")"

sudo docker compose exec -T backend node dist/cli/alerta-de-muestra.js < muestra/persona-de-ejemplo.jpg

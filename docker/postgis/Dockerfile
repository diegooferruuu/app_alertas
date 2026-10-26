# PostgreSQL 15 con PostGIS, nativo en ARM64 y en amd64.
#
# La imagen postgis/postgis solo se publica para amd64: en el servidor de Oracle,
# que es ARM, correría emulada. Esta parte de la imagen oficial de Postgres, que
# sí es multiarquitectura, y le agrega PostGIS desde el repositorio de
# PostgreSQL que esa imagen ya trae configurado.
#
# Se queda en la 15 por lo mismo que la de desarrollo: es la versión que declara
# el proyecto, y cambiar de versión mayor obliga a recrear el volumen.
FROM postgres:15-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-15-postgis-3 \
      postgresql-15-postgis-3-scripts \
 && rm -rf /var/lib/apt/lists/*

# Las extensiones, igual que en desarrollo. El esquema lo ponen las migraciones.
COPY init.sql /docker-entrypoint-initdb.d/init.sql

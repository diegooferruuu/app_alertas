-- Preparación de la base al crear el contenedor por primera vez.
--
-- Aquí van SOLO las extensiones. El esquema (tablas, índices, restricciones)
-- lo gobiernan las migraciones de TypeORM en apps/backend/src/database/migrations.
-- Definirlo también aquí produciría dos fuentes de verdad que se contradicen:
-- este archivo corre una única vez, al inicializar el volumen, y no vuelve a
-- ejecutarse nunca, así que cualquier cambio posterior quedaría solo en las
-- migraciones y este archivo envejecería en silencio.
--
-- Tras levantar el contenedor:  cd apps/backend && pnpm migration:run

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

# syntax=docker/dockerfile:1
#
# Backend de alertas para el servidor: ARM64 en Oracle, y también amd64.
#
# Se construye desde la raíz del monorepo, porque necesita el lockfile:
#
#   docker build -f apps/backend/Dockerfile -t alertas-backend .
#
# Dos etapas: una compila con todas las dependencias, la otra corre solo con las
# de producción. pnpm sale de `packageManager` por corepack, así que es la misma
# versión con la que se escribió el lockfile.

FROM node:24-bookworm-slim AS compilacion
WORKDIR /repo
RUN corepack enable

# Primero solo los manifiestos: mientras no cambien las dependencias, esta capa
# queda en caché y reconstruir tras tocar el código tarda segundos.
# `tsconfig.json` de la raíz también: el del backend hereda de él, y sin él
# TypeScript compila con otras opciones y falla.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile --filter backend...

COPY apps/backend apps/backend
RUN pnpm --filter backend build \
 && pnpm --filter backend deploy --prod --legacy /salida

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=compilacion --chown=node:node /salida/node_modules ./node_modules
COPY --from=compilacion --chown=node:node /salida/package.json ./package.json
COPY --from=compilacion --chown=node:node /repo/apps/backend/dist ./dist
# El modelo de español del OCR, en el directorio de trabajo, que es donde
# tesseract.js busca su caché. Sin él, el primer registro de documento lo
# descargaría de internet.
COPY --chown=node:node apps/backend/spa.traineddata ./spa.traineddata

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]

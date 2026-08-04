# The application image: React Router 7 in SSR mode owns the HTTP server
# (plan.md R1 -- no Fastify, no Express, no adapter in the request path),
# and the TypeScript ETL pipeline shares this same image (R2). Same
# built-not-pulled, multi-arch posture as docker/db, and for the same two
# reasons -- see docker/db/Dockerfile: Constitution Principle VII requires
# linux/arm64 to actually work, not just linux/amd64, and the components in
# the safety-critical request and ingest paths should come from a base we
# can audit.
#
# Multi-stage so the build toolchain (vite, @react-router/dev, typescript)
# never reaches the image that serves traffic or runs the ETL -- those get
# a `node_modules` built from production dependencies only.

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# -----------------------------------------------------------------------------

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The built RR7 client + server bundle.
COPY --from=build /app/build ./build

# Hand-authored server and ETL code, run directly by Node's built-in
# TypeScript support -- no compile step, no ts-node (see server/entry.ts).
# Includes the SQL files loaded at startup (plan.md R4) and the migration
# runner, which the one-shot `migrate` compose service invokes from this
# same image.
COPY server ./server
COPY sql ./sql
COPY etl ./etl

EXPOSE 3000

CMD ["node", "server/entry.ts"]

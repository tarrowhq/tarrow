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

# The build-output scan: the second layer behind the Content-Security-Policy
# (spec FR-026). It runs HERE, as its own build step, so that a third-party
# origin reaching the shipped assets fails `docker compose build` -- before an
# image exists, let alone before a reader's browser is asked to contact
# somebody else. A scan that only runs in the test suite is a scan somebody can
# ship past. See app/scripts/scan-external-origins.mjs.
RUN npm run scan:external-origins

# -----------------------------------------------------------------------------
# The browser stage: the build stage plus a real browser.
#
# TASK-0015 exists because somap shipped an app that did not work in a browser
# while 146 tests passed. Every one of them reached the app through fetch(),
# and fetch is not a browser -- it does not implement referrer policy, so it
# could not produce the `Origin: null` that broke the form, and no assertion
# over a response body could have noticed. A suite with no browser in it cannot
# express a bug only a browser can produce.
#
# Its own stage, not part of `build`, so nobody pays for it who is not running
# it: `docker compose up --build` targets `runtime`, which depends on `build`
# and never reaches this. Only the `browser-test` service under the `test`
# profile builds it.
#
# Debian's `chromium` is used rather than a downloaded binary because it is
# packaged for both amd64 and arm64 -- Principle VII again, the same reason
# docker/db builds rather than pulls. A browser test that only runs on the
# maintainer's architecture is not a test the project has.
FROM build AS browsertest

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# puppeteer-core drives the system browser and bundles none of its own.
ENV CHROMIUM_PATH=/usr/bin/chromium

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

# The runtime image carries no tests/ and no dev dependencies, and that is
# deliberate. scripts/ comes along anyway so that `npm test` run against THIS
# image fails with a sentence explaining which container the suite lives in --
# rather than exiting 0 having collected zero tests, which is what it did
# before (scripts/run-tests.mjs). A wrong invocation must look like a wrong
# invocation, not like a green suite.
COPY scripts ./scripts

EXPOSE 3000

# --max-http-header-size is raised from Node's 16 KB default to 64 KB.
#
# Not a tuning knob -- a bug fix (TASK-0014). Browsers key the cookie jar on
# hostname and ignore the port, so on a developer machine, where every project
# shares `localhost`, somap receives the accumulated cookies of every other
# application ever served from that hostname. Past 16 KB the parser rejects the
# request before somap sees it, and a housing tool answers with an error for
# something no part of somap did.
#
# 64 KB is headroom, not the fix on its own: server/entry.ts still answers an
# actual overflow with an explanation rather than a bare failure, because a
# limit large enough never to be hit is a limit nobody has tested.
#
# somap sets no cookies and reads no request header of consequence, so nothing
# here is made more permissive in any sense that matters -- only more legible.
CMD ["node", "--max-http-header-size=65536", "server/entry.ts"]

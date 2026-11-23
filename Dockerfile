# syntax=docker/dockerfile:1
#
# Production image for the VPS (built ON the VPS, no registry). See deploy/README.md.
#
# Targets:
#   runner  — the app: Next.js standalone server, non-root, no build tools
#   migrate — one-off `pnpm payload migrate` (dev deps + src; no .next)
#
# Secrets: DATABASE_URI and PAYLOAD_SECRET are NEVER present in any build stage —
# they would end up in image layers / .next/cache. They are runtime env only.
# NEXT_PUBLIC_SERVER_URL is a build-arg because Next inlines it into the bundles.

# node 24.22.3, Debian bookworm slim (glibc — sharp ships prebuilt glibc binaries)
ARG NODE_IMAGE=node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable \
 && corepack prepare pnpm@10.32.1 --activate \
 && chmod -R a+rX /opt/corepack
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store \
 && pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
FROM deps AS builder
COPY . .
ARG NEXT_PUBLIC_SERVER_URL
RUN test -n "$NEXT_PUBLIC_SERVER_URL" \
 || (echo "ERROR: build-arg NEXT_PUBLIC_SERVER_URL is required (e.g. https://app.example.org)" >&2; exit 1)
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
# Call next directly (not `pnpm build`) to cap the heap for a 8 GB VPS.
RUN NODE_OPTIONS="--no-deprecation --max-old-space-size=4096" node_modules/.bin/next build

# ---------------------------------------------------------------------------
# One-off migrations: `docker compose ... run --rm -T migrate`.
# Built from deps (not builder): it needs dev deps + src, never .next.
FROM deps AS migrate
COPY --chown=node:node . .
USER node
CMD ["pnpm", "payload", "migrate"]

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
# Standalone server (includes the traced node_modules, assets/fonts, pdfmake, sharp).
# .next/cache is deliberately NOT copied.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Student photos (local disk) live here; mounted as a named volume in compose.
RUN mkdir -p /app/media/student-photos && chown -R node:node /app/media
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "server.js"]

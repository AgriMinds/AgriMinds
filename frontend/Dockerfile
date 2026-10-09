# syntax=docker/dockerfile:1.7
# Build context is the REPOSITORY ROOT (compose: context: ., dockerfile: frontend/Dockerfile)
# because the web app depends on the workspace package packages/api-types.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
WORKDIR /repo

# ---- deps: install only what @agriminds/web needs, from the frozen lockfile ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
COPY packages/api-types/package.json packages/api-types/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @agriminds/web...

# ---- build ----
FROM deps AS build
COPY packages/api-types packages/api-types
COPY frontend frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @agriminds/web build

# ---- runtime: standalone server, non-root ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app
# standalone output mirrors the monorepo layout (outputFileTracingRoot = repo root)
COPY --from=build --chown=nextjs:nodejs /repo/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/frontend/public ./frontend/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "frontend/server.js"]

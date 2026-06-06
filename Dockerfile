FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/dashboard-ui/package.json packages/dashboard-ui/package.json
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app

LABEL org.opencontainers.image.title="Kew" \
      org.opencontainers.image.description="The dashboard for BullMQ. Standalone, fast, and complete." \
      org.opencontainers.image.url="https://kew.sh" \
      org.opencontainers.image.licenses="BUSL-1.1"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5399 \
    KEW_RETENTION_DB_PATH=/data/kew-retention.db

RUN mkdir -p /data
VOLUME /data

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/apps/server ./apps/server
COPY --from=builder /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=builder /app/apps/dashboard/dist ./apps/dashboard/dist

EXPOSE 5399
CMD ["bun", "apps/server/src/index.ts"]

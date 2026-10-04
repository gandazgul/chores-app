FROM docker.io/denoland/deno:2.9.7 AS builder
WORKDIR /app
ENV DENO_DIR=/deno-dir
COPY deno.json deno.lock ./
RUN deno install --frozen
COPY . .
RUN deno task build
# Include dynamic server imports in the offline runtime cache.
RUN deno cache --frozen scripts/start_production.ts dist/server/entry.mjs

FROM docker.io/denoland/deno:2.9.7
WORKDIR /app
ENV DENO_DIR=/deno-dir DENO_NO_UPDATE_CHECK=1 DB_ENV=production DB_PATH=/data/chores.db
COPY --from=builder --chown=deno:deno /deno-dir /deno-dir
COPY --from=builder --chown=deno:deno /app/node_modules ./node_modules
COPY --from=builder --chown=deno:deno /app/dist ./dist
COPY --from=builder --chown=deno:deno /app/src ./src
COPY --from=builder --chown=deno:deno /app/scripts/start_production.ts ./scripts/start_production.ts
COPY --from=builder --chown=deno:deno /app/scripts/backup_db.ts ./scripts/backup_db.ts
COPY --from=builder --chown=deno:deno /app/deno.json /app/deno.lock ./
RUN mkdir -p /data && chown deno:deno /data
USER deno
EXPOSE 8080
CMD ["run", "-A", "--cached-only", "--frozen", "scripts/start_production.ts"]

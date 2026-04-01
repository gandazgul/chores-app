# Use Deno's debian base image
FROM denoland/deno:latest AS builder

WORKDIR /app

# Cache dependencies
COPY deno.json deno.lock ./
RUN deno install

# Copy application code
COPY . .

# Build the Astro site
RUN deno task build

# Final production image
FROM denoland/deno:latest

WORKDIR /app

# Copy production artifacts and config from builder
COPY --from=builder --chown=deno:deno /app/dist ./dist
COPY --from=builder --chown=deno:deno /app/deno.json ./deno.json
COPY --from=builder --chown=deno:deno /app/deno.lock ./deno.lock

# Set non-root user
USER deno

# Port standard Deno uses
EXPOSE 8080

# Default environment port (can be overridden)
ENV PORT=8080
ENV HOST=0.0.0.0

CMD ["run", "-A", "--env", "dist/server/entry.mjs"]
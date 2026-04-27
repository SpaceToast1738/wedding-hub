# syntax=docker/dockerfile:1.7

# ─── Stage 1: dependencies ─────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ─── Stage 2: builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Transpile the seed script to plain JS so production containers (which don't
# have the `tsx` dev-dep) can run `node prisma/seed.js`. We invoke tsc with
# explicit flags rather than the project's tsconfig because that one has
# `noEmit: true` for type-checking.
RUN npx tsc prisma/seed.ts \
      --outDir prisma-build \
      --module commonjs \
      --moduleResolution node \
      --target es2022 \
      --esModuleInterop \
      --resolveJsonModule \
      --skipLibCheck

# ─── Stage 3: runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Tini for clean signal handling, openssl for Prisma, curl for healthcheck
RUN apk add --no-cache tini openssl curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone Next.js bundle (includes server.js + traced node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma CLI + schema + migrations (so the entrypoint can run `migrate deploy`)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Transpiled seed script (plain JS, no tsx required at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/prisma-build/seed.js ./prisma/seed.js

# Symlink for `npx prisma` / `node ./node_modules/prisma/build/index.js`
COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000

# Healthcheck hits the in-app /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]

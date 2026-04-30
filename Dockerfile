# syntax=docker/dockerfile:1.7

# ─── Stage 1: dependencies ─────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
# `.npmrc` MUST be copied before `npm ci` — it sets legacy-peer-deps=true,
# which the alpine npm 10.8.2 needs to skip the optional-peer conflict
# between next-auth (peer-wants nodemailer ^6) and @auth/core (peer-wants
# ^7). See `.npmrc` and CLAUDE.md for the full story. The `*` glob makes
# this tolerant of the file being absent on a future restructure.
COPY package.json package-lock.json* .npmrc* ./
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

# v1.38.3: transpile the operator scripts (seed-samples-only +
# reset-book) the same way. Both scripts import from prisma/seed and
# need to live alongside the transpiled seed.js so the relative-path
# require() resolves at runtime.
RUN npx tsc prisma/seed.ts scripts/seed-samples-only.ts scripts/reset-book.ts \
      --outDir scripts-build \
      --module commonjs \
      --moduleResolution node \
      --target es2022 \
      --esModuleInterop \
      --resolveJsonModule \
      --skipLibCheck \
      --rootDir .

# ─── Stage 3: runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Tini for clean signal handling, openssl for Prisma, curl for healthcheck
RUN apk add --no-cache tini openssl curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Pre-create /app/uploads with node:node ownership BEFORE the named volume
# mounts at runtime. Docker initialises a fresh volume from the image's
# directory contents (and ownership), so this gives the running `node` user
# write permission inside the otherwise read-only filesystem.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

# Standalone Next.js bundle (includes server.js + traced node_modules)
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Prisma CLI + schema + migrations (so the entrypoint can run `migrate deploy`)
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma

# Transpiled seed script (plain JS, no tsx required at runtime)
COPY --from=builder --chown=node:node /app/prisma-build/seed.js ./prisma/seed.js

# v1.38.3: transpiled operator scripts (seed-samples-only +
# reset-book). The builder stage transpiled them into
# /app/scripts-build/{prisma,scripts}/, preserving the relative tree
# so the `require("../prisma/seed")` inside scripts/*.js resolves
# cleanly. Copy the whole tree wholesale into /app/scripts-build/
# in the runner; entrypoint usage is `node scripts-build/scripts/<x>.js`.
COPY --from=builder --chown=node:node /app/scripts-build ./scripts-build

# Symlink for `npx prisma` / `node ./node_modules/prisma/build/index.js`
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000

# Healthcheck hits the in-app /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]

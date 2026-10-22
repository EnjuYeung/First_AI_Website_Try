# Build frontend
FROM node:24.22.1-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm 11.6.2+ rejects this cross-platform lockfile when resolving Tailwind's
# optional WASI dependencies on Alpine. Pin the last compatible npm release so
# the reproducible install remains strict instead of falling back to npm install.
# Dependency audits run separately in CI so registry audit outages do not block builds.
RUN npm install --global npm@11.6.1 \
    && npm ci --no-audit
COPY . .
RUN npm run build

# One production process serves the frontend, API and background tasks.
FROM node:24.22.1-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit
COPY server/server.js server/healthcheck.js ./
COPY server/lib/ ./lib/
COPY shared/ /app/shared/
COPY --from=build /app/dist /app/dist/
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "healthcheck.js"]
CMD ["node", "server.js"]

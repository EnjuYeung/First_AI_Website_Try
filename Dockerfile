# Build frontend
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm 11.6.2+ rejects this cross-platform lockfile when resolving Tailwind's
# optional WASI dependencies on Alpine. Pin the last compatible npm release so
# the reproducible install remains strict instead of falling back to npm install.
RUN npm install --global npm@11.6.1 \
    && npm ci
COPY . .
RUN npm run build

# Serve with nginx and proxy /api to backend
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

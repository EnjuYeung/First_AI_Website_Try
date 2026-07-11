FROM node:24-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/server.js ./
COPY server/lib/ ./lib/
COPY shared/ /app/shared
EXPOSE 3001
CMD ["npm", "start"]

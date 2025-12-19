FROM node:20-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY shared/ /app/shared
EXPOSE 3001
CMD ["npm", "start"]

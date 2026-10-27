FROM node:22-alpine

# Türkiye saat dilimi (tüm zaman hesapları TR duvar saatiyle çalışır)
ENV TZ=Europe/Istanbul
RUN apk add --no-cache tzdata

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3075

CMD ["node", "server.js"]

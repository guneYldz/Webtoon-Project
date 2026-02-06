# 1. Aşama: Bağımlılıkları Yükle (Node 20'ye güncellendi)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# React 19 uyumsuzluğu için legacy-peer-deps şart
RUN npm install --legacy-peer-deps

# 2. Aşama: Build Al (Node 20'ye güncellendi)
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment Variable'larını Build sırasında yakmak için
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# 3. Aşama: Çalıştır (Node 20'ye güncellendi)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Standart çalıştırma modu için dosyalar
COPY --from=builder /app/package.json .
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

# Git est obligatoire car Baileys est récupéré depuis Bitbucket.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./

RUN corepack enable \
    && yarn install --frozen-lockfile --network-timeout 120000

COPY . .

RUN mkdir -p web/sessions

EXPOSE 3000

# Lance simultanément le panneau Web et le bot WhatsApp.
CMD ["sh", "-c", "node web/server.js & exec node index.js"]

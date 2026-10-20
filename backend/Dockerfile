FROM node:24-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

FROM build AS migrate
ENV NODE_ENV=production
USER node
CMD ["npm", "run", "prisma:migrate:deploy"]

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json
USER node
EXPOSE 3001
CMD ["node", "--enable-source-maps", "dist/main.js"]

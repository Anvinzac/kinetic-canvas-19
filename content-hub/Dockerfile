# Independent, portable container — runs on Railway / Fly / Render / any host.
FROM node:22-slim

WORKDIR /app

# Install deps first for layer caching.
COPY package.json ./
RUN npm install --omit=dev && npm install tsx

COPY tsconfig.json ./
COPY src ./src

# Default to the long-running scheduler. For platform-cron hosts, override the
# command with: tsx src/cli.ts run
CMD ["npx", "tsx", "src/cli.ts", "serve"]

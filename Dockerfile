FROM node:22-bookworm-slim

# Install ffmpeg, curl, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application files
COPY . .

# Build frontend if vite config exists
RUN npm run build || true

# Volumes and ports
VOLUME ["/app/data"]
EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "server/index.js"]

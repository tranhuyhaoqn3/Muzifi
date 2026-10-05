FROM node:22-bookworm-slim

# Install ffmpeg, python3, curl, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

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

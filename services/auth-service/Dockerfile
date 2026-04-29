FROM node:20-alpine

# Jalankan sebagai non-root user untuk keamanan
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy manifest dulu agar layer cache tidak invalid saat kode berubah
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Ganti kepemilikan file ke non-root user
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]

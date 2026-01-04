# Official Puppeteer image (Isme Chrome pehle se hota hai)
FROM ghcr.io/puppeteer/puppeteer:latest

# Root user permissions
USER root

# Working directory
WORKDIR /app

# 🔥 FIX: Humne 'executable_path' wali line HATA DI hai.
# Ab Puppeteer khud sahi wala Chrome dhund lega.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Files copy karo
COPY package*.json ./

# Install dependencies
RUN npm install

# Baaki files copy
COPY . .

# Port
EXPOSE 3000

# Start command
CMD ["node", "index.js"]

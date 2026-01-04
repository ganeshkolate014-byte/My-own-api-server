FROM ghcr.io/puppeteer/puppeteer:latest

# Root user permissions taaki error na aaye
USER root

# Working directory
WORKDIR /app

# 🔥 MAGIC LINES: Chrome download skip karo (RAM Bachayega)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Files copy karo
COPY package*.json ./

# Ab npm install chalega lekin Chrome download nahi karega (Bahut Fast hoga)
RUN npm install

# Baaki files copy
COPY . .

# Port
EXPOSE 3000

# Start command
CMD ["node", "index.js"]

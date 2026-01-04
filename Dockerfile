# Official Puppeteer image use kar rahe hain
# Isme Chrome already installed hota hai, isliye crash nahi hoga
FROM ghcr.io/puppeteer/puppeteer:latest

# Root user ban jao taaki permissions ka issue na ho
USER root

# Working Directory set karo
WORKDIR /app

# Files copy karo
COPY package*.json ./

# Dependencies install karo
# --ignore-scripts zaroori hai taaki puppeteer fir se chrome download na kare
RUN npm ci --ignore-scripts

# Baaki files copy karo
COPY . .

# Port expose karo
EXPOSE 3000

# Server start karo
CMD ["node", "index.js"]

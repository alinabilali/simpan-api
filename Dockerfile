FROM node:20-slim
WORKDIR /app

# Copy package files first so Docker can cache the install step
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000
CMD ["node", "server.js"]


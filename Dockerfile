FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Fix permissions and Generate Prisma Client
RUN chmod -R +x node_modules/.bin && node node_modules/.bin/prisma generate

# Expose port
EXPOSE 3000

# Start command (running server directly, database should be synced manually or via CI)
CMD ["npm", "start"]

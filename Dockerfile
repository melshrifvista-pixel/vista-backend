FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package.json and package-lock.json
COPY package*.json ./

# Copy prisma schema early for potential dependency caching
COPY prisma ./prisma/

# Install dependencies (without postinstall generate)
RUN npm install

# Copy the rest of the application
COPY . .

# Explicitly generate Prisma Client after all files are present
RUN npx prisma generate --schema=prisma/schema.prisma

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]

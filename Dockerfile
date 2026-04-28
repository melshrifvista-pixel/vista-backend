FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package.json and package-lock.json
COPY package*.json ./

# Copy prisma schema before npm install (so postinstall: prisma generate works)
COPY prisma ./prisma/

# Install dependencies
RUN npm install


# Copy the rest of the application
COPY . .


# Expose port
EXPOSE 3000

# Start command (running server directly, database should be synced manually or via CI)
CMD ["npm", "start"]

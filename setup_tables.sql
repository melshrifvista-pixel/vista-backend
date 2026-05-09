-- Create missing tables for VISTA backend

DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'ACCOUNTANT', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EntityType" AS ENUM ('REVENUE', 'EXPENSE', 'CUSTODY', 'SALARY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('IN', 'OUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Alter User table to add role column if missing
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role "Role" NOT NULL DEFAULT 'VIEWER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOL NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isLocked" BOOL NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockUntil" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profilePicture" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW();

-- OTP table
CREATE TABLE IF NOT EXISTS "OTP" (
  id SERIAL PRIMARY KEY,
  "userId" INT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Session table
CREATE TABLE IF NOT EXISTS "Session" (
  id TEXT PRIMARY KEY,
  "userId" INT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "refreshTokenHash" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "isValid" BOOL NOT NULL DEFAULT TRUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- AuditLog table
CREATE TABLE IF NOT EXISTS "AuditLog" (
  id SERIAL PRIMARY KEY,
  "userId" INT REFERENCES "User"(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSON,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Contract table
CREATE TABLE IF NOT EXISTS "Contract" (
  id SERIAL PRIMARY KEY,
  "financialEntityId" INT NOT NULL REFERENCES "FinancialEntity"(id) ON DELETE CASCADE,
  "tenantName" TEXT NOT NULL,
  "startDate" TIMESTAMP NOT NULL,
  "endDate" TIMESTAMP NOT NULL,
  "monthlyRent" FLOAT NOT NULL DEFAULT 0,
  "isActive" BOOL NOT NULL DEFAULT TRUE,
  "userId" INT NOT NULL REFERENCES "User"(id),
  "clientGuid" TEXT UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Fix FinancialEntity if missing columns
ALTER TABLE "FinancialEntity" ADD COLUMN IF NOT EXISTS "clientGuid" TEXT UNIQUE;
ALTER TABLE "FinancialEntity" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW();

-- Fix Transaction if missing columns
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "clientGuid" TEXT UNIQUE;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isCashReturn" BOOL NOT NULL DEFAULT TRUE;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "receiptImagePath" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "personName" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT NOW();

SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;

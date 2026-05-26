-- AlterTable: Add missing columns to users
ALTER TABLE "users" 
ADD COLUMN "role" TEXT,
ADD COLUMN "profileComplete" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: PWD Profile (Person with Disability)
CREATE TABLE "pwd_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "dob" TIMESTAMP(3),
    "disabilityType" TEXT,
    "disabilitySince" INTEGER,
    "houseNo" TEXT,
    "street" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pwd_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Caregiver Profile
CREATE TABLE "caregiver_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "careeName" TEXT,
    "relation" TEXT,
    "careeDob" TIMESTAMP(3),
    "careDisability" TEXT,
    "careSince" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caregiver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Therapist Profile (Educator/Therapist)
CREATE TABLE "therapist_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "dob" TIMESTAMP(3),
    "specialty" TEXT,
    "institution" TEXT,
    "yearsOfExperience" INTEGER,
    "focusAreas" TEXT[],
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "verificationStatus" TEXT DEFAULT 'pending',
    "verificationDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapist_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NGO Profile
CREATE TABLE "ngo_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactPersonName" TEXT,
    "username" TEXT,
    "organizationName" TEXT,
    "registrationNumber" TEXT,
    "organizationType" TEXT,
    "servicesOffered" TEXT[],
    "city" TEXT,
    "pincode" TEXT,
    "website" TEXT,
    "verificationStatus" TEXT DEFAULT 'pending',
    "verificationDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ngo_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pwd_profiles_userId_key" ON "pwd_profiles"("userId");
CREATE UNIQUE INDEX "pwd_profiles_username_key" ON "pwd_profiles"("username");
CREATE INDEX "pwd_profiles_userId_idx" ON "pwd_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "caregiver_profiles_userId_key" ON "caregiver_profiles"("userId");
CREATE INDEX "caregiver_profiles_userId_idx" ON "caregiver_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "therapist_profiles_userId_key" ON "therapist_profiles"("userId");
CREATE UNIQUE INDEX "therapist_profiles_username_key" ON "therapist_profiles"("username");
CREATE INDEX "therapist_profiles_userId_idx" ON "therapist_profiles"("userId");
CREATE INDEX "therapist_profiles_verificationStatus_idx" ON "therapist_profiles"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ngo_profiles_userId_key" ON "ngo_profiles"("userId");
CREATE UNIQUE INDEX "ngo_profiles_username_key" ON "ngo_profiles"("username");
CREATE INDEX "ngo_profiles_userId_idx" ON "ngo_profiles"("userId");
CREATE INDEX "ngo_profiles_verificationStatus_idx" ON "ngo_profiles"("verificationStatus");

-- AddForeignKey
ALTER TABLE "pwd_profiles" ADD CONSTRAINT "pwd_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_profiles" ADD CONSTRAINT "caregiver_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapist_profiles" ADD CONSTRAINT "therapist_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ngo_profiles" ADD CONSTRAINT "ngo_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CallTag" AS ENUM ('won', 'lost', 'follow_up');

-- CreateEnum
CREATE TYPE "CallLanguage" AS ENUM ('es', 'en');

-- AlterTable
ALTER TABLE "CallSession" ADD COLUMN     "language" "CallLanguage" NOT NULL DEFAULT 'es',
ADD COLUMN     "prospectId" TEXT,
ADD COLUMN     "tag" "CallTag";

-- AlterTable
ALTER TABLE "SalesMethodology" ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodologyVersion" (
    "id" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MethodologyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MethodologyVersion_methodologyId_version_key" ON "MethodologyVersion"("methodologyId", "version");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MethodologyVersion" ADD CONSTRAINT "MethodologyVersion_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "SalesMethodology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

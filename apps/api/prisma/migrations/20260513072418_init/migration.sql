-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'seller');

-- CreateEnum
CREATE TYPE "MethodologyStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "SessionChannel" AS ENUM ('simulation', 'browser_audio', 'phone', 'video_call');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('created', 'live', 'ended', 'failed');

-- CreateEnum
CREATE TYPE "Speaker" AS ENUM ('seller', 'prospect', 'unknown');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('buying_signal', 'risk_signal', 'missing_info', 'competitor', 'urgency', 'budget', 'objection');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('question', 'argument', 'warning', 'next_step', 'objection_response');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'seller',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesMethodology" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rawContent" TEXT,
    "status" "MethodologyStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesMethodology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookStage" (
    "id" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "exitCriteria" TEXT,
    "requiredFields" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PlaybookStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookQuestion" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "purpose" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'medium',

    CONSTRAINT "PlaybookQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookObjection" (
    "id" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detectionExamples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedResponse" TEXT NOT NULL,
    "recommendedQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PlaybookObjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookSignal" (
    "id" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "type" "SignalType" NOT NULL,
    "name" TEXT NOT NULL,
    "detectionExamples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedAction" TEXT NOT NULL,

    CONSTRAINT "PlaybookSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sellerId" TEXT,
    "methodologyId" TEXT,
    "title" TEXT,
    "channel" "SessionChannel" NOT NULL DEFAULT 'simulation',
    "status" "SessionStatus" NOT NULL DEFAULT 'created',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "speaker" "Speaker" NOT NULL DEFAULT 'unknown',
    "text" TEXT NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT true,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectedSignal" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "transcriptSegmentId" TEXT,
    "type" "SignalType" NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetectedSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRecommendation" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "suggestedPhrase" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "reason" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallScore" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "discoveryScore" INTEGER NOT NULL,
    "qualificationScore" INTEGER NOT NULL,
    "objectionScore" INTEGER NOT NULL,
    "closingScore" INTEGER NOT NULL,
    "methodologyAdherence" INTEGER NOT NULL,
    "missingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "improvements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "executiveSummary" TEXT,
    "suggestedEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CallScore_callSessionId_key" ON "CallScore"("callSessionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesMethodology" ADD CONSTRAINT "SalesMethodology_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookStage" ADD CONSTRAINT "PlaybookStage_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "SalesMethodology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookQuestion" ADD CONSTRAINT "PlaybookQuestion_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PlaybookStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookObjection" ADD CONSTRAINT "PlaybookObjection_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "SalesMethodology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookSignal" ADD CONSTRAINT "PlaybookSignal_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "SalesMethodology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "SalesMethodology"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedSignal" ADD CONSTRAINT "DetectedSignal_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedSignal" ADD CONSTRAINT "DetectedSignal_transcriptSegmentId_fkey" FOREIGN KEY ("transcriptSegmentId") REFERENCES "TranscriptSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRecommendation" ADD CONSTRAINT "LiveRecommendation_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScore" ADD CONSTRAINT "CallScore_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

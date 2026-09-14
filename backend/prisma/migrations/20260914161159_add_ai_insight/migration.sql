-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "importance" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "needsAction" BOOLEAN NOT NULL,
    "actionType" TEXT NOT NULL,
    "suggestedTask" JSONB,
    "risk" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contextId" TEXT NOT NULL,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "PersonalContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

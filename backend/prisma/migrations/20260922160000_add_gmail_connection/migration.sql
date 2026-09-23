-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL,
    "googleSubject" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "scope" TEXT,
    "tokenType" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_googleSubject_key"
ON "GmailConnection"("googleSubject");

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_userId_key"
ON "GmailConnection"("userId");

-- AddForeignKey
ALTER TABLE "GmailConnection"
ADD CONSTRAINT "GmailConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

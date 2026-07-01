-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "requesterEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requesterName" TEXT;

-- Drop the temporary default now that existing rows (if any) are backfilled
ALTER TABLE "Ticket" ALTER COLUMN "requesterEmail" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_messageId_key" ON "Ticket"("messageId");

-- CreateIndex
CREATE INDEX "Ticket_requesterEmail_idx" ON "Ticket"("requesterEmail");

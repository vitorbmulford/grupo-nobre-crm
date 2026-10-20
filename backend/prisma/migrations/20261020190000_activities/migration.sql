CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'OTHER');

CREATE TABLE "Activity" (
  "id" UUID NOT NULL,
  "opportunityId" UUID NOT NULL,
  "type" "ActivityType" NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Activity_description_not_empty" CHECK (length(trim("description")) > 0),
  CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Activity_opportunityId_occurredAt_id_idx" ON "Activity"("opportunityId", "occurredAt", "id");
CREATE INDEX "Activity_occurredAt_id_idx" ON "Activity"("occurredAt", "id");

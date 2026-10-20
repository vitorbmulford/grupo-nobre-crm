CREATE TYPE "FollowUpAlertType" AS ENUM (
  'FOLLOW_UP_OVERDUE',
  'CONTACT_STALE',
  'PROPOSAL_EXPIRED',
  'CUSTOMER_EVENT_NEAR'
);

CREATE TYPE "FollowUpAlertStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "FollowUpAlert" (
  "id" UUID NOT NULL,
  "opportunityId" UUID NOT NULL,
  "type" "FollowUpAlertType" NOT NULL,
  "status" "FollowUpAlertStatus" NOT NULL DEFAULT 'OPEN',
  "referenceAt" TIMESTAMPTZ(3) NOT NULL,
  "acknowledgedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(3),
  CONSTRAINT "FollowUpAlert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FollowUpAlert_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FollowUpAlert_resolution_consistent" CHECK (
    ("status" = 'OPEN' AND "resolvedAt" IS NULL) OR
    ("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL)
  ),
  CONSTRAINT "FollowUpAlert_acknowledgement_resolved" CHECK (
    "acknowledgedAt" IS NULL OR "status" = 'RESOLVED'
  )
);

CREATE INDEX "FollowUpAlert_opportunityId_createdAt_id_idx" ON "FollowUpAlert"("opportunityId", "createdAt" DESC, "id" ASC);
CREATE INDEX "FollowUpAlert_status_createdAt_id_idx" ON "FollowUpAlert"("status", "createdAt" DESC, "id" ASC);
CREATE INDEX "FollowUpAlert_type_status_createdAt_id_idx" ON "FollowUpAlert"("type", "status", "createdAt" DESC, "id" ASC);
CREATE INDEX "FollowUpAlert_createdAt_id_idx" ON "FollowUpAlert"("createdAt" DESC, "id" ASC);

CREATE UNIQUE INDEX "FollowUpAlert_one_open_per_opportunity_type_key"
ON "FollowUpAlert" ("opportunityId", "type")
WHERE "status" = 'OPEN';

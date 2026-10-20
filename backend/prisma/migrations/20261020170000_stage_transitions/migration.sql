CREATE TABLE "StageTransition" (
  "id" UUID NOT NULL,
  "opportunityId" UUID NOT NULL,
  "fromStage" "OpportunityStage",
  "toStage" "OpportunityStage" NOT NULL,
  "reason" VARCHAR(1000),
  "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StageTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StageTransition_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StageTransition_opportunityId_changedAt_id_idx" ON "StageTransition"("opportunityId", "changedAt", "id");
CREATE INDEX "StageTransition_changedAt_id_idx" ON "StageTransition"("changedAt", "id");

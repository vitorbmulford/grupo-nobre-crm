DROP INDEX "Activity_opportunityId_occurredAt_id_idx";
DROP INDEX "Activity_occurredAt_id_idx";

CREATE INDEX "Activity_opportunityId_occurredAt_id_idx" ON "Activity"("opportunityId", "occurredAt" DESC, "id" ASC);
CREATE INDEX "Activity_occurredAt_id_idx" ON "Activity"("occurredAt" DESC, "id" ASC);

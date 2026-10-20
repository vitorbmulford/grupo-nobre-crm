CREATE TYPE "OpportunityStage" AS ENUM (
  'PRIMEIRO_CONTATO',
  'APRESENTACAO_ORCAMENTO',
  'FOLLOW_UP',
  'FORECAST',
  'FECHAMENTO',
  'PERDIDA'
);

CREATE SEQUENCE opportunity_code_seq START WITH 2008 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "Salesperson" (
  "id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Salesperson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Salesperson_name_key" UNIQUE ("name"),
  CONSTRAINT "Salesperson_name_not_empty" CHECK (length(trim("name")) > 0)
);

CREATE TABLE "Opportunity" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "companyName" VARCHAR(240) NOT NULL,
  "stage" "OpportunityStage" NOT NULL DEFAULT 'PRIMEIRO_CONTATO',
  "estimatedValue" DECIMAL(14,2),
  "lastContactAt" DATE,
  "proposalValidUntil" DATE,
  "customerEventDate" DATE,
  "nextFollowUpAt" TIMESTAMPTZ(3),
  "lossReason" VARCHAR(1000),
  "salespersonId" UUID,
  "version" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Opportunity_code_key" UNIQUE ("code"),
  CONSTRAINT "Opportunity_company_name_not_empty" CHECK (length(trim("companyName")) > 0),
  CONSTRAINT "Opportunity_estimated_value_nonnegative" CHECK ("estimatedValue" IS NULL OR "estimatedValue" >= 0),
  CONSTRAINT "Opportunity_version_nonnegative" CHECK ("version" >= 0),
  CONSTRAINT "Opportunity_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "OpportunityItem" (
  "id" UUID NOT NULL,
  "opportunityId" UUID NOT NULL,
  "name" VARCHAR(240) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpportunityItem_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "OpportunityItem_name_not_empty" CHECK (length(trim("name")) > 0),
  CONSTRAINT "OpportunityItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Salesperson_name_idx" ON "Salesperson"("name");
CREATE INDEX "Opportunity_companyName_idx" ON "Opportunity"("companyName");
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");
CREATE INDEX "Opportunity_salespersonId_idx" ON "Opportunity"("salespersonId");
CREATE INDEX "Opportunity_deletedAt_idx" ON "Opportunity"("deletedAt");
CREATE INDEX "Opportunity_stage_deletedAt_idx" ON "Opportunity"("stage", "deletedAt");
CREATE INDEX "Opportunity_salespersonId_deletedAt_idx" ON "Opportunity"("salespersonId", "deletedAt");
CREATE INDEX "Opportunity_createdAt_idx" ON "Opportunity"("createdAt");
CREATE INDEX "OpportunityItem_opportunityId_idx" ON "OpportunityItem"("opportunityId");
CREATE INDEX "OpportunityItem_name_idx" ON "OpportunityItem"("name");

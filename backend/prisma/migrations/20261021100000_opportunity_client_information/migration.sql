ALTER TABLE "Opportunity"
  ADD COLUMN "contactName" VARCHAR(160),
  ADD COLUMN "contactPhone" VARCHAR(30),
  ADD COLUMN "contactEmail" VARCHAR(254),
  ADD COLUMN "companyWebsite" VARCHAR(2048),
  ADD COLUMN "companyLocation" VARCHAR(240),
  ADD COLUMN "companyDescription" VARCHAR(2000);

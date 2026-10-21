import { OpportunityForm } from "@/components/opportunities/opportunity-form";

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpportunityForm opportunityId={id} />;
}

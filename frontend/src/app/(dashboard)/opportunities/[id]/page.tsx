import { OpportunityDetails } from "@/components/opportunities/opportunity-details";

export default async function OpportunityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpportunityDetails id={id} />;
}

import { api } from "@/lib/api/client";
import type { Opportunity } from "@/types/api";
import type { OpportunityPayload } from "@/lib/opportunity-form";

export function createOpportunity(payload: OpportunityPayload) {
  return api.post<Opportunity>("/opportunities", payload);
}

export function updateOpportunity(
  id: string,
  version: number,
  payload: OpportunityPayload,
) {
  return api.patch<Opportunity>(`/opportunities/${id}`, {
    ...payload,
    version,
  });
}

export function deleteOpportunity(id: string) {
  return api.delete<void>(`/opportunities/${id}`);
}

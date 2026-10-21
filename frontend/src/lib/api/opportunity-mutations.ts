import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queries";
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

export function transitionOpportunityStage(
  id: string,
  toStage: Opportunity["stage"],
  version: number,
  reason?: string,
) {
  return api.patch<Opportunity>(`/opportunities/${id}/stage`, {
    toStage,
    version,
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
  });
}

export function deleteOpportunity(id: string) {
  return api.delete<void>(`/opportunities/${id}`);
}

export function invalidateAfterOpportunityMutation(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.opportunities }),
    queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
  ]);
}

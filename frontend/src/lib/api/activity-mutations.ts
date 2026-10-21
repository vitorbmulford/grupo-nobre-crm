import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queries";
import { activityPayload, type ActivityFormValues } from "@/lib/activity-form";
import type { Activity } from "@/types/api";

export function createActivity(
  opportunityId: string,
  values: ActivityFormValues,
) {
  return api.post<Activity>(
    `/opportunities/${opportunityId}/activities`,
    activityPayload(values),
  );
}

export async function invalidateAfterActivity(
  queryClient: QueryClient,
  opportunityId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.opportunityActivities(opportunityId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.opportunity(opportunityId),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.opportunities }),
    queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
  ]);
}

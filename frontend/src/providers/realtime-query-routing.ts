import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queries";

export type RealtimeEvent =
  | "opportunity:created"
  | "opportunity:updated"
  | "opportunity:deleted"
  | "opportunity:stage-changed"
  | "activity:created"
  | "alert:created"
  | "alert:resolved";

export type RealtimeEventPayload = {
  opportunityId: string;
  alertId?: string;
  version?: number;
};

export function invalidateRealtimeEvent(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  event: RealtimeEvent,
  payload: RealtimeEventPayload,
): void {
  if (event.startsWith("opportunity:")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.opportunities });
    if (payload.opportunityId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opportunity(payload.opportunityId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opportunityHistory(payload.opportunityId),
      });
    }
    return;
  }

  if (event === "activity:created") {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.opportunityActivities(payload.opportunityId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.opportunity(payload.opportunityId),
    });
    return;
  }

  void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.opportunityAlerts(payload.opportunityId),
  });
}

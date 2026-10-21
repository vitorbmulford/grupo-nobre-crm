import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  FollowUpAlert,
  OpportunityListResponse,
  PageResponse,
} from "@/types/api";

export const queryKeys = {
  opportunities: ["opportunities"] as const,
  opportunityList: (page: number, search: string) =>
    ["opportunities", "list", { page, search }] as const,
  alerts: ["alerts"] as const,
};

export const opportunityListQuery = (page: number, search: string) =>
  queryOptions({
    queryKey: queryKeys.opportunityList(page, search),
    queryFn: ({ signal }) =>
      api.get<OpportunityListResponse>(
        "/opportunities",
        { page, limit: 10, search },
        signal,
      ),
  });

export const openAlertsQuery = queryOptions({
  queryKey: queryKeys.alerts,
  queryFn: ({ signal }) =>
    api.get<PageResponse<FollowUpAlert>>(
      "/alerts",
      { page: 1, limit: 100, status: "OPEN" },
      signal,
    ),
});

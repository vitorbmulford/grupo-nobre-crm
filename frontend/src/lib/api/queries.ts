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

export const pipelineOpportunitiesQuery = queryOptions({
  queryKey: ["opportunities", "pipeline"] as const,
  queryFn: async ({ signal }) => {
    const firstPage = await api.get<OpportunityListResponse>(
      "/opportunities",
      { page: 1, limit: 100 },
      signal,
    );
    const opportunities = [...firstPage.data];

    for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
      const response = await api.get<OpportunityListResponse>(
        "/opportunities",
        { page, limit: 100 },
        signal,
      );
      opportunities.push(...response.data);
    }

    return opportunities;
  },
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

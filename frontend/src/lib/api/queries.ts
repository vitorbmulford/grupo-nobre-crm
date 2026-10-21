import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  FollowUpAlert,
  Opportunity,
  OpportunityListResponse,
  PageResponse,
  Salesperson,
} from "@/types/api";

export const queryKeys = {
  opportunities: ["opportunities"] as const,
  opportunityList: (filters: OpportunityListFilters) =>
    ["opportunities", "list", filters] as const,
  opportunity: (id: string) => ["opportunities", "detail", id] as const,
  salespeople: ["salespeople"] as const,
  alerts: ["alerts"] as const,
};

export type OpportunityListFilters = {
  page: number;
  search: string;
  stage?: string;
  salespersonId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export const opportunityListQuery = (filters: OpportunityListFilters) =>
  queryOptions({
    queryKey: queryKeys.opportunityList(filters),
    queryFn: ({ signal }) =>
      api.get<OpportunityListResponse>(
        "/opportunities",
        { ...filters, limit: 10 },
        signal,
      ),
  });

export const opportunityQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.opportunity(id),
    queryFn: ({ signal }) =>
      api.get<Opportunity>(`/opportunities/${id}`, undefined, signal),
  });

export const salespeopleQuery = queryOptions({
  queryKey: queryKeys.salespeople,
  queryFn: ({ signal }) =>
    api.get<Salesperson[]>("/salespeople", undefined, signal),
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

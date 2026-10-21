import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  FollowUpAlert,
  Opportunity,
  OpportunityListResponse,
  OpportunityStage,
  PageResponse,
  Salesperson,
} from "@/types/api";

export const queryKeys = {
  opportunities: ["opportunities"] as const,
  pipeline: ["opportunities", "pipeline"] as const,
  pipelineStage: (
    stage: OpportunityStage,
    search: string,
    salespersonId: string,
    limit: number,
  ) =>
    [
      "opportunities",
      "pipeline",
      "stage",
      stage,
      search,
      salespersonId,
      limit,
    ] as const,
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

export const pipelineStageQuery = ({
  stage,
  search,
  salespersonId,
  limit,
}: {
  stage: OpportunityStage;
  search: string;
  salespersonId: string;
  limit: number;
}) =>
  infiniteQueryOptions({
    queryKey: queryKeys.pipelineStage(stage, search, salespersonId, limit),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api.get<OpportunityListResponse>(
        "/opportunities",
        {
          page: pageParam,
          limit,
          stage,
          search: search || undefined,
          salespersonId: salespersonId || undefined,
          sortBy: "updatedAt",
          sortOrder: "desc",
        },
        signal,
      ),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
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

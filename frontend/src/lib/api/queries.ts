import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  FollowUpAlert,
  Opportunity,
  OpportunityListResponse,
  OpportunityStage,
  PageResponse,
  Salesperson,
  Activity,
  StageTransition,
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
  opportunityHistory: (id: string) => ["opportunities", "history", id] as const,
  opportunityActivities: (id: string) =>
    ["opportunities", "activities", id] as const,
  opportunityAlerts: (id: string) => ["alerts", "opportunity", id] as const,
  salespeople: ["salespeople"] as const,
  alerts: ["alerts"] as const,
  alertList: (filters: AlertListFilters) =>
    ["alerts", "list", filters] as const,
  openAlertCount: ["alerts", "open-count"] as const,
};

export type AlertListFilters = {
  page: number;
  limit: number;
  status?: "OPEN" | "RESOLVED";
  type?: FollowUpAlert["type"];
  opportunityId?: string;
  search?: string;
  salespersonId?: string;
};

export const alertsQuery = (filters: AlertListFilters) =>
  queryOptions({
    queryKey: queryKeys.alertList(filters),
    queryFn: ({ signal }) =>
      api.get<PageResponse<FollowUpAlert>>("/alerts", filters, signal),
  });

export const openAlertCountQuery = queryOptions({
  queryKey: queryKeys.openAlertCount,
  queryFn: ({ signal }) =>
    api.get<PageResponse<FollowUpAlert>>(
      "/alerts",
      { page: 1, limit: 1, status: "OPEN" },
      signal,
    ),
  select: (response) => response.meta.total,
});

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

export const opportunityHistoryQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.opportunityHistory(id),
    queryFn: ({ signal }) =>
      api.get<StageTransition[]>(
        `/opportunities/${id}/history`,
        undefined,
        signal,
      ),
  });

export const opportunityActivitiesQuery = (id: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.opportunityActivities(id),
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) =>
      api.get<PageResponse<Activity>>(
        `/opportunities/${id}/activities`,
        { page: pageParam, limit: 100 },
        signal,
      ),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
  });

export const opportunityAlertsQuery = (id: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.opportunityAlerts(id),
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) =>
      api.get<PageResponse<FollowUpAlert>>(
        `/opportunities/${id}/alerts`,
        { page: pageParam, limit: 20 },
        signal,
      ),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
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

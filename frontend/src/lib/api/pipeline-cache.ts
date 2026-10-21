import type { InfiniteData } from "@tanstack/react-query";
import type { Opportunity, OpportunityListResponse } from "@/types/api";
import type { queryKeys } from "@/lib/api/queries";

type PipelineQueryKey = ReturnType<typeof queryKeys.pipelineStage>;
type PipelinePages = InfiniteData<OpportunityListResponse, number>;

function matchesFilters(
  opportunity: Opportunity,
  search: string,
  salespersonId: string,
) {
  const needle = search.trim().toLocaleLowerCase();
  const matchesSearch =
    !needle ||
    opportunity.code.toLocaleLowerCase().includes(needle) ||
    opportunity.companyName.toLocaleLowerCase().includes(needle);
  return (
    matchesSearch &&
    (!salespersonId || opportunity.salespersonId === salespersonId)
  );
}

export function updatePipelinePagesAfterMove(
  current: PipelinePages,
  queryKey: PipelineQueryKey,
  fromStage: Opportunity["stage"],
  updated: Opportunity,
): PipelinePages {
  const [, , , stage, search, salespersonId, limit] = queryKey;
  const leavesThisFilter =
    stage === fromStage && matchesFilters(updated, search, salespersonId);
  const entersThisFilter =
    stage === updated.stage && matchesFilters(updated, search, salespersonId);
  if (!leavesThisFilter && !entersThisFilter) return current;

  const firstPage = current.pages[0];
  if (!firstPage) return current;

  const total = Math.max(
    0,
    firstPage.meta.total - Number(leavesThisFilter) + Number(entersThisFilter),
  );
  let data = firstPage.data.filter((item) => item.id !== updated.id);

  // A moved opportunity should lead its new stage even when it was created
  // long ago. The server orders by updatedAt after this confirmed transition.
  if (entersThisFilter) {
    data = [updated, ...data].slice(0, limit);
  }

  return {
    pages: [
      {
        ...firstPage,
        data,
        meta: {
          ...firstPage.meta,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    ],
    pageParams: [current.pageParams[0] ?? 1],
  };
}

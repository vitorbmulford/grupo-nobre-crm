import { afterEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { pipelineStageQuery, queryKeys } from "@/lib/api/queries";
import { updatePipelinePagesAfterMove } from "@/lib/api/pipeline-cache";
import type {
  Opportunity,
  OpportunityListResponse,
  OpportunityStage,
} from "@/types/api";

const salespersonId = "8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae";

function opportunity(
  id: string,
  stage: OpportunityStage,
  companyName = "Tech Alpha",
): Opportunity {
  return {
    id,
    code: `OPP-${id}`,
    companyName,
    stage,
    estimatedValue: "100.00",
    lastContactAt: null,
    proposalValidUntil: null,
    customerEventDate: null,
    nextFollowUpAt: null,
    lossReason: null,
    salespersonId,
    version: 2,
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
    salesperson: { id: salespersonId, name: "Ana" },
    items: [],
  };
}

function response(
  data: Opportunity[],
  total: number,
  limit: number,
  page = 1,
): OpportunityListResponse {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("pipeline stage queries", () => {
  it("requests a stage page with server-side search and salesperson filters", async () => {
    const page = response([], 251, 25, 2);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const options = pipelineStageQuery({
      stage: "FOLLOW_UP",
      search: "alpha",
      salespersonId,
      limit: 25,
    });
    const queryFn = options.queryFn!;
    const context = {
      client: {} as QueryClient,
      queryKey: options.queryKey,
      signal: new AbortController().signal,
      pageParam: 2,
      direction: "forward",
      meta: undefined,
    } as Parameters<typeof queryFn>[0];

    await expect(queryFn(context)).resolves.toEqual(page);
    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestUrl).toContain("stage=FOLLOW_UP");
    expect(requestUrl).toContain("search=alpha");
    expect(requestUrl).toContain(`salespersonId=${salespersonId}`);
    expect(requestUrl).toContain("page=2");
    expect(requestUrl).toContain("limit=25");
  });

  it("requests another page only while the backend reports one", () => {
    const options = pipelineStageQuery({
      stage: "PRIMEIRO_CONTATO",
      search: "",
      salespersonId: "",
      limit: 25,
    });
    expect(
      options.getNextPageParam(response([], 251, 25, 10), [], 10, []),
    ).toBe(11);
    expect(
      options.getNextPageParam(response([], 251, 25, 11), [], 11, []),
    ).toBeUndefined();
    expect(options.queryKey).toEqual(
      queryKeys.pipelineStage("PRIMEIRO_CONTATO", "", "", 25),
    );
  });

  it("orders pipeline records by their latest update so moved cards lead a stage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response([], 0, 25)), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const options = pipelineStageQuery({
      stage: "FOLLOW_UP",
      search: "",
      salespersonId: "",
      limit: 25,
    });
    const queryFn = options.queryFn!;
    await queryFn({
      client: {} as QueryClient,
      queryKey: options.queryKey,
      signal: new AbortController().signal,
      pageParam: 1,
      direction: "forward",
      meta: undefined,
    } as Parameters<typeof queryFn>[0]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("sortBy=updatedAt");
  });

  it("keeps a zero-result stage empty and does not offer another page", async () => {
    const empty = response([], 0, 25);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(empty), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const options = pipelineStageQuery({
      stage: "PERDIDA",
      search: "sem resultados",
      salespersonId: "",
      limit: 25,
    });
    const queryFn = options.queryFn!;
    const context = {
      client: {} as QueryClient,
      queryKey: options.queryKey,
      signal: new AbortController().signal,
      pageParam: 1,
      direction: "forward",
      meta: undefined,
    } as Parameters<typeof queryFn>[0];
    await expect(queryFn(context)).resolves.toEqual(empty);
    expect(options.getNextPageParam(empty, [], 1, [])).toBeUndefined();
  });
});

describe("pipeline cache after a move", () => {
  it("updates both stage counts, removes stale loaded pages, and adds the visible card", () => {
    const moved = opportunity("moved", "APRESENTACAO_ORCAMENTO");
    const oldStageData = {
      pages: [
        response([moved, opportunity("other", "PRIMEIRO_CONTATO")], 26, 25),
        response([], 26, 25, 2),
      ],
      pageParams: [1, 2],
    };
    const oldStageKey = queryKeys.pipelineStage("PRIMEIRO_CONTATO", "", "", 25);
    const updatedSource = updatePipelinePagesAfterMove(
      oldStageData,
      oldStageKey,
      "PRIMEIRO_CONTATO",
      moved,
    );
    expect(updatedSource.pages).toHaveLength(1);
    expect(updatedSource.pages[0].data.map((item) => item.id)).toEqual([
      "other",
    ]);
    expect(updatedSource.pages[0].meta).toMatchObject({
      total: 25,
      totalPages: 1,
    });

    const destinationKey = queryKeys.pipelineStage(
      "APRESENTACAO_ORCAMENTO",
      "",
      "",
      25,
    );
    const updatedDestination = updatePipelinePagesAfterMove(
      { pages: [response([], 1, 25)], pageParams: [1] },
      destinationKey,
      "PRIMEIRO_CONTATO",
      moved,
    );
    expect(updatedDestination.pages[0].data[0]).toEqual(moved);
    expect(updatedDestination.pages[0].meta).toMatchObject({
      total: 2,
      totalPages: 1,
    });
  });

  it("does not change counts when the moved record does not match a cached filter", () => {
    const moved = opportunity("moved", "APRESENTACAO_ORCAMENTO", "Tech Alpha");
    const current = {
      pages: [response([], 3, 25)],
      pageParams: [1],
    };
    const key = queryKeys.pipelineStage(
      "PRIMEIRO_CONTATO",
      "another customer",
      salespersonId,
      25,
    );
    expect(
      updatePipelinePagesAfterMove(current, key, "PRIMEIRO_CONTATO", moved),
    ).toBe(current);
  });

  it("puts the confirmed moved opportunity first even when the destination page is full", () => {
    const moved = opportunity("moved-old-record", "FOLLOW_UP");
    const existing = Array.from({ length: 25 }, (_, index) =>
      opportunity(`existing-${index}`, "FOLLOW_UP"),
    );
    const key = queryKeys.pipelineStage("FOLLOW_UP", "", "", 25);
    const result = updatePipelinePagesAfterMove(
      { pages: [response(existing, 26, 25)], pageParams: [1] },
      key,
      "PRIMEIRO_CONTATO",
      moved,
    );
    expect(result.pages[0].data[0].id).toBe(moved.id);
    expect(result.pages[0].data).toHaveLength(25);
  });
});

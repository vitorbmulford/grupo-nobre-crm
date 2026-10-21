import { afterEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  opportunityActivitiesQuery,
  opportunityHistoryQuery,
  queryKeys,
} from "@/lib/api/queries";

afterEach(() => vi.unstubAllGlobals());

describe("opportunity commercial history queries", () => {
  it("reads the chronological transition history endpoint", async () => {
    const history = [
      {
        id: "t1",
        fromStage: null,
        toStage: "PRIMEIRO_CONTATO",
        reason: null,
        changedAt: "2026-10-20T12:00:00.000Z",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(history), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const options = opportunityHistoryQuery("opp-1");
    await expect(
      options.queryFn!({
        client: {} as QueryClient,
        queryKey: options.queryKey,
        signal: new AbortController().signal,
        meta: undefined,
        pageParam: 1,
        direction: "forward",
      }),
    ).resolves.toEqual(history);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/opportunities/opp-1/history",
    );
    expect(options.queryKey).toEqual(queryKeys.opportunityHistory("opp-1"));
  });
  it("requests the first bounded activities page and continues while the API reports more", async () => {
    const empty = {
      data: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(empty), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const options = opportunityActivitiesQuery("opp-1");
    await expect(
      options.queryFn!({
        client: {} as QueryClient,
        queryKey: options.queryKey,
        signal: new AbortController().signal,
        meta: undefined,
        pageParam: 1,
        direction: "forward",
      }),
    ).resolves.toEqual(empty);
    expect(String(fetchMock.mock.calls[0][0])).toContain("page=1");
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=100");
    expect(options.queryKey).toEqual(queryKeys.opportunityActivities("opp-1"));
    expect(options.getNextPageParam(empty, [], 1, [])).toBeUndefined();
    expect(
      options.getNextPageParam(
        { ...empty, meta: { ...empty.meta, total: 150, totalPages: 2 } },
        [],
        1,
        [],
      ),
    ).toBe(2);
  });
});

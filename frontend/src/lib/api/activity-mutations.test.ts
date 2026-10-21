import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  createActivity,
  invalidateAfterActivity,
} from "@/lib/api/activity-mutations";
import { queryKeys } from "@/lib/api/queries";

afterEach(() => vi.unstubAllGlobals());

describe("activity API", () => {
  it("posts the actual activity contract with occurredAt as ISO", async () => {
    const response = { id: "activity-1", type: "CALL" };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(response), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createActivity("opp-1", {
        type: "CALL",
        description: "  Ligação feita ",
        occurredAt: "2026-10-20T10:30",
      }),
    ).resolves.toEqual(response);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/opportunities/opp-1/activities",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      type: "CALL",
      description: "Ligação feita",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).occurredAt).toMatch(
      /Z$/,
    );
  });
  it("propagates HTTP errors from activity creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              message: "Activity date cannot be in the future",
            }),
            { status: 422, headers: { "content-type": "application/json" } },
          ),
        ),
    );
    await expect(
      createActivity("opp-1", {
        type: "CALL",
        description: "Contato",
        occurredAt: "2026-10-20T10:30",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("invalidates activity, detail, list and alert caches after success", async () => {
    const client = new QueryClient();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue();
    await invalidateAfterActivity(client, "opp-1");
    expect(invalidate.mock.calls.map(([filter]) => filter?.queryKey)).toEqual([
      queryKeys.opportunityActivities("opp-1"),
      queryKeys.opportunity("opp-1"),
      queryKeys.opportunities,
      queryKeys.alerts,
    ]);
    client.clear();
  });
});

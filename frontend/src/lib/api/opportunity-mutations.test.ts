import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  createOpportunity,
  deleteOpportunity,
  transitionOpportunityStage,
  updateOpportunity,
} from "@/lib/api/opportunity-mutations";
import type { OpportunityPayload } from "@/lib/opportunity-form";

afterEach(() => vi.unstubAllGlobals());

const payload: OpportunityPayload = {
  companyName: "Empresa Exemplo",
  estimatedValue: "1250.00",
  lastContactAt: null,
  proposalValidUntil: null,
  customerEventDate: null,
  nextFollowUpAt: null,
  lossReason: null,
  salespersonId: null,
  items: [{ name: "Caneca", quantity: 20 }],
};

describe("opportunity mutations", () => {
  it("creates using the supported endpoint and returns the API response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "new-id" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(createOpportunity(payload)).resolves.toEqual({ id: "new-id" });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(payload);
  });

  it("includes the current version in an update and surfaces HTTP 409", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 409,
          message: "Opportunity version is stale",
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await updateOpportunity("opp-1", 7, payload);
      expect.fail("Expected stale-version response to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 409 });
      expect((error as ApiError).message).toBe("Opportunity version is stale");
    }
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      ...payload,
      version: 7,
    });
  });

  it("moves to a valid stage with the returned version", async () => {
    const response = { id: "opp-1", stage: "FOLLOW_UP", version: 4 };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transitionOpportunityStage("opp-1", "FOLLOW_UP", 3),
    ).resolves.toEqual(response);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/opportunities/opp-1/stage",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      toStage: "FOLLOW_UP",
      version: 3,
    });
  });

  it("sends a trimmed justification and preserves conflict responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 409,
            message: "Opportunity version is stale",
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transitionOpportunityStage("opp-1", "PERDIDA", 8, "  Sem prazo  "),
    ).rejects.toMatchObject({ name: "ApiError", status: 409 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      toStage: "PERDIDA",
      version: 8,
      reason: "Sem prazo",
    });
  });

  it("deletes through the logical-delete endpoint and accepts its empty response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteOpportunity("opp-1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  });
});

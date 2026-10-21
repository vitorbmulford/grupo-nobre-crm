import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  alertMutationErrorMessage,
  invalidateAfterAlertResolution,
  resolveAlert,
} from "@/lib/api/alert-mutations";
import { ApiError } from "@/lib/api/client";
import { alertsQuery, queryKeys } from "@/lib/api/queries";
import { ALERT_TYPE_LABELS, alertDescription } from "@/lib/alerts";
import type { PageResponse, FollowUpAlert } from "@/types/api";

afterEach(() => vi.unstubAllGlobals());

const page: PageResponse<FollowUpAlert> = {
  data: [],
  meta: { page: 2, limit: 20, total: 41, totalPages: 3 },
};

describe("commercial alerts", () => {
  it("requests a page with only the selected API filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient();

    await expect(
      client.fetchQuery(
        alertsQuery({
          page: 2,
          limit: 20,
          status: "RESOLVED",
          type: "PROPOSAL_EXPIRED",
          opportunityId: "opportunity-id",
          search: "Nobre",
          salespersonId: "salesperson-id",
        }),
      ),
    ).resolves.toEqual(page);

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/alerts?page=2&limit=20&status=RESOLVED&type=PROPOSAL_EXPIRED&opportunityId=opportunity-id&search=Nobre&salespersonId=salesperson-id",
    );
    client.clear();
  });

  it("returns an empty page from the API without treating it as an error", async () => {
    const emptyPage: PageResponse<FollowUpAlert> = {
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(emptyPage), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const client = new QueryClient();

    await expect(
      client.fetchQuery(alertsQuery({ page: 1, limit: 20, status: "OPEN" })),
    ).resolves.toEqual(emptyPage);
    client.clear();
  });

  it("uses the idempotent resolve endpoint and propagates network and API errors", async () => {
    const resolved = { id: "alert-id", status: "RESOLVED" };
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify(resolved), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveAlert("alert-id")).resolves.toEqual(resolved);
    await expect(resolveAlert("alert-id")).resolves.toEqual(resolved);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/alerts/alert-id/resolve",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Alert not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(resolveAlert("missing-alert")).rejects.toMatchObject({
      status: 404,
      message: "Alert not found",
    });

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(resolveAlert("alert-id")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("conectar à API"),
    });
  });

  it("invalidates alert pages and the sidebar open count after resolution", async () => {
    const client = new QueryClient();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue();

    await invalidateAfterAlertResolution(client);

    expect(invalidate.mock.calls.map(([filter]) => filter?.queryKey)).toEqual([
      queryKeys.alerts,
    ]);
    client.clear();
  });

  it("turns repeated and conflicting operation errors into seller-facing guidance", () => {
    expect(
      alertMutationErrorMessage(new ApiError(404, "Alert not found")),
    ).toContain("não está mais disponível");
    expect(alertMutationErrorMessage(new ApiError(409, "Conflict"))).toContain(
      "Atualize a lista",
    );
    expect(alertMutationErrorMessage(new Error("unknown"))).toContain(
      "Tente novamente",
    );
  });

  it("labels every backend alert type in Portuguese without exposing enum names", () => {
    expect(Object.values(ALERT_TYPE_LABELS)).toEqual([
      "Retorno em atraso",
      "Contato sem atualização",
      "Proposta expirada",
      "Evento do cliente próximo",
    ]);
    for (const type of Object.keys(ALERT_TYPE_LABELS)) {
      const description = alertDescription(
        type as keyof typeof ALERT_TYPE_LABELS,
        "21/10/2026",
      );
      expect(description.length).toBeGreaterThan(40);
      expect(description).not.toContain(type);
      expect(description).toContain("21/10/2026");
    }
  });
});

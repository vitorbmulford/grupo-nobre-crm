import { afterEach, describe, expect, it, vi } from "vitest";
import { api, apiBaseUrl, ApiError, apiRequest } from "@/lib/api/client";

afterEach(() => vi.unstubAllGlobals());

describe("HTTP client", () => {
  it("uses the same-origin API path by default", () => {
    expect(apiBaseUrl).toBe("/api");
  });

  it("builds query strings and returns typed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      api.get<{ data: unknown[] }>("/opportunities", {
        search: "Tech Alpha",
        page: 2,
        absent: undefined,
      }),
    ).resolves.toEqual({ data: [] });
    expect(String(fetchMock.mock.calls[0][0])).toContain("search=Tech+Alpha");
    expect(String(fetchMock.mock.calls[0][0])).toContain("page=2");
  });
  it("preserves standardized backend errors and HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 409,
            message: "Opportunity version is stale",
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    await expect(
      apiRequest("/opportunities/x", { method: "PATCH", body: { version: 1 } }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "Opportunity version is stale",
    });
  });
  it("handles responses without a body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(api.delete<void>("/opportunities/x")).resolves.toBeUndefined();
  });
  it("turns network failures into a useful API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(api.get("/opportunities")).rejects.toBeInstanceOf(ApiError);
    await expect(api.get("/opportunities")).rejects.toMatchObject({
      status: 0,
    });
  });
});

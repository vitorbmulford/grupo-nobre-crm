import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/queries";
import { invalidateRealtimeEvent } from "@/providers/realtime-query-routing";

describe("invalidateRealtimeEvent", () => {
  it("invalidates opportunity lists, detail, and history selectively", () => {
    const invalidateQueries = vi.fn();

    invalidateRealtimeEvent(
      { invalidateQueries },
      "opportunity:stage-changed",
      { opportunityId: "opportunity-1", version: 4 },
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.opportunities,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.opportunity("opportunity-1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.opportunityHistory("opportunity-1"),
    });
  });

  it("invalidates activity history without touching alert lists", () => {
    const invalidateQueries = vi.fn();

    invalidateRealtimeEvent({ invalidateQueries }, "activity:created", {
      opportunityId: "opportunity-2",
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.opportunityActivities("opportunity-2"),
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.alerts,
    });
  });

  it("invalidates alert lists and the related opportunity alert history", () => {
    const invalidateQueries = vi.fn();

    invalidateRealtimeEvent({ invalidateQueries }, "alert:resolved", {
      opportunityId: "opportunity-3",
      alertId: "alert-1",
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.alerts,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.opportunityAlerts("opportunity-3"),
    });
  });
});

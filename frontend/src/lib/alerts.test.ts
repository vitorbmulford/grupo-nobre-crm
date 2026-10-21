import { describe, expect, it } from "vitest";
import { groupAlertsByOpportunity } from "@/lib/alerts";
import type { FollowUpAlert } from "@/types/api";

function alert(
  id: string,
  opportunityId: string,
  type: FollowUpAlert["type"],
): FollowUpAlert {
  return {
    id,
    opportunityId,
    type,
    status: "OPEN",
    referenceAt: "2026-10-21T00:00:00.000Z",
    createdAt: "2026-10-21T00:00:00.000Z",
    resolvedAt: null,
    opportunity: {
      id: opportunityId,
      code: `OPP-${opportunityId}`,
      companyName: `Cliente ${opportunityId}`,
      stage: "FOLLOW_UP",
    },
  };
}

describe("groupAlertsByOpportunity", () => {
  it("groups the same opportunity while keeping each commercial reason separate", () => {
    const followUp = alert("alert-1", "opportunity-1", "FOLLOW_UP_OVERDUE");
    const proposal = alert("alert-2", "opportunity-1", "PROPOSAL_EXPIRED");
    const contact = alert("alert-3", "opportunity-1", "CONTACT_STALE");

    const groups = groupAlertsByOpportunity([followUp, proposal, contact]);

    expect(groups).toHaveLength(1);
    expect(groups[0].alerts).toEqual([followUp, proposal, contact]);
    expect(new Set(groups[0].alerts.map(({ type }) => type)).size).toBe(3);
  });

  it("preserves first-seen order for different opportunities", () => {
    const first = alert("alert-1", "opportunity-1", "FOLLOW_UP_OVERDUE");
    const second = alert("alert-2", "opportunity-2", "CUSTOMER_EVENT_NEAR");
    const anotherFirst = alert(
      "alert-3",
      "opportunity-1",
      "PROPOSAL_EXPIRED",
    );

    const groups = groupAlertsByOpportunity([first, second, anotherFirst]);

    expect(groups.map(({ opportunity }) => opportunity.id)).toEqual([
      "opportunity-1",
      "opportunity-2",
    ]);
    expect(groups.map(({ alerts }) => alerts.length)).toEqual([2, 1]);
  });
});

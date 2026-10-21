import { describe, expect, it } from "vitest";
import { activityFormSchema, activityPayload } from "@/lib/activity-form";

describe("activity form", () => {
  it("accepts all API activity kinds and trims the description", () => {
    for (const type of [
      "CALL",
      "EMAIL",
      "MEETING",
      "WHATSAPP",
      "OTHER",
    ] as const) {
      expect(
        activityFormSchema.safeParse({
          type,
          description: " Test ",
          occurredAt: "2026-10-20T10:30",
        }).success,
      ).toBe(true);
    }
  });
  it("rejects empty or oversized descriptions and future dates", () => {
    const base = {
      type: "CALL",
      description: "ok",
      occurredAt: "2026-10-20T10:30",
    };
    expect(
      activityFormSchema.safeParse({ ...base, description: "  " }).success,
    ).toBe(false);
    expect(
      activityFormSchema.safeParse({ ...base, description: "x".repeat(2001) })
        .success,
    ).toBe(false);
    expect(
      activityFormSchema.safeParse({ ...base, occurredAt: "2999-01-01T10:30" })
        .success,
    ).toBe(false);
  });
  it("sends a timezone-explicit ISO timestamp", () => {
    const result = activityPayload({
      type: "CALL",
      description: "  Retorno  ",
      occurredAt: "2026-10-20T10:30",
    });
    expect(result.description).toBe("Retorno");
    expect(result.occurredAt).toMatch(/Z$/);
  });
});

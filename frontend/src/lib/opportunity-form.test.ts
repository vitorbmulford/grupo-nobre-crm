import { describe, expect, it } from "vitest";
import {
  formatConflictMessage,
  opportunityFormSchema,
  opportunityToFormValues,
  sanitizeEstimatedValueInput,
  sanitizeQuantityInput,
  toOpportunityPayload,
} from "@/lib/opportunity-form";

const validForm = {
  companyName: "  Empresa Exemplo  ",
  estimatedValue: "4500,50",
  lastContactAt: "2026-10-14",
  proposalValidUntil: "",
  customerEventDate: "2026-11-30",
  nextFollowUpAt: "2026-10-21T13:30",
  lossReason: "",
  salespersonId: "seller-1",
  items: [
    { name: " Caneca personalizada ", quantity: "300" },
    { name: "", quantity: "" },
  ],
};

describe("opportunity form validation and payload", () => {
  it("requires company and validates monetary precision and item quantities", () => {
    expect(opportunityFormSchema.safeParse(validForm).success).toBe(true);
    expect(
      opportunityFormSchema.safeParse({ ...validForm, companyName: "   " })
        .success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        estimatedValue: "12.34,00",
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        items: [{ name: "Brinde", quantity: "0" }],
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        items: [{ name: "", quantity: "2" }],
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        estimatedValue: "1234567890123",
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        estimatedValue: "1.234,50",
      }).success,
    ).toBe(true);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        items: [{ name: "Brinde", quantity: "2a" }],
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        items: [{ name: "Brinde", quantity: "2147483648" }],
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        companyName: "a".repeat(241),
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        lossReason: "a".repeat(1001),
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        lastContactAt: "2026-02-31",
      }).success,
    ).toBe(false);
  });

  it("sanitizes numeric fields and limits precision and input length", () => {
    expect(sanitizeEstimatedValueInput("R$ 123abc456,789")).toBe("123.456,78");
    expect(sanitizeEstimatedValueInput("2323232323")).toBe("2.323.232.323");
    expect(sanitizeEstimatedValueInput("123456789012345,00")).toBe(
      "123.456.789.012,00",
    );
    expect(sanitizeQuantityInput("12x3,4")).toBe("1234");
    expect(sanitizeQuantityInput("123456789012")).toBe("1234567890");
  });

  it("converts empty fields to null and serializes calendar dates, money and timestamp separately", () => {
    const parsed = opportunityFormSchema.parse(validForm);
    const payload = toOpportunityPayload(parsed);
    expect(payload).toMatchObject({
      companyName: "Empresa Exemplo",
      estimatedValue: "4500.50",
      lastContactAt: "2026-10-14",
      proposalValidUntil: null,
      customerEventDate: "2026-11-30",
      lossReason: null,
      salespersonId: "seller-1",
      items: [{ name: "Caneca personalizada", quantity: 300 }],
    });
    expect(payload.nextFollowUpAt).toMatch(/(?:Z|[+-]\d{2}:\d{2})$/);
  });

  it("supports scheduling, changing, and removing the next follow-up", () => {
    const scheduled = toOpportunityPayload(
      opportunityFormSchema.parse({
        ...validForm,
        nextFollowUpAt: "2026-10-21T13:30",
      }),
    );
    const changed = toOpportunityPayload(
      opportunityFormSchema.parse({
        ...validForm,
        nextFollowUpAt: "2026-10-22T09:45",
      }),
    );
    const removed = toOpportunityPayload(
      opportunityFormSchema.parse({ ...validForm, nextFollowUpAt: "" }),
    );

    expect(scheduled.nextFollowUpAt).toMatch(/2026-10-21T.*Z$/);
    expect(changed.nextFollowUpAt).toMatch(/2026-10-22T.*Z$/);
    expect(removed.nextFollowUpAt).toBeNull();
  });

  it("formats API money values as BRL while editing", () => {
    expect(
      opportunityToFormValues({
        id: "opportunity-1",
        code: "OPP-1",
        companyName: "Empresa Exemplo",
        stage: "PRIMEIRO_CONTATO",
        estimatedValue: "2323232323.50",
        lastContactAt: null,
        proposalValidUntil: null,
        customerEventDate: null,
        nextFollowUpAt: null,
        lossReason: null,
        salespersonId: null,
        salesperson: null,
        items: [],
        version: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }).estimatedValue,
    ).toBe("2.323.232.323,50");
  });

  it("explains stale-version conflicts without hiding the submitted changes", () => {
    expect(formatConflictMessage("Opportunity version is stale")).toContain(
      "Suas mudanças continuam no formulário",
    );
    expect(formatConflictMessage("Other failure")).toBe("Other failure");
  });
});

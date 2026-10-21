import { describe, expect, it } from "vitest";
import {
  ESTIMATED_VALUE_INPUT_PATTERN,
  formatConflictMessage,
  formatContactPhoneInput,
  opportunityFormSchema,
  opportunityToFormValues,
  sanitizeContactNameInput,
  sanitizeLocationInput,
  sanitizeEstimatedValueInput,
  sanitizeQuantityInput,
  toOpportunityPayload,
} from "@/lib/opportunity-form";

const validForm = {
  companyName: "  Empresa Exemplo  ",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  companyWebsite: "",
  companyLocation: "",
  companyDescription: "",
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
  it("accepts grouped estimated values in the browser input pattern", () => {
    const inputPattern = new RegExp(`^(?:${ESTIMATED_VALUE_INPUT_PATTERN})$`);
    expect(inputPattern.test("5.000.000.000")).toBe(true);
    expect(inputPattern.test("5.000.000.000,00")).toBe(true);
    expect(inputPattern.test("5000000000")).toBe(true);
  });

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
    for (const estimatedValue of [
      "5.000.000.000",
      "5.000.000.000,00",
    ]) {
      expect(
        opportunityFormSchema.safeParse({ ...validForm, estimatedValue })
          .success,
      ).toBe(true);
    }
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
    expect(sanitizeEstimatedValueInput("5.000.000.000,00")).toBe(
      "5.000.000.000,00",
    );
    expect(sanitizeEstimatedValueInput("5.000.000.000")).toBe(
      "5.000.000.000",
    );
    expect(sanitizeEstimatedValueInput("123456789012345,00")).toBe(
      "123.456.789.012,00",
    );
    expect(sanitizeQuantityInput("12x3,4")).toBe("1234");
    expect(sanitizeQuantityInput("123456789012")).toBe("1234567890");
    expect(sanitizeContactNameInput("João 123 da Silva!")).toBe(
      "João da Silva",
    );
    expect(formatContactPhoneInput("11987654321")).toBe("(11) 98765-4321");
    expect(formatContactPhoneInput("+55 (11) 98765-4321")).toBe(
      "+55 (11) 98765-4321",
    );
    expect(sanitizeLocationInput("São Paulo 123, SP!")).toBe("São Paulo, SP");
  });

  it("converts empty fields to null and serializes calendar dates, money and timestamp separately", () => {
    const parsed = opportunityFormSchema.parse(validForm);
    const payload = toOpportunityPayload(parsed);
    expect(payload).toMatchObject({
      companyName: "Empresa Exemplo",
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      companyWebsite: null,
      companyLocation: null,
      companyDescription: null,
      estimatedValue: "4500.50",
      lastContactAt: "2026-10-14",
      proposalValidUntil: null,
      customerEventDate: "2026-11-30",
      lossReason: null,
      salespersonId: "seller-1",
      items: [{ name: "Caneca personalizada", quantity: 300 }],
    });
    expect(payload.nextFollowUpAt).toMatch(/(?:Z|[+-]\d{2}:\d{2})$/);
    expect(
      toOpportunityPayload(
        opportunityFormSchema.parse({
          ...validForm,
          estimatedValue: "5.000.000.000,00",
        }),
      ).estimatedValue,
    ).toBe("5000000000.00");
  });

  it("accepts optional client details, validates supplied email and website, and clears whitespace", () => {
    const details = {
      contactName: " Mariana Souza ",
      contactPhone: " (11) 99999-0000 ",
      contactEmail: " mariana@empresa.com.br ",
      companyWebsite: " www.empresa.com.br ",
      companyLocation: " São Paulo, SP ",
      companyDescription: " Produtos para escritório ",
    };
    const parsed = opportunityFormSchema.parse({ ...validForm, ...details });
    expect(toOpportunityPayload(parsed)).toMatchObject({
      contactName: "Mariana Souza",
      contactPhone: "(11) 99999-0000",
      contactEmail: "mariana@empresa.com.br",
      companyWebsite: "www.empresa.com.br",
      companyLocation: "São Paulo, SP",
      companyDescription: "Produtos para escritório",
    });
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        contactEmail: "email-inválido",
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        companyWebsite: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        companyWebsite: "12e21e21e21e",
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        contactName: "Pessoa 123",
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        contactPhone: "'123 (11) 99999-0000",
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        contactPhone: "1".repeat(31),
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        contactPhone: "12345678901",
      }).success,
    ).toBe(true);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        companyLocation: "342243234243",
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        companyLocation: "São Paulo 123, SP",
      }).success,
    ).toBe(false);
    expect(
      opportunityFormSchema.safeParse({
        ...validForm,
        companyDescription: "a".repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      toOpportunityPayload(
        opportunityFormSchema.parse({
          ...validForm,
          contactName: "   ",
          companyDescription: "   ",
        }),
      ),
    ).toMatchObject({ contactName: null, companyDescription: null });
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
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        companyWebsite: null,
        companyLocation: null,
        companyDescription: null,
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

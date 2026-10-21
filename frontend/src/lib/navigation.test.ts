import { describe, expect, it } from "vitest";
import {
  getInternalReturnTo,
  getOpportunityBackLabel,
  withReturnTo,
} from "@/lib/navigation";

describe("opportunity return navigation", () => {
  it("uses a safe internal destination and falls back for direct links", () => {
    expect(getInternalReturnTo("/pipeline")).toBe("/pipeline");
    expect(getInternalReturnTo(undefined)).toBe("/opportunities");
    expect(getInternalReturnTo("//example.com")).toBe("/opportunities");
    expect(getInternalReturnTo("https://example.com")).toBe("/opportunities");
  });

  it("preserves nested return paths in the URL", () => {
    expect(
      withReturnTo("/opportunities/id/edit", "/opportunities/id?returnTo=%2Fpipeline"),
    ).toBe(
      "/opportunities/id/edit?returnTo=%2Fopportunities%2Fid%3FreturnTo%3D%252Fpipeline",
    );
  });

  it("labels the actual prior destination", () => {
    expect(getOpportunityBackLabel("/pipeline")).toBe("Voltar para Pipeline");
    expect(getOpportunityBackLabel("/alerts")).toBe("Voltar para alertas");
    expect(getOpportunityBackLabel("/alerts?status=OPEN")).toBe(
      "Voltar para alertas",
    );
    expect(getOpportunityBackLabel("/opportunities")).toBe(
      "Voltar para oportunidades",
    );
    expect(
      getOpportunityBackLabel("/opportunities/id?returnTo=%2Fpipeline", "Acme"),
    ).toBe("Voltar para Acme");
  });
});

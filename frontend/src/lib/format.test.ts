import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNextFollowUp,
} from "@/lib/format";
import { STAGES, stageLabel } from "@/lib/constants/stages";

describe("formatCurrency", () => {
  it("formats BRL strings with Brazilian separators", () => {
    expect(formatCurrency("4500.00")).toBe("R$ 4.500,00");
  });
  it("handles missing and invalid amounts", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency("invalid")).toBe("—");
  });
});

describe("date formatting", () => {
  it("keeps calendar dates on the same day", () => {
    expect(formatDate("2026-10-15")).toBe("15/10/2026");
  });
  it("uses an explicit offset for timestamps", () => {
    expect(formatDateTime("2026-10-15T15:30:00-03:00")).toMatch(
      /15\/10\/2026 às (15:30|18:30)/,
    );
  });
  it("marks a missing return schedule clearly", () => {
    expect(formatNextFollowUp(null)).toBe("Não agendado");
    expect(formatNextFollowUp(undefined)).toBe("Não agendado");
  });
  it("uses the local timezone and pt-BR date-time layout for a scheduled return", () => {
    expect(formatNextFollowUp("2026-10-15T15:30:00-03:00")).toMatch(
      /15\/10\/2026 às (15:30|18:30)/,
    );
  });
  it("returns a consistent marker for invalid and empty dates", () => {
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("pipeline stage labels", () => {
  it("covers all six backend enum values", () => {
    expect(STAGES).toHaveLength(6);
    expect(stageLabel("APRESENTACAO_ORCAMENTO")).toBe(
      "Apresentação de orçamento",
    );
    expect(stageLabel("PERDIDA")).toBe("Perdida");
  });
});

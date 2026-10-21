import type { OpportunityStage } from "@/types/api";

export const STAGES: {
  value: OpportunityStage;
  label: string;
  tone: string;
}[] = [
  { value: "PRIMEIRO_CONTATO", label: "Primeiro contato", tone: "slate" },
  {
    value: "APRESENTACAO_ORCAMENTO",
    label: "Apresentação de orçamento",
    tone: "blue",
  },
  { value: "FOLLOW_UP", label: "Follow-up", tone: "amber" },
  { value: "FORECAST", label: "Forecast", tone: "violet" },
  { value: "FECHAMENTO", label: "Fechamento", tone: "emerald" },
  { value: "PERDIDA", label: "Perdida", tone: "slate" },
];

export const STAGE_LABELS = Object.fromEntries(
  STAGES.map(({ value, label }) => [value, label]),
) as Record<OpportunityStage, string>;
export const stageLabel = (stage: OpportunityStage) => STAGE_LABELS[stage];

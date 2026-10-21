import { Badge } from "@/components/ui/badge";
import { stageLabel } from "@/lib/constants/stages";
import type { OpportunityStage } from "@/types/api";

const tones: Record<OpportunityStage, string> = {
  PRIMEIRO_CONTATO:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  APRESENTACAO_ORCAMENTO:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  FOLLOW_UP:
    "border-[#e1be68]/60 bg-[#e1be68]/15 text-[#6d5519] dark:border-[#e1be68]/30 dark:bg-[#e1be68]/10 dark:text-[#e1be68]",
  FORECAST:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
  FECHAMENTO:
    "border-[#83b735]/35 bg-[#83b735]/10 text-[#4c6b1f] dark:border-[#83b735]/30 dark:bg-[#83b735]/15 dark:text-[#a9dc65]",
  PERDIDA:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  return (
    <Badge variant="outline" className={tones[stage]}>
      {stageLabel(stage)}
    </Badge>
  );
}

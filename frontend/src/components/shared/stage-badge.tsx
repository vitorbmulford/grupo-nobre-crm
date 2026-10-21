import { Badge } from "@/components/ui/badge";
import { stageLabel } from "@/lib/constants/stages";
import type { OpportunityStage } from "@/types/api";

const tones: Record<OpportunityStage, string> = {
  PRIMEIRO_CONTATO:
    "border-border bg-muted/60 text-muted-foreground dark:border-border dark:bg-muted/50 dark:text-muted-foreground",
  APRESENTACAO_ORCAMENTO:
    "border-border bg-muted/60 text-foreground dark:border-border dark:bg-muted/50",
  FOLLOW_UP:
    "border-[#e1be68]/60 bg-[#e1be68]/15 text-[#6d5519] dark:border-[#e1be68]/30 dark:bg-[#e1be68]/10 dark:text-[#e1be68]",
  FORECAST:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
  FECHAMENTO:
    "border-[#83b735]/35 bg-[#83b735]/10 text-[#4c6b1f] dark:border-[#83b735]/30 dark:bg-[#83b735]/15 dark:text-[#a9dc65]",
  PERDIDA:
    "border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15",
};

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  return (
    <Badge variant="outline" className={tones[stage]}>
      {stageLabel(stage)}
    </Badge>
  );
}

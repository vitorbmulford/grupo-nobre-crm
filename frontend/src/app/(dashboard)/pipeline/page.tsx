import { ArrowRight, CircleCheck, CircleDot, CircleX } from "lucide-react";
import { EmptyState } from "@/components/shared/request-states";
import { PageHeader } from "@/components/shared/page-header";
import { STAGES } from "@/lib/constants/stages";

const icons = [
  CircleDot,
  CircleDot,
  CircleDot,
  CircleDot,
  CircleCheck,
  CircleX,
];

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Visão geral das etapas comerciais e do caminho de cada negociação."
      />
      <section
        aria-label="Etapas do pipeline"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {STAGES.map(({ value, label }, index) => {
          const Icon = icons[index];
          return (
            <article
              key={value}
              className="bg-card rounded-xl border p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-muted-foreground text-xs">
                    Etapa {index + 1}
                  </p>
                  <h2 className="text-sm font-semibold">{label}</h2>
                </div>
              </div>
              <div className="text-muted-foreground mt-4 border-t border-dashed pt-3 text-sm">
                Oportunidades serão organizadas nesta coluna.
              </div>
            </article>
          );
        })}
      </section>
      <div className="my-6 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
        <ArrowRight className="size-4 shrink-0" />
        <p>
          O quadro visual está preparado. A movimentação e a consulta completa
          do funil chegam em uma próxima etapa.
        </p>
      </div>
      <EmptyState
        title="Interação do pipeline em preparação"
        description="As regras de movimentação já são validadas pela API. A experiência de quadro será conectada junto com a próxima etapa comercial."
      />
    </>
  );
}

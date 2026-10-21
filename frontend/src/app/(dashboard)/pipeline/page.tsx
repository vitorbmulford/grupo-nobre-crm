"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleCheck, CircleDot, CircleX } from "lucide-react";
import {
  ErrorState,
  LoadingState,
} from "@/components/shared/request-states";
import { PageHeader } from "@/components/shared/page-header";
import { pipelineOpportunitiesQuery } from "@/lib/api/queries";
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
  const query = useQuery(pipelineOpportunitiesQuery);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Visão geral das etapas comerciais e do caminho de cada negociação."
      />
      {query.isPending ? (
        <LoadingState label="Consultando oportunidades do pipeline…" />
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <section
            aria-label="Etapas do pipeline"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {STAGES.map(({ value, label }, index) => {
              const Icon = icons[index];
              const opportunities = query.data.filter(
                (opportunity) => opportunity.stage === value,
              );

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
                    <p className="font-medium">
                      {opportunities.length}{" "}
                      {opportunities.length === 1
                        ? "oportunidade"
                        : "oportunidades"}
                    </p>
                    {opportunities.length === 0 ? (
                      <p className="mt-2">Nenhuma oportunidade nesta etapa.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {opportunities.map((opportunity) => (
                          <li key={opportunity.id}>
                            <span className="font-medium">
                              {opportunity.code}
                            </span>
                            <span> · {opportunity.companyName}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
          <div className="my-6 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
            <ArrowRight className="size-4 shrink-0" />
            <p>
              As oportunidades e etapas são carregadas diretamente da API. A
              movimentação entre etapas será conectada em uma próxima etapa.
            </p>
          </div>
        </>
      )}
    </>
  );
}

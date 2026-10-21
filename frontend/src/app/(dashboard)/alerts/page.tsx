"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/request-states";
import { PageHeader } from "@/components/shared/page-header";
import { StageBadge } from "@/components/shared/stage-badge";
import { openAlertsQuery } from "@/lib/api/queries";
import { formatDateTime } from "@/lib/format";

const alertNames = {
  FOLLOW_UP_OVERDUE: "Retorno agendado em atraso",
  CONTACT_STALE: "Contato sem atualização",
  PROPOSAL_EXPIRED: "Proposta expirada",
  CUSTOMER_EVENT_NEAR: "Evento do cliente próximo",
} as const;

export default function AlertsPage() {
  const query = useQuery(openAlertsQuery);
  return (
    <>
      <PageHeader
        title="Alertas"
        description="Sinais da API para ajudar o time a priorizar negociações que precisam de atenção."
      />
      {query.isPending ? (
        <LoadingState label="Consultando alertas abertos…" />
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="Tudo em dia"
          description="A API não retornou alertas abertos. Novos sinais aparecerão aqui quando uma oportunidade precisar de atenção."
        />
      ) : (
        <div className="space-y-3">
          {query.data.data.map((alert) => (
            <Card
              key={alert.id}
              className="flex flex-col gap-4 rounded-xl p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e1be68]/15 text-[#80651f] dark:bg-[#e1be68]/10 dark:text-[#e1be68]">
                <AlertTriangle className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{alertNames[alert.type]}</h2>
                  <StageBadge stage={alert.opportunity.stage} />
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {alert.opportunity.code} · {alert.opportunity.companyName}
                </p>
              </div>
              <p className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm">
                <Clock3 className="size-4" />
                {formatDateTime(alert.referenceAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

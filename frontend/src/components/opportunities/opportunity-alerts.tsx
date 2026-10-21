"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { BellRing, CalendarClock, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/request-states";
import { opportunityAlertsQuery } from "@/lib/api/queries";
import { ALERT_TYPE_LABELS, alertDescription } from "@/lib/alerts";
import { formatDate, formatDateTime } from "@/lib/format";
import type { FollowUpAlert } from "@/types/api";

export function OpportunityAlerts({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const query = useInfiniteQuery(opportunityAlertsQuery(opportunityId));
  const alerts = query.data?.pages.flatMap((page) => page.data) ?? [];
  const openCount = alerts.filter((alert) => alert.status === "OPEN").length;

  return (
    <section
      className="mt-6"
      aria-labelledby="opportunity-alerts-title"
      aria-busy={query.isPending || query.isFetchingNextPage}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="opportunity-alerts-title"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <BellRing aria-hidden="true" className="text-primary size-5" />
            Alertas da oportunidade
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Alertas registrados pelo CRM para esta negociação.
          </p>
        </div>
        {!query.isPending && !query.isError && alerts.length > 0 && (
          <span className="text-muted-foreground text-sm tabular-nums">
            {alerts.length} {alerts.length === 1 ? "alerta" : "alertas"}
            {openCount > 0 && ` · ${openCount} em aberto`}
          </span>
        )}
      </div>

      {query.isPending ? (
        <LoadingState label="Carregando alertas da oportunidade…" />
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="Nenhum alerta registrado"
          description="Quando esta oportunidade precisar de atenção, os alertas aparecerão aqui."
        />
      ) : (
        <>
          <ul className="divide-y rounded-xl border">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-start gap-3 p-4 sm:p-5">
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <BellRing aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">
                      {ALERT_TYPE_LABELS[alert.type]}
                    </h3>
                    <AlertStatusBadge status={alert.status} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {alertDescription(alert.type, referenceDate(alert))}
                  </p>
                  <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock aria-hidden="true" className="size-3.5" />
                      Gerado em {formatDateTime(alert.createdAt)}
                    </span>
                    {alert.status === "RESOLVED" && alert.resolvedAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 aria-hidden="true" className="size-3.5" />
                        Resolvido em {formatDateTime(alert.resolvedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {query.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage
                  ? "Carregando…"
                  : "Carregar mais alertas"}
              </Button>
            </div>
          )}
          {query.isFetchNextPageError && (
            <p
              role="alert"
              className="text-destructive mt-3 text-center text-sm"
            >
              Não foi possível carregar mais alertas. Tente novamente.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function referenceDate(alert: FollowUpAlert) {
  return alert.type === "FOLLOW_UP_OVERDUE"
    ? formatDateTime(alert.referenceAt)
    : formatDate(alert.referenceAt);
}

function AlertStatusBadge({ status }: { status: FollowUpAlert["status"] }) {
  return status === "OPEN" ? (
    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">
      Precisa de atenção
    </Badge>
  ) : (
    <Badge variant="secondary">Resolvido</Badge>
  );
}

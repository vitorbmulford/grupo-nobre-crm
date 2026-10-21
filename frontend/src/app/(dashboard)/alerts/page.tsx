"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eraser,
  Info,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/request-states";
import { PageHeader } from "@/components/shared/page-header";
import { StageBadge } from "@/components/shared/stage-badge";
import {
  alertDescription,
  ALERT_TYPE_LABELS,
  ALERT_TYPE_OPTIONS,
  groupAlertsByOpportunity,
} from "@/lib/alerts";
import {
  alertsQuery,
  opportunityListQuery,
  openAlertCountQuery,
  salespeopleQuery,
} from "@/lib/api/queries";
import {
  alertMutationErrorMessage,
  invalidateAfterAlertResolution,
  resolveAlert,
} from "@/lib/api/alert-mutations";
import { formatDate, formatDateTime } from "@/lib/format";
import { stageLabel } from "@/lib/constants/stages";
import type { FollowUpAlert, FollowUpAlertStatus } from "@/types/api";

const PAGE_SIZE = 20;

function referenceDate(alert: FollowUpAlert) {
  return alert.type === "FOLLOW_UP_OVERDUE"
    ? formatDateTime(alert.referenceAt)
    : formatDate(alert.referenceAt);
}

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FollowUpAlertStatus>("OPEN");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [confirmAlert, setConfirmAlert] = useState<FollowUpAlert | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchDraft.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchDraft]);
  const opportunitySearchQuery = useQuery({
    ...opportunityListQuery({
      page: 1,
      search: searchDraft.trim(),
      salespersonId: salespersonId || undefined,
      sortBy: "code",
      sortOrder: "asc",
    }),
    enabled: searchDraft.trim().length >= 2 && !selectedOpportunity,
  });
  const salespeople = useQuery(salespeopleQuery);
  const filters = {
    page,
    limit: PAGE_SIZE,
    status,
    type: type === "all" ? undefined : (type as FollowUpAlert["type"]),
    opportunityId: selectedOpportunity?.id,
    search: search || undefined,
    salespersonId: salespersonId || undefined,
  };
  const alerts = useQuery(alertsQuery(filters));
  const openCount = useQuery(openAlertCountQuery);
  const resolve = useMutation({
    mutationFn: resolveAlert,
    onSuccess: async () => {
      await invalidateAfterAlertResolution(queryClient);
      setConfirmAlert(null);
      toast.success("Alerta marcado como resolvido.");
    },
    onError: (error) => toast.error(alertMutationErrorMessage(error)),
  });

  function resetPage(action: () => void) {
    action();
    setPage(1);
  }

  const hasFilters =
    Boolean(searchDraft.trim()) ||
    Boolean(salespersonId) ||
    status !== "OPEN" ||
    type !== "all" ||
    Boolean(selectedOpportunity);

  function clearFilters() {
    setSearchDraft("");
    setSearch("");
    setSalespersonId("");
    setStatus("OPEN");
    setType("all");
    setSelectedOpportunity(null);
    setPage(1);
  }

  const opportunities = opportunitySearchQuery.data?.data ?? [];
  const canGoBack = page > 1;
  const canGoForward = (alerts.data?.meta.totalPages ?? 0) > page;

  return (
    <>
      <PageHeader
        title="Alertas comerciais"
        description="Retome conversas e acompanhe os sinais que o CRM identifica nas oportunidades."
        action={
          <Button variant="outline" onClick={() => setRulesOpen(true)}>
            <Info aria-hidden="true" className="size-4" /> Regras dos alertas
          </Button>
        }
      />

      <Card className="mb-5 rounded-xl border-amber-500/25 bg-amber-500/[0.035] p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <AlertTriangle aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-medium">
              {openCount.data === undefined
                ? "Acompanhe os retornos pendentes"
                : openCount.data +
                  (openCount.data === 1
                    ? " alerta aberto"
                    : " alertas abertos")}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Os alertas são gerados pela análise automática das oportunidades.
              Registrar um contato ou atualizar a negociação ajuda o CRM a
              acompanhar a situação.
            </p>
          </div>
        </div>
      </Card>

      <Card className="mb-5 rounded-xl p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Filtrar alertas</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Busque pelo cliente ou código, ou escolha uma oportunidade
              específica. Refine por vendedor, situação e tipo.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="h-9"
          >
            <Eraser aria-hidden="true" /> Limpar filtros
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="alert-search">
              Cliente, código ou oportunidade
            </Label>
            {selectedOpportunity ? (
              <div className="flex h-11 items-center justify-between gap-2 rounded-xl border-2 px-3 text-sm">
                <span className="truncate">{selectedOpportunity.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remover filtro de oportunidade"
                  onClick={() =>
                    resetPage(() => {
                      setSelectedOpportunity(null);
                      setSearchDraft("");
                      setSearch("");
                    })
                  }
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
                />
                <Input
                  id="alert-search"
                  type="search"
                  value={searchDraft}
                  maxLength={120}
                  onChange={(event) => {
                    setSearchDraft(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar cliente ou código"
                  className="pl-9"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={
                    searchDraft.trim().length >= 2 && opportunities.length > 0
                  }
                  aria-controls="alert-opportunity-results"
                />
                {searchDraft.trim().length >= 2 && (
                  <div
                    id="alert-opportunity-results"
                    role="listbox"
                    aria-label="Oportunidades encontradas"
                    className="bg-popover absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border p-1 shadow-lg"
                  >
                    {opportunitySearchQuery.isPending ? (
                      <p className="text-muted-foreground px-3 py-2 text-sm">
                        Buscando oportunidades…
                      </p>
                    ) : opportunitySearchQuery.isError ? (
                      <p
                        role="alert"
                        className="text-destructive px-3 py-2 text-sm"
                      >
                        Não foi possível buscar oportunidades.
                      </p>
                    ) : opportunities.length ? (
                      opportunities.map((opportunity) => (
                        <button
                          key={opportunity.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            setSelectedOpportunity({
                              id: opportunity.id,
                              label:
                                opportunity.code +
                                " · " +
                                opportunity.companyName,
                            });
                            setSearchDraft("");
                            setSearch("");
                            setPage(1);
                          }}
                          className="hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring flex w-full flex-col rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2"
                        >
                          <span className="text-sm font-medium">
                            {opportunity.code} · {opportunity.companyName}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {stageLabel(opportunity.stage)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-muted-foreground px-3 py-2 text-sm">
                        Nenhuma oportunidade encontrada.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Digite para filtrar ou escolha uma sugestão para selecionar uma
              oportunidade específica.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-salesperson">Vendedor</Label>
            <Select
              value={salespersonId || "all"}
              onValueChange={(value) =>
                resetPage(() =>
                  setSalespersonId(value === "all" ? "" : (value ?? "")),
                )
              }
              disabled={salespeople.isPending || salespeople.isError}
            >
              <SelectTrigger id="alert-salesperson" className="w-full">
                <SelectValue>
                  {salespersonId
                    ? (salespeople.data?.find(
                        (person) => person.id === salespersonId,
                      )?.name ?? "Vendedor")
                    : "Todos os vendedores"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {salespeople.data?.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {salespeople.isError && (
              <p className="text-destructive text-xs" role="alert">
                Não foi possível carregar os vendedores.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-status">Situação</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                resetPage(() => setStatus(value as FollowUpAlertStatus))
              }
            >
              <SelectTrigger id="alert-status" className="w-full">
                <SelectValue>
                  {status === "OPEN" ? "Em aberto" : "Resolvidos"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Em aberto</SelectItem>
                <SelectItem value="RESOLVED">Resolvidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-type">Tipo de alerta</Label>
            <Select
              value={type}
              onValueChange={(value) =>
                resetPage(() => setType(value ?? "all"))
              }
            >
              <SelectTrigger id="alert-type" className="w-full">
                <SelectValue>
                  {type === "all"
                    ? "Todos os tipos"
                    : ALERT_TYPE_LABELS[type as FollowUpAlert["type"]]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {ALERT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <section aria-labelledby="alert-results-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="alert-results-heading" className="font-semibold">
              {status === "OPEN" ? "Alertas em aberto" : "Alertas resolvidos"}
            </h2>
            {alerts.data && (
              <p className="text-muted-foreground mt-0.5 text-sm">
                {alerts.data.meta.total}{" "}
                {alerts.data.meta.total === 1 ? "resultado" : "resultados"}
              </p>
            )}
          </div>
          {alerts.data && alerts.data.meta.total > 0 && (
            <p className="text-muted-foreground text-sm">
              Página {alerts.data.meta.page} de {alerts.data.meta.totalPages}
            </p>
          )}
        </div>

        {alerts.isPending ? (
          <LoadingState label="Carregando alertas…" />
        ) : alerts.isError ? (
          <ErrorState
            message={alerts.error.message}
            onRetry={() => void alerts.refetch()}
          />
        ) : alerts.data.data.length === 0 ? (
          <EmptyState
            title={
              status === "OPEN"
                ? "Nenhum alerta em aberto"
                : "Nenhum alerta resolvido"
            }
            description={
              status === "OPEN"
                ? "As oportunidades estão em dia com os critérios monitorados. Novos alertas aparecerão aqui quando necessário."
                : "Alertas resolvidos aparecerão aqui para consulta."
            }
          />
        ) : (
          <div className="space-y-3">
            {groupAlertsByOpportunity(alerts.data.data).map((group) =>
              group.alerts.length > 1 ? (
                <GroupedAlertsCard
                  key={group.opportunity.id}
                  group={group}
                  isResolving={resolve.isPending}
                  onResolve={setConfirmAlert}
                />
              ) : (
                <SingleAlertCard
                  key={group.alerts[0].id}
                  alert={group.alerts[0]}
                  isResolving={resolve.isPending}
                  onResolve={setConfirmAlert}
                />
              ),
            )}
          </div>
        )}

        {alerts.data && alerts.data.meta.totalPages > 1 && (
          <nav
            className="mt-5 flex items-center justify-between gap-3"
            aria-label="Paginação dos alertas"
          >
            <Button
              variant="outline"
              disabled={!canGoBack || alerts.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft aria-hidden="true" /> Anterior
            </Button>
            <span className="text-muted-foreground text-sm tabular-nums">
              {alerts.data.meta.page} / {alerts.data.meta.totalPages}
            </span>
            <Button
              variant="outline"
              disabled={!canGoForward || alerts.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima <ChevronRight aria-hidden="true" />
            </Button>
          </nav>
        )}
      </section>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-7 sm:py-6">
            <DialogTitle className="text-lg">Regras dos alertas</DialogTitle>
            <DialogDescription>
              Entenda quando cada alerta aparece, como o CRM acompanha a
              situação e o que fazer em seguida.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
            <section aria-labelledby="alert-rules-types-heading">
              <div className="mb-3">
                <h3
                  id="alert-rules-types-heading"
                  className="text-sm font-semibold"
                >
                  Quando um alerta é criado
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  O CRM avalia oportunidades em andamento. Uma mesma
                  oportunidade pode ter mais de um alerta quando os motivos são
                  diferentes.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <AlertRuleCard title="Retorno em atraso">
                  Aparece quando o horário combinado para o próximo follow-up
                  chega ou passa e ainda não foi atualizado.
                </AlertRuleCard>
                <AlertRuleCard title="Contato sem atualização">
                  Aparece depois de mais de 7 dias corridos sem novo contato,
                  quando não há um follow-up agendado. O prazo padrão é
                  configurável.
                </AlertRuleCard>
                <AlertRuleCard title="Proposta expirada">
                  Aparece a partir do dia seguinte ao vencimento da proposta,
                  se a validade ainda estiver vencida.
                </AlertRuleCard>
                <AlertRuleCard title="Evento do cliente próximo">
                  Aparece quando o evento está marcado para hoje ou para os
                  próximos 7 dias. A janela padrão é configurável.
                </AlertRuleCard>
              </div>
            </section>

            <section
              aria-labelledby="alert-rules-operation-heading"
              className="border-primary/20 bg-primary/[0.035] rounded-xl border p-4 sm:p-5"
            >
              <div className="mb-4">
                <h3
                  id="alert-rules-operation-heading"
                  className="font-semibold"
                >
                  Como o acompanhamento funciona
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  A análise é automática e não altera a oportunidade nem entra
                  em contato com o cliente.
                </p>
              </div>
              <ul className="grid gap-3 text-sm sm:grid-cols-2">
                <AlertRuleItem icon={<RefreshCw aria-hidden="true" />}>
                  O backend avalia os alertas ao iniciar e, por padrão, a cada
                  15 minutos. Esse intervalo pode ser configurado; por isso,
                  um alerta pode aparecer no próximo ciclo de análise.
                </AlertRuleItem>
                <AlertRuleItem icon={<Info aria-hidden="true" />}>
                  Os alertas aparecem nesta tela e no indicador da navegação. O
                  CRM não envia e-mail, WhatsApp, SMS ou notificação externa.
                </AlertRuleItem>
                <AlertRuleItem icon={<Check aria-hidden="true" />}>
                  Registrar um contato, atualizar uma data ou encerrar a
                  oportunidade pode remover a condição. O CRM fecha o alerta
                  automaticamente na próxima avaliação.
                </AlertRuleItem>
                <AlertRuleItem icon={<AlertTriangle aria-hidden="true" />}>
                  “Marcar como resolvido” registra que você reconheceu o aviso;
                  não corrige os dados nem agenda um retorno. A mesma ocorrência
                  não será recriada enquanto a condição e sua referência
                  permanecerem iguais.
                </AlertRuleItem>
              </ul>
              <p className="text-muted-foreground mt-4 border-t pt-3 text-xs leading-relaxed">
                Por padrão, os alertas valem para oportunidades nas etapas
                Primeiro contato, Apresentação de orçamento, Follow-up e
                Previsão de fechamento. Negociações fechadas, perdidas ou
                excluídas não recebem novos alertas.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmAlert !== null}
        onOpenChange={(open) => {
          if (!open && !resolve.isPending) setConfirmAlert(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar alerta como resolvido?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAlert && (
                <>
                  O alerta de {confirmAlert.opportunity.code} ·{" "}
                  {confirmAlert.opportunity.companyName} sairá da lista de itens
                  em aberto e ficará disponível em resolvidos. Isso registra seu
                  reconhecimento; a análise automática continua ativa. Se a
                  mesma condição de risco persistir, esta ocorrência reconhecida
                  não será recriada até que a condição mude ou deixe de existir.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolve.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={resolve.isPending || !confirmAlert}
              onClick={(event) => {
                event.preventDefault();
                if (confirmAlert) resolve.mutate(confirmAlert.id);
              }}
            >
              {resolve.isPending ? "Atualizando…" : "Confirmar resolução"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SingleAlertCard({
  alert,
  isResolving,
  onResolve,
}: {
  alert: FollowUpAlert;
  isResolving: boolean;
  onResolve: (alert: FollowUpAlert) => void;
}) {
  return (
    <Card className="flex flex-col gap-4 rounded-xl p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{ALERT_TYPE_LABELS[alert.type]}</h3>
            <AlertStatusBadge status={alert.status} />
            <StageBadge stage={alert.opportunity.stage} />
          </div>
          <OpportunityAlertLink opportunity={alert.opportunity} />
          <AlertDetails alert={alert} />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/opportunities/${alert.opportunity.id}`} />}
          className="justify-between sm:justify-center"
        >
          Abrir oportunidade <ArrowRight aria-hidden="true" />
        </Button>
        {alert.status === "OPEN" && (
          <ResolveAlertButton
            isResolving={isResolving}
            onClick={() => onResolve(alert)}
          />
        )}
      </div>
    </Card>
  );
}

function GroupedAlertsCard({
  group,
  isResolving,
  onResolve,
}: {
  group: ReturnType<typeof groupAlertsByOpportunity>[number];
  isResolving: boolean;
  onResolve: (alert: FollowUpAlert) => void;
}) {
  const pendingCount = group.alerts.filter(
    (alert) => alert.status === "OPEN",
  ).length;
  const groupLabel =
    pendingCount === group.alerts.length
      ? `${pendingCount} ${pendingCount === 1 ? "pendência" : "pendências"} nesta oportunidade`
      : pendingCount === 0
        ? `${group.alerts.length} alertas resolvidos nesta oportunidade`
        : `${pendingCount} pendências · ${group.alerts.length - pendingCount} resolvidos`;

  return (
    <Card className="overflow-hidden rounded-xl p-0 shadow-sm">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">
              {groupLabel}
            </Badge>
            <StageBadge stage={group.opportunity.stage} />
          </div>
          <OpportunityAlertLink opportunity={group.opportunity} />
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/opportunities/${group.opportunity.id}`} />}
          className="hidden sm:inline-flex"
        >
          Abrir oportunidade <ArrowRight aria-hidden="true" />
        </Button>
      </div>
      <ul className="divide-y border-t">
        {group.alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">
                  {ALERT_TYPE_LABELS[alert.type]}
                </h3>
                {alert.status === "RESOLVED" && (
                  <Badge variant="secondary">
                    <Check aria-hidden="true" /> Resolvido
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
                {alertDescription(alert.type, referenceDate(alert))}
              </p>
              <AlertTimestamps alert={alert} />
            </div>
            {alert.status === "OPEN" && (
              <ResolveAlertButton
                isResolving={isResolving}
                onClick={() => onResolve(alert)}
              />
            )}
          </li>
        ))}
      </ul>
      <div className="border-t px-4 py-3 sm:hidden">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/opportunities/${group.opportunity.id}`} />}
          className="w-full justify-between"
        >
          Abrir oportunidade <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}

function OpportunityAlertLink({
  opportunity,
}: {
  opportunity: FollowUpAlert["opportunity"];
}) {
  return (
    <Link
      href={`/opportunities/${opportunity.id}?returnTo=${encodeURIComponent("/alerts")}`}
      className="text-primary mt-1 inline-flex items-center gap-1 text-sm font-medium hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      aria-label={`Abrir oportunidade ${opportunity.code}, ${opportunity.companyName}`}
    >
      {opportunity.code} · {opportunity.companyName}
      <ArrowRight aria-hidden="true" className="size-3.5 shrink-0" />
    </Link>
  );
}

function AlertDetails({ alert }: { alert: FollowUpAlert }) {
  return (
    <>
      <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
        {alertDescription(alert.type, referenceDate(alert))}
      </p>
      <AlertTimestamps alert={alert} />
    </>
  );
}

function AlertTimestamps({ alert }: { alert: FollowUpAlert }) {
  return (
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
  );
}

function AlertStatusBadge({ status }: { status: FollowUpAlert["status"] }) {
  return status === "OPEN" ? (
    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">
      Precisa de atenção
    </Badge>
  ) : (
    <Badge variant="secondary">
      <Check aria-hidden="true" /> Resolvido
    </Badge>
  );
}

function ResolveAlertButton({
  isResolving,
  onClick,
}: {
  isResolving: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={isResolving}
      className="justify-between sm:justify-center"
    >
      <Check aria-hidden="true" /> Marcar como resolvido
    </Button>
  );
}

function AlertRuleCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="bg-card rounded-xl border p-4 shadow-sm">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
        {children}
      </p>
    </article>
  );
}

function AlertRuleItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center [&_svg]:size-4">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

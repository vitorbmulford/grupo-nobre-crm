"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  CircleCheck,
  CircleDot,
  CircleX,
  ArrowDown,
  Check,
  Eraser,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  MoveRight,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import {
  pipelineStageQuery,
  queryKeys,
  salespeopleQuery,
} from "@/lib/api/queries";
import { ApiError } from "@/lib/api/client";
import { transitionOpportunityStage } from "@/lib/api/opportunity-mutations";
import { updatePipelinePagesAfterMove } from "@/lib/api/pipeline-cache";
import { STAGES } from "@/lib/constants/stages";
import { formatCurrency, formatNextFollowUp } from "@/lib/format";
import type {
  Opportunity,
  OpportunityListResponse,
  OpportunityStage,
} from "@/types/api";

const PIPELINE_PAGE_SIZE = 25;
const TERMINAL_STAGES = new Set<OpportunityStage>(["FECHAMENTO", "PERDIDA"]);

const stageIcons = [
  CircleDot,
  CircleDot,
  CircleDot,
  CircleDot,
  CircleCheck,
  CircleX,
];

const stageColumnTones: Record<OpportunityStage, string> = {
  PRIMEIRO_CONTATO: "border-cyan-500/35 bg-cyan-500/[0.08]",
  APRESENTACAO_ORCAMENTO: "border-blue-500/35 bg-blue-500/[0.08]",
  FOLLOW_UP: "border-[#e1be68]/35 bg-[#e1be68]/[0.08]",
  FORECAST: "border-violet-500/35 bg-violet-500/[0.08]",
  FECHAMENTO: "border-[#83b735]/40 bg-[#83b735]/[0.09]",
  PERDIDA: "border-destructive/35 bg-destructive/[0.08]",
};

const stageMeanings: Record<OpportunityStage, string> = {
  PRIMEIRO_CONTATO:
    "Oportunidade recém-iniciada, em contato inicial com o cliente.",
  APRESENTACAO_ORCAMENTO:
    "Orçamento e opções de brindes apresentados ao cliente.",
  FOLLOW_UP:
    "Acompanhamento da proposta e dos próximos contatos com o cliente.",
  FORECAST:
    "Negociação em previsão de fechamento, antes da etapa de fechamento.",
  FECHAMENTO: "Negociação fechada. Esta etapa encerra a movimentação no funil.",
  PERDIDA: "Negociação encerrada sem fechamento. O motivo fica registrado.",
};

function needsReason(from: OpportunityStage, to: OpportunityStage) {
  if (to === "PERDIDA") return true;
  const fromIndex = STAGES.findIndex((stage) => stage.value === from);
  const toIndex = STAGES.findIndex((stage) => stage.value === to);
  return toIndex >= 0 && fromIndex >= 0 && toIndex < fromIndex;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409)
      return "Esta oportunidade foi alterada por outra pessoa. Atualizamos os dados; confira a etapa e tente novamente.";
    if (error.status === 422) {
      const messages: Record<string, string> = {
        "Terminal opportunities cannot be moved":
          "Oportunidades encerradas não podem ser movimentadas.",
        "Opportunity is already in this stage":
          "A oportunidade já está nesta etapa.",
        "A loss reason is required": "Informe o motivo da perda.",
        "Closing is only allowed from FORECAST":
          "Fechamento só pode ser alcançado a partir de Previsão de fechamento.",
        "An estimated value is required":
          "Informe o valor estimado antes de avançar para Apresentação de orçamento.",
        "At least one gift item is required":
          "Adicione ao menos um item de brinde antes de avançar para Apresentação de orçamento.",
        "A reason is required to move backward":
          "Informe uma justificativa para retornar de etapa.",
        "Only sequential stage movements are allowed":
          "Avance ou retorne uma etapa por vez.",
      };
      return (
        messages[error.message] ??
        `A API recusou esta transição: ${error.message}`
      );
    }
    if (error.status === 0) return error.message;
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível mover a oportunidade.";
}

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const salespeople = useQuery(salespeopleQuery);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchUrlReady, setSearchUrlReady] = useState(false);
  const [salespersonId, setSalespersonId] = useState("");
  const [showClosed, setShowClosed] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    opportunity: Opportunity;
    toStage: OpportunityStage;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [activeOpportunity, setActiveOpportunity] =
    useState<Opportunity | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchDraft.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchDraft]);

  useEffect(() => {
    const initialSearch = new URLSearchParams(window.location.search)
      .get("search")
      ?.trim();
    const timeout = window.setTimeout(() => {
      if (initialSearch) {
        setSearchDraft(initialSearch);
        setSearch(initialSearch);
      }
      setSearchUrlReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!searchUrlReady) return;
    const url = new URL(window.location.href);
    if (search) url.searchParams.set("search", search);
    else url.searchParams.delete("search");
    window.history.replaceState(window.history.state, "", url);
  }, [search, searchUrlReady]);

  const stageLimit = (stage: OpportunityStage) =>
    !showClosed && TERMINAL_STAGES.has(stage) ? 1 : PIPELINE_PAGE_SIZE;
  const firstContactQuery = useInfiniteQuery(
    pipelineStageQuery({
      stage: "PRIMEIRO_CONTATO",
      search,
      salespersonId,
      limit: stageLimit("PRIMEIRO_CONTATO"),
    }),
  );
  const presentationQuery = useInfiniteQuery(
    pipelineStageQuery({
      stage: "APRESENTACAO_ORCAMENTO",
      search,
      salespersonId,
      limit: stageLimit("APRESENTACAO_ORCAMENTO"),
    }),
  );
  const followUpQuery = useInfiniteQuery(
    pipelineStageQuery({
      stage: "FOLLOW_UP",
      search,
      salespersonId,
      limit: stageLimit("FOLLOW_UP"),
    }),
  );
  const forecastQuery = useInfiniteQuery(
    pipelineStageQuery({
      stage: "FORECAST",
      search,
      salespersonId,
      limit: stageLimit("FORECAST"),
    }),
  );
  const closingQuery = useInfiniteQuery(
    pipelineStageQuery({
      stage: "FECHAMENTO",
      search,
      salespersonId,
      limit: stageLimit("FECHAMENTO"),
    }),
  );
  const lostQuery = useInfiniteQuery(
    pipelineStageQuery({
      stage: "PERDIDA",
      search,
      salespersonId,
      limit: stageLimit("PERDIDA"),
    }),
  );
  const stageQueries = [
    firstContactQuery,
    presentationQuery,
    followUpQuery,
    forecastQuery,
    closingQuery,
    lostQuery,
  ];
  const loadedOpportunities = stageQueries.flatMap(
    (stageQuery) => stageQuery.data?.pages.flatMap((page) => page.data) ?? [],
  );
  const visibleLoadedCount = stageQueries.reduce(
    (count, stageQuery, index) =>
      !showClosed && TERMINAL_STAGES.has(STAGES[index].value)
        ? count
        : count +
          (stageQuery.data?.pages.reduce(
            (pageCount, page) => pageCount + page.data.length,
            0,
          ) ?? 0),
    0,
  );
  const hasFilters = Boolean(
    searchDraft.trim() || salespersonId || !showClosed,
  );
  const countsReady = stageQueries.every(
    (stageQuery, index) =>
      (!showClosed && TERMINAL_STAGES.has(STAGES[index].value)) ||
      stageQuery.data,
  );
  const totalOpportunities = countsReady
    ? stageQueries.reduce(
        (total, stageQuery, index) =>
          !showClosed && TERMINAL_STAGES.has(STAGES[index].value)
            ? total
            : total + (stageQuery.data?.pages[0]?.meta.total ?? 0),
        0,
      )
    : undefined;

  const transition = useMutation({
    mutationFn: ({
      opportunity,
      toStage,
      reason: moveReason,
    }: {
      opportunity: Opportunity;
      toStage: OpportunityStage;
      reason?: string;
    }) =>
      transitionOpportunityStage(
        opportunity.id,
        toStage,
        opportunity.version,
        moveReason,
      ),
    onSuccess: (updated, variables) => {
      const cachedPipelineQueries = queryClient.getQueriesData<
        InfiniteData<OpportunityListResponse, number>
      >({ queryKey: queryKeys.pipeline });
      for (const [queryKey, current] of cachedPipelineQueries) {
        if (!current || queryKey[2] !== "stage" || queryKey.length !== 7)
          continue;
        queryClient.setQueryData(
          queryKey,
          updatePipelinePagesAfterMove(
            current,
            queryKey as ReturnType<typeof queryKeys.pipelineStage>,
            variables.opportunity.stage,
            updated,
          ),
        );
      }
      queryClient.setQueryData(queryKeys.opportunity(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            key[0] === "opportunities" &&
            key[1] === "pipeline" &&
            key[2] === "stage" &&
            (key[3] === variables.opportunity.stage || key[3] === updated.stage)
          );
        },
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "opportunities" &&
          query.queryKey[1] !== "pipeline",
      });
      setPendingMove(null);
      setReason("");
      toast.success(
        `${updated.code} movida para ${STAGES.find((stage) => stage.value === updated.stage)?.label}.`,
      );
    },
    onError: (error, variables) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.resetQueries({ queryKey: queryKeys.pipeline });
        void queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "opportunities" &&
            query.queryKey[1] !== "pipeline" &&
            !(
              query.queryKey[1] === "detail" &&
              query.queryKey[2] === variables.opportunity.id
            ),
        });
      }
      toast.error(errorMessage(error));
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function clearFilters() {
    setSearchDraft("");
    setSearch("");
    setSalespersonId("");
    setShowClosed(true);
  }

  function requestMove(opportunity: Opportunity, toStage: OpportunityStage) {
    if (transition.isPending || opportunity.stage === toStage) return;
    if (opportunity.stage === "FECHAMENTO" || opportunity.stage === "PERDIDA") {
      toast.error("Oportunidades encerradas não podem ser movimentadas.");
      return;
    }
    if (
      needsReason(opportunity.stage, toStage) ||
      toStage === "FECHAMENTO"
    ) {
      setReason("");
      setPendingMove({ opportunity, toStage });
      return;
    }
    transition.mutate({ opportunity, toStage });
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveOpportunity(
      loadedOpportunities.find((item) => item.id === id) ?? null,
    );
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveOpportunity(null);
    if (!event.over) return;
    const opportunity = loadedOpportunities.find(
      (item) => item.id === String(event.active.id),
    );
    const target = STAGES.find(
      (stage) => stage.value === String(event.over?.id),
    );
    if (opportunity && target) requestMove(opportunity, target.value);
  }

  async function confirmMove() {
    if (!pendingMove || transition.isPending) return;
    const normalized = reason.trim();
    if (
      needsReason(pendingMove.opportunity.stage, pendingMove.toStage) &&
      !normalized
    ) {
      toast.error(
        pendingMove.toStage === "PERDIDA"
          ? "Informe o motivo da perda."
          : "Informe a justificativa do retorno.",
      );
      return;
    }
    transition.mutate({ ...pendingMove, reason: normalized });
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Acompanhe as oportunidades em cada etapa e mova as negociações conforme avançam."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRulesOpen(true)}>
              <Info className="mr-2 size-4" /> Regras do funil
            </Button>
          </div>
        }
      />
      <section
        aria-label="Filtros do pipeline"
        className="bg-card mb-4 grid gap-3 rounded-xl border p-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_minmax(12rem,0.7fr)_auto_auto] xl:items-center"
      >
        <label className="relative block">
          <span className="sr-only">
            Buscar cliente ou código da oportunidade
          </span>
          <Input
            type="search"
            value={searchDraft}
            maxLength={120}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Buscar cliente ou código"
            className="h-10 rounded-lg border px-3 text-sm"
          />
        </label>
        <Select
          value={salespersonId || "all"}
          onValueChange={(value) =>
            setSalespersonId(value === "all" ? "" : (value ?? ""))
          }
          disabled={salespeople.isPending || salespeople.isError}
        >
          <SelectTrigger
            aria-label="Filtrar por vendedor"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          >
            <SelectValue placeholder="Todos os vendedores">
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
        <Button
          type="button"
          variant="outline"
          aria-pressed={showClosed}
          onClick={() => setShowClosed((current) => !current)}
          className="h-10 justify-start"
        >
          {showClosed ? (
            <Eye className="mr-2 size-4" />
          ) : (
            <EyeOff className="mr-2 size-4" />
          )}
          {showClosed ? "Encerradas visíveis" : "Encerradas ocultas"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={clearFilters}
          disabled={!hasFilters}
          className="h-10 justify-start"
        >
          <Eraser className="mr-2 size-4" /> Limpar filtros
        </Button>
      </section>
      {salespeople.isError && (
        <p
          className="text-destructive mb-3 flex items-center justify-between gap-3 text-xs"
          role="alert"
        >
          Não foi possível carregar os vendedores.
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void salespeople.refetch()}
          >
            Tentar novamente
          </Button>
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p
          className="text-muted-foreground text-xs"
          role="status"
          aria-live="polite"
        >
          {totalOpportunities === undefined
            ? "Consultando oportunidades…"
            : `${totalOpportunities} ${totalOpportunities === 1 ? "oportunidade exibida" : "oportunidades exibidas"}`}
          {visibleLoadedCount > 0 && ` · ${visibleLoadedCount} carregadas`}
        </p>
        {transition.isPending && (
          <p
            className="text-muted-foreground flex items-center gap-2 text-xs"
            role="status"
          >
            <LoaderCircle className="size-3.5 animate-spin" /> Aguardando
            confirmação da API…
          </p>
        )}
      </div>
      {totalOpportunities === 0 && (
        <p
          className="text-muted-foreground mb-3 rounded-lg border border-dashed px-4 py-3 text-center text-sm"
          role="status"
        >
          {hasFilters
            ? "Nenhuma oportunidade corresponde aos filtros atuais."
            : "Ainda não há oportunidades cadastradas no funil."}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveOpportunity(null)}
      >
        <section
          aria-label="Etapas do pipeline comercial"
          className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {STAGES.map((stage, index) => {
            const stageQuery = stageQueries[index];
            const opportunities =
              stageQuery.data?.pages.flatMap((page) => page.data) ?? [];
            const hidden = !showClosed && TERMINAL_STAGES.has(stage.value);
            return (
              <StageColumn
                key={stage.value}
                stage={stage.value}
                label={stage.label}
                icon={stageIcons[index]}
                opportunities={hidden ? [] : opportunities}
                count={stageQuery.data?.pages[0]?.meta.total}
                loadedCount={hidden ? 0 : opportunities.length}
                isPending={stageQuery.isPending}
                isError={stageQuery.isError}
                errorMessage={stageQuery.error?.message}
                onRetry={() => void stageQuery.refetch()}
                hasNextPage={!hidden && stageQuery.hasNextPage}
                isFetchingNextPage={stageQuery.isFetchingNextPage}
                onLoadMore={() => void stageQuery.fetchNextPage()}
                hidden={hidden}
                onMove={requestMove}
                disabled={transition.isPending}
              />
            );
          })}
        </section>
        <DragOverlay>
          {activeOpportunity ? (
            <OpportunityCardVisual opportunity={activeOpportunity} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-7 sm:py-6">
            <DialogTitle className="text-lg">Regras do funil</DialogTitle>
            <DialogDescription>
              Veja o significado de cada etapa e o que é necessário para
              avançar.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
            <section aria-labelledby="stage-rules-heading">
              <div className="mb-3">
                <h3 id="stage-rules-heading" className="text-sm font-semibold">
                  Etapas da negociação
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  A sequência padrão permite avançar ou retornar uma etapa por
                  vez.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {STAGES.map((stage, index) => (
                  <article
                    key={stage.value}
                    className="bg-card rounded-xl border p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold">{stage.label}</h4>
                        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                          {stageMeanings[stage.value]}
                        </p>
                      </div>
                    </div>
                    <div className="bg-muted/50 mt-4 rounded-lg p-3">
                      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                        Condição de entrada
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">
                        {stageCondition(stage.value)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="general-rules-heading"
              className="border-primary/20 bg-primary/[0.035] rounded-xl border p-4 sm:p-5"
            >
              <div className="mb-4">
                <h3 id="general-rules-heading" className="font-semibold">
                  Regras gerais de movimentação
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  A API confere estas condições antes de registrar qualquer
                  mudança.
                </p>
              </div>
              <ul className="grid gap-3 text-sm sm:grid-cols-2">
                <RuleItem icon={<ArrowRight />}>
                  Nas etapas regulares, avance ou retorne uma etapa por vez.
                </RuleItem>
                <RuleItem icon={<RotateCcw />}>
                  Ao retornar uma etapa, informe uma justificativa.
                </RuleItem>
                <RuleItem icon={<Check />}>
                  Para entrar em Apresentação de orçamento, mantenha um valor
                  estimado e ao menos um item de brinde.
                </RuleItem>
                <RuleItem icon={<ArrowDown />}>
                  Fechamento só pode vir de Previsão de fechamento.
                </RuleItem>
                <RuleItem icon={<X />}>
                  Perdida pode ser escolhida em qualquer etapa ativa e exige um
                  motivo.
                </RuleItem>
                <RuleItem icon={<Info />}>
                  Fechamento e Perdida são etapas finais e não podem ser
                  alteradas.
                </RuleItem>
              </ul>
              <p className="text-muted-foreground mt-4 border-t pt-3 text-xs leading-relaxed">
                Cada movimentação usa a versão atual da oportunidade. Se outra
                pessoa tiver feito uma alteração, a API rejeita a mudança e os
                dados são atualizados.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingMove !== null}
        onOpenChange={(open) => {
          if (!open && !transition.isPending) {
            setPendingMove(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingMove?.toStage === "FECHAMENTO"
                ? "Confirmar fechamento definitivo"
                : pendingMove?.toStage === "PERDIDA"
                  ? "Motivo da perda"
                  : "Justificativa para retornar etapa"}
            </DialogTitle>
            <DialogDescription>
              {pendingMove && (
                <>
                  {pendingMove.opportunity.code}:{" "}
                  {
                    STAGES.find(
                      (stage) => stage.value === pendingMove.opportunity.stage,
                    )?.label
                  }{" "}
                  →{" "}
                  {
                    STAGES.find((stage) => stage.value === pendingMove.toStage)
                      ?.label
                  }
                  {pendingMove.toStage === "FECHAMENTO"
                    ? ". Ao confirmar, esta oportunidade será encerrada e não poderá mais mudar de etapa."
                    : ". Informe o motivo para confirmar."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {pendingMove?.toStage === "FECHAMENTO" ? (
            <div
              role="note"
              className="border-amber-500/30 bg-amber-500/10 text-foreground flex items-start gap-3 rounded-lg border p-3 text-sm leading-relaxed"
            >
              <Info className="text-amber-600 mt-0.5 size-4 shrink-0 dark:text-amber-400" />
              <p>
                O fechamento é definitivo. Depois de confirmar, a oportunidade
                ficará em uma etapa final e não poderá ser reaberta pelo
                Pipeline.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="stage-transition-reason">
                {pendingMove?.toStage === "PERDIDA"
                  ? "Motivo da perda"
                  : "Justificativa"}
              </Label>
              <Textarea
                id="stage-transition-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                placeholder={
                  pendingMove?.toStage === "PERDIDA"
                    ? "Ex.: cliente adiou o projeto"
                    : "Explique por que a oportunidade voltou de etapa"
                }
                disabled={transition.isPending}
                autoFocus
              />
              <p className="text-muted-foreground text-xs">
                Até 1.000 caracteres.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingMove(null)}
              disabled={transition.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void confirmMove()}
              disabled={
                transition.isPending ||
                (pendingMove?.toStage !== "FECHAMENTO" && !reason.trim())
              }
            >
              {transition.isPending ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <MoveRight className="mr-2 size-4" />
              )}
              {pendingMove?.toStage === "FECHAMENTO"
                ? "Confirmar fechamento"
                : "Confirmar movimentação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function stageCondition(stage: OpportunityStage) {
  switch (stage) {
    case "PRIMEIRO_CONTATO":
      return "Etapa inicial atribuída quando a oportunidade é criada.";
    case "APRESENTACAO_ORCAMENTO":
      return "Avanço de uma etapa; exige valor estimado e pelo menos um item de brinde.";
    case "FOLLOW_UP":
      return "Avanço de uma etapa a partir de Apresentação de orçamento.";
    case "FORECAST":
      return "Avanço de uma etapa a partir de Follow-up.";
    case "FECHAMENTO":
      return "Só pode vir de Previsão de fechamento.";
    case "PERDIDA":
      return "Pode vir de qualquer etapa ativa e exige motivo da perda.";
  }
}

function RuleItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 leading-relaxed">
      <span className="text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

function StageColumn({
  stage,
  label,
  icon,
  opportunities,
  count,
  loadedCount,
  isPending,
  isError,
  errorMessage,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  hidden,
  onMove,
  disabled,
}: {
  stage: OpportunityStage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  opportunities: Opportunity[];
  count?: number;
  loadedCount: number;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  hidden: boolean;
  onMove: (opportunity: Opportunity, stage: OpportunityStage) => void;
  disabled: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  const Icon = icon;
  return (
    <article
      ref={setNodeRef}
      aria-label={`${label}, ${count === undefined ? "carregando" : `${count} ${count === 1 ? "oportunidade" : "oportunidades"}`}`}
      className={`${isOver ? "border-primary bg-primary/5 ring-primary/20 ring-2" : stageColumnTones[stage]} flex h-[min(34rem,calc(100dvh-15rem))] min-h-72 w-full min-w-0 flex-col overflow-hidden rounded-xl border p-3 transition-colors`}
    >
      <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border">
            <Icon className="size-4" />
          </span>
          <span>{label}</span>
        </h2>
        <span className="bg-background text-muted-foreground rounded-full border px-2 py-0.5 text-xs tabular-nums">
          {count ?? "…"}
        </span>
      </div>
      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
        aria-label={`Oportunidades em ${label}`}
      >
        {hidden ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs">
            {count === undefined
              ? "Consultando oportunidades encerradas…"
              : count > 0
                ? `${count} ${count === 1 ? "oportunidade encerrada oculta." : "oportunidades encerradas ocultas."}`
                : "Nenhuma oportunidade encerrada nesta etapa."}
          </p>
        ) : isPending && opportunities.length === 0 ? (
          <div
            className="text-muted-foreground flex min-h-32 items-center justify-center gap-2 text-xs"
            role="status"
          >
            <LoaderCircle className="size-4 animate-spin" /> Carregando etapa…
          </div>
        ) : isError && opportunities.length === 0 ? (
          <div
            className="border-destructive/30 bg-destructive/5 rounded-lg border p-3 text-center text-xs"
            role="alert"
          >
            <p>{errorMessage ?? "Não foi possível carregar esta etapa."}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onRetry}
            >
              Tentar novamente
            </Button>
          </div>
        ) : opportunities.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs">
            Nenhuma oportunidade nesta etapa para esses filtros.
          </p>
        ) : (
          opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              disabled={disabled}
              onMove={(toStage) => onMove(opportunity, toStage)}
            />
          ))
        )}
        {isError && opportunities.length > 0 && (
          <p className="text-destructive px-2 py-1 text-xs" role="alert">
            Falha ao atualizar: {errorMessage}
          </p>
        )}
        {!hidden && hasNextPage && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage ? (
              <LoaderCircle className="mr-2 size-3.5 animate-spin" />
            ) : null}
            {isFetchingNextPage
              ? "Carregando…"
              : `Carregar mais (${loadedCount} de ${count ?? "…"})`}
          </Button>
        )}
      </div>
    </article>
  );
}

function OpportunityCard({
  opportunity,
  disabled,
  onMove,
}: {
  opportunity: Opportunity;
  disabled: boolean;
  onMove: (stage: OpportunityStage) => void;
}) {
  const terminal =
    opportunity.stage === "FECHAMENTO" || opportunity.stage === "PERDIDA";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: opportunity.id,
    disabled: disabled || terminal,
  });

  return (
    <Card
      ref={setNodeRef}
      onPointerDown={
        listeners?.onPointerDown as React.PointerEventHandler<HTMLDivElement>
      }
      className={`group/card w-full gap-2 rounded-lg p-2.5 shadow-sm transition-[box-shadow,transform] ${terminal ? "" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "ring-primary/50 opacity-35 ring-2" : "hover:shadow-md"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/opportunities/${opportunity.id}?returnTo=${encodeURIComponent("/pipeline")}`}
            className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {opportunity.code}
            <ArrowRight className="size-3" />
          </Link>
          <p
            className="mt-1 truncate text-sm font-semibold"
            title={opportunity.companyName}
          >
            {opportunity.companyName}
          </p>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:bg-muted focus-visible:ring-ring -mt-1 -mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Arrastar ${opportunity.code} para outra etapa`}
          title={
            terminal
              ? "Etapa final: oportunidades encerradas não podem ser movidas"
              : "Use espaço e as setas do teclado para mover"
          }
          disabled={disabled || terminal}
          {...attributes}
          onKeyDown={
            listeners?.onKeyDown as React.KeyboardEventHandler<HTMLButtonElement>
          }
        >
          <MoveRight className="size-4" />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Vendedor</dt>
          <dd className="mt-0.5 truncate font-medium">
            {opportunity.salesperson?.name ?? "Não atribuído"}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-muted-foreground">Valor estimado</dt>
          <dd className="mt-0.5 font-medium">
            {formatCurrency(opportunity.estimatedValue)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Próximo follow-up</dt>
          <dd className="mt-0.5 font-medium">
            {formatNextFollowUp(opportunity.nextFollowUpAt)}
          </dd>
        </div>
      </dl>
      {terminal && (
        <p
          id={`terminal-stage-${opportunity.id}`}
          role="note"
          className="border-muted-foreground/20 bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs leading-relaxed"
        >
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Etapa final. Oportunidades em{" "}
            {STAGES.find((stage) => stage.value === opportunity.stage)?.label}{" "}
            não podem ser movidas.
          </span>
        </p>
      )}
      <div className="flex justify-end border-t pt-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || terminal}
                title={
                  terminal
                    ? "Etapa final: oportunidades encerradas não podem ser movidas"
                    : "Escolher uma etapa para esta oportunidade"
                }
                className="h-7 px-2 text-xs"
              >
                <MoveRight className="mr-1.5 size-3.5" /> Mover etapa
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel>Escolha a etapa</DropdownMenuLabel>
            {STAGES.map((stage) => (
              <DropdownMenuItem
                key={stage.value}
                disabled={disabled || stage.value === opportunity.stage}
                onClick={() => onMove(stage.value)}
              >
                {stage.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

function OpportunityCardVisual({
  opportunity,
  overlay = false,
}: {
  opportunity: Opportunity;
  overlay?: boolean;
}) {
  return (
    <Card
      className={`w-[280px] gap-2 rounded-lg p-3 shadow-lg ${overlay ? "rotate-1 opacity-95" : ""}`}
    >
      <p className="text-primary text-xs font-semibold">{opportunity.code}</p>
      <p className="truncate text-sm font-semibold">
        {opportunity.companyName}
      </p>
      <p className="text-muted-foreground text-xs">
        {formatCurrency(opportunity.estimatedValue)}
      </p>
    </Card>
  );
}

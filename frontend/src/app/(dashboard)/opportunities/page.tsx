"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/request-states";
import { PageHeader } from "@/components/shared/page-header";
import { StageBadge } from "@/components/shared/stage-badge";
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
import {
  opportunityListQuery,
  queryKeys,
  salespeopleQuery,
} from "@/lib/api/queries";
import { deleteOpportunity } from "@/lib/api/opportunity-mutations";
import { updateOpportunity } from "@/lib/api/opportunity-mutations";
import { STAGES } from "@/lib/constants/stages";
import {
  formatCurrency,
  formatDate,
  formatNextFollowUp,
} from "@/lib/format";
import {
  formatConflictMessage,
  opportunityToFormValues,
  toOpportunityPayload,
} from "@/lib/opportunity-form";
import type { Opportunity } from "@/types/api";

const SORT_OPTIONS = [
  ["createdAt", "Data de criação"],
  ["updatedAt", "Última atualização"],
  ["code", "Código da oportunidade"],
  ["companyName", "Nome da empresa"],
  ["stage", "Nome da etapa"],
  ["estimatedValue", "Valor estimado"],
  ["lastContactAt", "Último contato"],
  ["proposalValidUntil", "Validade da proposta"],
  ["customerEventDate", "Data do evento do cliente"],
] as const;

function sortHelpText(sortBy: string, sortOrder: "asc" | "desc"): string {
  const ascending = sortOrder === "asc";
  switch (sortBy) {
    case "code":
      return ascending
        ? "Exemplo: OPP-2001 aparece antes de OPP-2002."
        : "Exemplo: OPP-2002 aparece antes de OPP-2001.";
    case "companyName":
      return ascending
        ? "Empresas em ordem alfabética: A–Z."
        : "Empresas em ordem alfabética inversa: Z–A.";
    case "stage":
      return ascending
        ? "Etapas do início para o fim do funil."
        : "Etapas do fim para o início do funil.";
    case "estimatedValue":
      return ascending
        ? "Menores valores estimados primeiro."
        : "Maiores valores estimados primeiro.";
    case "updatedAt":
      return ascending
        ? "Atualizadas há mais tempo primeiro."
        : "Atualizadas mais recentemente primeiro.";
    case "lastContactAt":
      return ascending
        ? "Último contato: data mais antiga primeiro."
        : "Último contato: data mais recente primeiro.";
    case "proposalValidUntil":
      return ascending
        ? "Validade da proposta: data mais antiga primeiro."
        : "Validade da proposta: data mais recente primeiro.";
    case "customerEventDate":
      return ascending
        ? "Evento do cliente: data mais antiga primeiro."
        : "Evento do cliente: data mais recente primeiro.";
    default:
      return ascending
        ? "Criadas há mais tempo primeiro."
        : "Criadas mais recentemente primeiro.";
  }
}

function sortDirectionLabels(sortBy: string) {
  switch (sortBy) {
    case "code":
      return { asc: "Menor código primeiro", desc: "Maior código primeiro" };
    case "companyName":
      return { asc: "A → Z", desc: "Z → A" };
    case "stage":
      return { asc: "Início do funil", desc: "Fim do funil" };
    case "estimatedValue":
      return { asc: "Menor valor primeiro", desc: "Maior valor primeiro" };
    case "createdAt":
    case "updatedAt":
    case "lastContactAt":
    case "proposalValidUntil":
    case "customerEventDate":
      return { asc: "Mais antiga primeiro", desc: "Mais recente primeiro" };
    default:
      return { asc: "Crescente", desc: "Decrescente" };
  }
}

export default function OpportunitiesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const filters = {
    page,
    search: search.trim(),
    stage: stage || undefined,
    salespersonId: salespersonId || undefined,
    sortBy,
    sortOrder,
  };
  const query = useQuery(opportunityListQuery(filters));
  const salespeople = useQuery(salespeopleQuery);
  const stageText = STAGES.find((item) => item.value === stage)?.label;
  const salespersonText = salespeople.data?.find(
    (person) => person.id === salespersonId,
  )?.name;
  const sortText = SORT_OPTIONS.find(([value]) => value === sortBy)?.[1];
  const sortDirections = sortDirectionLabels(sortBy);

  function resetPage(action: () => void) {
    action();
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Oportunidades"
        description="Encontre negociações, acompanhe seus próximos contatos e mantenha os dados comerciais atualizados."
        action={
          <Button
            nativeButton={false}
            render={<Link href="/opportunities/new" />}
          >
            <Plus className="mr-2 size-4" />
            Nova oportunidade
          </Button>
        }
      />
      <Card className="border-border/80 overflow-hidden rounded-xl shadow-sm">
        <div className="bg-muted/20 space-y-4 border-b px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Todas as oportunidades</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Busca, filtros e ordenação aplicados pela API comercial
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                <RefreshCw
                  className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`}
                />
                Atualizar
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <section className="border-border/70 bg-background/70 rounded-2xl border p-3 shadow-sm sm:p-4">
              <div className="mb-4">
                <h3 className="font-semibold">Buscar e filtrar</h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Procure por empresa ou código e refine por etapa e vendedor.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,2fr)_1fr_1fr]">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="opportunity-search">Empresa ou código</Label>
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    />
                    <Input
                      id="opportunity-search"
                      placeholder="Ex.: Padaria do Bairro ou OPP-2007"
                      className="pl-9"
                      value={search}
                      onChange={(event) =>
                        resetPage(() => setSearch(event.target.value))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="opportunity-stage-filter">Etapa</Label>
                  <Select
                    value={stage || "all"}
                    onValueChange={(value) =>
                      resetPage(() =>
                        setStage(!value || value === "all" ? "" : value),
                      )
                    }
                  >
                    <SelectTrigger
                      id="opportunity-stage-filter"
                      className="w-full"
                    >
                      <SelectValue>
                        {stageText ?? "Todas as etapas"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as etapas</SelectItem>
                      {STAGES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="opportunity-salesperson-filter">
                    Vendedor
                  </Label>
                  <Select
                    value={salespersonId || "all"}
                    onValueChange={(value) =>
                      resetPage(() =>
                        setSalespersonId(
                          !value || value === "all" ? "" : value,
                        ),
                      )
                    }
                  >
                    <SelectTrigger
                      id="opportunity-salesperson-filter"
                      className="w-full"
                    >
                      <SelectValue>
                        {salespersonText ?? "Todos os vendedores"}
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
                </div>
              </div>
            </section>

            <section className="border-border/70 bg-muted/20 rounded-2xl border p-3 sm:p-4">
              <div className="mb-4">
                <h3 className="font-semibold">Ordenar resultados</h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Escolha como colocar os resultados em sequência.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:max-w-2xl">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="opportunity-sort-field">
                    Informação para ordenar
                  </Label>
                  <Select
                    value={sortBy}
                    onValueChange={(value) =>
                      value && resetPage(() => setSortBy(value))
                    }
                  >
                    <SelectTrigger
                      id="opportunity-sort-field"
                      className="w-full"
                    >
                      <SelectValue>{sortText}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="opportunity-sort-direction">Sentido</Label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value) =>
                      resetPage(() => setSortOrder(value as "asc" | "desc"))
                    }
                  >
                    <SelectTrigger
                      id="opportunity-sort-direction"
                      className="w-full"
                    >
                      <SelectValue>
                        {sortOrder === "desc"
                          ? sortDirections.desc
                          : sortDirections.asc}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">{sortDirections.asc}</SelectItem>
                      <SelectItem value="desc">
                        {sortDirections.desc}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p
                id="opportunity-sort-explanation"
                className="text-muted-foreground mt-3 text-xs"
              >
                {sortHelpText(sortBy, sortOrder)}
              </p>
            </section>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {query.isPending ? (
            <LoadingState label="Buscando oportunidades na API…" />
          ) : query.isError ? (
            <ErrorState
              message={query.error.message}
              onRetry={() => void query.refetch()}
            />
          ) : query.data.data.length === 0 ? (
            <EmptyState
              title={
                filters.search || stage || salespersonId
                  ? "Nenhuma oportunidade encontrada"
                  : "Nenhuma oportunidade cadastrada"
              }
              description={
                filters.search || stage || salespersonId
                  ? "Ajuste a busca ou os filtros comerciais."
                  : "Cadastre uma oportunidade para começar."
              }
            />
          ) : (
            <>
              {query.isFetching && (
                <p role="status" className="text-muted-foreground mb-3 text-xs">
                  Atualizando resultados…
                </p>
              )}
              <div className="hidden overflow-x-auto md:block">
                <Table className="min-w-[1120px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[17%] px-3 py-4">
                        Oportunidade
                      </TableHead>
                      <TableHead className="w-[14%] px-3 py-4">Etapa</TableHead>
                      <TableHead className="w-[10%] px-3 py-4">Vendedor</TableHead>
                      <TableHead className="w-[12%] px-3 py-4">
                        Último contato
                      </TableHead>
                      <TableHead className="w-[25%] px-3 py-4">
                        Próximo follow-up
                      </TableHead>
                      <TableHead className="w-[12%] px-3 py-4 text-right">
                        Valor estimado
                      </TableHead>
                      <TableHead className="w-[10%] px-3 py-4 text-right">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.data.map((opportunity) => (
                      <OpportunityRow
                        key={opportunity.id}
                        opportunity={opportunity}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {query.data.data.map((opportunity) => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground">
                  {query.data.meta.total}{" "}
                  {query.data.meta.total === 1
                    ? "oportunidade"
                    : "oportunidades"}{" "}
                  · Página {query.data.meta.page} de{" "}
                  {Math.max(query.data.meta.totalPages, 1)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || query.isFetching}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      page >= query.data.meta.totalPages || query.isFetching
                    }
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Próxima
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </>
  );
}

function OpportunityRow({ opportunity }: { opportunity: Opportunity }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const deletion = useMutation({
    mutationFn: () => deleteOpportunity(opportunity.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opportunities,
      });
      toast.success(`${opportunity.code} excluída.`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a oportunidade.",
      ),
  });
  return (
    <>
      <TableRow className="hover:bg-muted/30">
        <TableCell className="px-3 py-4">
          <Link
            href={`/opportunities/${opportunity.id}`}
            className="font-medium hover:underline"
          >
            {opportunity.companyName}
          </Link>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {opportunity.code}
          </div>
        </TableCell>
        <TableCell className="px-3 py-4">
          <StageBadge stage={opportunity.stage} />
        </TableCell>
        <TableCell className="px-3 py-4">
          {opportunity.salesperson?.name ?? (
            <span className="text-muted-foreground">Sem vendedor</span>
          )}
        </TableCell>
        <TableCell className="px-3 py-4 tabular-nums">
          {formatDate(opportunity.lastContactAt)}
        </TableCell>
        <TableCell className="px-3 py-4">
          <FollowUpScheduleEditor
            key={`${opportunity.id}-${opportunity.version}`}
            opportunity={opportunity}
          />
        </TableCell>
        <TableCell className="px-3 py-4 text-right font-medium tabular-nums">
          {formatCurrency(opportunity.estimatedValue)}
        </TableCell>
        <TableCell className="px-3 py-4 text-right">
          <div className="bg-background inline-flex justify-end rounded-lg border p-0.5 shadow-sm">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Abrir ${opportunity.code}`}
              nativeButton={false}
              render={<Link href={`/opportunities/${opportunity.id}`} />}
            >
              <Eye className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="border-border border-l rounded-l-none"
              aria-label={`Editar ${opportunity.code}`}
              nativeButton={false}
              render={<Link href={`/opportunities/${opportunity.id}/edit`} />}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="border-border border-l rounded-l-none text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Excluir ${opportunity.code}`}
              onClick={() => setConfirm(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {opportunity.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              A exclusão é lógica. Os dados comerciais e os itens serão mantidos
              no sistema, mas esta oportunidade deixará de aparecer nas
              consultas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletion.isPending}
              onClick={(event) => {
                event.preventDefault();
                deletion.mutate();
                setConfirm(false);
              }}
            >
              {deletion.isPending ? "Excluindo…" : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const deletion = useMutation({
    mutationFn: () => deleteOpportunity(opportunity.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opportunities,
      });
      toast.success(`${opportunity.code} excluída.`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a oportunidade.",
      ),
  });
  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">{opportunity.code}</p>
          <Link
            href={`/opportunities/${opportunity.id}`}
            className="mt-0.5 block font-medium hover:underline"
          >
            {opportunity.companyName}
          </Link>
        </div>
        <StageBadge stage={opportunity.stage} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-y py-4 text-sm">
        <MobileDetail label="Vendedor">
          {opportunity.salesperson?.name ?? "Sem vendedor"}
        </MobileDetail>
        <MobileDetail label="Valor estimado">
          {formatCurrency(opportunity.estimatedValue)}
        </MobileDetail>
        <MobileDetail label="Último contato">
          {formatDate(opportunity.lastContactAt)}
        </MobileDetail>
        <div className="col-span-2">
          <p className="text-muted-foreground text-xs">Próximo follow-up</p>
          <div className="mt-1">
            <FollowUpScheduleEditor
              key={`${opportunity.id}-${opportunity.version}`}
              opportunity={opportunity}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/opportunities/${opportunity.id}`} />}
        >
          <Eye className="mr-1 size-4" />
          Abrir
        </Button>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/opportunities/${opportunity.id}/edit`} />}
        >
          <Pencil className="mr-1 size-4" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Excluir ${opportunity.code}`}
          onClick={() => setConfirm(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {opportunity.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              A exclusão é lógica. Os dados e itens serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletion.isPending}
              onClick={(event) => {
                event.preventDefault();
                deletion.mutate();
                setConfirm(false);
              }}
            >
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function FollowUpScheduleEditor({
  opportunity,
}: {
  opportunity: Opportunity;
}) {
  const queryClient = useQueryClient();
  const initialValue = opportunityToFormValues(opportunity).nextFollowUpAt;
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  const schedule = useMutation({
    mutationFn: (nextFollowUpAt: string | null) => {
      const values = opportunityToFormValues(opportunity);
      return updateOpportunity(
        opportunity.id,
        opportunity.version,
        toOpportunityPayload({ ...values, nextFollowUpAt: nextFollowUpAt ?? "" }),
      );
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.opportunities }),
        queryClient.setQueryData(queryKeys.opportunity(saved.id), saved),
      ]);
      setIsEditing(false);
      toast.success(
        saved.nextFollowUpAt
          ? "Próximo follow-up atualizado."
          : "Agendamento removido.",
      );
    },
    onError: (error) =>
      toast.error(
        formatConflictMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o próximo follow-up.",
        ),
      ),
  });

  function save() {
    if (!value) {
      toast.error("Informe data e hora ou use Remover agendamento.");
      return;
    }
    schedule.mutate(value);
  }

  if (isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          aria-label={`Próximo follow-up de ${opportunity.companyName}`}
          type="datetime-local"
          className="h-9 w-full min-w-[13.5rem] px-2.5 text-sm sm:w-[13.5rem]"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          disabled={schedule.isPending}
        />
        <Button
          size="sm"
          onClick={save}
          disabled={schedule.isPending}
          aria-label="Salvar próximo follow-up"
        >
          <Check className="size-3.5" />
          Salvar
        </Button>
        {opportunity.nextFollowUpAt && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => schedule.mutate(null)}
            disabled={schedule.isPending}
          >
            Remover
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Cancelar edição do próximo follow-up"
          onClick={() => {
            setValue(initialValue);
            setIsEditing(false);
          }}
          disabled={schedule.isPending}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={
          opportunity.nextFollowUpAt
            ? "font-medium tabular-nums"
            : "text-muted-foreground"
        }
      >
        {formatNextFollowUp(opportunity.nextFollowUpAt)}
      </span>
      <Button
        size="sm"
        variant="link"
        className="h-auto px-0 text-xs"
        onClick={() => setIsEditing(true)}
      >
        {opportunity.nextFollowUpAt ? "Alterar" : "Agendar retorno"}
      </Button>
    </div>
  );
}

function MobileDetail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/request-states";
import { BackLink } from "@/components/shared/back-link";
import { StageBadge } from "@/components/shared/stage-badge";
import { opportunityQuery, queryKeys } from "@/lib/api/queries";
import { deleteOpportunity } from "@/lib/api/opportunity-mutations";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNextFollowUp,
} from "@/lib/format";

export function OpportunityDetails({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const query = useQuery(opportunityQuery(id));
  const deletion = useMutation({
    mutationFn: () => deleteOpportunity(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opportunities,
      });
      await queryClient.removeQueries({ queryKey: queryKeys.opportunity(id) });
      toast.success("Oportunidade excluída.");
      router.push("/opportunities");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a oportunidade.",
      ),
  });

  if (query.isPending)
    return (
      <>
        <BackLink href="/opportunities" label="Voltar para oportunidades" />
        <LoadingState label="Carregando oportunidade…" />
      </>
    );
  if (query.isError)
    return (
      <>
        <BackLink href="/opportunities" label="Voltar para oportunidades" />
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      </>
    );
  const opportunity = query.data;
  const hasUnscheduledFollowUp =
    opportunity.stage === "FOLLOW_UP" && !opportunity.nextFollowUpAt;

  return (
    <>
      <BackLink href="/opportunities" label="Voltar para oportunidades" />
      <header className="mb-5 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-primary mb-1 text-xs font-semibold tracking-[0.16em] uppercase">
            Grupo Nobre · Comercial
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-[28px]">
              {opportunity.companyName}
            </h1>
            <StageBadge stage={opportunity.stage} />
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-foreground bg-muted rounded-md px-2 py-0.5 font-medium tabular-nums">
              {opportunity.code}
            </span>
            <span>Criada em {formatDateTime(opportunity.createdAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/opportunities/${id}/edit`} />}
          >
            <Pencil className="mr-2 size-4" />
            Editar
          </Button>
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 size-4" />
            Excluir
          </Button>
        </div>
      </header>

      <div className="grid items-start gap-5 pt-2 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="gap-0 p-0">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 id="opportunity-follow-up-title" className="font-semibold">
              Acompanhamento
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Datas importantes para conduzir esta negociação.
            </p>
          </div>
          <dl
            aria-labelledby="opportunity-follow-up-title"
            className="divide-y"
          >
            <Detail label="Próximo follow-up" highlight>
              {formatNextFollowUp(opportunity.nextFollowUpAt)}
            </Detail>
            <Detail label="Último contato">
              {formatDate(opportunity.lastContactAt)}
            </Detail>
            <Detail label="Validade da proposta">
              {formatDate(opportunity.proposalValidUntil)}
            </Detail>
            <Detail label="Evento do cliente">
              {formatDate(opportunity.customerEventDate)}
            </Detail>
            <Detail label="Última atualização">
              {formatDateTime(opportunity.updatedAt)}
            </Detail>
          </dl>
          {hasUnscheduledFollowUp && (
            <div
              role="status"
              className="border-primary/25 bg-primary/5 flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <p className="text-sm">
                Nenhum próximo contato foi agendado para esta oportunidade.
              </p>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/opportunities/${id}/edit#nextFollowUpAt`} />}
              >
                Agendar retorno
              </Button>
            </div>
          )}
          {opportunity.lossReason && (
            <div className="bg-muted/40 border-t px-5 py-4 sm:px-6">
              <p className="text-muted-foreground text-xs font-medium">
                Motivo de perda
              </p>
              <p className="mt-1 text-sm leading-relaxed">
                {opportunity.lossReason}
              </p>
            </div>
          )}
        </Card>

        <aside className="space-y-5">
          <Card className="gap-5 p-5">
            <div>
              <h2 className="font-semibold">Resumo comercial</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Responsável e valor da oportunidade.
              </p>
            </div>
            <dl className="space-y-5">
              <SummaryItem label="Vendedora responsável">
                {opportunity.salesperson?.name ?? "Sem vendedor"}
              </SummaryItem>
              <SummaryItem label="Valor estimado" prominent>
                {formatCurrency(opportunity.estimatedValue)}
              </SummaryItem>
            </dl>
          </Card>

          <Card className="gap-3 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 id="opportunity-items-title" className="font-semibold">
                  Itens de brinde
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Produtos desta oportunidade.
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                {opportunity.items.length}
              </span>
            </div>
            {opportunity.items.length === 0 ? (
              <EmptyState
                title="Sem itens cadastrados"
                description="Os itens da negociação aparecerão aqui quando forem informados."
              />
            ) : (
              <ul
                aria-labelledby="opportunity-items-title"
                className="divide-y"
              >
                {opportunity.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-0"
                  >
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                      {item.quantity.toLocaleString("pt-BR")} un.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {opportunity.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              A oportunidade ficará fora das consultas comuns. O código e os
              itens serão preservados para manter o histórico comercial.
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

function SummaryItem({
  label,
  children,
  prominent = false,
}: {
  label: string;
  children: React.ReactNode;
  prominent?: boolean;
}) {
  return (
    <div className={prominent ? "border-primary border-l-2 pl-4" : "min-w-0"}>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd
        className={`mt-1 truncate ${
          prominent
            ? "text-primary text-2xl font-semibold tracking-tight tabular-nums"
            : "text-base font-medium"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function Detail({
  label,
  children,
  highlight = false,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd
        className={`text-sm font-medium tabular-nums ${
          highlight ? "text-primary" : ""
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

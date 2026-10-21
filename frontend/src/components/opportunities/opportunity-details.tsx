"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ErrorState, LoadingState } from "@/components/shared/request-states";
import { BackLink } from "@/components/shared/back-link";
import { StageBadge } from "@/components/shared/stage-badge";
import { opportunityQuery, queryKeys } from "@/lib/api/queries";
import { deleteOpportunity } from "@/lib/api/opportunity-mutations";
import {
  getInternalReturnTo,
  getOpportunityBackLabel,
  withReturnTo,
} from "@/lib/navigation";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNextFollowUp,
} from "@/lib/format";
import { OpportunityCommercialHistory } from "@/components/opportunities/opportunity-commercial-history";

export function OpportunityDetails({
  id,
  returnTo: requestedReturnTo,
}: {
  id: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const returnTo = getInternalReturnTo(requestedReturnTo);
  const backLabel = getOpportunityBackLabel(returnTo);
  const editHref = withReturnTo(
    `/opportunities/${id}/edit`,
    `/opportunities/${id}?returnTo=${encodeURIComponent(returnTo)}`,
  );
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
        <BackLink href={returnTo} label={backLabel} />
        <LoadingState label="Carregando oportunidade…" />
      </>
    );
  if (query.isError)
    return (
      <>
        <BackLink href={returnTo} label={backLabel} />
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
      <BackLink
        href={returnTo}
        label={getOpportunityBackLabel(returnTo, query.data.companyName)}
      />
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
            render={
              <Link
                href={`/pipeline?search=${encodeURIComponent(opportunity.code)}`}
              />
            }
          >
            Acompanhar na pipeline <ArrowRight aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={editHref} />}
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

      <section aria-label="Resumo da oportunidade">
        <dl className="grid gap-6 sm:grid-cols-3">
          <SummaryItem label="Valor estimado" prominent>
            {formatCurrency(opportunity.estimatedValue)}
          </SummaryItem>
          <SummaryItem label="Vendedora responsável">
            {opportunity.salesperson?.name ?? "Sem vendedor"}
          </SummaryItem>
          <SummaryItem label="Próximo follow-up" highlight>
            {formatNextFollowUp(opportunity.nextFollowUpAt)}
          </SummaryItem>
        </dl>
      </section>
      <OpportunityCommercialHistory
        opportunityId={opportunity.id}
        aside={
          <>
            <section aria-labelledby="opportunity-items-title">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <h2 id="opportunity-items-title" className="font-semibold">
                    Itens da oportunidade
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Produtos incluídos na negociação.
                  </p>
                </div>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {opportunity.items.length}
                </span>
              </div>
              {opportunity.items.length === 0 ? (
                <p className="text-muted-foreground mt-4 text-sm">
                  Nenhum item informado.
                </p>
              ) : (
                <ul className="mt-3 divide-y">
                  {opportunity.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-4 py-2.5"
                    >
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {item.quantity.toLocaleString("pt-BR")} un.
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section
              className="border-t pt-5"
              aria-labelledby="opportunity-dates-title"
            >
              <h2 id="opportunity-dates-title" className="font-semibold">
                Datas comerciais
              </h2>
              <dl className="mt-3 space-y-3">
                <Detail label="Último contato">
                  {formatDate(opportunity.lastContactAt)}
                </Detail>
                <Detail label="Validade da proposta">
                  {formatDate(opportunity.proposalValidUntil)}
                </Detail>
                <Detail label="Evento do cliente">
                  {formatDate(opportunity.customerEventDate)}
                </Detail>
                <Detail label="Atualizada em">
                  {formatDateTime(opportunity.updatedAt)}
                </Detail>
              </dl>
              {hasUnscheduledFollowUp && (
                <div role="status" className="bg-primary/5 mt-4 rounded-lg p-3">
                  <p className="text-sm">
                    Nenhum próximo contato foi agendado.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    nativeButton={false}
                    render={<Link href={`${editHref}#nextFollowUpAt`} />}
                  >
                    Agendar retorno
                  </Button>
                </div>
              )}
              {opportunity.lossReason && (
                <div className="bg-muted/40 mt-4 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    Motivo de perda
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {opportunity.lossReason}
                  </p>
                </div>
              )}
            </section>
          </>
        }
      />
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
  highlight = false,
}: {
  label: string;
  children: React.ReactNode;
  prominent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd
        className={`mt-1 truncate ${
          prominent
            ? "text-primary text-2xl font-semibold tracking-tight tabular-nums"
            : highlight
              ? "text-primary text-base font-semibold"
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
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
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

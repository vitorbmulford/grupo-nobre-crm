"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { opportunityListQuery } from "@/lib/api/queries";
import { formatCurrency, formatDate } from "@/lib/format";

export default function OpportunitiesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useQuery(opportunityListQuery(page, search.trim()));

  return (
    <>
      <PageHeader
        title="Oportunidades"
        description="Acompanhe negociações ativas e encontre rapidamente o próximo contato comercial."
      />
      <Card className="border-border/80 overflow-hidden rounded-xl shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold">Todas as oportunidades</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Dados atualizados diretamente pela API comercial
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              aria-label="Buscar por empresa ou código"
              placeholder="Buscar empresa ou código…"
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
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
                search
                  ? "Nenhuma oportunidade encontrada"
                  : "Nenhuma oportunidade cadastrada"
              }
              description={
                search
                  ? "Tente outro nome de empresa ou código comercial."
                  : "Quando houver oportunidades ativas na API, elas aparecerão aqui."
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Oportunidade</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Último contato</TableHead>
                      <TableHead className="text-right">
                        Valor estimado
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.data.map((opportunity) => (
                      <TableRow
                        key={opportunity.id}
                        className="hover:bg-muted/30"
                      >
                        <TableCell>
                          <div className="font-medium">
                            {opportunity.companyName}
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-xs">
                            {opportunity.code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StageBadge stage={opportunity.stage} />
                        </TableCell>
                        <TableCell>
                          {opportunity.salesperson?.name ?? (
                            <span className="text-muted-foreground">
                              Sem vendedor
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDate(opportunity.lastContactAt)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(opportunity.estimatedValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {query.data.data.map((opportunity) => (
                  <article
                    key={opportunity.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {opportunity.code}
                        </p>
                        <h3 className="mt-0.5 font-medium">
                          {opportunity.companyName}
                        </h3>
                      </div>
                      <StageBadge stage={opportunity.stage} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Vendedor
                        </p>
                        <p className="mt-1">
                          {opportunity.salesperson?.name ?? "Sem vendedor"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Último contato
                        </p>
                        <p className="mt-1">
                          {formatDate(opportunity.lastContactAt)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">
                          Valor estimado
                        </p>
                        <p className="mt-1 font-semibold tabular-nums">
                          {formatCurrency(opportunity.estimatedValue)}
                        </p>
                      </div>
                    </div>
                  </article>
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

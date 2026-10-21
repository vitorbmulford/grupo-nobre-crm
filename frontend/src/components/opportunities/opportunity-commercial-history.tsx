"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CircleX,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  createActivity,
  invalidateAfterActivity,
} from "@/lib/api/activity-mutations";
import {
  activityFormSchema,
  type ActivityFormValues,
} from "@/lib/activity-form";
import {
  opportunityActivitiesQuery,
  opportunityHistoryQuery,
} from "@/lib/api/queries";
import { formatDateTime } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/constants/stages";
import type { Activity, ActivityType, StageTransition } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, LoadingState } from "@/components/shared/request-states";

const TYPES: { value: ActivityType; label: string }[] = [
  { value: "CALL", label: "Ligação" },
  { value: "EMAIL", label: "E-mail" },
  { value: "MEETING", label: "Reunião" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "OTHER", label: "Outra interação" },
];
const TYPE_LABELS = Object.fromEntries(
  TYPES.map((item) => [item.value, item.label]),
) as Record<ActivityType, string>;
const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: UsersRound,
  WHATSAPP: MessageCircle,
  OTHER: MoreHorizontal,
};

function localDateTimeValue() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function OpportunityCommercialHistory({
  opportunityId,
  aside,
}: {
  opportunityId: string;
  aside?: React.ReactNode;
}) {
  const client = useQueryClient();
  const history = useQuery(opportunityHistoryQuery(opportunityId));
  const activities = useInfiniteQuery(
    opportunityActivitiesQuery(opportunityId),
  );
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: "CALL",
      description: "",
      occurredAt: localDateTimeValue(),
    },
  });
  const create = useMutation({
    mutationFn: (values: ActivityFormValues) =>
      createActivity(opportunityId, values),
    onSuccess: async () => {
      await invalidateAfterActivity(client, opportunityId);
      form.reset({
        type: "CALL",
        description: "",
        occurredAt: localDateTimeValue(),
      });
      toast.success("Atividade registrada.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a atividade.",
      ),
  });
  const timeline = [
    ...(history.data ?? []).map((transition) => ({
      kind: "transition" as const,
      id: transition.id,
      occurredAt: transition.changedAt,
      transition,
    })),
    ...(activities.data?.pages.flatMap((page) => page.data) ?? []).map(
      (activity) => ({
        kind: "activity" as const,
        id: activity.id,
        occurredAt: activity.occurredAt,
        activity,
      }),
    ),
  ].sort(
    (first, second) =>
      new Date(second.occurredAt).getTime() -
      new Date(first.occurredAt).getTime(),
  );
  const isLoading = history.isPending || activities.isPending;
  const error = history.isError ? history.error : activities.error;

  return (
    <section
      className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]"
      aria-label="Histórico comercial"
    >
      <div className="lg:col-start-2">
        <div className="flex items-end justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Histórico comercial
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Etapas e contatos em uma única linha do tempo.
            </p>
          </div>
          {!isLoading && (
            <span className="text-muted-foreground text-sm tabular-nums">
              {timeline.length}
            </span>
          )}
        </div>
        <div className="pt-5">
          {isLoading ? (
            <LoadingState label="Carregando histórico…" />
          ) : error ? (
            <ErrorState
              message={error.message}
              onRetry={() => {
                void history.refetch();
                void activities.refetch();
              }}
            />
          ) : timeline.length === 0 ? (
            <div className="text-muted-foreground flex items-center gap-3 py-8 text-sm">
              <span className="bg-muted flex size-9 items-center justify-center rounded-full">
                —
              </span>
              <p>Nenhuma movimentação ou atividade registrada ainda.</p>
            </div>
          ) : (
            <ol className="divide-y" aria-label="Histórico comercial">
              {timeline.map((entry) =>
                entry.kind === "transition" ? (
                  <Transition
                    key={`transition-${entry.id}`}
                    item={entry.transition}
                  />
                ) : (
                  <ActivityEntry
                    key={`activity-${entry.id}`}
                    item={entry.activity}
                  />
                ),
              )}
            </ol>
          )}
          {activities.hasNextPage && (
            <Button
              className="mt-5"
              variant="outline"
              disabled={activities.isFetchingNextPage}
              onClick={() => void activities.fetchNextPage()}
            >
              {activities.isFetchingNextPage
                ? "Carregando…"
                : "Carregar atividades anteriores"}
            </Button>
          )}
        </div>
      </div>
      <aside className="border-t pt-6 lg:sticky lg:top-6 lg:col-start-1 lg:row-start-1 lg:border-t-0 lg:border-r lg:border-l-0 lg:pt-0 lg:pr-8 lg:pl-0">
        <div className="space-y-5">{aside}</div>
        <section
          className="mt-6 border-t pt-5"
          aria-labelledby="activity-form-title"
        >
          <h2 id="activity-form-title" className="font-semibold">
            Registrar interação
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Adicione um contato realizado com o cliente.
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="activity-type">Tipo</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => value && field.onChange(value)}
                    >
                      <SelectTrigger id="activity-type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.type && (
                  <p role="alert" className="text-destructive text-sm">
                    {form.formState.errors.type.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-occurred-at">Data e hora</Label>
                <Input
                  id="activity-occurred-at"
                  type="datetime-local"
                  max={localDateTimeValue()}
                  {...form.register("occurredAt")}
                  aria-invalid={!!form.formState.errors.occurredAt}
                />
                {form.formState.errors.occurredAt && (
                  <p role="alert" className="text-destructive text-sm">
                    {form.formState.errors.occurredAt.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-description">Descrição</Label>
              <Textarea
                id="activity-description"
                maxLength={2000}
                {...form.register("description")}
                aria-invalid={!!form.formState.errors.description}
                placeholder="O que foi conversado ou combinado?"
              />
              {form.formState.errors.description && (
                <p role="alert" className="text-destructive text-sm">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={create.isPending}>
              <Plus className="size-4" />
              {create.isPending ? "Registrando…" : "Registrar atividade"}
            </Button>
          </form>
        </section>
      </aside>
    </section>
  );
}

function Transition({ item }: { item: StageTransition }) {
  const closed = item.toStage === "FECHAMENTO";
  const lost = item.toStage === "PERDIDA";
  const stages = Object.keys(STAGE_LABELS);
  const fromIndex = item.fromStage ? stages.indexOf(item.fromStage) : -1;
  const toIndex = stages.indexOf(item.toStage);
  const backwards = !closed && !lost && fromIndex >= 0 && toIndex < fromIndex;
  const Icon = closed
    ? Check
    : lost
      ? CircleX
      : backwards
        ? ArrowDownRight
        : ArrowUpRight;
  const color = closed
    ? "text-emerald-600"
    : lost
      ? "text-destructive"
      : backwards
        ? "text-amber-600"
        : "text-primary";
  return (
    <li className="relative py-4 pl-8">
      <span
        className={`bg-primary/5 absolute top-4 left-0 flex size-6 items-center justify-center rounded-full border ${color}`}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-primary text-[10px] font-semibold tracking-[0.12em] uppercase">
          Pipeline
        </span>
        <time
          className="text-muted-foreground text-xs"
          dateTime={item.changedAt}
        >
          {formatDateTime(item.changedAt)}
        </time>
      </div>
      <p className="mt-1 text-sm font-medium">
        {item.fromStage ? STAGE_LABELS[item.fromStage] : "Etapa inicial"}{" "}
        <span aria-hidden="true">→</span> {STAGE_LABELS[item.toStage]}
      </p>
      {item.reason && (
        <p className="text-muted-foreground mt-1 text-sm">{item.reason}</p>
      )}
    </li>
  );
}

function ActivityEntry({ item }: { item: Activity }) {
  const Icon = ACTIVITY_ICONS[item.type];
  return (
    <li className="relative py-4 pl-8">
      <span className="absolute top-4 left-0 flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-emerald-700 uppercase dark:text-emerald-400">
          Interação
        </span>
        <time
          className="text-muted-foreground text-xs"
          dateTime={item.occurredAt}
        >
          {formatDateTime(item.occurredAt)}
        </time>
      </div>
      <p className="mt-1 text-sm font-medium">{TYPE_LABELS[item.type]}</p>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        {item.description}
      </p>
    </li>
  );
}

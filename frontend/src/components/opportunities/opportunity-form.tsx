"use client";

import { useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { BackLink } from "@/components/shared/back-link";
import { ErrorState, LoadingState } from "@/components/shared/request-states";
import { PageHeader } from "@/components/shared/page-header";
import { ApiError } from "@/lib/api/client";
import {
  opportunityQuery,
  queryKeys,
  salespeopleQuery,
} from "@/lib/api/queries";
import {
  createOpportunity,
  updateOpportunity,
} from "@/lib/api/opportunity-mutations";
import { getInternalReturnTo, getOpportunityBackLabel } from "@/lib/navigation";
import {
  ESTIMATED_VALUE_INPUT_PATTERN,
  formatConflictMessage,
  opportunityFormSchema,
  opportunityToFormValues,
  formatContactPhoneInput,
  sanitizeContactNameInput,
  sanitizeLocationInput,
  sanitizeEstimatedValueInput,
  sanitizeQuantityInput,
  toOpportunityPayload,
  type OpportunityFormValues,
} from "@/lib/opportunity-form";

export function OpportunityForm({
  opportunityId,
  returnTo: requestedReturnTo,
}: {
  opportunityId?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const detail = useQuery({
    ...opportunityQuery(opportunityId ?? ""),
    enabled: Boolean(opportunityId),
  });
  const salespeople = useQuery(salespeopleQuery);
  const opportunity = detail.data;
  const [version, setVersion] = useState(opportunity?.version);
  const [conflict, setConflict] = useState(false);
  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
    values: opportunityToFormValues(opportunity),
    mode: "onBlur",
  });
  const estimatedValueField = form.register("estimatedValue");
  const contactNameField = form.register("contactName");
  const contactPhoneField = form.register("contactPhone");
  const companyNameLength = useWatch({
    control: form.control,
    name: "companyName",
  }).length;
  const lossReasonLength = useWatch({
    control: form.control,
    name: "lossReason",
  }).length;
  const contactNameLength = useWatch({
    control: form.control,
    name: "contactName",
  }).length;
  const contactPhoneLength = useWatch({
    control: form.control,
    name: "contactPhone",
  }).length;
  const contactEmailLength = useWatch({
    control: form.control,
    name: "contactEmail",
  }).length;
  const companyWebsiteLength = useWatch({
    control: form.control,
    name: "companyWebsite",
  }).length;
  const companyLocationLength = useWatch({
    control: form.control,
    name: "companyLocation",
  }).length;
  const companyDescriptionLength = useWatch({
    control: form.control,
    name: "companyDescription",
  }).length;
  const watchedItems = useWatch({ control: form.control, name: "items" });
  const selectedSalesperson = useWatch({
    control: form.control,
    name: "salespersonId",
  });
  const selectedSalespersonName = salespeople.data?.find(
    (person) => person.id === selectedSalesperson,
  )?.name;
  const items = useFieldArray({ control: form.control, name: "items" });

  const mutation = useMutation({
    mutationFn: async (values: OpportunityFormValues) => {
      const payload = toOpportunityPayload(values);
      if (!opportunityId) return createOpportunity(payload);
      return updateOpportunity(
        opportunityId,
        version ?? opportunity?.version ?? 0,
        payload,
      );
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opportunities,
      });
      await queryClient.setQueryData(queryKeys.opportunity(saved.id), saved);
      toast.success(
        opportunityId ? "Oportunidade atualizada." : "Oportunidade criada.",
      );
      router.push(`/opportunities/${saved.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) setConflict(true);
      toast.error(
        formatConflictMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a oportunidade.",
        ),
      );
    },
  });

  async function reloadLatest() {
    if (!opportunityId) return;
    const latest = await queryClient.fetchQuery({
      ...opportunityQuery(opportunityId),
      staleTime: 0,
    });
    setVersion(latest.version);
    form.reset(opportunityToFormValues(latest));
    setConflict(false);
    toast.info(
      "Dados atuais carregados. Revise e aplique suas alterações novamente.",
    );
  }

  const backHref = getInternalReturnTo(requestedReturnTo);
  const backLabel = getOpportunityBackLabel(backHref, opportunity?.companyName);

  if (opportunityId && detail.isPending)
    return (
      <>
        <BackLink href={backHref} label={backLabel} />
        <LoadingState label="Carregando oportunidade…" />
      </>
    );
  if (opportunityId && detail.isError)
    return (
      <>
        <BackLink href={backHref} label={backLabel} />
        <ErrorState
          message={detail.error.message}
          onRetry={() => void detail.refetch()}
        />
      </>
    );
  if (salespeople.isPending)
    return (
      <>
        <BackLink href={backHref} label={backLabel} />
        <LoadingState label="Carregando vendedores…" />
      </>
    );
  if (salespeople.isError)
    return (
      <>
        <BackLink href={backHref} label={backLabel} />
        <ErrorState
          message={salespeople.error.message}
          onRetry={() => void salespeople.refetch()}
        />
      </>
    );

  const fieldError = (name: keyof OpportunityFormValues) =>
    form.formState.errors[name]?.message as string | undefined;

  return (
    <>
      <BackLink href={backHref} label={backLabel} />
      <PageHeader
        title={opportunityId ? "Editar oportunidade" : "Nova oportunidade"}
        description={
          opportunityId
            ? "Atualize os dados comerciais. A etapa do funil é controlada pela API de transições."
            : "Registre uma negociação comercial e organize os próximos contatos."
        }
      />
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-5"
      >
        {conflict && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p>
              Outra pessoa salvou alterações nesta oportunidade. Seus dados não
              foram enviados por cima da versão atual.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void reloadLatest()}
            >
              <RefreshCw className="mr-2 size-4" />
              Carregar versão atual
            </Button>
          </div>
        )}

        <Card className="space-y-5 p-4 sm:p-6">
          <div>
            <h2 className="font-semibold">Dados comerciais</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Campos opcionais podem ficar em branco.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="companyName"
              label="Empresa *"
              error={fieldError("companyName")}
              characterCount={{ current: companyNameLength, max: 240 }}
              className="sm:col-span-2"
            >
              <Input
                id="companyName"
                maxLength={240}
                aria-invalid={Boolean(fieldError("companyName"))}
                {...form.register("companyName")}
              />
            </Field>
            <Field
              id="estimatedValue"
              label="Valor estimado (R$)"
              error={fieldError("estimatedValue")}
              hint="Os milhares são separados automaticamente. Use vírgula para os centavos."
            >
              <Input
                id="estimatedValue"
                type="text"
                inputMode="decimal"
                maxLength={18}
                pattern={ESTIMATED_VALUE_INPUT_PATTERN}
                placeholder="Ex.: 4500,00"
                aria-invalid={Boolean(fieldError("estimatedValue"))}
                {...estimatedValueField}
                onChange={(event) => {
                  const input = event.currentTarget;
                  const previousValue = input.value;
                  const selection =
                    input.selectionStart ?? previousValue.length;
                  const prefix = previousValue.slice(0, selection);
                  const decimalIndex = prefix.lastIndexOf(",");
                  const formattedValue =
                    sanitizeEstimatedValueInput(previousValue);
                  input.value = formattedValue;
                  const formattedDecimalIndex = formattedValue.indexOf(",");
                  const nextCaret =
                    decimalIndex >= 0 && formattedDecimalIndex >= 0
                      ? formattedDecimalIndex +
                        1 +
                        prefix.slice(decimalIndex + 1).replace(/\D/g, "").length
                      : caretAfterDigits(
                          formattedValue,
                          prefix.replace(/\D/g, "").length,
                        );
                  input.setSelectionRange(nextCaret, nextCaret);
                  void estimatedValueField.onChange(event);
                }}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <Label htmlFor="salespersonId">Vendedor</Label>
              <Select
                value={selectedSalesperson || "none"}
                onValueChange={(value) =>
                  form.setValue(
                    "salespersonId",
                    !value || value === "none" ? "" : value,
                    {
                      shouldDirty: true,
                    },
                  )
                }
              >
                <SelectTrigger id="salespersonId" className="w-full">
                  <SelectValue>
                    {selectedSalespersonName ?? "Sem vendedor"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vendedor</SelectItem>
                  {salespeople.data?.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateField
              id="lastContactAt"
              label="Último contato"
              register={form.register("lastContactAt")}
              error={fieldError("lastContactAt")}
            />
            <DateField
              id="proposalValidUntil"
              label="Validade da proposta"
              register={form.register("proposalValidUntil")}
              error={fieldError("proposalValidUntil")}
            />
            <DateField
              id="customerEventDate"
              label="Data do evento do cliente"
              register={form.register("customerEventDate")}
              error={fieldError("customerEventDate")}
            />
            <Field
              id="nextFollowUpAt"
              label="Próximo follow-up"
              error={fieldError("nextFollowUpAt")}
            >
              <Input
                id="nextFollowUpAt"
                type="datetime-local"
                aria-invalid={Boolean(fieldError("nextFollowUpAt"))}
                {...form.register("nextFollowUpAt")}
              />
            </Field>
            <Field
              id="lossReason"
              label="Motivo de perda"
              error={fieldError("lossReason")}
              characterCount={{ current: lossReasonLength, max: 1000 }}
              className="sm:col-span-2"
            >
              <Textarea
                id="lossReason"
                maxLength={1000}
                {...form.register("lossReason")}
              />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="font-semibold">Informações do cliente</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Opcional. Registre apenas o que for útil para acompanhar este
              cliente.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="contactName"
              label="Pessoa de contato"
              error={fieldError("contactName")}
              characterCount={{ current: contactNameLength, max: 160 }}
            >
              <Input
                id="contactName"
                placeholder="Ex.: Mariana Souza"
                maxLength={160}
                aria-invalid={Boolean(fieldError("contactName"))}
                {...contactNameField}
                onChange={(event) => {
                  event.currentTarget.value = sanitizeContactNameInput(
                    event.currentTarget.value,
                  );
                  void contactNameField.onChange(event);
                }}
              />
            </Field>
            <Field
              id="contactPhone"
              label="Telefone / WhatsApp"
              error={fieldError("contactPhone")}
              characterCount={{ current: contactPhoneLength, max: 30 }}
            >
              <Input
                id="contactPhone"
                type="tel"
                placeholder="Ex.: (11) 99999-0000"
                maxLength={30}
                aria-invalid={Boolean(fieldError("contactPhone"))}
                {...contactPhoneField}
                onChange={(event) => {
                  event.currentTarget.value = formatContactPhoneInput(
                    event.currentTarget.value,
                  );
                  void contactPhoneField.onChange(event);
                }}
              />
            </Field>
            <Field
              id="contactEmail"
              label="E-mail de contato"
              error={fieldError("contactEmail")}
              characterCount={{ current: contactEmailLength, max: 254 }}
            >
              <Input
                id="contactEmail"
                type="email"
                placeholder="Ex.: contato@empresa.com.br"
                maxLength={254}
                aria-invalid={Boolean(fieldError("contactEmail"))}
                {...form.register("contactEmail")}
              />
            </Field>
            <Field
              id="companyWebsite"
              label="Site da empresa"
              error={fieldError("companyWebsite")}
              hint="Pode informar com ou sem https://."
              characterCount={{ current: companyWebsiteLength, max: 2048 }}
            >
              <Input
                id="companyWebsite"
                type="text"
                inputMode="url"
                placeholder="Ex.: www.empresa.com.br"
                maxLength={2048}
                aria-invalid={Boolean(fieldError("companyWebsite"))}
                {...form.register("companyWebsite")}
              />
            </Field>
            <Field
              id="companyLocation"
              label="Cidade / Estado"
              error={fieldError("companyLocation")}
              characterCount={{ current: companyLocationLength, max: 240 }}
            >
              <Input
                id="companyLocation"
                placeholder="Ex.: São Paulo, SP"
                maxLength={240}
                aria-invalid={Boolean(fieldError("companyLocation"))}
                {...form.register("companyLocation", {
                  onChange: (event) => {
                    event.currentTarget.value = sanitizeLocationInput(
                      event.currentTarget.value,
                    );
                  },
                })}
              />
            </Field>
            <Field
              id="companyDescription"
              label="Sobre a empresa"
              characterCount={{ current: companyDescriptionLength, max: 2000 }}
              className="sm:col-span-2"
            >
              <Textarea
                id="companyDescription"
                placeholder="Segmento, produtos, serviços ou observações sobre o negócio."
                maxLength={2000}
                rows={3}
                {...form.register("companyDescription")}
              />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Itens de brinde</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Adicione os itens e quantidades desta oportunidade.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => items.append({ name: "", quantity: "" })}
            >
              <Plus className="mr-2 size-4" />
              Adicionar item
            </Button>
          </div>
          {items.fields.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              Nenhum item informado.
            </p>
          ) : (
            items.fields.map((item, index) => {
              const itemNameLength = watchedItems[index]?.name.length ?? 0;
              const nameError =
                form.formState.errors.items?.[index]?.name?.message;
              const quantityError =
                form.formState.errors.items?.[index]?.quantity?.message;
              const quantityField = form.register(`items.${index}.quantity`);
              return (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
                >
                  <Field
                    id={`item-${index}-name`}
                    label={`Item ${index + 1}`}
                    error={nameError}
                    characterCount={{ current: itemNameLength, max: 240 }}
                  >
                    <Input
                      id={`item-${index}-name`}
                      maxLength={240}
                      aria-invalid={Boolean(nameError)}
                      {...form.register(`items.${index}.name`)}
                    />
                  </Field>
                  <Field
                    id={`item-${index}-quantity`}
                    label="Quantidade"
                    error={quantityError}
                    characterCount={{
                      current: watchedItems[index]?.quantity.length ?? 0,
                      max: 10,
                    }}
                  >
                    <Input
                      id={`item-${index}-quantity`}
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{1,10}"
                      aria-invalid={Boolean(quantityError)}
                      {...quantityField}
                      onChange={(event) => {
                        event.currentTarget.value = sanitizeQuantityInput(
                          event.currentTarget.value,
                        );
                        void quantityField.onChange(event);
                      }}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover item ${index + 1}`}
                    onClick={() => items.remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })
          )}
        </Card>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? "Salvando…"
              : opportunityId
                ? "Salvar alterações"
                : "Criar oportunidade"}
          </Button>
        </div>
      </form>
    </>
  );
}

function caretAfterDigits(value: string, digitCount: number): number {
  if (digitCount === 0) return 0;
  let seenDigits = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) seenDigits += 1;
    if (seenDigits === digitCount) return index + 1;
  }
  return value.length;
}

function Field({
  id,
  label,
  error,
  hint,
  characterCount,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  characterCount?: { current: number; max: number };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {characterCount && (
          <span
            className="text-muted-foreground text-xs tabular-nums"
            aria-live="polite"
          >
            {characterCount.current}/{characterCount.max}
          </span>
        )}
      </div>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DateField({
  id,
  label,
  register,
  error,
}: {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <Field id={id} label={label} error={error}>
      <Input id={id} type="date" aria-invalid={Boolean(error)} {...register} />
    </Field>
  );
}

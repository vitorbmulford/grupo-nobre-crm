import { z } from "zod";
import type { Opportunity, Salesperson } from "@/types/api";

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

const optionalDate = z
  .string()
  .refine(
    (value) => value === "" || isCalendarDate(value),
    "Informe uma data válida.",
  );

const optionalDateTime = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
        isCalendarDate(value.slice(0, 10)) &&
        Number(value.slice(11, 13)) <= 23 &&
        Number(value.slice(14, 16)) <= 59),
    "Informe uma data e hora válidas.",
  );

const MAX_ITEM_QUANTITY = 2_147_483_647;
const ESTIMATED_VALUE_PATTERN =
  /^(?:\d{1,12}|\d{1,3}(?:\.\d{3}){1,3})(?:,\d{1,2})?$/;
const itemSchema = z.object({ name: z.string(), quantity: z.string() });

export const opportunityFormSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(1, "Informe o nome da empresa.")
      .max(240, "Use até 240 caracteres."),
    estimatedValue: z.string().refine((value) => {
      if (!value.trim()) return true;
      return ESTIMATED_VALUE_PATTERN.test(value.trim());
    }, "Informe um valor com até 12 dígitos e 2 casas decimais."),
    lastContactAt: optionalDate,
    proposalValidUntil: optionalDate,
    customerEventDate: optionalDate,
    nextFollowUpAt: optionalDateTime,
    lossReason: z.string().max(1000, "Use até 1000 caracteres."),
    salespersonId: z.string(),
    items: z.array(itemSchema),
  })
  .superRefine(({ items }, context) => {
    items.forEach((item, index) => {
      const name = item.name.trim();
      const quantity = item.quantity.trim();
      if (!name && !quantity) return;
      if (!name) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "name"],
          message: "Informe o nome do item.",
        });
      } else if (name.length > 240) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "name"],
          message: "Use até 240 caracteres.",
        });
      }
      if (
        !/^\d{1,10}$/.test(quantity) ||
        Number(quantity) < 1 ||
        Number(quantity) > MAX_ITEM_QUANTITY
      ) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "quantity"],
          message: "Informe um inteiro entre 1 e 2.147.483.647.",
        });
      }
    });
  });

export function sanitizeEstimatedValueInput(value: string): string {
  const allowed = value.replace(/[^\d.,]/g, "");
  const commaIndex = allowed.lastIndexOf(",");
  let integerDigits: string;
  let fraction = "";
  let hasDecimalSeparator = commaIndex >= 0;

  if (hasDecimalSeparator) {
    integerDigits = allowed.slice(0, commaIndex).replace(/\D/g, "");
    fraction = allowed
      .slice(commaIndex + 1)
      .replace(/\D/g, "")
      .slice(0, 2);
  } else {
    const isGroupedInteger = /^\d{1,3}(?:\.\d{3}){1,3}$/.test(allowed);
    const dotIndex = allowed.lastIndexOf(".");
    const dotFraction = allowed.slice(dotIndex + 1);
    const isDecimalDot =
      dotIndex >= 0 &&
      !isGroupedInteger &&
      /^\d{0,2}$/.test(dotFraction) &&
      allowed.slice(0, dotIndex).replace(/\D/g, "").length > 0;

    if (isDecimalDot) {
      integerDigits = allowed.slice(0, dotIndex).replace(/\D/g, "");
      fraction = dotFraction.replace(/\D/g, "").slice(0, 2);
      hasDecimalSeparator = true;
    } else {
      integerDigits = allowed.replace(/\D/g, "");
    }
  }

  const integer = integerDigits.slice(0, 12).replace(/^0+(?=\d)/, "");
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${groupedInteger || (hasDecimalSeparator ? "0" : "")}${
    hasDecimalSeparator ? `,${fraction}` : ""
  }`;
}

function formatApiEstimatedValue(value: string | null): string {
  if (!value) return "";
  const [whole = "", decimal = ""] = value.split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal ? `${groupedInteger},${decimal.slice(0, 2)}` : groupedInteger;
}

export function sanitizeQuantityInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;

export type OpportunityPayload = {
  companyName: string;
  estimatedValue: string | null;
  lastContactAt: string | null;
  proposalValidUntil: string | null;
  customerEventDate: string | null;
  nextFollowUpAt: string | null;
  lossReason: string | null;
  salespersonId: string | null;
  items: { name: string; quantity: number }[];
};

export function toOpportunityPayload(
  values: OpportunityFormValues,
): OpportunityPayload {
  const value = values.estimatedValue
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
  return {
    companyName: values.companyName.trim(),
    estimatedValue: value || null,
    lastContactAt: values.lastContactAt || null,
    proposalValidUntil: values.proposalValidUntil || null,
    customerEventDate: values.customerEventDate || null,
    nextFollowUpAt: values.nextFollowUpAt
      ? new Date(values.nextFollowUpAt).toISOString()
      : null,
    lossReason: values.lossReason.trim() || null,
    salespersonId: values.salespersonId || null,
    items: values.items
      .filter((item) => item.name.trim() && item.quantity.trim())
      .map((item) => ({
        name: item.name.trim(),
        quantity: Number(item.quantity),
      })),
  };
}

function dateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function opportunityToFormValues(
  opportunity?: Opportunity,
): OpportunityFormValues {
  return {
    companyName: opportunity?.companyName ?? "",
    estimatedValue: formatApiEstimatedValue(
      opportunity?.estimatedValue ?? null,
    ),
    lastContactAt: opportunity?.lastContactAt ?? "",
    proposalValidUntil: opportunity?.proposalValidUntil ?? "",
    customerEventDate: opportunity?.customerEventDate ?? "",
    nextFollowUpAt: dateTimeInput(opportunity?.nextFollowUpAt ?? null),
    lossReason: opportunity?.lossReason ?? "",
    salespersonId: opportunity?.salespersonId ?? "",
    items:
      opportunity?.items.map(({ name, quantity }) => ({
        name,
        quantity: String(quantity),
      })) ?? [],
  };
}

export function formatConflictMessage(message: string): string {
  if (message.includes("version is stale")) {
    return "Esta oportunidade foi alterada por outra pessoa. Suas mudanças continuam no formulário; atualize os dados antes de tentar salvar novamente.";
  }
  return message;
}

export function salespersonLabel(salesperson: Salesperson): string {
  return salesperson.name;
}

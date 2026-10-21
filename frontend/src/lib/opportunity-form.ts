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
export const ESTIMATED_VALUE_INPUT_PATTERN = String.raw`(?:\d{1,12}|\d{1,3}(?:\.\d{3}){1,3})(?:,\d{1,2})?`;
const itemSchema = z.object({ name: z.string(), quantity: z.string() });
const optionalText = (maxLength: number) =>
  z.string().max(maxLength, `Use até ${maxLength} caracteres.`);
const contactNamePattern = /^[\p{L}\p{M}][\p{L}\p{M} .,'’()/-]*$/u;
const contactPhonePattern = /^(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}-?\d{4}$/;
const companyWebsitePattern =
  /^(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i;
const optionalContactName = optionalText(160).refine(
  (value) => !value.trim() || contactNamePattern.test(value.trim()),
  "Use apenas letras e pontuação comum para nomes.",
);
const optionalContactPhone = optionalText(30).refine(
  (value) => !value.trim() || contactPhonePattern.test(value.trim()),
  "Informe um telefone com DDD e número válido.",
);
const optionalEmail = optionalText(254).refine(
  (value) => !value.trim() || z.email().safeParse(value.trim()).success,
  "Informe um e-mail válido.",
);
const optionalWebsite = optionalText(2048).refine((value) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!companyWebsitePattern.test(trimmed)) return false;
  try {
    const parsed = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}, "Informe um site válido.");
const optionalLocation = optionalText(240).refine(
  (value) => !value.trim() || /^[\p{L}\p{M}\s,.'’()/-]+$/u.test(value),
  "Use apenas letras e pontuação comum para cidade e estado.",
);

export const opportunityFormSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(1, "Informe o nome da empresa.")
      .max(240, "Use até 240 caracteres."),
    contactName: optionalContactName,
    contactPhone: optionalContactPhone,
    contactEmail: optionalEmail,
    companyWebsite: optionalWebsite,
    companyLocation: optionalLocation,
    companyDescription: optionalText(2000),
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

export function sanitizeContactNameInput(value: string): string {
  return value
    .replace(/[^\p{L}\p{M} .,'’()/-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 160);
}

export function sanitizeLocationInput(value: string): string {
  return value
    .replace(/[^\p{L}\p{M}\s,.'’()/-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.'’])/g, "$1")
    .slice(0, 240);
}

export function formatContactPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  const hasCountryCode =
    /^\s*\+55/.test(value) || (digits.length > 11 && digits.startsWith("55"));
  const national = (hasCountryCode ? digits.slice(2) : digits).slice(0, 11);
  const areaCode = national.slice(0, 2);
  const subscriber = national.slice(2);
  const countryPrefix = hasCountryCode ? "+55 " : "";

  if (!areaCode) return countryPrefix;
  if (areaCode.length < 2) return `${countryPrefix}(${areaCode}`;
  if (!subscriber) return `${countryPrefix}(${areaCode})`;
  if (subscriber.length <= 4)
    return `${countryPrefix}(${areaCode}) ${subscriber}`;

  const subscriberLength = subscriber.length >= 9 ? 5 : 4;
  return `${countryPrefix}(${areaCode}) ${subscriber.slice(0, subscriberLength)}-${subscriber.slice(subscriberLength)}`;
}

export type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;

export type OpportunityPayload = {
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  companyWebsite: string | null;
  companyLocation: string | null;
  companyDescription: string | null;
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
    contactName: values.contactName.trim() || null,
    contactPhone: values.contactPhone.trim() || null,
    contactEmail: values.contactEmail.trim() || null,
    companyWebsite: values.companyWebsite.trim() || null,
    companyLocation: values.companyLocation.trim() || null,
    companyDescription: values.companyDescription.trim() || null,
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
    contactName: opportunity?.contactName ?? "",
    contactPhone: opportunity?.contactPhone ?? "",
    contactEmail: opportunity?.contactEmail ?? "",
    companyWebsite: opportunity?.companyWebsite ?? "",
    companyLocation: opportunity?.companyLocation ?? "",
    companyDescription: opportunity?.companyDescription ?? "",
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

import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseISO(value);
  return isValid(date) ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseISO(value);
  return isValid(date)
    ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : "—";
}

/** Formats the optional return schedule without making an unscheduled return look like missing data. */
export function formatNextFollowUp(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "Não agendado";
}

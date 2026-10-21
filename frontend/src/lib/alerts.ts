import type { FollowUpAlert, FollowUpAlertType } from "@/types/api";

export const ALERT_TYPE_OPTIONS: {
  value: FollowUpAlertType;
  label: string;
  description: string;
}[] = [
  {
    value: "FOLLOW_UP_OVERDUE",
    label: "Retorno em atraso",
    description:
      "O prazo combinado para retornar ao cliente já passou. Entre em contato e registre a próxima etapa.",
  },
  {
    value: "CONTACT_STALE",
    label: "Contato sem atualização",
    description:
      "A oportunidade está sem um novo contato registrado há vários dias. Retome a conversa e registre a interação.",
  },
  {
    value: "PROPOSAL_EXPIRED",
    label: "Proposta expirada",
    description:
      "A validade da proposta terminou. Confirme as condições com o cliente e atualize a negociação.",
  },
  {
    value: "CUSTOMER_EVENT_NEAR",
    label: "Evento do cliente próximo",
    description:
      "A data do evento do cliente está próxima. Confirme os detalhes e alinhe os próximos passos.",
  },
];

export const ALERT_TYPE_LABELS = Object.fromEntries(
  ALERT_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<FollowUpAlertType, string>;

export function alertDescription(
  type: FollowUpAlertType,
  referenceDate: string,
) {
  const description =
    ALERT_TYPE_OPTIONS.find((option) => option.value === type)?.description ??
    "Esta oportunidade precisa de atenção.";
  return `${description} Referência: ${referenceDate}.`;
}

export type FollowUpAlertGroup = {
  opportunity: FollowUpAlert["opportunity"];
  alerts: FollowUpAlert[];
};

export function groupAlertsByOpportunity(
  alerts: FollowUpAlert[],
): FollowUpAlertGroup[] {
  const groups = new Map<string, FollowUpAlertGroup>();

  for (const alert of alerts) {
    const group = groups.get(alert.opportunity.id);
    if (group) group.alerts.push(alert);
    else {
      groups.set(alert.opportunity.id, {
        opportunity: alert.opportunity,
        alerts: [alert],
      });
    }
  }

  return [...groups.values()];
}

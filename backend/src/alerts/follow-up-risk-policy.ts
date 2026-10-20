export const FOLLOW_UP_ALERT_TYPES = [
  'FOLLOW_UP_OVERDUE',
  'CONTACT_STALE',
  'PROPOSAL_EXPIRED',
  'CUSTOMER_EVENT_NEAR',
] as const;

export type RiskAlertType = (typeof FOLLOW_UP_ALERT_TYPES)[number];
export type RiskStage =
  | 'PRIMEIRO_CONTATO'
  | 'APRESENTACAO_ORCAMENTO'
  | 'FOLLOW_UP'
  | 'FORECAST'
  | 'FECHAMENTO'
  | 'PERDIDA';

export type RiskOpportunity = {
  stage: RiskStage;
  deletedAt: Date | null;
  lastContactAt: Date | null;
  nextFollowUpAt: Date | null;
  proposalValidUntil: Date | null;
  customerEventDate: Date | null;
};

export type RiskAlert = {
  type: RiskAlertType;
  referenceAt: Date;
};

export type RiskPolicyConfig = {
  staleContactDays: number;
  customerEventWindowDays: number;
};

const ACTIVE_STAGES = new Set<RiskStage>([
  'PRIMEIRO_CONTATO',
  'APRESENTACAO_ORCAMENTO',
  'FOLLOW_UP',
  'FORECAST',
]);

/**
 * Evaluates DATE fields as UTC calendar dates, matching PostgreSQL DATE values,
 * and nextFollowUpAt as an absolute instant. The caller supplies the clock.
 */
export function evaluateFollowUpRisks(
  opportunity: RiskOpportunity,
  evaluatedAt: Date,
  config: RiskPolicyConfig,
): RiskAlert[] {
  if (opportunity.deletedAt !== null || !ACTIVE_STAGES.has(opportunity.stage)) {
    return [];
  }

  const alerts: RiskAlert[] = [];
  const evaluationDate = utcDateOnly(evaluatedAt);

  if (opportunity.nextFollowUpAt !== null) {
    if (opportunity.nextFollowUpAt.getTime() <= evaluatedAt.getTime()) {
      alerts.push({
        type: 'FOLLOW_UP_OVERDUE',
        referenceAt: new Date(opportunity.nextFollowUpAt),
      });
    }
  } else if (opportunity.lastContactAt !== null) {
    const contactDate = utcDateOnly(opportunity.lastContactAt);
    const daysSinceContact = daysBetween(contactDate, evaluationDate);
    if (daysSinceContact > config.staleContactDays) {
      alerts.push({
        type: 'CONTACT_STALE',
        referenceAt: contactDate,
      });
    }
  }

  if (opportunity.proposalValidUntil !== null) {
    const proposalDate = utcDateOnly(opportunity.proposalValidUntil);
    if (proposalDate.getTime() < evaluationDate.getTime()) {
      alerts.push({ type: 'PROPOSAL_EXPIRED', referenceAt: proposalDate });
    }
  }

  if (opportunity.customerEventDate !== null) {
    const eventDate = utcDateOnly(opportunity.customerEventDate);
    const daysUntilEvent = daysBetween(evaluationDate, eventDate);
    if (
      daysUntilEvent >= 0 &&
      daysUntilEvent <= config.customerEventWindowDays
    ) {
      alerts.push({ type: 'CUSTOMER_EVENT_NEAR', referenceAt: eventDate });
    }
  }

  return alerts;
}

export function utcDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

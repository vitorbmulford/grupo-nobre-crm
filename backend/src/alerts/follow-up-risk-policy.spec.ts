import {
  evaluateFollowUpRisks,
  RiskOpportunity,
} from './follow-up-risk-policy.js';

const evaluatedAt = new Date('2026-10-15T12:00:00.000Z');
const defaults = { staleContactDays: 7, customerEventWindowDays: 7 };

function opportunity(values: Partial<RiskOpportunity> = {}): RiskOpportunity {
  return {
    stage: 'FOLLOW_UP',
    deletedAt: null,
    lastContactAt: null,
    nextFollowUpAt: null,
    proposalValidUntil: null,
    customerEventDate: null,
    ...values,
  };
}

function types(values: Partial<RiskOpportunity> = {}) {
  return evaluateFollowUpRisks(opportunity(values), evaluatedAt, defaults).map(
    ({ type }) => type,
  );
}

describe('evaluateFollowUpRisks', () => {
  it('flags an overdue return at the exact instant and ignores a future return', () => {
    expect(
      types({ nextFollowUpAt: new Date('2026-10-15T12:00:00.000Z') }),
    ).toContain('FOLLOW_UP_OVERDUE');
    expect(
      types({ nextFollowUpAt: new Date('2026-10-15T12:00:00.001Z') }),
    ).not.toContain('FOLLOW_UP_OVERDUE');
  });

  it('uses contact date only when no return is scheduled and crosses after seven calendar days', () => {
    expect(
      types({ lastContactAt: new Date('2026-10-08T00:00:00.000Z') }),
    ).not.toContain('CONTACT_STALE');
    expect(
      types({ lastContactAt: new Date('2026-10-07T23:59:59.000Z') }),
    ).toContain('CONTACT_STALE');
    expect(
      types({
        lastContactAt: new Date('2026-10-01T00:00:00.000Z'),
        nextFollowUpAt: new Date('2026-10-16T00:00:00.000Z'),
      }),
    ).not.toContain('CONTACT_STALE');
    expect(types({ lastContactAt: null })).not.toContain('CONTACT_STALE');
  });

  it('compares proposal validity as a commercial date and treats null as unknown', () => {
    expect(
      types({ proposalValidUntil: new Date('2026-10-14T00:00:00.000Z') }),
    ).toContain('PROPOSAL_EXPIRED');
    expect(
      types({ proposalValidUntil: new Date('2026-10-15T00:00:00.000Z') }),
    ).not.toContain('PROPOSAL_EXPIRED');
    expect(types({ proposalValidUntil: null })).not.toContain(
      'PROPOSAL_EXPIRED',
    );
  });

  it('includes events from today through the seventh day, but excludes past and later dates', () => {
    expect(
      types({ customerEventDate: new Date('2026-10-22T00:00:00.000Z') }),
    ).toContain('CUSTOMER_EVENT_NEAR');
    expect(
      types({ customerEventDate: new Date('2026-10-23T00:00:00.000Z') }),
    ).not.toContain('CUSTOMER_EVENT_NEAR');
    expect(
      types({ customerEventDate: new Date('2026-10-14T00:00:00.000Z') }),
    ).not.toContain('CUSTOMER_EVENT_NEAR');
  });

  it('returns independent risks together and excludes terminal or deleted opportunities', () => {
    expect(
      types({
        nextFollowUpAt: new Date('2026-10-14T10:00:00.000Z'),
        proposalValidUntil: new Date('2026-10-14T00:00:00.000Z'),
        customerEventDate: new Date('2026-10-20T00:00:00.000Z'),
      }),
    ).toEqual(['FOLLOW_UP_OVERDUE', 'PROPOSAL_EXPIRED', 'CUSTOMER_EVENT_NEAR']);
    expect(types({ stage: 'FECHAMENTO' })).toEqual([]);
    expect(types({ stage: 'PERDIDA' })).toEqual([]);
    expect(types({ deletedAt: new Date('2026-10-14T00:00:00.000Z') })).toEqual(
      [],
    );
  });

  it('compares DATE values by UTC calendar day regardless of the host timezone', () => {
    const risks = evaluateFollowUpRisks(
      opportunity({
        lastContactAt: new Date('2026-10-08T23:00:00.000Z'),
        customerEventDate: new Date('2026-10-22T00:00:00.000Z'),
      }),
      new Date('2026-10-15T00:30:00.000Z'),
      defaults,
    );
    expect(risks.map(({ type }) => type)).toEqual(['CUSTOMER_EVENT_NEAR']);
  });
});

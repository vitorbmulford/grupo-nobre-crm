import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { searchTerms } from '../common/search-terms.js';
import {
  ListAlertsQueryDto,
  ListOpportunityAlertsQueryDto,
} from './dto/list-alerts-query.dto.js';
import {
  evaluateFollowUpRisks,
  RiskAlertType,
} from './follow-up-risk-policy.js';

const alertOpportunity = {
  id: true,
  code: true,
  companyName: true,
  stage: true,
} as const;

@Injectable()
export class AlertsService {
  private readonly staleContactDays: number;
  private readonly customerEventWindowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.staleContactDays = config.get<number>(
      'FOLLOW_UP_STALE_CONTACT_DAYS',
      7,
    );
    this.customerEventWindowDays = config.get<number>(
      'FOLLOW_UP_CUSTOMER_EVENT_WINDOW_DAYS',
      7,
    );
  }

  async list(query: ListAlertsQueryDto, defaultOpen = false) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const loadPage = async (terms?: string[]) => {
      const where: Prisma.FollowUpAlertWhereInput = {
        ...(query.status
          ? { status: query.status }
          : defaultOpen
            ? { status: 'OPEN' }
            : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.opportunityId ? { opportunityId: query.opportunityId } : {}),
        ...(search || query.salespersonId
          ? {
              opportunity: {
                is: {
                  ...(query.salespersonId
                    ? { salespersonId: query.salespersonId }
                    : {}),
                  ...(terms
                    ? {
                        OR: terms.flatMap((term) => [
                          {
                            code: {
                              contains: term,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            companyName: {
                              contains: term,
                              mode: 'insensitive' as const,
                            },
                          },
                        ]),
                      }
                    : {}),
                },
              },
            }
          : {}),
      };
      const [total, data] = await Promise.all([
        this.prisma.followUpAlert.count({ where }),
        this.prisma.followUpAlert.findMany({
          where,
          include: { opportunity: { select: alertOpportunity } },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      return { total, data };
    };
    let { total, data } = await loadPage(search ? [search] : undefined);
    if (total === 0 && search) {
      const alternatives = searchTerms(search).slice(1);
      if (alternatives.length) ({ total, data } = await loadPage(alternatives));
    }
    return {
      data: data.map(serializeAlert),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listForOpportunity(
    opportunityId: string,
    query: ListOpportunityAlertsQueryDto,
  ) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
      select: { id: true },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    return this.list(
      {
        status: query.status,
        type: query.type,
        opportunityId,
        search: query.search,
        salespersonId: query.salespersonId,
        page: query.page,
        limit: query.limit,
      },
      false,
    );
  }

  async resolve(id: string) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "FollowUpAlert" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (!rows[0]) throw new NotFoundException('Alert not found');
      const current = await transaction.followUpAlert.findUniqueOrThrow({
        where: { id },
        include: { opportunity: { select: alertOpportunity } },
      });
      if (current.status === 'OPEN') {
        return transaction.followUpAlert.update({
          where: { id },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            acknowledgedAt: new Date(),
          },
          include: { opportunity: { select: alertOpportunity } },
        });
      }
      return current;
    });
    return serializeAlert(result);
  }

  async evaluate(evaluatedAt: Date, opportunityIds?: string[]) {
    const candidates = await this.prisma.opportunity.findMany({
      where: {
        ...(opportunityIds ? { id: { in: opportunityIds } } : {}),
        OR: [
          { deletedAt: null },
          { followUpAlerts: { some: { status: 'OPEN' } } },
        ],
      },
      select: { id: true },
    });

    let created = 0;
    let maintained = 0;
    let resolved = 0;
    let failed = 0;
    for (const { id } of candidates) {
      try {
        const result = await this.reconcileOpportunity(id, evaluatedAt);
        created += result.created;
        maintained += result.maintained;
        resolved += result.resolved;
      } catch (error) {
        if (isUniqueConflict(error)) {
          maintained += 1;
          continue;
        }
        failed += 1;
        this.logger.error(
          {
            opportunityId: id,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          },
          'Follow-up alert reconciliation failed for opportunity',
        );
      }
    }

    const counts = {
      opportunitiesEvaluated: candidates.length,
      created,
      maintained,
      resolved,
      failed,
    };
    this.logger.info(counts, 'Follow-up alert evaluation completed');
    return counts;
  }

  private async reconcileOpportunity(id: string, evaluatedAt: Date) {
    return this.prisma.$transaction(async (transaction) => {
      // Serialize reconciliation with commercial edits, terminal transitions,
      // and soft deletion for this opportunity.
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Opportunity" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (!rows[0]) return { created: 0, maintained: 0, resolved: 0 };

      const opportunity = await transaction.opportunity.findUnique({
        where: { id },
        select: {
          id: true,
          stage: true,
          deletedAt: true,
          lastContactAt: true,
          nextFollowUpAt: true,
          proposalValidUntil: true,
          customerEventDate: true,
        },
      });
      if (!opportunity) return { created: 0, maintained: 0, resolved: 0 };

      const risks = evaluateFollowUpRisks(opportunity, evaluatedAt, {
        staleContactDays: this.staleContactDays,
        customerEventWindowDays: this.customerEventWindowDays,
      });
      const riskByType = new Map(risks.map((risk) => [risk.type, risk]));
      const openAlerts = await transaction.followUpAlert.findMany({
        where: { opportunityId: id, status: 'OPEN' },
      });
      let created = 0;
      let maintained = 0;
      let resolved = 0;
      const retained = new Set<RiskAlertType>();

      for (const alert of openAlerts) {
        const risk = riskByType.get(alert.type);
        if (
          risk &&
          risk.referenceAt.getTime() === alert.referenceAt.getTime()
        ) {
          retained.add(alert.type);
          maintained += 1;
          continue;
        }
        await transaction.followUpAlert.update({
          where: { id: alert.id },
          data: { status: 'RESOLVED', resolvedAt: evaluatedAt },
        });
        resolved += 1;
      }

      const acknowledged = await transaction.followUpAlert.findMany({
        where: { opportunityId: id, acknowledgedAt: { not: null } },
      });
      for (const previous of acknowledged) {
        const currentRisk = riskByType.get(previous.type);
        if (
          !currentRisk ||
          currentRisk.referenceAt.getTime() !== previous.referenceAt.getTime()
        ) {
          await transaction.followUpAlert.update({
            where: { id: previous.id },
            data: { acknowledgedAt: null },
          });
        }
      }

      for (const risk of risks) {
        if (retained.has(risk.type)) continue;
        const isAcknowledged = acknowledged.some(
          (previous) =>
            previous.type === risk.type &&
            previous.referenceAt.getTime() === risk.referenceAt.getTime(),
        );
        if (isAcknowledged) {
          maintained += 1;
          continue;
        }
        await transaction.followUpAlert.create({
          data: {
            opportunityId: id,
            type: risk.type,
            referenceAt: risk.referenceAt,
          },
        });
        created += 1;
      }

      return { created, maintained, resolved };
    });
  }
}

function serializeAlert(alert: {
  id: string;
  opportunityId: string;
  type: string;
  status: string;
  referenceAt: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  opportunity: { id: string; code: string; companyName: string; stage: string };
}) {
  return {
    id: alert.id,
    opportunityId: alert.opportunityId,
    type: alert.type,
    status: alert.status,
    referenceAt: alert.referenceAt.toISOString(),
    createdAt: alert.createdAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    opportunity: alert.opportunity,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

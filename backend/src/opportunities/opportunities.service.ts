import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { searchTerms } from '../common/search-terms.js';
import { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import { ListOpportunitiesQueryDto } from './dto/list-opportunities-query.dto.js';
import { TransitionStageDto } from './dto/transition-stage.dto.js';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';
import { evaluateTransition } from './pipeline/pipeline-policy.js';
import { RealtimeService } from '../realtime/realtime.service.js';

const opportunityRelations = {
  salesperson: true,
  items: { orderBy: { createdAt: 'asc' as const } },
} as const;
type OpportunityWithRelations = Prisma.OpportunityGetPayload<{
  include: typeof opportunityRelations;
}>;

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(query: ListOpportunitiesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const makeWhere = (terms?: string[]): Prisma.OpportunityWhereInput => ({
      deletedAt: null,
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.salespersonId ? { salespersonId: query.salespersonId } : {}),
      ...(terms
        ? {
            OR: terms.flatMap((term) => [
              { code: { contains: term, mode: 'insensitive' as const } },
              { companyName: { contains: term, mode: 'insensitive' as const } },
            ]),
          }
        : {}),
    });
    const orderBy = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    } as Prisma.OpportunityOrderByWithRelationInput;

    const loadPage = async (terms?: string[]) => {
      const where = makeWhere(terms);
      const [total, data] = await Promise.all([
        this.prisma.opportunity.count({ where }),
        this.prisma.opportunity.findMany({
          where,
          include: opportunityRelations,
          orderBy: [orderBy, { id: 'asc' }],
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
      data: data.map(serializeOpportunity),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, deletedAt: null },
      include: opportunityRelations,
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    return serializeOpportunity(opportunity);
  }

  async create(dto: CreateOpportunityDto) {
    try {
      const opportunity = await this.prisma.$transaction(async (transaction) => {
        const [nextCode] = await transaction.$queryRaw<
          Array<{ value: bigint }>
        >`
          SELECT nextval('opportunity_code_seq') AS value
        `;
        const code = `OPP-${String(nextCode.value).padStart(4, '0')}`;
        const opportunity = await transaction.opportunity.create({
          data: {
            code,
            companyName: dto.companyName.trim(),
            contactName: optionalText(dto.contactName),
            contactPhone: optionalPhone(dto.contactPhone),
            contactEmail: optionalText(dto.contactEmail),
            companyWebsite: optionalText(dto.companyWebsite),
            companyLocation: optionalText(dto.companyLocation),
            companyDescription: optionalText(dto.companyDescription),
            stage: 'PRIMEIRO_CONTATO',
            estimatedValue: decimal(dto.estimatedValue),
            lastContactAt: dateOnly(dto.lastContactAt),
            proposalValidUntil: dateOnly(dto.proposalValidUntil),
            customerEventDate: dateOnly(dto.customerEventDate),
            nextFollowUpAt: dateTime(dto.nextFollowUpAt),
            lossReason: dto.lossReason?.trim() || null,
            salespersonId: dto.salespersonId ?? null,
            items: dto.items?.length
              ? { create: dto.items.map(normalizeItem) }
              : undefined,
          },
          include: opportunityRelations,
        });
        return serializeOpportunity(opportunity);
      });
      this.realtime.publish('opportunity:created', {
        opportunityId: opportunity.id,
        version: opportunity.version,
      });
      return opportunity;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateOpportunityDto) {
    try {
      const opportunity = await this.prisma.$transaction(async (transaction) => {
        const { version, items, ...fields } = dto;
        const current = await transaction.opportunity.findFirst({
          where: { id, deletedAt: null },
          include: { items: true },
        });
        if (!current) throw new NotFoundException('Opportunity not found');
        if (current.version !== version) {
          throw new ConflictException('Opportunity version is stale');
        }
        const currentHasBudgetData = hasBudgetData(
          current.estimatedValue,
          current.items,
        );
        const nextEstimatedValue =
          fields.estimatedValue === undefined
            ? current.estimatedValue
            : decimal(fields.estimatedValue);
        const nextHasBudgetData = hasBudgetData(
          nextEstimatedValue,
          items === undefined
            ? current.items
            : items.map((item) => ({ quantity: item.quantity })),
        );
        if (
          current.stage !== 'PRIMEIRO_CONTATO' &&
          currentHasBudgetData &&
          !nextHasBudgetData
        ) {
          throw new UnprocessableEntityException(
            'An opportunity past the first stage must retain its estimated value and at least one gift item',
          );
        }
        const data: Prisma.OpportunityUpdateManyMutationInput = {
          version: { increment: 1 },
          ...(fields.companyName !== undefined
            ? { companyName: fields.companyName.trim() }
            : {}),
          ...(fields.contactName !== undefined
            ? { contactName: optionalText(fields.contactName) }
            : {}),
          ...(fields.contactPhone !== undefined
            ? { contactPhone: optionalPhone(fields.contactPhone) }
            : {}),
          ...(fields.contactEmail !== undefined
            ? { contactEmail: optionalText(fields.contactEmail) }
            : {}),
          ...(fields.companyWebsite !== undefined
            ? { companyWebsite: optionalText(fields.companyWebsite) }
            : {}),
          ...(fields.companyLocation !== undefined
            ? { companyLocation: optionalText(fields.companyLocation) }
            : {}),
          ...(fields.companyDescription !== undefined
            ? { companyDescription: optionalText(fields.companyDescription) }
            : {}),
          ...(fields.estimatedValue !== undefined
            ? { estimatedValue: decimal(fields.estimatedValue) }
            : {}),
          ...(fields.lastContactAt !== undefined
            ? { lastContactAt: dateOnly(fields.lastContactAt) }
            : {}),
          ...(fields.proposalValidUntil !== undefined
            ? { proposalValidUntil: dateOnly(fields.proposalValidUntil) }
            : {}),
          ...(fields.customerEventDate !== undefined
            ? { customerEventDate: dateOnly(fields.customerEventDate) }
            : {}),
          ...(fields.nextFollowUpAt !== undefined
            ? { nextFollowUpAt: dateTime(fields.nextFollowUpAt) }
            : {}),
          ...(fields.lossReason !== undefined
            ? { lossReason: fields.lossReason?.trim() || null }
            : {}),
          ...(fields.salespersonId !== undefined
            ? { salespersonId: fields.salespersonId }
            : {}),
        };
        const result = await transaction.opportunity.updateMany({
          where: { id, version, deletedAt: null },
          data,
        });
        if (result.count === 0) {
          const current = await transaction.opportunity.findUnique({
            where: { id },
            select: { deletedAt: true },
          });
          if (!current || current.deletedAt) {
            throw new NotFoundException('Opportunity not found');
          }
          throw new ConflictException('Opportunity version is stale');
        }

        if (items !== undefined) {
          await transaction.opportunityItem.deleteMany({
            where: { opportunityId: id },
          });
          if (items.length > 0) {
            await transaction.opportunityItem.createMany({
              data: items.map((item) => ({
                opportunityId: id,
                ...normalizeItem(item),
              })),
            });
          }
        }

        const opportunity = await transaction.opportunity.findUniqueOrThrow({
          where: { id },
          include: opportunityRelations,
        });
        return serializeOpportunity(opportunity);
      });
      this.realtime.publish('opportunity:updated', {
        opportunityId: opportunity.id,
        version: opportunity.version,
      });
      return opportunity;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async transitionStage(id: string, dto: TransitionStageDto) {
    try {
      const opportunity = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.opportunity.findFirst({
          where: { id, deletedAt: null },
          include: { items: true },
        });
        if (!current) throw new NotFoundException('Opportunity not found');
        if (current.version !== dto.version) {
          throw new ConflictException('Opportunity version is stale');
        }

        let decision: ReturnType<typeof evaluateTransition>;
        try {
          decision = evaluateTransition(
            current.stage,
            dto.toStage,
            dto.reason,
            current.estimatedValue !== null,
            current.items.some((item) => item.quantity > 0),
          );
        } catch (error) {
          throw new UnprocessableEntityException(
            error instanceof Error ? error.message : 'Invalid stage transition',
          );
        }

        const updated = await transaction.opportunity.updateMany({
          where: {
            id,
            version: dto.version,
            stage: current.stage,
            deletedAt: null,
          },
          data: {
            stage: dto.toStage,
            ...(dto.toStage === 'PERDIDA'
              ? { lossReason: decision.reason }
              : {}),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          const latest = await transaction.opportunity.findUnique({
            where: { id },
            select: { deletedAt: true },
          });
          if (!latest || latest.deletedAt) {
            throw new NotFoundException('Opportunity not found');
          }
          throw new ConflictException('Opportunity version is stale');
        }

        await transaction.stageTransition.create({
          data: {
            opportunityId: id,
            fromStage: current.stage,
            toStage: dto.toStage,
            reason: decision.reason,
          },
        });
        const opportunity = await transaction.opportunity.findUniqueOrThrow({
          where: { id },
          include: opportunityRelations,
        });
        return serializeOpportunity(opportunity);
      });
      this.realtime.publish('opportunity:stage-changed', {
        opportunityId: opportunity.id,
        version: opportunity.version,
      });
      return opportunity;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async history(id: string) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, deletedAt: null },
      select: {
        stageTransitions: {
          orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    return opportunity.stageTransitions.map((transition) => ({
      id: transition.id,
      fromStage: transition.fromStage,
      toStage: transition.toStage,
      reason: transition.reason,
      changedAt: transition.changedAt.toISOString(),
    }));
  }

  async softDelete(id: string): Promise<void> {
    const result = await this.prisma.opportunity.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    if (result.count === 1) {
      this.realtime.publish('opportunity:deleted', { opportunityId: id });
      return;
    }

    const existing = await this.prisma.opportunity.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Opportunity not found');
  }
}

function hasBudgetData(
  estimatedValue: Prisma.Decimal | null,
  items: Array<{ quantity: number }>,
): boolean {
  return estimatedValue !== null && items.some((item) => item.quantity > 0);
}

function decimal(value: string | null | undefined): Prisma.Decimal | null {
  return value == null ? null : new Prisma.Decimal(value);
}

function dateOnly(value: string | null | undefined): Date | null {
  if (value == null) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function dateTime(value: string | null | undefined): Date | null {
  return value == null ? null : new Date(value);
}

function normalizeItem(item: { name: string; quantity: number }) {
  return { name: item.name.trim(), quantity: item.quantity };
}

function serializeOpportunity(opportunity: OpportunityWithRelations) {
  return {
    id: opportunity.id,
    code: opportunity.code,
    companyName: opportunity.companyName,
    contactName: opportunity.contactName,
    contactPhone: opportunity.contactPhone,
    contactEmail: opportunity.contactEmail,
    companyWebsite: opportunity.companyWebsite,
    companyLocation: opportunity.companyLocation,
    companyDescription: opportunity.companyDescription,
    stage: opportunity.stage,
    estimatedValue: opportunity.estimatedValue?.toFixed(2) ?? null,
    lastContactAt: serializeDateOnly(opportunity.lastContactAt),
    proposalValidUntil: serializeDateOnly(opportunity.proposalValidUntil),
    customerEventDate: serializeDateOnly(opportunity.customerEventDate),
    nextFollowUpAt: opportunity.nextFollowUpAt?.toISOString() ?? null,
    lossReason: opportunity.lossReason,
    salespersonId: opportunity.salespersonId,
    version: opportunity.version,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
    salesperson: opportunity.salesperson
      ? { id: opportunity.salesperson.id, name: opportunity.salesperson.name }
      : null,
    items: opportunity.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

function optionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function optionalPhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  const hasCountryCode =
    trimmed.startsWith('+55') ||
    (digits.length > 11 && digits.startsWith('55'));
  const national = hasCountryCode ? digits.slice(2) : digits;
  const areaCode = national.slice(0, 2);
  const number = national.slice(2);
  if (areaCode.length !== 2 || ![8, 9].includes(number.length)) return trimmed;
  const subscriberLength = number.length === 9 ? 5 : 4;
  const formatted = `(${areaCode}) ${number.slice(0, subscriberLength)}-${number.slice(subscriberLength)}`;
  return hasCountryCode ? `+55 ${formatted}` : formatted;
}

function serializeDateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function mapPrismaError(error: unknown): Error {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return error instanceof Error
      ? error
      : new Error('Database operation failed');
  }
  if (error.code === 'P2002') {
    return new ConflictException(
      'An opportunity with this code already exists',
    );
  }
  if (error.code === 'P2003') {
    return new UnprocessableEntityException(
      'The assigned salesperson does not exist',
    );
  }
  if (error.code === 'P2025') {
    return new NotFoundException('Opportunity not found');
  }
  if (error.code === 'P2000' || error.code === 'P2004') {
    return new BadRequestException('Opportunity data violates a constraint');
  }
  return new Error('Database operation failed');
}

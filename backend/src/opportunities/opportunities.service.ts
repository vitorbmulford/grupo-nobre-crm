import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import { ListOpportunitiesQueryDto } from './dto/list-opportunities-query.dto.js';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';

const opportunityRelations = {
  salesperson: true,
  items: { orderBy: { createdAt: 'asc' as const } },
} as const;
type OpportunityWithRelations = Prisma.OpportunityGetPayload<{
  include: typeof opportunityRelations;
}>;

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListOpportunitiesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OpportunityWhereInput = {
      deletedAt: null,
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.salespersonId ? { salespersonId: query.salespersonId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { companyName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    } as Prisma.OpportunityOrderByWithRelationInput;

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
      return await this.prisma.$transaction(async (transaction) => {
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
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateOpportunityDto) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const { version, items, ...fields } = dto;
        const data: Prisma.OpportunityUpdateManyMutationInput = {
          version: { increment: 1 },
          ...(fields.companyName !== undefined
            ? { companyName: fields.companyName.trim() }
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
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async softDelete(id: string): Promise<void> {
    const result = await this.prisma.opportunity.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    if (result.count === 1) return;

    const existing = await this.prisma.opportunity.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Opportunity not found');
  }
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

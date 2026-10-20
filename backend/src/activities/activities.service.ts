import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateActivityDto } from './dto/create-activity.dto.js';
import { ListActivitiesQueryDto } from './dto/list-activities-query.dto.js';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(opportunityId: string, dto: CreateActivityDto) {
    const occurredAt = new Date(dto.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new UnprocessableEntityException('Activity date is invalid');
    }
    if (occurredAt.getTime() > Date.now()) {
      throw new UnprocessableEntityException(
        'Activity date cannot be in the future',
      );
    }
    const description = dto.description.trim();
    if (!description) {
      throw new UnprocessableEntityException(
        'Activity description cannot be empty',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<{ id: string; deletedAt: Date | null }>
      >`
        SELECT "id", "deletedAt" FROM "Opportunity" WHERE "id" = ${opportunityId}::uuid FOR UPDATE
      `;
      if (!rows[0] || rows[0].deletedAt) {
        throw new NotFoundException('Opportunity not found');
      }

      const activity = await transaction.activity.create({
        data: { opportunityId, type: dto.type, description, occurredAt },
      });
      const contactDate = new Date(
        Date.UTC(
          occurredAt.getUTCFullYear(),
          occurredAt.getUTCMonth(),
          occurredAt.getUTCDate(),
        ),
      );
      await transaction.opportunity.updateMany({
        where: {
          id: opportunityId,
          deletedAt: null,
          OR: [{ lastContactAt: null }, { lastContactAt: { lt: contactDate } }],
        },
        data: {
          lastContactAt: contactDate,
          version: { increment: 1 },
        },
      });
      return serializeActivity(activity);
    });
  }

  async list(opportunityId: string, query: ListActivitiesQueryDto) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
      select: { id: true },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ActivityWhereInput = {
      opportunityId,
      ...(query.type ? { type: query.type } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: data.map(serializeActivity),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

function serializeActivity(activity: {
  id: string;
  opportunityId: string;
  type: string;
  description: string;
  occurredAt: Date;
  createdAt: Date;
}) {
  return {
    id: activity.id,
    opportunityId: activity.opportunityId,
    type: activity.type,
    description: activity.description,
    occurredAt: activity.occurredAt.toISOString(),
    createdAt: activity.createdAt.toISOString(),
  };
}

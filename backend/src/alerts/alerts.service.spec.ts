import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertsService } from './alerts.service.js';

describe('AlertsService', () => {
  it('matches accented customer names when the search omits the accent', async () => {
    const count = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      followUpAlert: { count, findMany },
    } as unknown as PrismaService;
    const config = {
      get: (_key: string, fallback: number) => fallback,
    } as unknown as ConfigService;
    const logger = { info: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
    const service = new AlertsService(prisma, config, logger);

    await service.list({ page: 1, limit: 20, search: 'agencia' }, true);

    const where = count.mock.calls[1][0].where;
    expect(where.opportunity.is.OR).toContainEqual({
      companyName: { contains: 'agência', mode: 'insensitive' },
    });
  });

  it('filters alert pages by customer/code search and opportunity salesperson', async () => {
    const count = vi.fn().mockResolvedValue(1);
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      followUpAlert: { count, findMany },
    } as unknown as PrismaService;
    const config = {
      get: (_key: string, fallback: number) => fallback,
    } as unknown as ConfigService;
    const logger = { info: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
    const service = new AlertsService(prisma, config, logger);

    await service.list(
      {
        page: 2,
        limit: 10,
        search: '  Nobre  ',
        salespersonId: 'salesperson-1',
      },
      true,
    );

    const expectedFilter = {
      status: 'OPEN',
      opportunity: {
        is: {
          salespersonId: 'salesperson-1',
          OR: [
            { code: { contains: 'Nobre', mode: 'insensitive' } },
            { companyName: { contains: 'Nobre', mode: 'insensitive' } },
          ],
        },
      },
    };
    expect(count).toHaveBeenCalledWith({ where: expectedFilter });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedFilter,
        skip: 10,
        take: 10,
      }),
    );
  });

  it('continues reconciling other opportunities after one opportunity fails', async () => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'opportunity-2' }]),
      opportunity: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'opportunity-2',
          stage: 'FOLLOW_UP',
          deletedAt: null,
          lastContactAt: null,
          nextFollowUpAt: new Date('2026-10-14T10:00:00.000Z'),
          proposalValidUntil: null,
          customerEventDate: null,
        }),
      },
      followUpAlert: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    let transactionCount = 0;
    const prisma = {
      opportunity: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'opportunity-1' },
            { id: 'opportunity-2' },
          ]),
      },
      $transaction: vi.fn(async (operation: (tx: unknown) => unknown) => {
        transactionCount += 1;
        if (transactionCount === 1) throw new Error('forced row failure');
        return operation(transaction);
      }),
    } as unknown as PrismaService;
    const config = {
      get: (_key: string, fallback: number) => fallback,
    } as unknown as ConfigService;
    const errorLog = vi.fn();
    const logger = {
      info: vi.fn(),
      error: errorLog,
    } as unknown as PinoLogger;
    const service = new AlertsService(prisma, config, logger);

    await expect(
      service.evaluate(new Date('2026-10-15T12:00:00.000Z')),
    ).resolves.toEqual({
      opportunitiesEvaluated: 2,
      created: 1,
      maintained: 0,
      resolved: 0,
      failed: 1,
    });
    expect(transaction.opportunity.findUnique).toHaveBeenCalledTimes(1);
    expect(transaction.followUpAlert.create).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith(
      { opportunityId: 'opportunity-1', errorName: 'Error' },
      'Follow-up alert reconciliation failed for opportunity',
    );
  });
});

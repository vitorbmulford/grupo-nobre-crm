import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertsService } from './alerts.service.js';

describe('AlertsService', () => {
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

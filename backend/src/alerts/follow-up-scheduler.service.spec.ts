import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { AlertsService } from './alerts.service.js';
import { FollowUpSchedulerService } from './follow-up-scheduler.service.js';

describe('FollowUpSchedulerService', () => {
  it('evaluates alerts immediately when the scheduler starts', () => {
    const evaluate = vi.fn().mockResolvedValue({
      opportunitiesEvaluated: 0,
      created: 0,
      maintained: 0,
      resolved: 0,
      failed: 0,
    });
    const alerts = { evaluate } as unknown as AlertsService;
    const config = {
      get: vi.fn().mockReturnValue(900000),
    } as unknown as ConfigService;
    const addInterval = vi.fn();
    const registry = { addInterval } as unknown as SchedulerRegistry;
    const logger = { error: vi.fn() } as unknown as PinoLogger;
    const interval = { unref: vi.fn() } as unknown as ReturnType<
      typeof setInterval
    >;
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockReturnValue(interval);
    const scheduler = new FollowUpSchedulerService(
      alerts,
      config,
      registry,
      logger,
    );

    scheduler.onModuleInit();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 900000);
    expect(addInterval).toHaveBeenCalledWith(
      'follow-up-risk-evaluation',
      interval,
    );
    expect(evaluate).toHaveBeenCalledTimes(1);
    setIntervalSpy.mockRestore();
  });

  it('releases its execution guard after a failed run and recovers on the next run', async () => {
    const evaluate = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary database outage'))
      .mockResolvedValue({
        opportunitiesEvaluated: 0,
        created: 0,
        maintained: 0,
        resolved: 0,
        failed: 0,
      });
    const alerts = { evaluate } as unknown as AlertsService;
    const config = {} as ConfigService;
    const registry = {} as SchedulerRegistry;
    const errorLog = vi.fn();
    const logger = { error: errorLog } as unknown as PinoLogger;
    const scheduler = new FollowUpSchedulerService(
      alerts,
      config,
      registry,
      logger,
    );

    await scheduler.run();
    await scheduler.run();

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(errorLog).toHaveBeenCalledWith(
      { errorName: 'Error' },
      'Follow-up alert evaluation failed',
    );
  });
});

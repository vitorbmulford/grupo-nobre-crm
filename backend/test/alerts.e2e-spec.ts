import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http/configure-http.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AlertsService } from '../src/alerts/alerts.service.js';

describe('Follow-up alerts API and reconciliation (PostgreSQL integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let alerts: AlertsService;
  const prefix = `Alert integration ${randomUUID()}`;
  const ids: string[] = [];
  const reference = new Date('2026-10-15T12:00:00.000Z');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('api');
    configureHttp(app, app.get(ConfigService));
    await app.init();
    prisma = app.get(PrismaService);
    alerts = app.get(AlertsService);
  });

  afterAll(async () => {
    if (ids.length) {
      await prisma.followUpAlert.deleteMany({
        where: { opportunityId: { in: ids } },
      });
      await prisma.activity.deleteMany({
        where: { opportunityId: { in: ids } },
      });
      await prisma.stageTransition.deleteMany({
        where: { opportunityId: { in: ids } },
      });
      await prisma.opportunityItem.deleteMany({
        where: { opportunityId: { in: ids } },
      });
      await prisma.opportunity.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
  });

  async function createOpportunity(
    suffix: string,
    values: {
      stage?:
        | 'PRIMEIRO_CONTATO'
        | 'APRESENTACAO_ORCAMENTO'
        | 'FOLLOW_UP'
        | 'FORECAST'
        | 'FECHAMENTO'
        | 'PERDIDA';
      lastContactAt?: Date | null;
      nextFollowUpAt?: Date | null;
      proposalValidUntil?: Date | null;
      customerEventDate?: Date | null;
    } = {},
  ) {
    const opportunity = await prisma.opportunity.create({
      data: {
        code: `T-${randomUUID().slice(0, 12)}`,
        companyName: `${prefix} ${suffix}`,
        stage: values.stage ?? 'FOLLOW_UP',
        lastContactAt: values.lastContactAt ?? null,
        nextFollowUpAt: values.nextFollowUpAt ?? null,
        proposalValidUntil: values.proposalValidUntil ?? null,
        customerEventDate: values.customerEventDate ?? null,
      },
    });
    ids.push(opportunity.id);
    return opportunity;
  }

  it('creates one alert per risk, is idempotent across repeated and concurrent evaluations, then reconciles and preserves history', async () => {
    const overdueAt = new Date('2026-10-14T10:00:00.000Z');
    const opportunity = await createOpportunity('idempotência', {
      nextFollowUpAt: overdueAt,
    });

    expect(await alerts.evaluate(reference, [opportunity.id])).toMatchObject({
      created: 1,
    });
    expect(await alerts.evaluate(reference, [opportunity.id])).toMatchObject({
      created: 0,
    });
    await Promise.all([
      alerts.evaluate(reference, [opportunity.id]),
      alerts.evaluate(reference, [opportunity.id]),
    ]);
    expect(
      await prisma.followUpAlert.count({
        where: { opportunityId: opportunity.id, status: 'OPEN' },
      }),
    ).toBe(1);

    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { nextFollowUpAt: new Date('2026-10-16T10:00:00.000Z') },
    });
    expect(await alerts.evaluate(reference, [opportunity.id])).toMatchObject({
      resolved: 1,
    });
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { nextFollowUpAt: overdueAt },
    });
    expect(await alerts.evaluate(reference, [opportunity.id])).toMatchObject({
      created: 1,
    });
    expect(
      await prisma.followUpAlert.count({
        where: { opportunityId: opportunity.id },
      }),
    ).toBe(2);
  });

  it('manually resolves idempotently and suppresses the same occurrence until risk clears', async () => {
    const opportunity = await createOpportunity('reconhecimento', {
      nextFollowUpAt: new Date('2026-10-14T10:00:00.000Z'),
    });
    await alerts.evaluate(reference, [opportunity.id]);
    const alert = await prisma.followUpAlert.findFirstOrThrow({
      where: { opportunityId: opportunity.id, status: 'OPEN' },
    });

    const resolved = await request(app.getHttpServer())
      .patch(`/api/alerts/${alert.id}/resolve`)
      .expect(200);
    expect(resolved.body.status).toBe('RESOLVED');
    expect(resolved.body.resolvedAt).toBeTruthy();
    const resolvedAgain = await request(app.getHttpServer())
      .patch(`/api/alerts/${alert.id}/resolve`)
      .expect(200);
    expect(resolvedAgain.body.resolvedAt).toBe(resolved.body.resolvedAt);
    const resolvedFilter = await request(app.getHttpServer())
      .get('/api/alerts')
      .query({ status: 'RESOLVED', type: 'FOLLOW_UP_OVERDUE' })
      .expect(200);
    expect(
      resolvedFilter.body.data.some(
        (row: { opportunityId: string }) =>
          row.opportunityId === opportunity.id,
      ),
    ).toBe(true);
    expect(await alerts.evaluate(reference, [opportunity.id])).toMatchObject({
      created: 0,
    });

    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { nextFollowUpAt: new Date('2026-10-16T10:00:00.000Z') },
    });
    await alerts.evaluate(reference, [opportunity.id]);
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { nextFollowUpAt: new Date('2026-10-14T10:00:00.000Z') },
    });
    expect(await alerts.evaluate(reference, [opportunity.id])).toMatchObject({
      created: 1,
    });
  });

  it('lists with filters and pagination, scopes opportunity history, and returns 404 for missing or deleted records', async () => {
    const opportunity = await createOpportunity('api', {
      lastContactAt: new Date('2026-10-01T00:00:00.000Z'),
      proposalValidUntil: new Date('2026-10-14T00:00:00.000Z'),
      customerEventDate: new Date('2026-10-20T00:00:00.000Z'),
    });
    await alerts.evaluate(reference, [opportunity.id]);

    const pending = await request(app.getHttpServer())
      .get('/api/alerts')
      .query({ opportunityId: opportunity.id, page: 1, limit: 2 })
      .expect(200);
    expect(pending.body.data).toHaveLength(2);
    expect(pending.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(
      await request(app.getHttpServer())
        .get('/api/alerts')
        .query({ type: 'PROPOSAL_EXPIRED', opportunityId: opportunity.id })
        .expect(200),
    ).toHaveProperty('body.data[0].type', 'PROPOSAL_EXPIRED');
    await request(app.getHttpServer())
      .get(`/api/opportunities/${opportunity.id}/alerts`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/alerts')
      .query({ status: 'BAD' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/opportunities/${randomUUID()}/alerts`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/alerts/${randomUUID()}/resolve`)
      .expect(404);

    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { deletedAt: reference },
    });
    await alerts.evaluate(reference, [opportunity.id]);
    await request(app.getHttpServer())
      .get(`/api/opportunities/${opportunity.id}/alerts`)
      .expect(404);
    expect(
      await prisma.followUpAlert.count({
        where: { opportunityId: opportunity.id, status: 'OPEN' },
      }),
    ).toBe(0);
  });

  it('resolves alerts automatically for terminal opportunities', async () => {
    for (const stage of ['FECHAMENTO', 'PERDIDA'] as const) {
      const opportunity = await createOpportunity(`terminal ${stage}`, {
        nextFollowUpAt: new Date('2026-10-14T10:00:00.000Z'),
      });
      await alerts.evaluate(reference, [opportunity.id]);
      await prisma.opportunity.update({
        where: { id: opportunity.id },
        data: { stage },
      });
      expect(await alerts.evaluate(reference, [opportunity.id])).toMatchObject({
        resolved: 1,
      });
      expect(
        await prisma.followUpAlert.count({
          where: { opportunityId: opportunity.id, status: 'OPEN' },
        }),
      ).toBe(0);
    }
  });

  it('reconciles an alert when soft deletion races scheduler evaluation', async () => {
    const opportunity = await createOpportunity('scheduler contra exclusão', {
      nextFollowUpAt: new Date('2026-10-14T10:00:00.000Z'),
    });
    const [, deletion] = await Promise.all([
      alerts.evaluate(reference, [opportunity.id]),
      request(app.getHttpServer()).delete(
        `/api/opportunities/${opportunity.id}`,
      ),
    ]);
    expect(deletion.status).toBe(204);
    await alerts.evaluate(reference, [opportunity.id]);
    expect(
      await prisma.followUpAlert.count({
        where: { opportunityId: opportunity.id, status: 'OPEN' },
      }),
    ).toBe(0);
  });

  it('keeps a manual acknowledgment when scheduler evaluation races resolution', async () => {
    const opportunity = await createOpportunity(
      'scheduler contra reconhecimento',
      {
        nextFollowUpAt: new Date('2026-10-14T10:00:00.000Z'),
      },
    );
    await alerts.evaluate(reference, [opportunity.id]);
    const alert = await prisma.followUpAlert.findFirstOrThrow({
      where: { opportunityId: opportunity.id, status: 'OPEN' },
    });

    const [, resolution] = await Promise.all([
      alerts.evaluate(reference, [opportunity.id]),
      request(app.getHttpServer()).patch(`/api/alerts/${alert.id}/resolve`),
    ]);
    expect(resolution.status).toBe(200);
    await alerts.evaluate(reference, [opportunity.id]);
    expect(
      await prisma.followUpAlert.count({
        where: { opportunityId: opportunity.id, status: 'OPEN' },
      }),
    ).toBe(0);
    expect(
      await prisma.followUpAlert.count({
        where: {
          opportunityId: opportunity.id,
          acknowledgedAt: { not: null },
        },
      }),
    ).toBe(1);
  });

  it('enforces the partial unique index when simultaneous inserts race', async () => {
    const opportunity = await createOpportunity('índice único');
    const create = () =>
      prisma.followUpAlert.create({
        data: {
          opportunityId: opportunity.id,
          type: 'FOLLOW_UP_OVERDUE',
          referenceAt: reference,
        },
      });
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    expect(
      await prisma.followUpAlert.count({
        where: { opportunityId: opportunity.id, status: 'OPEN' },
      }),
    ).toBe(1);
  });
});

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

describe('Activities API (PostgreSQL integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const prefix = `Activity integration ${randomUUID()}`;
  const ids: string[] = [];

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
  });

  afterAll(async () => {
    if (ids.length) {
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
    extra: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/api/opportunities')
      .send({ companyName: `${prefix} ${suffix}`, ...extra })
      .expect(201);
    ids.push(response.body.id as string);
    return response.body as { id: string; version: number; stage: string };
  }

  function post(
    id: string,
    type: string,
    occurredAt: string,
    description = 'Contato realizado',
  ) {
    return request(app.getHttpServer())
      .post(`/api/opportunities/${id}/activities`)
      .send({ type, occurredAt, description });
  }

  it('creates every supported contact type and normalizes the description', async () => {
    const opportunity = await createOpportunity('tipos');
    const occurredAt = '2026-10-19T10:00:00.000Z';
    for (const type of ['CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'OTHER']) {
      const response = await post(
        opportunity.id,
        type,
        occurredAt,
        '  Nota  ',
      ).expect(201);
      expect(response.body).toMatchObject({
        opportunityId: opportunity.id,
        type,
        description: 'Nota',
        occurredAt,
      });
      expect(response.body.createdAt).toBeTruthy();
    }
    expect(
      await prisma.stageTransition.count({
        where: { opportunityId: opportunity.id },
      }),
    ).toBe(0);
    const current = await prisma.opportunity.findUniqueOrThrow({
      where: { id: opportunity.id },
    });
    expect(current.lastContactAt?.toISOString().slice(0, 10)).toBe(
      '2026-10-19',
    );
    expect(current.version).toBe(1);
  });

  it('validates type, description, timestamp, future dates, and opportunity existence', async () => {
    const opportunity = await createOpportunity('validação');
    await post(opportunity.id, 'TEXT', '2026-10-19T10:00:00.000Z').expect(400);
    await post(
      opportunity.id,
      'CALL',
      '2026-10-19T10:00:00.000Z',
      '   ',
    ).expect(400);
    await post(opportunity.id, 'CALL', 'not-a-date').expect(400);
    await post(opportunity.id, 'CALL', '2026-10-19T10:00:00').expect(400);
    await post(
      opportunity.id,
      'CALL',
      '2026-10-19T10:00:00.000Z',
      'x'.repeat(2001),
    ).expect(400);
    await post(opportunity.id, 'CALL', '2999-10-19T10:00:00.000Z').expect(422);
    await post(randomUUID(), 'CALL', '2026-10-19T10:00:00.000Z').expect(404);
  });

  it('lists scoped, filtered and paginated rows in stable newest-first order', async () => {
    const first = await createOpportunity('consulta A');
    const second = await createOpportunity('consulta B');
    const same = '2026-10-19T10:00:00.000Z';
    const older = '2026-10-18T10:00:00.000Z';
    await post(first.id, 'CALL', same).expect(201);
    await post(first.id, 'EMAIL', same).expect(201);
    await post(first.id, 'MEETING', older).expect(201);
    await post(second.id, 'CALL', same).expect(201);

    const all = await request(app.getHttpServer())
      .get(`/api/opportunities/${first.id}/activities`)
      .expect(200);
    expect(all.body.data).toHaveLength(3);
    expect(all.body.data[0].occurredAt).toBe(same);
    expect(all.body.data[0].id.localeCompare(all.body.data[1].id)).toBeLessThan(
      0,
    );
    expect(all.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });

    const filtered = await request(app.getHttpServer())
      .get(`/api/opportunities/${first.id}/activities`)
      .query({ type: 'CALL', page: 1, limit: 1 })
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.meta).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1,
    });
    expect(filtered.body.data[0].opportunityId).toBe(first.id);
    await request(app.getHttpServer())
      .get(`/api/opportunities/${first.id}/activities`)
      .query({ type: 'BAD' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/opportunities/${randomUUID()}/activities`)
      .expect(404);
  });

  it('updates lastContactAt monotonically and increments version only when the date advances', async () => {
    const opportunity = await createOpportunity('last contact');
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { lastContactAt: new Date('2026-10-19T00:00:00.000Z'), version: 5 },
    });
    await post(opportunity.id, 'EMAIL', '2026-10-18T23:59:59.000Z').expect(201);
    let current = await prisma.opportunity.findUniqueOrThrow({
      where: { id: opportunity.id },
    });
    expect(current.lastContactAt?.toISOString().slice(0, 10)).toBe(
      '2026-10-19',
    );
    expect(current.version).toBe(5);

    await post(opportunity.id, 'CALL', '2026-10-19T23:59:59.000Z').expect(201);
    current = await prisma.opportunity.findUniqueOrThrow({
      where: { id: opportunity.id },
    });
    expect(current.version).toBe(5);
    await post(opportunity.id, 'CALL', '2026-10-20T00:30:00.000Z').expect(201);
    current = await prisma.opportunity.findUniqueOrThrow({
      where: { id: opportunity.id },
    });
    expect(current.lastContactAt?.toISOString().slice(0, 10)).toBe(
      '2026-10-20',
    );
    expect(current.version).toBe(6);
  });

  it('rolls back both activity and opportunity changes if the insert fails', async () => {
    const opportunity = await createOpportunity('atomicidade');
    await prisma.$executeRaw`CREATE OR REPLACE FUNCTION reject_activity_for_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced activity failure'; END $$`;
    await prisma.$executeRaw`CREATE TRIGGER reject_activity_for_test BEFORE INSERT ON "Activity" FOR EACH ROW EXECUTE FUNCTION reject_activity_for_test()`;
    try {
      await post(opportunity.id, 'CALL', '2026-10-19T12:00:00.000Z').expect(
        500,
      );
      const current = await prisma.opportunity.findUniqueOrThrow({
        where: { id: opportunity.id },
      });
      expect(current.lastContactAt).toBeNull();
      expect(current.version).toBe(0);
      expect(
        await prisma.activity.count({
          where: { opportunityId: opportunity.id },
        }),
      ).toBe(0);
    } finally {
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS reject_activity_for_test ON "Activity"`;
      await prisma.$executeRaw`DROP FUNCTION IF EXISTS reject_activity_for_test()`;
    }
  });

  it('serializes concurrent contacts, accepts terminal opportunities, and preserves activities on soft delete', async () => {
    const opportunity = await createOpportunity('concorrência');
    const results = await Promise.all([
      post(opportunity.id, 'CALL', '2026-10-18T12:00:00.000Z'),
      post(opportunity.id, 'EMAIL', '2026-10-20T12:00:00.000Z'),
      post(opportunity.id, 'MEETING', '2026-10-19T12:00:00.000Z'),
    ]);
    expect(results.map((result) => result.status)).toEqual([201, 201, 201]);
    let current = await prisma.opportunity.findUniqueOrThrow({
      where: { id: opportunity.id },
    });
    expect(current.lastContactAt?.toISOString().slice(0, 10)).toBe(
      '2026-10-20',
    );
    expect(current.version).toBe(2);

    for (const stage of ['FECHAMENTO', 'PERDIDA'] as const) {
      const terminal = await createOpportunity(`terminal ${stage}`);
      await prisma.opportunity.update({
        where: { id: terminal.id },
        data: { stage },
      });
      const created = await post(
        terminal.id,
        'OTHER',
        '2026-10-20T12:00:00.000Z',
      ).expect(201);
      current = await prisma.opportunity.findUniqueOrThrow({
        where: { id: terminal.id },
      });
      expect(current.stage).toBe(stage);
      expect(created.body.type).toBe('OTHER');
    }

    const preserved = await createOpportunity('preservada');
    await post(preserved.id, 'CALL', '2026-10-19T12:00:00.000Z').expect(201);
    await request(app.getHttpServer())
      .delete(`/api/opportunities/${preserved.id}`)
      .expect(204);
    expect(
      await prisma.activity.count({ where: { opportunityId: preserved.id } }),
    ).toBe(1);
    await request(app.getHttpServer())
      .get(`/api/opportunities/${preserved.id}/activities`)
      .expect(404);
    await post(preserved.id, 'CALL', '2026-10-20T12:00:00.000Z').expect(404);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${preserved.id}/activities/${randomUUID()}`)
      .send({ description: 'x' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/opportunities/${preserved.id}/activities/${randomUUID()}`)
      .expect(404);

    const racing = await createOpportunity('atividade contra exclusão');
    const [activityResponse, deleteResponse] = await Promise.all([
      post(racing.id, 'CALL', '2026-10-20T12:00:00.000Z'),
      request(app.getHttpServer()).delete(`/api/opportunities/${racing.id}`),
    ]);
    expect([201, 404]).toContain(activityResponse.status);
    expect(deleteResponse.status).toBe(204);
    expect(
      await prisma.activity.count({ where: { opportunityId: racing.id } }),
    ).toBe(activityResponse.status === 201 ? 1 : 0);
  });
});

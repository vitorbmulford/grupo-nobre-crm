import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureHttp } from '../src/http/configure-http.js';
import { AlertsService } from '../src/alerts/alerts.service.js';

describe('Opportunities API (PostgreSQL integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let alerts: AlertsService;
  const runId = randomUUID();
  const companyPrefix = `Integration ${runId}`;
  const salespersonName = `Integration ${runId}`;
  let salespersonId: string;

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
    const salesperson = await prisma.salesperson.create({
      data: { name: salespersonName },
    });
    salespersonId = salesperson.id;
  });

  afterAll(async () => {
    const opportunities = await prisma.opportunity.findMany({
      where: { companyName: { startsWith: companyPrefix } },
      select: { id: true },
    });
    const ids = opportunities.map(({ id }) => id);
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
    await prisma.salesperson.deleteMany({ where: { name: salespersonName } });
    await app.close();
  });

  function createBody(suffix: string, extra: Record<string, unknown> = {}) {
    return {
      companyName: `${companyPrefix} ${suffix}`,
      estimatedValue: '1200.50',
      salespersonId,
      items: [{ name: 'Caderno personalizado', quantity: 10 }],
      ...extra,
    };
  }

  async function createOpportunity(
    suffix: string,
    extra: Record<string, unknown> = {},
  ) {
    return request(app.getHttpServer())
      .post('/api/opportunities')
      .send(createBody(suffix, extra))
      .expect(201);
  }

  it('creates valid opportunities and allocates distinct codes concurrently', async () => {
    const [first, second] = await Promise.all([
      createOpportunity('Concorrência A'),
      createOpportunity('Concorrência B'),
    ]);

    expect(first.body.stage).toBe('PRIMEIRO_CONTATO');
    expect(first.body.code).toMatch(/^OPP-\d{4,}$/);
    expect(second.body.code).not.toBe(first.body.code);
    expect(first.body.estimatedValue).toBe('1200.50');
    expect(first.body).toMatchObject({
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      companyWebsite: null,
      companyLocation: null,
      companyDescription: null,
    });
    expect(first.body.items).toEqual([
      expect.objectContaining({ name: 'Caderno personalizado', quantity: 10 }),
    ]);
  });

  it('accepts estimated values with twelve integer digits', async () => {
    const response = await createOpportunity('Valor máximo válido', {
      estimatedValue: '5000000000.00',
    });
    expect(response.body.estimatedValue).toBe('5000000000.00');
  });

  it('creates, reads, updates, and clears optional client information', async () => {
    const created = await createOpportunity('Perfil do cliente', {
      contactName: ' Mariana Souza ',
      contactPhone: ' 11999990000 ',
      contactEmail: 'mariana@empresa.com.br',
      companyWebsite: 'www.empresa.com.br',
      companyLocation: ' São Paulo, SP ',
      companyDescription: ' Distribuidora de materiais para escritório. ',
    });
    expect(created.body).toMatchObject({
      contactName: 'Mariana Souza',
      contactPhone: '(11) 99999-0000',
      contactEmail: 'mariana@empresa.com.br',
      companyWebsite: 'www.empresa.com.br',
      companyLocation: 'São Paulo, SP',
      companyDescription: 'Distribuidora de materiais para escritório.',
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/opportunities/${created.body.id}`)
      .expect(200);
    expect(detail.body.contactEmail).toBe('mariana@empresa.com.br');
    const list = await request(app.getHttpServer())
      .get('/api/opportunities')
      .query({ search: created.body.code })
      .expect(200);
    expect(list.body.data[0].companyDescription).toBe(
      'Distribuidora de materiais para escritório.',
    );

    const updated = await request(app.getHttpServer())
      .patch(`/api/opportunities/${created.body.id}`)
      .send({
        version: created.body.version,
        companyName: created.body.companyName,
        contactName: '',
        contactPhone: null,
        contactEmail: 'novo@empresa.com.br',
        companyWebsite: '',
        companyLocation: '',
        companyDescription: 'Novo contexto.',
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      contactName: null,
      contactPhone: null,
      contactEmail: 'novo@empresa.com.br',
      companyWebsite: null,
      companyLocation: null,
      companyDescription: 'Novo contexto.',
    });

    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(
        createBody('Perfil com e-mail inválido', { contactEmail: 'inválido' }),
      )
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(
        createBody('Perfil com contato inválido', {
          contactName: 'Contato 123',
        }),
      )
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(
        createBody('Perfil com telefone inválido', { contactPhone: "'123" }),
      )
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(
        createBody('Perfil com site inválido', {
          companyWebsite: '12e21e21e21e',
        }),
      )
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(
        createBody('Perfil com descrição longa', {
          companyDescription: 'x'.repeat(2001),
        }),
      )
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(
        createBody('Perfil com cidade inválida', {
          companyLocation: 'São Paulo 123, SP',
        }),
      )
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/opportunities/${created.body.id}`)
      .expect(204);
  });

  it('rejects invalid fields, direct stage changes, and missing salesperson references', async () => {
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(createBody('Inválida', { companyName: '   ' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(
        createBody('Quantidade inválida', {
          items: [{ name: 'Brinde', quantity: 0 }],
        }),
      )
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(createBody('Valor inválido', { estimatedValue: '-1.00' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(
        createBody('Retorno sem fuso', {
          nextFollowUpAt: '2026-10-21T13:00:00',
        }),
      )
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(createBody('Etapa indevida', { stage: 'FORECAST' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(createBody('Vendedor inexistente', { salespersonId: randomUUID() }))
      .expect(422);
  });

  it('searches by company and code, filters by stage and salesperson, and paginates with stable ordering', async () => {
    const first = await createOpportunity('Busca Alpha');
    const second = await createOpportunity('Busca Beta');
    const byCompany = await request(app.getHttpServer())
      .get('/api/opportunities')
      .query({ search: 'busca alpha' })
      .expect(200);
    expect(
      byCompany.body.data.map((item: { id: string }) => item.id),
    ).toContain(first.body.id);

    const byCode = await request(app.getHttpServer())
      .get('/api/opportunities')
      .query({ search: first.body.code.toLowerCase() })
      .expect(200);
    expect(byCode.body.data.map((item: { id: string }) => item.id)).toContain(
      first.body.id,
    );

    const filtered = await request(app.getHttpServer())
      .get('/api/opportunities')
      .query({ stage: 'PRIMEIRO_CONTATO', salespersonId })
      .expect(200);
    expect(filtered.body.data.map((item: { id: string }) => item.id)).toContain(
      first.body.id,
    );
    expect(filtered.body.data.map((item: { id: string }) => item.id)).toContain(
      second.body.id,
    );

    const page = await request(app.getHttpServer())
      .get('/api/opportunities')
      .query({
        search: companyPrefix,
        sortBy: 'code',
        sortOrder: 'asc',
        page: 1,
        limit: 1,
      })
      .expect(200);
    expect(page.body.meta).toEqual({
      page: 1,
      limit: 1,
      total: 4,
      totalPages: 4,
    });
    expect(page.body.data).toHaveLength(1);
    const sortedCodes = (
      await prisma.opportunity.findMany({
        where: { companyName: { startsWith: companyPrefix }, deletedAt: null },
        orderBy: { code: 'asc' },
        select: { code: true },
      })
    ).map(({ code }) => code);
    expect(page.body.data[0].code).toBe(sortedCodes[0]);
  });

  it('paginates a large stage-specific result without dropping filtered opportunities', async () => {
    const bulkPrefix = `${companyPrefix} Bulk`;
    await prisma.opportunity.createMany({
      data: Array.from({ length: 251 }, (_, index) => ({
        code: `LOAD-${runId.slice(0, 8)}-${String(index).padStart(3, '0')}`,
        companyName: `${bulkPrefix} ${index}`,
        stage: 'FOLLOW_UP' as const,
        estimatedValue: '100.00',
        salespersonId,
      })),
    });

    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        request(app.getHttpServer())
          .get('/api/opportunities')
          .query({
            stage: 'FOLLOW_UP',
            salespersonId,
            search: bulkPrefix,
            page,
            limit: 100,
            sortBy: 'code',
            sortOrder: 'asc',
          })
          .expect(200),
      ),
    );
    const records = pages.flatMap((page) => page.body.data);

    expect(pages.map((page) => page.body.meta)).toEqual([
      { page: 1, limit: 100, total: 251, totalPages: 3 },
      { page: 2, limit: 100, total: 251, totalPages: 3 },
      { page: 3, limit: 100, total: 251, totalPages: 3 },
    ]);
    expect(records).toHaveLength(251);
    expect(
      new Set(records.map((record: { id: string }) => record.id)).size,
    ).toBe(251);
    expect(
      records.every(
        (record: { stage: string; salespersonId: string }) =>
          record.stage === 'FOLLOW_UP' &&
          record.salespersonId === salespersonId,
      ),
    ).toBe(true);
  });

  it('returns 404 for an unknown opportunity and updates fields and items with version checks', async () => {
    await request(app.getHttpServer())
      .get(`/api/opportunities/${randomUUID()}`)
      .expect(404);
    const created = await createOpportunity('Atualização');
    const details = await request(app.getHttpServer())
      .get(`/api/opportunities/${created.body.id}`)
      .expect(200);
    expect(details.body).toMatchObject({
      id: created.body.id,
      salesperson: { id: salespersonId, name: salespersonName },
      items: [expect.objectContaining({ name: 'Caderno personalizado' })],
    });
    const updated = await request(app.getHttpServer())
      .patch(`/api/opportunities/${created.body.id}`)
      .send({
        version: created.body.version,
        companyName: `${companyPrefix} Atualizada`,
        items: [{ name: 'Nova caneca', quantity: 25 }],
      })
      .expect(200);
    expect(updated.body.companyName).toBe(`${companyPrefix} Atualizada`);
    expect(updated.body.version).toBe(created.body.version + 1);
    expect(updated.body.items).toEqual([
      expect.objectContaining({ name: 'Nova caneca', quantity: 25 }),
    ]);

    await request(app.getHttpServer())
      .patch(`/api/opportunities/${created.body.id}`)
      .send({ version: created.body.version, stage: 'FORECAST' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${created.body.id}`)
      .send({
        version: created.body.version,
        companyName: 'Atualização atrasada',
      })
      .expect(409);
  });

  it('soft deletes idempotently and excludes deleted data while preserving items and code', async () => {
    const created = await createOpportunity('Exclusão lógica');
    const code = created.body.code as string;
    await request(app.getHttpServer())
      .delete(`/api/opportunities/${created.body.id}`)
      .expect(204);
    const deleted = await prisma.opportunity.findUniqueOrThrow({
      where: { id: created.body.id },
      include: { items: true },
    });
    const firstDeletedAt = deleted.deletedAt?.toISOString();
    expect(firstDeletedAt).toBeTruthy();
    expect(deleted.code).toBe(code);
    expect(deleted.items).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/opportunities/${created.body.id}`)
      .expect(204);
    const repeated = await prisma.opportunity.findUniqueOrThrow({
      where: { id: created.body.id },
      select: { deletedAt: true },
    });
    expect(repeated.deletedAt?.toISOString()).toBe(firstDeletedAt);

    await request(app.getHttpServer())
      .get(`/api/opportunities/${created.body.id}`)
      .expect(404);
    const listing = await request(app.getHttpServer())
      .get('/api/opportunities')
      .query({ search: code })
      .expect(200);
    expect(listing.body.data).toHaveLength(0);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${created.body.id}`)
      .send({
        version: created.body.version,
        companyName: 'Não pode atualizar',
      })
      .expect(404);

    await expect(
      prisma.opportunity.delete({ where: { id: created.body.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('enforces unique commercial codes in PostgreSQL', async () => {
    await expect(
      prisma.opportunity.create({
        data: {
          code: 'OPP-2001',
          companyName: `${companyPrefix} Código duplicado`,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('skips sequence values after collisions and failed inserts without reusing codes', async () => {
    const [{ last_value: lastValue, is_called: isCalled }] =
      await prisma.$queryRaw<Array<{ last_value: bigint; is_called: boolean }>>`
        SELECT last_value, is_called FROM opportunity_code_seq
      `;
    const firstCandidate = isCalled ? lastValue + 1n : lastValue;
    const reservedCode = `OPP-${String(firstCandidate).padStart(4, '0')}`;
    await prisma.opportunity.create({
      data: {
        code: reservedCode,
        companyName: `${companyPrefix} código reservado`,
      },
    });

    await request(app.getHttpServer())
      .post('/api/opportunities')
      .send(createBody('colisão de sequência'))
      .expect(409);
    const afterCollision = await createOpportunity('após colisão');
    expect(afterCollision.body.code).toBe(
      `OPP-${String(firstCandidate + 1n).padStart(4, '0')}`,
    );

    await prisma.$executeRaw`CREATE OR REPLACE FUNCTION reject_opportunity_for_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced opportunity failure'; END $$`;
    await prisma.$executeRaw`CREATE TRIGGER reject_opportunity_for_test BEFORE INSERT ON "Opportunity" FOR EACH ROW EXECUTE FUNCTION reject_opportunity_for_test()`;
    try {
      await request(app.getHttpServer())
        .post('/api/opportunities')
        .send(createBody('falha no insert'))
        .expect(500);
    } finally {
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS reject_opportunity_for_test ON "Opportunity"`;
      await prisma.$executeRaw`DROP FUNCTION IF EXISTS reject_opportunity_for_test()`;
    }

    const afterFailedInsert = await createOpportunity('após rollback');
    expect(afterFailedInsert.body.code).toBe(
      `OPP-${String(firstCandidate + 3n).padStart(4, '0')}`,
    );
  });

  it('moves sequentially, records history, and supports justified single-step returns', async () => {
    const created = await createOpportunity('Funil sequencial');
    const id = created.body.id as string;
    const move = (toStage: string, version: number, reason?: string) =>
      request(app.getHttpServer())
        .patch(`/api/opportunities/${id}/stage`)
        .send({ toStage, version, ...(reason ? { reason } : {}) });

    const budget = await move('APRESENTACAO_ORCAMENTO', 0).expect(200);
    expect(budget.body).toMatchObject({
      stage: 'APRESENTACAO_ORCAMENTO',
      version: 1,
    });
    const followUp = await move('FOLLOW_UP', 1).expect(200);
    const forecast = await move('FORECAST', 2).expect(200);
    const returned = await move('FOLLOW_UP', 3, 'Cliente pediu revisão').expect(
      200,
    );
    expect(returned.body).toMatchObject({ stage: 'FOLLOW_UP', version: 4 });

    const history = await request(app.getHttpServer())
      .get(`/api/opportunities/${id}/history`)
      .expect(200);
    expect(history.body).toHaveLength(4);
    expect(
      history.body.map((item: { toStage: string }) => item.toStage),
    ).toEqual(['APRESENTACAO_ORCAMENTO', 'FOLLOW_UP', 'FORECAST', 'FOLLOW_UP']);
    expect(history.body[3]).toMatchObject({
      fromStage: 'FORECAST',
      reason: 'Cliente pediu revisão',
    });
    expect(followUp.body.stage).toBe('FOLLOW_UP');
    expect(forecast.body.stage).toBe('FORECAST');
  });

  it('enforces transition prerequisites, terminal rules, loss reason, and soft deletion', async () => {
    const noValue = await createOpportunity('Sem valor', {
      estimatedValue: null,
    });
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${noValue.body.id}/stage`)
      .send({ toStage: 'APRESENTACAO_ORCAMENTO', version: 0 })
      .expect(422);
    expect(
      await prisma.stageTransition.count({
        where: { opportunityId: noValue.body.id },
      }),
    ).toBe(0);

    const noItems = await createOpportunity('Sem brinde', { items: [] });
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${noItems.body.id}/stage`)
      .send({ toStage: 'APRESENTACAO_ORCAMENTO', version: 0 })
      .expect(422);

    const opportunity = await createOpportunity('Regras inválidas');
    const transition = (toStage: string, reason?: string) =>
      request(app.getHttpServer())
        .patch(`/api/opportunities/${opportunity.body.id}/stage`)
        .send({ toStage, version: 0, ...(reason ? { reason } : {}) });
    await transition('FORECAST').expect(422);
    await transition('PRIMEIRO_CONTATO').expect(422);
    await transition('PERDIDA', '   ').expect(422);
    await transition('APRESENTACAO_ORCAMENTO').expect(200);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${opportunity.body.id}/stage`)
      .send({ toStage: 'FOLLOW_UP', version: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${opportunity.body.id}/stage`)
      .send({ toStage: 'APRESENTACAO_ORCAMENTO', version: 2 })
      .expect(422);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${opportunity.body.id}/stage`)
      .send({ toStage: 'PERDIDA', version: 2, reason: 'Sem orçamento' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${opportunity.body.id}/stage`)
      .send({ toStage: 'PRIMEIRO_CONTATO', version: 3, reason: 'Reabrir' })
      .expect(422);

    const deleted = await createOpportunity('Excluída antes da transição');
    await request(app.getHttpServer())
      .delete(`/api/opportunities/${deleted.body.id}`)
      .expect(204);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${deleted.body.id}/stage`)
      .send({ toStage: 'PERDIDA', version: 0, reason: 'Motivo' })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/opportunities/${deleted.body.id}/history`)
      .expect(404);
  });

  it('allows loss from every active stage and closing only from forecast', async () => {
    const stages = [
      'PRIMEIRO_CONTATO',
      'APRESENTACAO_ORCAMENTO',
      'FOLLOW_UP',
      'FORECAST',
    ] as const;
    for (const [index, stage] of stages.entries()) {
      const created = await createOpportunity(`Perda ${index}`);
      if (stage !== 'PRIMEIRO_CONTATO') {
        await prisma.opportunity.update({
          where: { id: created.body.id },
          data: { stage, version: 8 },
        });
      }
      const lost = await request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}/stage`)
        .send({
          toStage: 'PERDIDA',
          version: stage === 'PRIMEIRO_CONTATO' ? 0 : 8,
          reason: 'Sem interesse',
        })
        .expect(200);
      expect(lost.body.lossReason).toBe('Sem interesse');
      const [history] = await prisma.stageTransition.findMany({
        where: { opportunityId: created.body.id },
      });
      expect(history?.reason).toBe('Sem interesse');
    }

    const closing = await createOpportunity('Fechamento após forecast');
    await prisma.opportunity.update({
      where: { id: closing.body.id },
      data: { stage: 'FORECAST', version: 7 },
    });
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${closing.body.id}/stage`)
      .send({ toStage: 'FECHAMENTO', version: 7 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${closing.body.id}/stage`)
      .send({ toStage: 'PERDIDA', version: 8, reason: 'Cancelou' })
      .expect(422);
  });

  it('rejects stale and concurrent versions with a single transition record', async () => {
    const created = await createOpportunity('Concorrência de transição');
    const payload = { toStage: 'APRESENTACAO_ORCAMENTO', version: 0 };
    const responses = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}/stage`)
        .send(payload),
      request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}/stage`)
        .send(payload),
    ]);
    expect(
      responses
        .map((response) => response.status)
        .sort((left, right) => left - right),
    ).toEqual([200, 409]);
    expect(
      await prisma.stageTransition.count({
        where: { opportunityId: created.body.id },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${created.body.id}/stage`)
      .send(payload)
      .expect(409);
  });

  it('allows only one concurrent PATCH using the same opportunity version', async () => {
    const created = await createOpportunity('PATCH concorrente');
    const responses = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}`)
        .send({ version: 0, companyName: `${companyPrefix} edição A` }),
      request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}`)
        .send({ version: 0, companyName: `${companyPrefix} edição B` }),
    ]);
    expect(
      responses
        .map((response) => response.status)
        .sort((left, right) => left - right),
    ).toEqual([200, 409]);
    const current = await prisma.opportunity.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(current.version).toBe(1);
    expect([
      `${companyPrefix} edição A`,
      `${companyPrefix} edição B`,
    ]).toContain(current.companyName);
  });

  it('serializes a PATCH against a stage transition on the same version', async () => {
    const created = await createOpportunity('PATCH contra etapa');
    const [commercialEdit, transition] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}`)
        .send({ version: 0, companyName: `${companyPrefix} editada` }),
      request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}/stage`)
        .send({ toStage: 'APRESENTACAO_ORCAMENTO', version: 0 }),
    ]);
    expect(
      [commercialEdit.status, transition.status].sort(
        (left, right) => left - right,
      ),
    ).toEqual([200, 409]);
    const current = await prisma.opportunity.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(current.version).toBe(1);
    expect(current.stage).toBe(
      transition.status === 200 ? 'APRESENTACAO_ORCAMENTO' : 'PRIMEIRO_CONTATO',
    );
    expect(
      await prisma.stageTransition.count({
        where: { opportunityId: created.body.id },
      }),
    ).toBe(transition.status === 200 ? 1 : 0);
  });

  it('completes an integrated sale flow and resolves its open alert on closing', async () => {
    const created = await createOpportunity('Fluxo venda completa', {
      nextFollowUpAt: '2026-10-14T10:00:00.000Z',
    });
    const reference = new Date('2026-10-15T12:00:00.000Z');
    expect(await alerts.evaluate(reference, [created.body.id])).toMatchObject({
      created: 1,
    });

    let opportunity = (
      await request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}/stage`)
        .send({ toStage: 'APRESENTACAO_ORCAMENTO', version: 0 })
        .expect(200)
    ).body;
    opportunity = (
      await request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}/stage`)
        .send({ toStage: 'FOLLOW_UP', version: opportunity.version })
        .expect(200)
    ).body;
    await request(app.getHttpServer())
      .post(`/api/opportunities/${created.body.id}/activities`)
      .send({
        type: 'CALL',
        description: 'Cliente confirmou recebimento do orçamento',
        occurredAt: '2026-10-15T10:00:00.000Z',
      })
      .expect(201);
    const current = await prisma.opportunity.findUniqueOrThrow({
      where: { id: created.body.id },
      select: { version: true },
    });
    opportunity = (
      await request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}/stage`)
        .send({ toStage: 'FORECAST', version: current.version })
        .expect(200)
    ).body;
    opportunity = (
      await request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}/stage`)
        .send({ toStage: 'FECHAMENTO', version: opportunity.version })
        .expect(200)
    ).body;

    const history = await request(app.getHttpServer())
      .get(`/api/opportunities/${created.body.id}/history`)
      .expect(200);
    expect(
      history.body.map((entry: { toStage: string }) => entry.toStage),
    ).toEqual([
      'APRESENTACAO_ORCAMENTO',
      'FOLLOW_UP',
      'FORECAST',
      'FECHAMENTO',
    ]);
    expect(await alerts.evaluate(reference, [created.body.id])).toMatchObject({
      resolved: 1,
    });
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${created.body.id}/stage`)
      .send({ toStage: 'PERDIDA', version: opportunity.version, reason: 'x' })
      .expect(422);
    expect(
      await prisma.followUpAlert.count({
        where: { opportunityId: created.body.id, status: 'OPEN' },
      }),
    ).toBe(0);
  });

  it('serializes a commercial patch against soft deletion', async () => {
    const created = await createOpportunity('Patch contra exclusão');
    const [patched, deleted] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}`)
        .send({ version: 0, companyName: `${companyPrefix} alterada` }),
      request(app.getHttpServer()).delete(
        `/api/opportunities/${created.body.id}`,
      ),
    ]);

    expect([200, 404]).toContain(patched.status);
    expect(deleted.status).toBe(204);
    const stored = await prisma.opportunity.findUniqueOrThrow({
      where: { id: created.body.id },
      select: { deletedAt: true },
    });
    expect(stored.deletedAt).toBeInstanceOf(Date);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${created.body.id}`)
      .send({ version: 0, companyName: 'Não pode alterar' })
      .expect(404);
  });

  it('records a lost opportunity and prevents new alerts for the terminal stage', async () => {
    const created = await createOpportunity('Fluxo oportunidade perdida', {
      nextFollowUpAt: '2026-10-14T10:00:00.000Z',
    });
    await request(app.getHttpServer())
      .post(`/api/opportunities/${created.body.id}/activities`)
      .send({
        type: 'EMAIL',
        description: 'Cliente recusou a proposta',
        occurredAt: '2026-10-15T10:00:00.000Z',
      })
      .expect(201);
    const reference = new Date('2026-10-15T12:00:00.000Z');
    expect(await alerts.evaluate(reference, [created.body.id])).toMatchObject({
      created: 1,
    });
    const lost = await request(app.getHttpServer())
      .patch(`/api/opportunities/${created.body.id}/stage`)
      .send({
        toStage: 'PERDIDA',
        version: 1,
        reason: 'Prazo de entrega incompatível',
      })
      .expect(200);
    expect(lost.body.lossReason).toBe('Prazo de entrega incompatível');
    expect(
      await request(app.getHttpServer())
        .get(`/api/opportunities/${created.body.id}/history`)
        .expect(200),
    ).toHaveProperty('body[0].toStage', 'PERDIDA');
    expect(await alerts.evaluate(reference, [created.body.id])).toMatchObject({
      created: 0,
      resolved: 1,
    });
    expect(
      await prisma.followUpAlert.count({
        where: { opportunityId: created.body.id, status: 'OPEN' },
      }),
    ).toBe(0);
  });

  it('rolls back the stage update when PostgreSQL rejects the history insert', async () => {
    const created = await createOpportunity('Atomicidade do histórico');
    await prisma.$executeRaw`CREATE OR REPLACE FUNCTION reject_stage_transition_for_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced history failure'; END $$`;
    await prisma.$executeRaw`CREATE TRIGGER reject_stage_transition_for_test BEFORE INSERT ON "StageTransition" FOR EACH ROW EXECUTE FUNCTION reject_stage_transition_for_test()`;
    try {
      await request(app.getHttpServer())
        .patch(`/api/opportunities/${created.body.id}/stage`)
        .send({ toStage: 'APRESENTACAO_ORCAMENTO', version: 0 })
        .expect(500);
      const current = await prisma.opportunity.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      expect(current).toMatchObject({ stage: 'PRIMEIRO_CONTATO', version: 0 });
      expect(
        await prisma.stageTransition.count({
          where: { opportunityId: created.body.id },
        }),
      ).toBe(0);
    } finally {
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS reject_stage_transition_for_test ON "StageTransition"`;
      await prisma.$executeRaw`DROP FUNCTION IF EXISTS reject_stage_transition_for_test()`;
    }
  });

  it('prevents common edits from removing established budget data while allowing legacy gaps', async () => {
    const normal = await createOpportunity('Dados comerciais protegidos');
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${normal.body.id}/stage`)
      .send({ toStage: 'APRESENTACAO_ORCAMENTO', version: 0 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${normal.body.id}`)
      .send({
        version: 1,
        companyName: normal.body.companyName,
        estimatedValue: null,
      })
      .expect(422);
    await request(app.getHttpServer())
      .patch(`/api/opportunities/${normal.body.id}`)
      .send({ version: 1, companyName: normal.body.companyName, items: [] })
      .expect(422);

    const legacy = await prisma.opportunity.create({
      data: {
        code: `OPP-LEGACY-${randomUUID().slice(0, 8)}`,
        companyName: `${companyPrefix} histórico incompleto`,
        stage: 'APRESENTACAO_ORCAMENTO',
      },
    });
    const edited = await request(app.getHttpServer())
      .patch(`/api/opportunities/${legacy.id}`)
      .send({ version: 0, companyName: `${companyPrefix} histórico editado` })
      .expect(200);
    expect(edited.body.companyName).toBe(`${companyPrefix} histórico editado`);
  });

  it('lists sellers and preserves seeded records and item IDs on repeated seed runs', async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl)
      throw new Error('DATABASE_URL is required for integration tests');
    const runSeed = (script: string) =>
      execFileSync('npm', ['run', script], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'ignore',
      });
    const seededTransitionCount = await prisma.stageTransition.count({
      where: {
        opportunity: {
          code: {
            in: Array.from({ length: 7 }, (_, index) => `OPP-${2001 + index}`),
          },
        },
      },
    });
    runSeed('prisma:seed');

    const codes = Array.from(
      { length: 7 },
      (_, index) => `OPP-${2001 + index}`,
    );
    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { code: 'OPP-2001' },
      include: { items: true },
    });
    const [item] = opportunity.items;
    if (!item) throw new Error('OPP-2001 must have its case item');
    const originalItems = opportunity.items.map(({ id, name, quantity }) => ({
      id,
      name,
      quantity,
    }));
    const original = {
      companyName: opportunity.companyName,
      estimatedValue: opportunity.estimatedValue?.toFixed(2) ?? null,
      stage: opportunity.stage,
      version: opportunity.version,
      salespersonId: opportunity.salespersonId,
      itemId: item.id,
    };

    try {
      await prisma.$transaction([
        prisma.opportunity.update({
          where: { id: opportunity.id },
          data: {
            companyName: `${companyPrefix} alterada depois da seed`,
            estimatedValue: '98765.43',
            version: { increment: 1 },
          },
        }),
        prisma.opportunityItem.update({
          where: { id: item.id },
          data: { name: 'Brinde ajustado no CRM', quantity: 321 },
        }),
      ]);

      runSeed('seed:run');
      runSeed('seed:run');

      const [afterReruns, count, salespeople, httpSalespeople] =
        await Promise.all([
          prisma.opportunity.findUniqueOrThrow({
            where: { code: 'OPP-2001' },
            include: { items: true },
          }),
          prisma.opportunity.count({ where: { code: { in: codes } } }),
          prisma.salesperson.findMany({
            where: { name: { in: ['Ana', 'Bruno', 'Carla'] } },
          }),
          request(app.getHttpServer()).get('/api/salespeople').expect(200),
        ]);
      expect(count).toBe(7);
      expect(
        await prisma.stageTransition.count({
          where: { opportunity: { code: { in: codes } } },
        }),
      ).toBe(seededTransitionCount);
      expect(afterReruns).toMatchObject({
        companyName: `${companyPrefix} alterada depois da seed`,
        stage: original.stage,
        salespersonId: original.salespersonId,
        version: original.version + 1,
      });
      expect(afterReruns.estimatedValue?.toFixed(2)).toBe('98765.43');
      expect(afterReruns.items).toHaveLength(originalItems.length);
      expect(
        afterReruns.items.map(({ id, name, quantity }) => ({
          id,
          name,
          quantity,
        })),
      ).toEqual(
        originalItems.map((existingItem) =>
          existingItem.id === original.itemId
            ? { ...existingItem, name: 'Brinde ajustado no CRM', quantity: 321 }
            : existingItem,
        ),
      );
      expect(salespeople).toHaveLength(3);
      expect(
        httpSalespeople.body.map((person: { name: string }) => person.name),
      ).toContain('Ana');
    } finally {
      await prisma.$transaction([
        prisma.opportunity.update({
          where: { id: opportunity.id },
          data: {
            companyName: original.companyName,
            estimatedValue: original.estimatedValue,
            stage: original.stage,
            version: original.version,
            salespersonId: original.salespersonId,
          },
        }),
        ...originalItems.map((existingItem) =>
          prisma.opportunityItem.update({
            where: { id: existingItem.id },
            data: {
              name: existingItem.name,
              quantity: existingItem.quantity,
            },
          }),
        ),
      ]);
    }
  }, 30_000);
});

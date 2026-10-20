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

describe('Opportunities API (PostgreSQL integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
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

  async function createOpportunity(suffix: string) {
    return request(app.getHttpServer())
      .post('/api/opportunities')
      .send(createBody(suffix))
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
    expect(first.body.items).toEqual([
      expect.objectContaining({ name: 'Caderno personalizado', quantity: 10 }),
    ]);
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

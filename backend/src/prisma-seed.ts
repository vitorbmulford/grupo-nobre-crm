import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const records = [
  {
    code: 'OPP-2001',
    companyName: 'Tech Alpha Ltda',
    stage: 'PRIMEIRO_CONTATO',
    estimatedValue: '4500.00',
    lastContactAt: '2026-10-14',
    proposalValidUntil: null,
    customerEventDate: '2026-11-30',
    salespersonName: 'Ana',
    itemName: 'Caneca personalizada',
    quantity: 300,
  },
  {
    code: 'OPP-2002',
    companyName: 'Construtora Horizonte',
    stage: 'APRESENTACAO_ORCAMENTO',
    estimatedValue: '9800.00',
    lastContactAt: '2026-10-06',
    proposalValidUntil: '2026-10-13',
    customerEventDate: '2026-10-25',
    salespersonName: 'Bruno',
    itemName: 'Kit escritório',
    quantity: 120,
  },
  {
    code: 'OPP-2003',
    companyName: 'Clínica Vida',
    stage: 'FOLLOW_UP',
    estimatedValue: '7200.00',
    lastContactAt: '2026-10-13',
    proposalValidUntil: '2026-10-20',
    customerEventDate: '2026-10-18',
    salespersonName: 'Ana',
    itemName: 'Squeeze personalizado',
    quantity: 500,
  },
  {
    code: 'OPP-2004',
    companyName: 'Agência Pulso',
    stage: 'FOLLOW_UP',
    estimatedValue: '3900.00',
    lastContactAt: '2026-10-02',
    proposalValidUntil: '2026-10-10',
    customerEventDate: '2026-11-05',
    salespersonName: 'Carla',
    itemName: 'Camiseta estampada',
    quantity: 80,
  },
  {
    code: 'OPP-2005',
    companyName: 'Banco Norte',
    stage: 'FORECAST',
    estimatedValue: '38000.00',
    lastContactAt: '2026-10-15',
    proposalValidUntil: '2026-10-22',
    customerEventDate: '2026-12-12',
    salespersonName: 'Bruno',
    itemName: 'Agenda executiva',
    quantity: 1000,
  },
  {
    code: 'OPP-2006',
    companyName: 'Escola Saber',
    stage: 'FECHAMENTO',
    estimatedValue: '11500.00',
    lastContactAt: '2026-10-09',
    proposalValidUntil: '2026-10-16',
    customerEventDate: '2026-10-17',
    salespersonName: 'Carla',
    itemName: 'Mochila infantil',
    quantity: 250,
  },
  {
    code: 'OPP-2007',
    companyName: 'Padaria do Bairro',
    stage: 'PERDIDA',
    estimatedValue: '350.00',
    lastContactAt: '2026-10-01',
    proposalValidUntil: '2026-10-08',
    customerEventDate: '2026-10-20',
    salespersonName: 'Ana',
    itemName: 'Caneta promocional',
    quantity: 50,
  },
] as const;

async function seed() {
  const salespeople = new Map<string, string>();
  for (const name of new Set(records.map((record) => record.salespersonName))) {
    const salesperson = await prisma.salesperson.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    salespeople.set(name, salesperson.id);
  }

  for (const record of records) {
    const data = {
      companyName: record.companyName,
      stage: record.stage,
      estimatedValue: record.estimatedValue,
      lastContactAt: new Date(`${record.lastContactAt}T00:00:00.000Z`),
      proposalValidUntil: record.proposalValidUntil
        ? new Date(`${record.proposalValidUntil}T00:00:00.000Z`)
        : null,
      customerEventDate: new Date(`${record.customerEventDate}T00:00:00.000Z`),
      lossReason: null,
      nextFollowUpAt: null,
      salespersonId: salespeople.get(record.salespersonName)!,
    };
    await prisma.opportunity.upsert({
      where: { code: record.code },
      create: {
        ...data,
        code: record.code,
        items: {
          create: { name: record.itemName, quantity: record.quantity },
        },
      },
      update: {},
    });
  }
}

try {
  await seed();
  console.info(`Ensured ${records.length} case opportunities.`);
} catch (error) {
  console.error('Opportunity seed failed.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

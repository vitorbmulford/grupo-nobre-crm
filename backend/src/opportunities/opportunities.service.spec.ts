import { OpportunitiesService } from './opportunities.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('OpportunitiesService', () => {
  it('always scopes list queries to active opportunities and applies query filters', async () => {
    const count = vi.fn().mockResolvedValue(1);
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      opportunity: { count, findMany },
    } as unknown as PrismaService;
    const service = new OpportunitiesService(prisma);

    await service.list({
      search: 'Alpha',
      stage: 'FOLLOW_UP',
      salespersonId: '8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae',
      sortBy: 'companyName',
      sortOrder: 'asc',
      page: 2,
      limit: 10,
    });

    const expectedWhere = {
      deletedAt: null,
      stage: 'FOLLOW_UP',
      salespersonId: '8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae',
      OR: [
        { code: { contains: 'Alpha', mode: 'insensitive' } },
        { companyName: { contains: 'Alpha', mode: 'insensitive' } },
      ],
    };
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        orderBy: [{ companyName: 'asc' }, { id: 'asc' }],
        skip: 10,
        take: 10,
      }),
    );
  });

  it('counts active rows and reports empty result pagination consistently', async () => {
    const prisma = {
      opportunity: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const service = new OpportunitiesService(prisma);

    await expect(service.list({ page: 1, limit: 20 })).resolves.toMatchObject({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('finds accented company names from unaccented search suggestions', async () => {
    const count = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const prisma = {
      opportunity: { count, findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new OpportunitiesService(prisma);

    await service.list({ search: 'agencia', page: 1, limit: 10 });

    expect(count.mock.calls[1][0].where.OR).toContainEqual({
      companyName: { contains: 'agência', mode: 'insensitive' },
    });
  });
});

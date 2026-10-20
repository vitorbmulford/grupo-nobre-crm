import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SalespeopleService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.salesperson.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, createdAt: true },
    });
  }
}

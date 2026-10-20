import { Module } from '@nestjs/common';
import { SalespeopleController } from './salespeople.controller.js';
import { SalespeopleService } from './salespeople.service.js';

@Module({
  controllers: [SalespeopleController],
  providers: [SalespeopleService],
})
export class SalespeopleModule {}

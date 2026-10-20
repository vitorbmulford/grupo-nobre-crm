import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { SalespeopleService } from './salespeople.service.js';

class SalespersonDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana' })
  name!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

@ApiTags('Salespeople')
@Controller('salespeople')
export class SalespeopleController {
  constructor(private readonly salespeople: SalespeopleService) {}

  @Get()
  @ApiOperation({ summary: 'Listar vendedores disponíveis para atribuição' })
  @ApiOkResponse({ type: [SalespersonDto] })
  findAll() {
    return this.salespeople.findAll();
  }
}

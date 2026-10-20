import { ApiProperty } from '@nestjs/swagger';

export class SalespersonResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana' })
  name!: string;
}

export class OpportunityItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Caneca personalizada' })
  name!: string;

  @ApiProperty({ example: 300 })
  quantity!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class OpportunityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'OPP-2008' })
  code!: string;

  @ApiProperty({ example: 'Tech Alpha Ltda' })
  companyName!: string;

  @ApiProperty({
    enum: [
      'PRIMEIRO_CONTATO',
      'APRESENTACAO_ORCAMENTO',
      'FOLLOW_UP',
      'FORECAST',
      'FECHAMENTO',
      'PERDIDA',
    ],
  })
  stage!: string;

  @ApiProperty({ example: '4500.00', nullable: true })
  estimatedValue!: string | null;

  @ApiProperty({ example: '2026-10-14', format: 'date', nullable: true })
  lastContactAt!: string | null;

  @ApiProperty({ example: '2026-10-20', format: 'date', nullable: true })
  proposalValidUntil!: string | null;

  @ApiProperty({ example: '2026-11-30', format: 'date', nullable: true })
  customerEventDate!: string | null;

  @ApiProperty({
    example: '2026-10-21T13:00:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  nextFollowUpAt!: string | null;

  @ApiProperty({ example: null, nullable: true })
  lossReason!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  salespersonId!: string | null;

  @ApiProperty({ example: 0 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: SalespersonResponseDto, nullable: true })
  salesperson!: SalespersonResponseDto | null;

  @ApiProperty({ type: [OpportunityItemResponseDto] })
  items!: OpportunityItemResponseDto[];
}

export class OpportunityPageMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 7 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class OpportunityListResponseDto {
  @ApiProperty({ type: [OpportunityResponseDto] })
  data!: OpportunityResponseDto[];

  @ApiProperty({ type: OpportunityPageMetaDto })
  meta!: OpportunityPageMetaDto;
}

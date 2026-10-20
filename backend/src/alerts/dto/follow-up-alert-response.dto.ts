import { ApiProperty } from '@nestjs/swagger';
import {
  FollowUpAlertStatus,
  FollowUpAlertType,
} from '../../generated/prisma/client.js';

export class AlertOpportunitySummaryDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'UUID da oportunidade relacionada, com o mesmo valor do campo opportunityId do alerta. Use este valor no segmento :opportunityId de GET /api/opportunities/:opportunityId/alerts.',
    example: '30a1c326-4df9-48dc-9192-d9a7f6193924',
  })
  id!: string;

  @ApiProperty({ example: 'OPP-2004' })
  code!: string;

  @ApiProperty({ example: 'Agência Pulso' })
  companyName!: string;

  @ApiProperty({ example: 'FOLLOW_UP' })
  stage!: string;
}

export class FollowUpAlertResponseDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'UUID do alerta. Use este valor no segmento :alertId de PATCH /api/alerts/:alertId/resolve.',
    example: '939b5a24-d99a-4188-a24a-b433fbddf845',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'UUID da oportunidade relacionada; é diferente do id do alerta e identifica a oportunidade.',
    example: '30a1c326-4df9-48dc-9192-d9a7f6193924',
  })
  opportunityId!: string;

  @ApiProperty({ enum: FollowUpAlertType })
  type!: FollowUpAlertType;

  @ApiProperty({ enum: FollowUpAlertStatus })
  status!: FollowUpAlertStatus;

  @ApiProperty({ format: 'date-time' })
  referenceAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  resolvedAt!: string | null;

  @ApiProperty({ type: AlertOpportunitySummaryDto })
  opportunity!: AlertOpportunitySummaryDto;
}

export class FollowUpAlertListResponseDto {
  @ApiProperty({ type: [FollowUpAlertResponseDto] })
  data!: FollowUpAlertResponseDto[];

  @ApiProperty({
    example: { page: 1, limit: 20, total: 3, totalPages: 1 },
  })
  meta!: { page: number; limit: number; total: number; totalPages: number };
}

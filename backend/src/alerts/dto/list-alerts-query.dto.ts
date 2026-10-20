import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  FollowUpAlertStatus,
  FollowUpAlertType,
} from '../../generated/prisma/client.js';

export class ListAlertsQueryDto {
  @ApiPropertyOptional({ enum: FollowUpAlertStatus })
  @IsOptional()
  @IsEnum(FollowUpAlertStatus)
  status?: FollowUpAlertStatus;

  @ApiPropertyOptional({ enum: FollowUpAlertType })
  @IsOptional()
  @IsEnum(FollowUpAlertType)
  type?: FollowUpAlertType;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Filtra pelo UUID da oportunidade relacionada; não é o id do alerta.',
  })
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ListOpportunityAlertsQueryDto extends OmitType(
  ListAlertsQueryDto,
  ['opportunityId'] as const,
) {}

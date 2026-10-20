import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OpportunityStage } from '../../generated/prisma/client.js';

export const opportunitySortFields = [
  'code',
  'companyName',
  'stage',
  'estimatedValue',
  'createdAt',
  'updatedAt',
  'lastContactAt',
  'proposalValidUntil',
  'customerEventDate',
] as const;

export class ListOpportunitiesQueryDto {
  @ApiPropertyOptional({ example: 'Tech Alpha', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: OpportunityStage })
  @IsOptional()
  @IsEnum(OpportunityStage)
  stage?: OpportunityStage;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  salespersonId?: string;

  @ApiPropertyOptional({ enum: opportunitySortFields, default: 'createdAt' })
  @IsOptional()
  @IsIn(opportunitySortFields)
  sortBy?: (typeof opportunitySortFields)[number] = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

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

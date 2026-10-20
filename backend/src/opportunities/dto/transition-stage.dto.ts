import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { OpportunityStage } from '../../generated/prisma/client.js';

export class TransitionStageDto {
  @ApiProperty({ enum: OpportunityStage, example: 'FOLLOW_UP' })
  @IsEnum(OpportunityStage)
  toStage!: OpportunityStage;

  @ApiProperty({
    example: 2,
    minimum: 0,
    description: 'Versão atual retornada pela API.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;

  @ApiPropertyOptional({
    example: 'Cliente solicitou nova avaliação',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

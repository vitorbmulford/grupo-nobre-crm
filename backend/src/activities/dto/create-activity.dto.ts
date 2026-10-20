import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ActivityType } from '../../generated/prisma/client.js';

export class CreateActivityDto {
  @ApiProperty({ enum: ActivityType, example: ActivityType.CALL })
  @IsEnum(ActivityType)
  type!: ActivityType;

  @ApiProperty({
    maxLength: 2000,
    example: 'Cliente confirmou recebimento do orçamento.',
  })
  @IsString()
  @Matches(/\S/, {
    message: 'description must contain a non-whitespace character',
  })
  @MaxLength(2000)
  description!: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-20T14:30:00.000Z',
  })
  @IsDateString({ strict: true })
  occurredAt!: string;
}

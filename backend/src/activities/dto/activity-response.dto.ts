import { ApiProperty } from '@nestjs/swagger';
import { ActivityType } from '../../generated/prisma/client.js';

export class ActivityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  opportunityId!: string;

  @ApiProperty({ enum: ActivityType })
  type!: ActivityType;

  @ApiProperty({ maxLength: 2000 })
  description!: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ActivityListResponseDto {
  @ApiProperty({ type: [ActivityResponseDto] })
  data!: ActivityResponseDto[];

  @ApiProperty({
    example: { page: 1, limit: 20, total: 0, totalPages: 0 },
  })
  meta!: { page: number; limit: number; total: number; totalPages: number };
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ValidationDetailDto {
  @ApiProperty({ example: 'items.0.quantity' })
  field!: string;

  @ApiProperty({
    type: [String],
    example: ['quantity must not be less than 1'],
  })
  constraints!: string[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiPropertyOptional({ type: [ValidationDetailDto] })
  details?: ValidationDetailDto[];

  @ApiProperty({ format: 'uuid' })
  correlationId!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;

  @ApiProperty({ example: '/api/opportunities' })
  path!: string;
}

import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpportunityItemInputDto {
  @ApiProperty({ example: 'Caneca personalizada' })
  @IsString()
  @Matches(/\S/, { message: 'name should not be empty' })
  @MaxLength(240)
  name!: string;

  @ApiProperty({ example: 300, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOpportunityDto {
  @ApiProperty({ example: 'Tech Alpha Ltda' })
  @IsString()
  @Matches(/\S/, { message: 'companyName should not be empty' })
  @MaxLength(240)
  companyName!: string;

  @ApiPropertyOptional({
    example: '4500.00',
    nullable: true,
    pattern: '^\\d{1,12}(\\.\\d{1,2})?$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, {
    message:
      'estimatedValue must be a non-negative decimal with up to 2 decimal places',
  })
  estimatedValue?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-14',
    nullable: true,
    format: 'date',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  lastContactAt?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-20',
    nullable: true,
    format: 'date',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  proposalValidUntil?: string | null;

  @ApiPropertyOptional({
    example: '2026-11-30',
    nullable: true,
    format: 'date',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  customerEventDate?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-21T13:00:00.000Z',
    nullable: true,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string | null;

  @ApiPropertyOptional({
    example: 'Prazo incompatível',
    nullable: true,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  lossReason?: string | null;

  @ApiPropertyOptional({
    example: '8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  salespersonId?: string | null;

  @ApiPropertyOptional({ type: [OpportunityItemInputDto] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpportunityItemInputDto)
  items?: OpportunityItemInputDto[];
}

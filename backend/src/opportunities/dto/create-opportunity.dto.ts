import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
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
    example: 'Mariana Souza',
    nullable: true,
    maxLength: 160,
  })
  @Transform(({ value }) => trimOptionalText(value))
  @ValidateIf((_object, value) => hasText(value))
  @IsString()
  @MaxLength(160)
  @Matches(/^[\p{L}\p{M}][\p{L}\p{M} .,'’()/-]*$/u, {
    message: 'contactName contains invalid characters',
  })
  contactName?: string | null;

  @ApiPropertyOptional({
    example: '(11) 99999-0000',
    nullable: true,
    maxLength: 30,
  })
  @Transform(({ value }) => trimOptionalText(value))
  @ValidateIf((_object, value) => hasText(value))
  @IsString()
  @MaxLength(30)
  @Matches(/^(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}-?\d{4}$/, {
    message: 'Informe um telefone com DDD e número válido.',
  })
  contactPhone?: string | null;

  @ApiPropertyOptional({
    example: 'mariana@empresa.com.br',
    nullable: true,
    maxLength: 254,
  })
  @Transform(({ value }) => trimOptionalText(value))
  @ValidateIf((_object, value) => hasText(value))
  @IsString()
  @MaxLength(254)
  @IsEmail()
  contactEmail?: string | null;

  @ApiPropertyOptional({
    example: 'www.empresa.com.br',
    nullable: true,
    maxLength: 2048,
  })
  @Transform(({ value }) => trimOptionalText(value))
  @ValidateIf((_object, value) => hasText(value))
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_protocol: false, protocols: ['http', 'https'] })
  @Matches(
    /^(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i,
    { message: 'companyWebsite must be a valid website address' },
  )
  companyWebsite?: string | null;

  @ApiPropertyOptional({
    example: 'São Paulo, SP',
    nullable: true,
    maxLength: 240,
  })
  @Transform(({ value }) => trimOptionalText(value))
  @ValidateIf((_object, value) => hasText(value))
  @IsString()
  @MaxLength(240)
  @Matches(/^[\p{L}\p{M}\s,.'’()/-]+$/u, {
    message: 'Use apenas letras e pontuação comum para cidade e estado.',
  })
  companyLocation?: string | null;

  @ApiPropertyOptional({
    example: 'Distribuidora de materiais para escritório.',
    nullable: true,
    maxLength: 2000,
  })
  @Transform(({ value }) => trimOptionalText(value))
  @ValidateIf((_object, value) => hasText(value))
  @IsString()
  @MaxLength(2000)
  companyDescription?: string | null;

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
    description: 'Timestamp ISO 8601 com Z ou offset explícito.',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i, {
    message: 'nextFollowUpAt must include a timezone offset',
  })
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

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function trimOptionalText(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { CreateOpportunityDto } from './create-opportunity.dto.js';

export class UpdateOpportunityDto extends CreateOpportunityDto {
  @ApiProperty({
    example: 0,
    description:
      'Versão retornada pela API; impede sobrescrever atualizações concorrentes.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;
}

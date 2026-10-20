import { ApiProperty } from '@nestjs/swagger';

const stages = [
  'PRIMEIRO_CONTATO',
  'APRESENTACAO_ORCAMENTO',
  'FOLLOW_UP',
  'FORECAST',
  'FECHAMENTO',
  'PERDIDA',
] as const;

export class StageTransitionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: stages, nullable: true })
  fromStage!: string | null;

  @ApiProperty({ enum: stages })
  toStage!: string;

  @ApiProperty({ nullable: true, example: 'Cliente solicitou nova avaliação' })
  reason!: string | null;

  @ApiProperty({ format: 'date-time' })
  changedAt!: string;
}

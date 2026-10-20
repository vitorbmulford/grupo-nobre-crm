import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../http/api-error-response.dto.js';
import {
  ActivityResponseDto,
  ActivityListResponseDto,
} from './dto/activity-response.dto.js';
import { CreateActivityDto } from './dto/create-activity.dto.js';
import { ListActivitiesQueryDto } from './dto/list-activities-query.dto.js';
import { ActivitiesService } from './activities.service.js';

@ApiTags('Activities')
@Controller('opportunities/:id/activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Post()
  @ApiParam({
    name: 'id',
    description: 'UUID da oportunidade à qual a atividade será vinculada.',
    format: 'uuid',
  })
  @ApiOperation({
    summary: 'Registrar interação comercial',
    description:
      'Todos os tipos representam contatos realizados. Não altera etapa nem cria transição de pipeline.',
  })
  @ApiCreatedResponse({ type: ActivityResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Tipo, descrição ou data inválidos.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Oportunidade inexistente ou excluída.',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiErrorResponseDto,
    description: 'A data do contato não pode estar no futuro.',
  })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activities.create(id, dto);
  }

  @Get()
  @ApiParam({
    name: 'id',
    description: 'UUID da oportunidade cujas atividades serão consultadas.',
    format: 'uuid',
  })
  @ApiOperation({
    summary: 'Consultar atividades da oportunidade',
    description:
      'Lista interações em ordem decrescente de occurredAt, com desempate por id, filtro por tipo e paginação.',
  })
  @ApiOkResponse({ type: ActivityListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Oportunidade inexistente ou excluída.',
  })
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListActivitiesQueryDto,
  ) {
    return this.activities.list(id, query);
  }
}

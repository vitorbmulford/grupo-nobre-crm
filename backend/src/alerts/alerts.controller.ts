import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../http/api-error-response.dto.js';
import {
  FollowUpAlertListResponseDto,
  FollowUpAlertResponseDto,
} from './dto/follow-up-alert-response.dto.js';
import {
  ListAlertsQueryDto,
  ListOpportunityAlertsQueryDto,
} from './dto/list-alerts-query.dto.js';
import { AlertsService } from './alerts.service.js';

@ApiTags('Alerts')
@Controller()
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('alerts')
  @ApiOperation({
    summary: 'Listar alertas comerciais',
    description:
      'Lista alertas internos do CRM; sem filtro de status, retorna somente os alertas OPEN. A ordenação é createdAt decrescente e id crescente.',
  })
  @ApiOkResponse({ type: FollowUpAlertListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  list(@Query() query: ListAlertsQueryDto) {
    return this.alerts.list(query, true);
  }

  @Get('opportunities/:opportunityId/alerts')
  @ApiParam({
    name: 'opportunityId',
    format: 'uuid',
    description:
      'UUID da oportunidade. Use o campo opportunityId (ou opportunity.id) retornado por GET /api/alerts. Não use o id do alerta.',
    example: '30a1c326-4df9-48dc-9192-d9a7f6193924',
  })
  @ApiOperation({
    summary: 'Listar alertas de uma oportunidade',
    description:
      'Retorna alertas abertos e resolvidos da oportunidade informada. O parâmetro opportunityId é o UUID da oportunidade (campo opportunityId na resposta de GET /api/alerts), não o id do alerta. Oportunidades excluídas logicamente retornam 404.',
  })
  @ApiOkResponse({ type: FollowUpAlertListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  listForOpportunity(
    @Param('opportunityId', ParseUUIDPipe) opportunityId: string,
    @Query() query: ListOpportunityAlertsQueryDto,
  ) {
    return this.alerts.listForOpportunity(opportunityId, query);
  }

  @Patch('alerts/:alertId/resolve')
  @ApiParam({
    name: 'alertId',
    format: 'uuid',
    description:
      'UUID do alerta, campo id retornado por GET /api/alerts. Não use opportunityId.',
  })
  @ApiOperation({
    summary: 'Resolver ou reconhecer um alerta',
    description:
      'Resolve um alerta aberto de forma idempotente. O reconhecimento impede a recriação da mesma ocorrência enquanto tipo e referência permanecerem em risco; o scheduler libera o reconhecimento quando a condição desaparece ou sua referência muda.',
  })
  @ApiOkResponse({ type: FollowUpAlertResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  resolve(@Param('alertId', ParseUUIDPipe) alertId: string) {
    return this.alerts.resolve(alertId);
  }
}

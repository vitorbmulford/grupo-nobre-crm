import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CreateOpportunityDto } from './dto/create-opportunity.dto.js';
import { ListOpportunitiesQueryDto } from './dto/list-opportunities-query.dto.js';
import {
  OpportunityListResponseDto,
  OpportunityResponseDto,
} from './dto/opportunity-response.dto.js';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto.js';
import { OpportunitiesService } from './opportunities.service.js';
import { ApiErrorResponseDto } from '../http/api-error-response.dto.js';

@ApiTags('Opportunities')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar oportunidades ativas',
    description:
      'Busca por código ou empresa. Oportunidades com deletedAt preenchido são omitidas.',
  })
  @ApiOkResponse({ type: OpportunityListResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Filtros inválidos.',
  })
  list(@Query() query: ListOpportunitiesQueryDto) {
    return this.opportunities.list(query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consultar oportunidade e seus itens' })
  @ApiOkResponse({ type: OpportunityResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Oportunidade inexistente ou excluída.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.opportunities.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar oportunidade em Primeiro Contato',
    description:
      'O código é atribuído pelo servidor. A etapa inicial é sempre PRIMEIRO_CONTATO.',
  })
  @ApiCreatedResponse({ type: OpportunityResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Dados ou itens inválidos.',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiErrorResponseDto,
    description: 'Vendedor inexistente.',
  })
  create(@Body() dto: CreateOpportunityDto) {
    return this.opportunities.create(dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Atualizar dados comerciais e itens',
    description:
      'Informe a version atual. A etapa não pode ser alterada por este endpoint; itens fornecidos substituem os itens atuais de forma transacional.',
  })
  @ApiOkResponse({ type: OpportunityResponseDto })
  @ApiBadRequestResponse({
    type: ApiErrorResponseDto,
    description: 'Dados inválidos ou propriedade stage não permitida.',
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'A versão informada está desatualizada.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Oportunidade inexistente ou excluída.',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiErrorResponseDto,
    description: 'Vendedor inexistente.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunities.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Excluir logicamente uma oportunidade',
    description:
      'Preenche deletedAt uma única vez. A oportunidade, o código e os itens permanecem no banco; chamadas repetidas são idempotentes.',
  })
  @ApiNoContentResponse({ description: 'Excluída ou já excluída.' })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Oportunidade inexistente.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.opportunities.softDelete(id);
  }
}

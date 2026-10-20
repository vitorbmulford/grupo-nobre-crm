import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@Controller()
@ApiTags('System')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Endpoint inicial da API' })
  @ApiResponse({ status: 200, description: 'API disponível' })
  getHello(): string {
    return this.appService.getHello();
  }
}

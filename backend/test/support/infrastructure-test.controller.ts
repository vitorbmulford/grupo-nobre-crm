import {
  Get,
  NotFoundException,
  Post,
  Body,
  Controller,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

class EchoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  name!: string;
}

@Controller()
export class InfrastructureTestController {
  @Post('test/echo')
  echo(@Body() body: EchoDto) {
    return body;
  }

  @Get('test/not-found')
  notFound(): never {
    throw new NotFoundException('Test resource not found');
  }

  @Get('test/unavailable')
  unavailable(): never {
    throw new ServiceUnavailableException('private dependency detail');
  }

  @Get('test/unexpected')
  unexpected(): never {
    const error = new Error(
      [
        'Unexpected storage failure',
        'DATABASE_URL=postgresql://crm:db-secret@db:5432/crm',
        'Authorization: Bearer auth-secret',
        'Cookie: session=cookie-secret',
        'body={"name":"body-secret"}',
        'request URL ?token=query-secret',
      ].join('\n'),
    );
    error.stack = `${error.name}: ${error.message}\n    at handler (token=stack-secret)`;
    throw error;
  }
}

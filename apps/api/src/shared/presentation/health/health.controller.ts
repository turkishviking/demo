import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthDto, OutboxHealthDto } from '@cardsim/shared';
import type { Response } from 'express';
import {
  DATABASE_HEALTH_PROBE,
  type DatabaseHealthProbe,
  OUTBOX_STATS_READER,
  type OutboxStatsReader,
} from '../../application/health.port';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_HEALTH_PROBE) private readonly database: DatabaseHealthProbe,
    @Inject(OUTBOX_STATS_READER) private readonly outbox: OutboxStatsReader,
  ) {}

  @Get()
  @ApiOperation({ summary: "État de l'API et de la base" })
  async health(@Res({ passthrough: true }) res: Response): Promise<HealthDto> {
    const up = await this.database.isUp();
    if (!up) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: up ? 'ok' : 'degraded', database: up ? 'up' : 'down' };
  }

  @Get('outbox')
  @ApiOperation({ summary: "Events en attente et en dead letter dans l'outbox" })
  outboxHealth(): Promise<OutboxHealthDto> {
    return this.outbox.read();
  }
}

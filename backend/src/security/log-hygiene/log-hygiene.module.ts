import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { pinoHttpOptions } from './log-redaction';

/** JSON structured logging via Pino (§4) with DESC control 15 redaction. */
@Module({
  imports: [LoggerModule.forRoot({ pinoHttp: pinoHttpOptions })],
})
export class LogHygieneModule {}

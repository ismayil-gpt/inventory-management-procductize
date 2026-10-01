import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { AuthSessionRepository } from './auth-session.repository';
import { MultiFactorService } from './multi-factor.service';

@Module({
  imports: [
    PassportModule,
    // Secrets/expiry are passed per-token in the service (separate access +
    // refresh secrets), so the module registers with no default.
    JwtModule.register({}),
  ],
  controllers: [AuthenticationController],
  providers: [AuthenticationService, JwtAccessStrategy, AuthSessionRepository, MultiFactorService],
  exports: [AuthenticationService, AuthSessionRepository, MultiFactorService],
})
export class AuthenticationModule {}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { AuthSessionRepository } from '../auth-session.repository';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  sid?: string;
}

/** Validates the Bearer access token and populates request.user (§11 #4). */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly sessions: AuthSessionRepository) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev_access_secret'),
    });
  }

  /** A valid signature is not enough: the session must still be open (DESC #4). */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (!payload.sid || !(await this.sessions.isActive(payload.sid))) {
      throw new UnauthorizedException({
        code: 'SESSION_ENDED',
        messageEn: 'This session has ended. Please sign in again.',
        messageAr: 'انتهت هذه الجلسة. الرجاء تسجيل الدخول مرة أخرى.',
      });
    }
    return { userId: payload.sub, email: payload.email, role: payload.role, sessionId: payload.sid };
  }
}

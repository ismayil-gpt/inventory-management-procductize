import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

/** Validates the Bearer access token and populates request.user (§11 #4). */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev_access_secret'),
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}

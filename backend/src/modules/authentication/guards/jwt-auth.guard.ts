import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid access token. Applied to every non-public route (§11 #8). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

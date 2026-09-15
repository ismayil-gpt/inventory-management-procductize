import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Enforces @Roles(...) at the controller level — never trusted from the client
 * (§11 #8). Must run after JwtAuthGuard so request.user is populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user || !required.includes(user.role as Role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        messageEn: 'You do not have permission to perform this action.',
        messageAr: 'ليس لديك إذن لتنفيذ هذا الإجراء.',
      });
    }
    return true;
  }
}

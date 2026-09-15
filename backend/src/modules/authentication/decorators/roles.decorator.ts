import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restrict a route to one or more roles. Enforced by RolesGuard (§11 #8). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

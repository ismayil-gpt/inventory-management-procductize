import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

/** Injects the authenticated user (populated by JwtAccessStrategy). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);

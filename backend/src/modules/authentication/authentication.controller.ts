import { Body, Controller, Get, Post, Req, UseGuards, UsePipes, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticationService } from './authentication.service';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';
import { loginSchema, LoginDto, refreshSchema, RefreshDto } from './dto/login.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';

@ApiTags('authentication')
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly auth: AuthenticationService) {}

  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginSchema))
  @ApiOperation({ summary: 'Sign in with email + password → access & refresh tokens' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    // TODO(prod): apply rate limiting to /auth/* (DESC #12) once Redis is available.
    return this.auth.login(dto, req.ip);
  }

  @Post('refresh')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(refreshSchema))
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out (client discards tokens)' })
  logout(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.auth.logout(user.userId, req.ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.userId);
  }
}

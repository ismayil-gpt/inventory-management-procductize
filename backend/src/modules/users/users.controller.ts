import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';
import { createUserSchema, CreateUserDto, updateUserSchema, UpdateUserDto } from './dto/user.schema';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (ADMIN only)' })
  list() {
    return this.users.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a user (ADMIN)' })
  create(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.create(dto, user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user — role, active, password (ADMIN)' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.update(id, dto, user.userId, user.sessionId);
  }

  @Post(':id/end-sessions')
  @ApiOperation({ summary: 'Sign a user out of every device now (ADMIN, DESC #4)' })
  endSessions(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.endSessions(id, user.userId, user.sessionId);
  }

  @Post(':id/reset-mfa')
  @ApiOperation({ summary: 'Clear a user\'s two-step sign-in so they enrol again (ADMIN, DESC #7)' })
  resetMultiFactor(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.resetMultiFactor(id, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user that has no recorded activity (ADMIN). Otherwise deactivate.' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.remove(id, user.userId);
  }
}

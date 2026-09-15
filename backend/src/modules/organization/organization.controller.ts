import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';

const updateOrganizationSchema = z
  .object({
    nameEn: z.string().trim().min(1).max(160),
    nameAr: z.string().trim().min(1).max(160),
    defaultLanguage: z.enum(['en', 'ar']),
    timezone: z.string().trim().min(1).max(64),
  })
  .partial();
type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;

@ApiTags('organization')
@ApiBearerAuth()
@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get()
  @ApiOperation({ summary: 'Current deployment / organization settings' })
  get() {
    return this.organization.getCurrent();
  }

  @Patch()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update organisation name, default language, timezone (ADMIN)' })
  update(@Body(new ZodValidationPipe(updateOrganizationSchema)) dto: UpdateOrganizationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organization.update(dto, user.userId);
  }
}

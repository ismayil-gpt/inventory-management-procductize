import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { StorageLocationsService } from './storage-locations.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../authentication/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../security/zod-validation.pipe';
import { createNodeSchema, CreateNodeDto, bulkCreateSchema, BulkCreateDto, updateNodeSchema, UpdateNodeDto } from './dto/location.schema';

@ApiTags('storage-locations')
@ApiBearerAuth()
@Controller('storage-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StorageLocationsController {
  constructor(private readonly locations: StorageLocationsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create one location node (ADMIN)' })
  createNode(@Body(new ZodValidationPipe(createNodeSchema)) dto: CreateNodeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.locations.createNode(dto, user.userId);
  }

  @Post('bulk-create')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Bulk-generate a subtree (ADMIN). ?preview=true to preview without saving.' })
  @ApiQuery({ name: 'preview', required: false, type: Boolean })
  bulkCreate(@Body(new ZodValidationPipe(bulkCreateSchema)) dto: BulkCreateDto, @CurrentUser() user: AuthenticatedUser, @Query('preview') preview?: string) {
    return this.locations.bulkCreate(dto, user.userId, preview === 'true');
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Rename or deactivate a location (ADMIN)' })
  updateNode(@Param('id') id: string, @Body(new ZodValidationPipe(updateNodeSchema)) dto: UpdateNodeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.locations.updateNode(id, dto, user.userId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete an empty leaf location with no history (ADMIN). Otherwise deactivate.' })
  removeNode(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.locations.remove(id, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Full location tree with stock rollups' })
  tree() {
    return this.locations.getTree();
  }

  @Get('resolve/:barcode')
  @ApiOperation({ summary: 'Resolve a location by its barcode (scanned or typed)' })
  resolve(@Param('barcode') barcode: string) {
    return this.locations.resolveByBarcode(barcode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Location detail with the stock sitting on it' })
  getById(@Param('id') id: string) {
    return this.locations.getById(id);
  }

  @Get(':id/stock')
  @ApiOperation({ summary: 'Stock at a location (optionally including descendants)' })
  @ApiQuery({ name: 'includeDescendants', required: false, type: Boolean })
  stock(@Param('id') id: string, @Query('includeDescendants') includeDescendants?: string) {
    return this.locations.stockAt(id, includeDescendants === 'true');
  }
}

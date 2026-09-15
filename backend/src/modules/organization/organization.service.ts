import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface UpdateOrganizationDto {
  nameEn?: string;
  nameAr?: string;
  defaultLanguage?: string;
  timezone?: string;
}

type OrganizationRow = {
  id: string; code: string; nameEn: string; nameAr: string;
  defaultLanguage: string; timezone: string; logoObjectKey: string | null;
};

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  private async activeOrg() {
    const org = await this.prisma.organization.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!org) throw new NotFoundException({ code: 'NO_ORGANIZATION', messageEn: 'No organization configured.', messageAr: 'لا توجد مؤسسة مهيأة.' });
    return org;
  }

  private pick(org: OrganizationRow) {
    return {
      id: org.id, code: org.code, nameEn: org.nameEn, nameAr: org.nameAr,
      defaultLanguage: org.defaultLanguage, timezone: org.timezone, logoObjectKey: org.logoObjectKey,
    };
  }

  /** The single active organisation — the white-label identity for this deployment. */
  async getCurrent() {
    return this.pick(await this.activeOrg());
  }

  /** Rebrand for a new customer without a code change or migration (§5A). */
  async update(dto: UpdateOrganizationDto, actorId: string) {
    const before = await this.activeOrg();
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.organization.update({
        where: { id: before.id },
        data: { nameEn: dto.nameEn, nameAr: dto.nameAr, defaultLanguage: dto.defaultLanguage, timezone: dto.timezone },
      });
      await tx.auditLog.create({
        data: {
          actorId, action: 'ORGANIZATION_UPDATE', entityType: 'Organization', entityId: before.id,
          before: { nameEn: before.nameEn, nameAr: before.nameAr, defaultLanguage: before.defaultLanguage, timezone: before.timezone },
          after: { nameEn: u.nameEn, nameAr: u.nameAr, defaultLanguage: u.defaultLanguage, timezone: u.timezone },
        },
      });
      return u;
    });
    return this.pick(updated);
  }
}

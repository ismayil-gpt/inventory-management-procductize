import { z } from 'zod';

// Ref: CLAUDE.md §5, §7. Barcode is optional on create — when omitted the service
// generates an INTERNAL barcode (§7 "generates internal barcode if absent").
export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  barcode: z.string().trim().max(64).optional().nullable(),
  nameEn: z.string().trim().min(1).max(200),
  nameAr: z.string().trim().min(1).max(200),
  categoryId: z.string().trim().min(1).optional().nullable(),
  baseUnitId: z.string().trim().min(1),
  packSize: z.number().int().min(1).default(1),
  reorderPoint: z.number().int().min(0),
  minLevel: z.number().int().min(0),
  maxLevel: z.number().int().min(1),
  supplierId: z.string().trim().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

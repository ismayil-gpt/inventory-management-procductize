import { z } from 'zod';

// Ref: CLAUDE.md §5A.3, §7. Single create, bulk generator (with preview), and edit.
export const createNodeSchema = z.object({
  parentId: z.string().min(1).optional().nullable(),
  locationTypeId: z.string().min(1),
  code: z.string().trim().min(1).max(32),
  nameEn: z.string().trim().max(120).optional().nullable(),
  nameAr: z.string().trim().max(120).optional().nullable(),
});
export type CreateNodeDto = z.infer<typeof createNodeSchema>;

export const bulkCreateSchema = z.object({
  parentId: z.string().min(1).optional().nullable(),
  levels: z
    .array(
      z.object({
        locationTypeId: z.string().min(1),
        prefix: z.string().max(16),
        from: z.number().int().min(0),
        to: z.number().int().min(0),
      }).refine((l) => l.to >= l.from, { message: 'to must be >= from' }),
    )
    .min(1)
    .max(6),
});
export type BulkCreateDto = z.infer<typeof bulkCreateSchema>;

export const updateNodeSchema = z.object({
  nameEn: z.string().trim().max(120).optional().nullable(),
  nameAr: z.string().trim().max(120).optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateNodeDto = z.infer<typeof updateNodeSchema>;

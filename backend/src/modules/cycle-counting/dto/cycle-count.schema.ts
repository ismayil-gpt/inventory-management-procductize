import { z } from 'zod';

export const createCycleCountSchema = z.object({ note: z.string().trim().max(200).optional().nullable() });
export type CreateCycleCountDto = z.infer<typeof createCycleCountSchema>;

export const scanSchema = z.object({
  productId: z.string().min(1),
  locationNodeId: z.string().min(1),
  countedQty: z.number().int().min(0),
});
export type ScanDto = z.infer<typeof scanSchema>;

export const closeSchema = z.object({ apply: z.boolean().default(false) });
export type CloseDto = z.infer<typeof closeSchema>;

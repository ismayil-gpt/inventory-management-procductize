import { z } from 'zod';

// Ref: CLAUDE.md §5 (StockMovement), §7, §12. clientId is the device-generated
// idempotency key that makes the offline outbox safe to retry.
export const movementSchema = z.object({
  clientId: z.string().min(8).max(64),
  type: z.enum(['GOODS_IN', 'GOODS_OUT', 'TRANSFER', 'ADJUSTMENT']),
  productId: z.string().min(1),
  fromLocationNodeId: z.string().min(1).nullish(),
  toLocationNodeId: z.string().min(1).nullish(),
  // Positive amount for in/out/transfer; signed delta for adjustment.
  quantity: z.number().int(),
  reason: z.string().nullish(),
});
export type MovementDto = z.infer<typeof movementSchema>;

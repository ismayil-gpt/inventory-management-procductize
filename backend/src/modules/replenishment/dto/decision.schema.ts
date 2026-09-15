import { z } from 'zod';

export const approveSchema = z.object({ approvedQty: z.number().int().min(1).optional() });
export type ApproveDto = z.infer<typeof approveSchema>;

export const rejectSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export type RejectDto = z.infer<typeof rejectSchema>;

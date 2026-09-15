import { z } from 'zod';

export const assistantQuerySchema = z.object({
  text: z.string().trim().min(1).max(500),
  language: z.enum(['en', 'ar']),
});
export type AssistantQueryDto = z.infer<typeof assistantQuerySchema>;

import { z } from 'zod';

// Shared-shape login payload (mirrors the frontend contract, §4).
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

// DESC #7 — two-step sign-in payloads.
export const mfaChallengeSchema = z.object({ mfaToken: z.string().min(20) });
export type MfaChallengeDto = z.infer<typeof mfaChallengeSchema>;

export const mfaCodeSchema = z.object({
  mfaToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});
export type MfaCodeDto = z.infer<typeof mfaCodeSchema>;

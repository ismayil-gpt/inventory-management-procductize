import { z } from 'zod';

// DESC #3 — minimum 12 characters + a small common-password blocklist.
const COMMON_PASSWORDS = new Set([
  'password1234', 'passwordpassword', '123456789012', 'qwertyuiop12', 'administrator', 'letmein12345', 'welcome12345',
]);

const password = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128)
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), 'That password is too common.');

export const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(['ADMIN', 'STORE_KEEPER']),
  password,
  preferredLanguage: z.enum(['en', 'ar']).default('en'),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['ADMIN', 'STORE_KEEPER']).optional(),
  isActive: z.boolean().optional(),
  preferredLanguage: z.enum(['en', 'ar']).optional(),
  password: password.optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

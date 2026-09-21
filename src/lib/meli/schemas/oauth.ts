import { z } from 'zod';

export const meliTokenResponseSchema = z.object({
  access_token: z.string().min(10),
  token_type: z.string(),
  expires_in: z.number().int().positive(),
  scope: z.string(),
  user_id: z.number().int().positive(),
  refresh_token: z.string().min(10),
});

export const meliOAuthErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  error_description: z.string().optional(),
  status: z.number().optional(),
});

import { z } from "zod";

/**
 * Validation schema for user login requests
 */
export const LoginValidation = z.object({
  body: z.object({
    email: z.string().email("Invalid email address."),
    password: z.string().min(8, "Password is required."),
  }),
});

/**
 * Validation schema for password reset requests
 */
export const RequesPasswordResetValidation = z.object({
  body: z.object({
    email: z.string().email("Invalid email address."),
  }),
});

/**
 * Validation schema for password reset completion
 */
export const PasswordResetValidation = z.object({
  body: z.object({
    code: z.string().min(1, "Code is required."),
    newPassword: z.string().min(8, "New password is required."),
  }),
});

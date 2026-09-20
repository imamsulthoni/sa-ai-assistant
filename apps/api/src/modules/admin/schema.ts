import { z } from "zod";

export const AdminCreateUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter")
    .max(30, "Username maksimal 30 karakter")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username hanya boleh huruf, angka, underscore, atau strip"),
  email: z
    .string()
    .trim()
    .email("Email tidak valid")
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(100, "Password maksimal 100 karakter"),
  role: z.enum(["SUPER_ADMIN", "USER"]).default("USER"),
});

export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>;

export const AdminUpdateUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter")
    .max(30, "Username maksimal 30 karakter")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username hanya boleh huruf, angka, underscore, atau strip")
    .optional(),
  email: z
    .string()
    .trim()
    .email("Email tidak valid")
    .transform((val) => val.toLowerCase())
    .optional(),
  role: z.enum(["SUPER_ADMIN", "USER"]).optional(),
});

export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;

export const AdminResetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(100, "Password maksimal 100 karakter"),
});

export type AdminResetPasswordInput = z.infer<typeof AdminResetPasswordSchema>;

export const AdminToggleStatusSchema = z.object({
  isActive: z.boolean(),
});

export type AdminToggleStatusInput = z.infer<typeof AdminToggleStatusSchema>;

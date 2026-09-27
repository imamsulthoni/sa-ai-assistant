import { z } from "zod";

export const RegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter")
    .max(30, "Username maksimal 30 karakter")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username hanya boleh berisi huruf, angka, underscore, dan strip"),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid")
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(100, "Password maksimal 100 karakter"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Format email tidak valid")
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

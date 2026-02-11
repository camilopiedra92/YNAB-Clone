import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().trim().min(2, 'Nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres').max(128),
});

export const LoginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(1, 'Contraseña es requerida'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().trim().email('Email inválido'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual es requerida'),
  newPassword: z.string().min(8, 'Nueva contraseña debe tener al menos 8 caracteres').max(128),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

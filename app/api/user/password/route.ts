import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth-helpers';
import { getUserByEmail, getUserById, updatePassword } from '@/lib/repos';
import { validateBody } from '@/lib/schemas/helpers';
import { ChangePasswordSchema } from '@/lib/schemas/auth';

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) return authResult.response;

    const body = await request.json();
    const validation = validateBody(ChangePasswordSchema, body);
    if (!validation.success) return validation.response;

    const { currentPassword, newPassword } = validation.data;

    // Get the user's profile to find their email, then get full row with hash
    const profile = await getUserById(authResult.userId);
    if (!profile) return apiError('User not found', 404);

    const user = await getUserByEmail(profile.email);
    if (!user) return apiError('User not found', 404);

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return apiError('Contraseña actual incorrecta', 400);
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 12);
    await updatePassword(authResult.userId, newHash);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error changing password:', error);
    return apiError('Error al cambiar la contraseña', 500);
  }
}

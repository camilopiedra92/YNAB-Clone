import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';
import { requireAuth } from '@/lib/auth-helpers';
import { getUserById, updateUser, getUserByEmail } from '@/lib/repos';
import { validateBody } from '@/lib/schemas/helpers';
import { UpdateProfileSchema } from '@/lib/schemas/auth';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) return authResult.response;

    const user = await getUserById(authResult.userId);
    if (!user) return apiError('User not found', 404);

    return NextResponse.json(user);
  } catch (error) {
    logger.error('Error fetching profile:', error);
    return apiError('Error al obtener el perfil', 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) return authResult.response;

    const body = await request.json();
    const validation = validateBody(UpdateProfileSchema, body);
    if (!validation.success) return validation.response;

    const { name, email } = validation.data;

    const updated = await updateUser(authResult.userId, { name, email });
    if (!updated) return apiError('User not found', 404);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_ALREADY_EXISTS') {
      return apiError('Ya existe una cuenta con este email', 409);
    }
    logger.error('Error updating profile:', error);
    return apiError('Error al actualizar el perfil', 500);
  }
}

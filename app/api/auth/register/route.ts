import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import bcrypt from 'bcryptjs';
import { getUserByEmail, createUser } from '@/lib/repos';
import { validateBody } from '@/lib/schemas/helpers';
import { RegisterSchema } from '@/lib/schemas/auth';
import { authLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // Rate limiting — prevent brute-force registration
    const ip = getClientIP(request);
    const limit = await authLimiter.check(ip);
    if (!limit.success) return rateLimitResponse(limit);
    const body = await request.json();

    const validation = validateBody(RegisterSchema, body);
    if (!validation.success) return validation.response;

    const { name, email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existing = await getUserByEmail(normalizedEmail);

    if (existing) {
      return apiError('Ya existe una cuenta con este email', 409);
    }

    // Hash password with bcrypt (cost factor 12)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await createUser({
      name,
      email: normalizedEmail,
      passwordHash: hashedPassword,
    });

    return NextResponse.json(
      { id: newUser.id, email: newUser.email, name: newUser.name },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error registering user:', error);
    return apiError('Error al crear la cuenta', 500);
  }
}

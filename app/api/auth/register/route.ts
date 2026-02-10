import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, createUser } from '@/lib/repos';
import { RegisterSchema } from '@/lib/schemas/auth';
import { authLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // Rate limiting — prevent brute-force registration
    const ip = getClientIP(request);
    const limit = await authLimiter.check(ip);
    if (!limit.success) return rateLimitResponse(limit);
    const body = await request.json();

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    // Check if user already exists
    const existing = await getUserByEmail(normalizedEmail);

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con este email' },
        { status: 409 }
      );
    }

    // Hash password with bcrypt (cost factor 12)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
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
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: 'Error al crear la cuenta' },
      { status: 500 }
    );
  }
}

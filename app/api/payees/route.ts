import { NextRequest, NextResponse } from 'next/server';
import { getPayees } from '@/lib/db';

export async function GET() {
    try {
        const payees = getPayees();
        return NextResponse.json(payees);
    } catch (error) {
        console.error('Error fetching payees:', error);
        return NextResponse.json({ error: 'Failed to fetch payees' }, { status: 500 });
    }
}

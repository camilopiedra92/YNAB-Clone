import { NextResponse } from 'next/server';
import { getPayees } from '@/lib/repos';

export async function GET() {
    try {
        const payees = await getPayees();
        return NextResponse.json(payees);
    } catch (error) {
        console.error('Error fetching payees:', error);
        return NextResponse.json({ error: 'Failed to fetch payees' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getLendersFromDB } from '../../../lib/db-lenders';

export async function GET() {
  try {
    const lenders = await getLendersFromDB();
    return NextResponse.json(lenders);
  } catch (error) {
    console.error('Error fetching lenders:', error);
    return NextResponse.json([], { status: 500 });
  }
}
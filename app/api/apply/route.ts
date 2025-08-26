import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { providerId, payload } = await request.json();

    await new Promise((resolve) => setTimeout(resolve, 800));

    return NextResponse.json({
      ok: true,
      id: `demo-${Date.now()}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process application' },
      { status: 500 }
    );
  }
}
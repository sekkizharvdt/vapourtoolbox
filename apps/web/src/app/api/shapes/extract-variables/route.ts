import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // const { expression } = body;

    // TODO: Implement variable extraction
    return NextResponse.json({
      message: 'Variable extraction service coming soon',
      variables: [],
      body,
    });
  } catch (error) {
    console.error('Variable extraction error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Variable extraction failed',
      },
      { status: 500 }
    );
  }
}

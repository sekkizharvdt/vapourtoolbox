/**
 * BOM Quote PDF Generation API Route
 * Calls Firebase Function to generate PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebase } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { PDFGenerationOptions, PDFGenerationResult } from '@vapour/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const bomId = params.id;

    if (!bomId) {
      return NextResponse.json({ error: 'BOM ID is required' }, { status: 400 });
    }

    // Get request body
    const body = await request.json();
    const options = body.options as PDFGenerationOptions;

    // Get Firebase app and auth
    const { app, auth } = getFirebase();
    const user = auth.currentUser;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call Firebase Function
    const functions = getFunctions(app, 'asia-south1');
    const generatePDF = httpsCallable<
      { bomId: string; options: PDFGenerationOptions; userId: string },
      PDFGenerationResult
    >(functions, 'generateBOMQuotePDF');

    const result = await generatePDF({
      bomId,
      options: {
        ...options,
        bomId, // Ensure bomId is in options
      },
      userId: user.uid,
    });

    if (!result.data.success) {
      return NextResponse.json(
        { error: result.data.error || 'PDF generation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    console.error('Error generating PDF:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { searchProperties } from '@/lib/services/property-service';

export const dynamic = 'force-dynamic';

/**
 * Semantic Vector Search API Route
 * Member 1 Implementation
 * 
 * Query Params:
 * - q: Natural language prompt (e.g., "quiet 2BHK near tech park pet friendly under 25k")
 * - city: Filter by city (e.g., "Bengaluru")
 * - maxPrice: Maximum monthly rent in INR
 * - bedrooms: Number of bedrooms (e.g., 2)
 *
 * Constraints written inside q ("under 20k", "2BHK", "in Pune") are parsed into exact
 * SQL filters; see lib/query-parser.ts. Explicit params win over parsed ones.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const city = searchParams.get('city') || undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? Number(searchParams.get('maxPrice'))
      : undefined;
    const bedrooms = searchParams.get('bedrooms')
      ? Number(searchParams.get('bedrooms'))
      : undefined;
    const minPrice = searchParams.get('minPrice')
      ? Number(searchParams.get('minPrice'))
      : undefined;
    const limit = searchParams.get('limit')
      ? Number(searchParams.get('limit'))
      : undefined; // service default: 30 semantic matches / 60 catalog rows

    const { properties, applied, semanticText } = await searchProperties({
      query: q,
      city,
      maxPrice,
      minPrice,
      bedrooms,
      limit,
    });

    return NextResponse.json({
      success: true,
      total: properties.length,
      query: q,
      applied,
      semanticText,
      properties,
    });
  } catch (error: any) {
    console.error('Semantic search failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal Server Error during vector search',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  searchPropertiesSemantic,
  createProperty,
  getAvailableCities,
} from '@/lib/services/property-service';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Properties API Route
 * Member 1 Implementation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? Number(searchParams.get('maxPrice'))
      : undefined;
    const bedrooms = searchParams.get('bedrooms')
      ? Number(searchParams.get('bedrooms'))
      : undefined;

    const properties = await searchPropertiesSemantic({
      city,
      maxPrice,
      bedrooms,
    });

    const cities = await getAvailableCities();

    return NextResponse.json({
      success: true,
      total: properties.length,
      cities,
      properties,
    });
  } catch (error: any) {
    console.error('Fetch properties error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Default to first owner from database if not supplied (for demo simplicity)
    let ownerId = body.owner_id;
    if (!ownerId) {
      const ownerRes = await query(
        `SELECT id FROM users WHERE role = 'OWNER' LIMIT 1`
      );
      if (ownerRes.rows.length > 0) {
        ownerId = ownerRes.rows[0].id;
      } else {
        throw new Error('No owner user found in database');
      }
    }

    if (!body.title || !body.description || !body.price_per_month || !body.city) {
      return NextResponse.json(
        { success: false, error: 'Missing required property listing fields' },
        { status: 400 }
      );
    }

    const created = await createProperty({
      owner_id: ownerId,
      title: body.title,
      description: body.description,
      property_type: body.property_type || 'Apartment',
      price_per_month: Number(body.price_per_month),
      security_deposit: Number(body.security_deposit || 0),
      bedrooms: Number(body.bedrooms || 1),
      bathrooms: Number(body.bathrooms || 1),
      area_sqft: Number(body.area_sqft || 600),
      address: body.address,
      city: body.city,
      state: body.state || 'Karnataka',
      pincode: body.pincode || '560001',
      amenities: Array.isArray(body.amenities) ? body.amenities : [],
      image_url: body.image_url,
    });

    return NextResponse.json({
      success: true,
      message: 'Property created and vector embedding generated successfully',
      property: created,
    });
  } catch (error: any) {
    console.error('Create property error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

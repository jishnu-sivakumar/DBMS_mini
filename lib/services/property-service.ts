import { query, withTransaction } from '@/lib/db';
import { getEmbedding, buildPropertySearchText, toVectorLiteral } from '@/lib/embeddings';

export interface Property {
  id: string;
  title: string;
  description: string;
  property_type: string;
  price_per_month: number;
  security_deposit?: number;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  address: string;
  city: string;
  state?: string;
  pincode?: string;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  amenities: string[];
  image_url?: string;
  owner_id?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  avg_rating?: number;
  review_count?: number;
  similarity_score?: number;
}

export interface SearchFilters {
  query?: string;
  city?: string;
  maxPrice?: number;
  bedrooms?: number;
  limit?: number;
}

/**
 * Perform Semantic Vector Search with Hybrid SQL Filters
 * (Member 1 Implementation)
 * 
 * Uses PostgreSQL + pgvector cosine similarity (<=> operator)
 * via stored function fn_search_properties_semantic
 */
export async function searchPropertiesSemantic(filters: SearchFilters): Promise<Property[]> {
  const { query: searchQuery, city, maxPrice, bedrooms, limit = 12 } = filters;

  // If no semantic query provided, fallback to standard relational catalog filter
  if (!searchQuery || searchQuery.trim().length === 0) {
    let sql = `
      SELECT * FROM view_property_catalog
      WHERE status = 'AVAILABLE'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (city && city !== 'All') {
      sql += ` AND LOWER(city) = LOWER($${paramIndex++})`;
      params.push(city);
    }
    if (maxPrice) {
      sql += ` AND price_per_month <= $${paramIndex++}`;
      params.push(maxPrice);
    }
    if (bedrooms) {
      sql += ` AND bedrooms = $${paramIndex++}`;
      params.push(bedrooms);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query<Property>(sql, params);
    return result.rows.map((row) => ({
      ...row,
      price_per_month: Number(row.price_per_month),
      avg_rating: Number(row.avg_rating),
    }));
  }

  // 1. Generate 384-dimensional dense vector for the natural language query
  const queryEmbedding = await getEmbedding(searchQuery);
  const vectorStr = toVectorLiteral(queryEmbedding);

  // 2. Query PostgreSQL pgvector cosine distance function
  const sql = `
    SELECT 
      id,
      title,
      description,
      property_type,
      price_per_month,
      bedrooms,
      bathrooms,
      area_sqft,
      address,
      city,
      status,
      amenities,
      image_url,
      owner_name,
      avg_rating,
      ROUND((similarity_score * 100)::numeric, 1)::float AS similarity_score
    FROM fn_search_properties_semantic(
      $1::text::vector,
      0.15,
      $2,
      $3,
      $4,
      $5
    )
  `;

  const params = [
    vectorStr,
    limit,
    city && city !== 'All' ? city : null,
    maxPrice || null,
    bedrooms || null,
  ];

  const result = await query<Property>(sql, params);
  return result.rows.map((row) => ({
    ...row,
    price_per_month: Number(row.price_per_month),
    avg_rating: Number(row.avg_rating),
    similarity_score: Number(row.similarity_score),
  }));
}

/**
 * Retrieve a single property by ID along with owner details and reviews
 */
export async function getPropertyById(id: string) {
  const propertyRes = await query(
    `SELECT * FROM view_property_catalog WHERE id = $1`,
    [id]
  );

  if (propertyRes.rows.length === 0) return null;

  const reviewsRes = await query(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name AS tenant_name
     FROM reviews r
     JOIN users u ON r.tenant_id = u.id
     WHERE r.property_id = $1
     ORDER BY r.created_at DESC`,
    [id]
  );

  return {
    ...propertyRes.rows[0],
    price_per_month: Number(propertyRes.rows[0].price_per_month),
    avg_rating: Number(propertyRes.rows[0].avg_rating),
    reviews: reviewsRes.rows,
  };
}

/**
 * Insert a new Property Listing and compute its vector embedding
 * (Demonstrates ACID Transaction: Property record + Vector record)
 */
export async function createProperty(data: {
  owner_id: string;
  title: string;
  description: string;
  property_type: string;
  price_per_month: number;
  security_deposit: number;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  amenities: string[];
  image_url?: string;
}) {
  return await withTransaction(async (client) => {
    // 1. Insert Property Row
    const insertPropSql = `
      INSERT INTO properties (
        owner_id, title, description, property_type, price_per_month,
        security_deposit, bedrooms, bathrooms, area_sqft, address,
        city, state, pincode, amenities, image_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const propRes = await client.query(insertPropSql, [
      data.owner_id,
      data.title,
      data.description,
      data.property_type || 'Apartment',
      data.price_per_month,
      data.security_deposit || 0,
      data.bedrooms,
      data.bathrooms,
      data.area_sqft,
      data.address,
      data.city,
      data.state || 'Karnataka',
      data.pincode || '560001',
      data.amenities || [],
      data.image_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    ]);

    const property = propRes.rows[0];

    // 2. Generate 384-dimensional vector embedding
    const indexedText = buildPropertySearchText(property);
    const embedding = await getEmbedding(indexedText);
    const vectorStr = toVectorLiteral(embedding);

    // 3. Store in property_embeddings table
    await client.query(
      `INSERT INTO property_embeddings (property_id, embedding, model_name, indexed_content)
       VALUES ($1, $2::text::vector, 'all-MiniLM-L6-v2', $3)`,
      [property.id, vectorStr, indexedText]
    );

    return property;
  });
}

/**
 * Retrieve unique cities available in listings
 */
export async function getAvailableCities(): Promise<string[]> {
  const result = await query<{ city: string }>(
    `SELECT DISTINCT city FROM properties WHERE status = 'AVAILABLE' ORDER BY city ASC`
  );
  return result.rows.map((r) => r.city);
}

/**
 * Retrieve owner analytics metrics via view_owner_analytics
 */
export async function getOwnerAnalytics() {
  const result = await query(
    `SELECT * FROM view_owner_analytics ORDER BY total_properties DESC`
  );
  return result.rows;
}

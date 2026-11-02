import { query, withTransaction } from '@/lib/db';
import { getEmbedding, buildPropertySearchText, toVectorLiteral } from '@/lib/embeddings';
import { parseSearchQuery } from '@/lib/query-parser';

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
  minPrice?: number;
  bedrooms?: number;
  limit?: number;
}

export interface SearchResult {
  properties: Property[];
  /** constraints understood from the sentence, e.g. ["under ₹20,000", "2 BHK"] */
  applied: string[];
  /** the text actually embedded for similarity (constraint phrases removed) */
  semanticText: string;
}

const mapRow = (row: any): Property => ({
  ...row,
  price_per_month: Number(row.price_per_month),
  avg_rating: Number(row.avg_rating),
  ...(row.similarity_score !== undefined ? { similarity_score: Number(row.similarity_score) } : {}),
});

/**
 * Hybrid search: natural-language sentence + explicit filters.
 *
 * 1. Hard constraints in the sentence ("under 20k", "2BHK", "in Pune") are parsed out and
 *    applied as exact SQL filters. Explicit UI filters take precedence over parsed ones.
 * 2. What is left of the sentence is embedded (all-MiniLM-L6-v2) and ranked by pgvector
 *    cosine distance via fn_search_properties_semantic.
 * 3. If nothing meaningful is left ("homes under 20k") the relational catalog is returned,
 *    cheapest first.
 */
export async function searchProperties(filters: SearchFilters): Promise<SearchResult> {
  const { query: searchQuery, limit } = filters;

  const cityRows = await query<{ city: string }>(`SELECT DISTINCT city FROM properties`);
  const parsed = parseSearchQuery(searchQuery ?? '', cityRows.rows.map((r) => r.city));

  const city = filters.city && filters.city !== 'All' ? filters.city : parsed.city;
  const maxPrice = filters.maxPrice ?? parsed.maxPrice;
  const minPrice = filters.minPrice ?? parsed.minPrice;
  const bedrooms = filters.bedrooms ?? parsed.bedrooms;

  const applied = [...parsed.applied];
  // Mention UI filters that are not already visible as chips from the sentence
  if (filters.maxPrice !== undefined && parsed.maxPrice === undefined) applied.push(`under ₹${filters.maxPrice.toLocaleString('en-IN')}`);
  if (filters.bedrooms !== undefined && parsed.bedrooms === undefined) applied.push(`${filters.bedrooms} BHK`);
  if (filters.city && filters.city !== 'All' && parsed.city === undefined) applied.push(filters.city);

  // No semantic content left: plain relational listing
  if (parsed.isGeneric || parsed.text.trim().length === 0) {
    let sql = `SELECT * FROM view_property_catalog WHERE status = 'AVAILABLE'`;
    const params: any[] = [];
    if (city) {
      params.push(city);
      sql += ` AND LOWER(city) = LOWER($${params.length})`;
    }
    if (maxPrice !== undefined) {
      params.push(maxPrice);
      sql += ` AND price_per_month <= $${params.length}`;
    }
    if (minPrice !== undefined) {
      params.push(minPrice);
      sql += ` AND price_per_month >= $${params.length}`;
    }
    if (bedrooms !== undefined) {
      params.push(bedrooms);
      sql += ` AND bedrooms = $${params.length}`;
    }
    const order = minPrice !== undefined && maxPrice === undefined ? 'price_per_month DESC' : 'price_per_month ASC';
    params.push(limit ?? 60);
    sql += ` ORDER BY ${order}, created_at DESC LIMIT $${params.length}`;

    const result = await query<Property>(sql, params);
    return { properties: result.rows.map(mapRow), applied, semanticText: '' };
  }

  // Semantic path: embed only the descriptive part of the sentence
  const queryEmbedding = await getEmbedding(parsed.text);
  const vectorStr = toVectorLiteral(queryEmbedding);

  const sql = `
    SELECT
      id, title, description, property_type, price_per_month, bedrooms, bathrooms,
      area_sqft, address, city, status, amenities, image_url, owner_name, avg_rating,
      ROUND((similarity_score * 100)::numeric, 1)::float AS similarity_score
    FROM fn_search_properties_semantic($1::text::vector, 0.20, $2, $3, $4, $5)
    WHERE ($6::numeric IS NULL OR price_per_month >= $6)
  `;
  const result = await query<Property>(sql, [
    vectorStr,
    limit ?? 30,
    city ?? null,
    maxPrice ?? null,
    bedrooms ?? null,
    minPrice ?? null,
  ]);
  return { properties: result.rows.map(mapRow), applied, semanticText: parsed.text };
}

/** Backwards-compatible wrapper that returns only the listings. */
export async function searchPropertiesSemantic(filters: SearchFilters): Promise<Property[]> {
  return (await searchProperties(filters)).properties;
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

export interface OwnerPropertyRow {
  id: string;
  title: string;
  property_type: string;
  city: string;
  address: string;
  price_per_month: number;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  image_url?: string;
  created_at: string;
  total_requests: number;
  pending_requests: number;
  approved_bookings: number;
  avg_rating: number;
  review_count: number;
}

/**
 * Every property listed by one owner (any status), with booking and review counts.
 * Aggregates are computed in separate subqueries so bookings x reviews do not multiply rows.
 */
export async function getOwnerProperties(ownerId: string): Promise<OwnerPropertyRow[]> {
  const result = await query(
    `SELECT
       p.id, p.title, p.property_type, p.city, p.address, p.price_per_month,
       p.bedrooms, p.bathrooms, p.area_sqft, p.status, p.image_url, p.created_at,
       COALESCE(b.total_requests, 0)    AS total_requests,
       COALESCE(b.pending_requests, 0)  AS pending_requests,
       COALESCE(b.approved_bookings, 0) AS approved_bookings,
       COALESCE(r.avg_rating, 0)        AS avg_rating,
       COALESCE(r.review_count, 0)      AS review_count
     FROM properties p
     LEFT JOIN (
       SELECT property_id,
              COUNT(*)                                     AS total_requests,
              COUNT(*) FILTER (WHERE status = 'PENDING')   AS pending_requests,
              COUNT(*) FILTER (WHERE status = 'APPROVED')  AS approved_bookings
       FROM bookings GROUP BY property_id
     ) b ON b.property_id = p.id
     LEFT JOIN (
       SELECT property_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*) AS review_count
       FROM reviews GROUP BY property_id
     ) r ON r.property_id = p.id
     WHERE p.owner_id = $1
     ORDER BY p.created_at DESC`,
    [ownerId]
  );
  return result.rows.map((row: any) => ({
    ...row,
    price_per_month: Number(row.price_per_month),
    total_requests: Number(row.total_requests),
    pending_requests: Number(row.pending_requests),
    approved_bookings: Number(row.approved_bookings),
    avg_rating: Number(row.avg_rating),
    review_count: Number(row.review_count),
  }));
}

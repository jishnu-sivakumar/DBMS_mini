/**
 * PropFind Embedding Service
 * Architecture: Option 2 (Vector Database Paradigm with pgvector)
 * Vector Dimension: 384 (matches all-MiniLM-L6-v2 standard)
 * 
 * Supports:
 * 1. Pluggable OpenAI text-embedding-3-small (if OPENAI_API_KEY is provided)
 * 2. High-speed local semantic projection vectorizer (zero-dependency, works offline without API keys)
 */

export const EMBEDDING_DIMENSION = 384;

/**
 * Normalizes a vector to unit length (L2 norm = 1)
 * Required for accurate cosine similarity calculation
 */
function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vector;
  return vector.map((val) => Number((val / norm).toFixed(6)));
}

/**
 * Zero-dependency semantic text vectorizer
 * Uses token hashing with semantic concept buckets + n-gram term frequencies
 * to project arbitrary text into a dense 384-dimensional normalized vector.
 */
export function generateLocalEmbedding(text: string): number[] {
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = cleanText.split(/\s+/).filter(Boolean);
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);

  if (tokens.length === 0) {
    vector[0] = 1.0;
    return vector;
  }

  // Domain semantic weight boost for real estate keywords
  const semanticClusters: Record<string, number[]> = {
    bedroom: [10, 11, 12, 13, 14],
    bhk: [10, 11, 12, 13, 14],
    rk: [15, 16],
    quiet: [20, 21, 22],
    peaceful: [20, 21, 22],
    calm: [20, 21, 22],
    tech: [30, 31, 32],
    it: [30, 31, 32],
    park: [30, 31, 32],
    office: [33, 34],
    pet: [40, 41, 42],
    dog: [40, 41],
    cat: [40, 41],
    pool: [50, 51, 52],
    swimming: [50, 51, 52],
    luxury: [60, 61, 62],
    premium: [60, 61, 62],
    penthouse: [60, 63, 64],
    budget: [70, 71, 72],
    cheap: [70, 71, 72],
    affordable: [70, 71, 72],
    student: [75, 76, 77],
    gym: [80, 81, 82],
    fitness: [80, 81],
    balcony: [90, 91, 92],
    terrace: [90, 93],
    metro: [100, 101, 102],
    station: [100, 101],
    transit: [100, 103],
    furnished: [110, 111, 112],
    interior: [110, 113],
    garden: [120, 121, 122],
    gated: [130, 131],
    security: [130, 132],
  };

  // 1. Unigram and bigram hashing
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Hash unigram to slot
    let hash = 0;
    for (let c = 0; c < token.length; c++) {
      hash = (hash << 5) - hash + token.charCodeAt(c);
      hash |= 0;
    }
    const idx = Math.abs(hash) % EMBEDDING_DIMENSION;
    vector[idx] += 1.0;

    // Check semantic clusters
    if (semanticClusters[token]) {
      semanticClusters[token].forEach((slot) => {
        vector[slot % EMBEDDING_DIMENSION] += 2.5;
      });
    }

    // Bigram
    if (i < tokens.length - 1) {
      const bigram = `${token}_${tokens[i + 1]}`;
      let bHash = 0;
      for (let c = 0; c < bigram.length; c++) {
        bHash = (bHash << 5) - bHash + bigram.charCodeAt(c);
        bHash |= 0;
      }
      const bIdx = Math.abs(bHash) % EMBEDDING_DIMENSION;
      vector[bIdx] += 1.5;
    }
  }

  return normalizeVector(vector);
}

/**
 * Generate embedding for text (auto-detects OpenAI or fallback to local vectorizer)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== "sk-placeholder") {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
          dimensions: EMBEDDING_DIMENSION,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.data[0].embedding;
      }
    } catch (err) {
      console.warn("OpenAI API call failed, falling back to local semantic vectorizer:", err);
    }
  }

  return generateLocalEmbedding(text);
}

/**
 * Formats property metadata and description into a rich string for embedding indexing
 */
export function buildPropertySearchText(property: {
  title: string;
  description: string;
  bedrooms: number;
  bathrooms: number;
  property_type: string;
  city: string;
  address: string;
  amenities?: string[];
}): string {
  const amenitiesStr = property.amenities && property.amenities.length > 0
    ? `Amenities: ${property.amenities.join(", ")}.`
    : "";

  return `${property.title}. ${property.description}. Type: ${property.bedrooms} BHK ${property.property_type} in ${property.city}, located at ${property.address}. ${amenitiesStr}`.trim();
}

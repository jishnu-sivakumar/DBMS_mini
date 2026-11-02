/**
 * PropFind Embedding Service
 * Architecture: Option 2 (Vector Database Paradigm with pgvector)
 * Vector Dimension: 384
 *
 * Supports:
 * 1. Local all-MiniLM-L6-v2 (sentence-transformers) via @huggingface/transformers.
 * 2. High-speed deterministic 384-dim semantic projection fallback (works 100% offline, zero network wait).
 * 3. Optional OpenAI text-embedding-3-small (if OPENAI_API_KEY is set).
 */

export const EMBEDDING_DIMENSION = 384;
export const LOCAL_MODEL_NAME = 'all-MiniLM-L6-v2';
const HF_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

let transformersModule: any = null;
let extractorPromise: Promise<any> | null = null;
let useOfflineFallback = false;

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vector;
  return vector.map((val) => Number((val / norm).toFixed(6)));
}

/**
 * Offline semantic text vectorizer
 * Projects text into a dense 384-dimensional unit-norm vector with semantic domain clusters.
 */
export function generateSemanticHashEmbedding(text: string): number[] {
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = cleanText.split(/\s+/).filter(Boolean);
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);

  if (tokens.length === 0) {
    vector[0] = 1.0;
    return vector;
  }

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
    dog: [40, 41, 42],
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

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let hash = 0;
    for (let c = 0; c < token.length; c++) {
      hash = (hash << 5) - hash + token.charCodeAt(c);
      hash |= 0;
    }
    const idx = Math.abs(hash) % EMBEDDING_DIMENSION;
    vector[idx] += 1.0;

    if (semanticClusters[token]) {
      semanticClusters[token].forEach((slot) => {
        vector[slot % EMBEDDING_DIMENSION] += 2.5;
      });
    }

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

async function getExtractor(): Promise<any> {
  if (useOfflineFallback) {
    return null;
  }

  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        if (!transformersModule) {
          transformersModule = await import('@huggingface/transformers');
        }
        const { pipeline, env } = transformersModule;
        env.allowLocalModels = false;

        // 2-second timeout for remote HuggingFace CDN fetch
        let timer: any;
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Transformers model download timeout')), 2000);
          if (typeof timer.unref === 'function') timer.unref();
        });

        const result = await Promise.race([
          pipeline('feature-extraction', HF_MODEL_ID, { dtype: 'fp32' }),
          timeoutPromise,
        ]);
        clearTimeout(timer);
        return result;
      } catch (err) {
        console.warn('HuggingFace transformers offline/unavailable, using fast offline semantic vectorizer:', (err as any)?.message || err);
        useOfflineFallback = true;
        return null;
      }
    })();
  }
  return extractorPromise;
}

/** all-MiniLM-L6-v2 embedding or semantic vectorizer fallback */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
  try {
    const extractor = await getExtractor();
    if (extractor) {
      const out = await extractor(text, { pooling: 'mean', normalize: true });
      const vec = Array.from(out.data as Float32Array);
      if (vec.length === EMBEDDING_DIMENSION) {
        return vec;
      }
    }
  } catch (err) {
    useOfflineFallback = true;
  }
  return generateSemanticHashEmbedding(text);
}

/**
 * Generate embedding for text (OpenAI if configured, otherwise local MiniLM / fallback)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'sk-placeholder' && apiKey.startsWith('sk-')) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
          dimensions: EMBEDDING_DIMENSION,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.data[0].embedding;
      }
    } catch (err) {
      console.warn('OpenAI API call failed, falling back to local vectorizer:', err);
    }
  }

  return generateLocalEmbedding(text);
}

/** pgvector text literal: "[0.1,0.2,...]" */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
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
  const amenitiesStr =
    property.amenities && property.amenities.length > 0
      ? `Amenities: ${property.amenities.join(', ')}.`
      : '';

  return `${property.title}. ${amenitiesStr} ${property.description}`.replace(/\s+/g, ' ').trim();
}

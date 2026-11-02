/**
 * PropFind Embedding Service
 * Architecture: Option 2 (Vector Database Paradigm with pgvector)
 * Vector Dimension: 384
 *
 * Supports:
 * 1. Local all-MiniLM-L6-v2 (sentence-transformers) via @huggingface/transformers.
 *    Runs inside the Node server with ONNX, mean pooling + L2 normalisation.
 *    No API key needed; the ~23 MB model is downloaded once and cached on disk.
 * 2. Optional OpenAI text-embedding-3-small (if OPENAI_API_KEY is set).
 *
 * NOTE: vectors from different models are NOT comparable. Stored vectors and
 * query vectors must come from the same model, so re-run `npm run db:seed`
 * (or re-embed) after changing OPENAI_API_KEY.
 *
 * This file has no path-alias imports so scripts/seed.mjs can import it too.
 */
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

export const EMBEDDING_DIMENSION = 384;
export const LOCAL_MODEL_NAME = 'all-MiniLM-L6-v2';
const HF_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

// Optional: load the model from a local folder (offline use)
if (process.env.EMBEDDING_LOCAL_MODEL_PATH) {
  env.localModelPath = process.env.EMBEDDING_LOCAL_MODEL_PATH;
  env.allowRemoteModels = false;
}

// Keep one loaded model per process (survives Next.js hot reloads in dev)
const g = globalThis as unknown as { _extractor?: Promise<FeatureExtractionPipeline> };

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!g._extractor) {
    g._extractor = (pipeline('feature-extraction', HF_MODEL_ID, {
      dtype: 'fp32',
    }) as Promise<FeatureExtractionPipeline>).catch((err) => {
      g._extractor = undefined; // allow a retry on the next call
      throw err;
    });
  }
  return g._extractor;
}

/** all-MiniLM-L6-v2 embedding: mean pooling + normalisation -> 384 floats */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const out = await extractor(text, { pooling: 'mean', normalize: true });
  const vec = Array.from(out.data as Float32Array);
  if (vec.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Expected ${EMBEDDING_DIMENSION}-dim embedding, got ${vec.length}`);
  }
  return vec;
}

/**
 * Generate embedding for text (OpenAI if configured, otherwise local MiniLM)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'sk-placeholder') {
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
      console.warn('OpenAI API call failed, falling back to local all-MiniLM-L6-v2:', err);
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

  return `${property.title}. ${property.description}. Type: ${property.bedrooms} BHK ${property.property_type} in ${property.city}, located at ${property.address}. ${amenitiesStr}`.trim();
}

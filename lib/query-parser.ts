/**
 * Natural-language query parser.
 *
 * Pulls hard constraints (budget, bedrooms, city) out of a search sentence such as
 *   "pet friendly 2BHK in Pune under 25k"
 * so they can be applied as exact SQL filters. Semantic (vector) similarity is bad at
 * numbers: "under 20k" and "under 50k" embed almost identically, so the numeric part
 * must be a WHERE clause, not part of the vector.
 *
 * Pure function, no imports: easy to unit test.
 */

export interface ParsedQuery {
  /** the query with the constraint phrases removed (this is what gets embedded) */
  text: string;
  maxPrice?: number;
  minPrice?: number;
  bedrooms?: number;
  city?: string;
  /** true when nothing meaningful is left for semantic matching ("homes under 20k") */
  isGeneric: boolean;
  /** human-readable list of what was understood, for the UI chips */
  applied: string[];
}

const NUMBER = String.raw`(\d+(?:,\d{2,3})*(?:\.\d+)?)`;
// longest alternatives first so "lakh" is not matched as "l"
const UNIT = String.raw`\s*(lakhs|lakh|lacs|lac|thousand|k|l)?(?![a-z])`;
const CURRENCY = String.raw`(?:rs\.?|inr|₹)?\s*`;

const MAX_WORDS = String.raw`(?:under|below|less than|upto|up to|within|maximum|max|not more than|budget(?: of)?|at most|<=?)`;
const MIN_WORDS = String.raw`(?:over|above|more than|at least|minimum|min|starting from|from|>=?)`;

const MAX_RE = new RegExp(String.raw`\b${MAX_WORDS}\s*(?:a\s*)?(?:rent\s*(?:of)?\s*)?${CURRENCY}${NUMBER}${UNIT}(?:\s*(?:per month|/month|a month|pm|rent))?`, 'i');
const MIN_RE = new RegExp(String.raw`\b${MIN_WORDS}\s*${CURRENCY}${NUMBER}${UNIT}(?:\s*(?:per month|/month|a month|pm|rent))?`, 'i');
// "20k budget", "rent 20k", "around 20000" (treated as a maximum)
const LOOSE_RE = new RegExp(String.raw`(?:\b(?:rent|budget|around|about)\s*(?:of|is)?\s*${CURRENCY}${NUMBER}${UNIT}|${CURRENCY}${NUMBER}${UNIT}\s*(?:budget|rent|per month|/month|a month))`, 'i');

const BHK_RE = /\b([1-9])\s*[- ]?\s*(?:bhk|bed(?:room)?s?|br)\b/i;
const RK_RE = /\b1\s*rk\b/i;

// Words that carry no semantic meaning once the constraints are removed
const GENERIC_WORDS = new Set([
  'home', 'homes', 'house', 'houses', 'flat', 'flats', 'apartment', 'apartments', 'property', 'properties',
  'place', 'places', 'room', 'rooms', 'rent', 'rental', 'rentals', 'for', 'in', 'at', 'a', 'an', 'the', 'to',
  'of', 'with', 'and', 'near', 'me', 'show', 'find', 'looking', 'want', 'need', 'i', 'under', 'below', 'budget',
  'cheap', 'affordable', 'available', 'any', 'bhk', 'bedroom', 'bedrooms', 'month', 'per', 'my', 'is', 'on',
]);

function toRupees(raw: string, unit?: string): number {
  const n = parseFloat(raw.replace(/,/g, ''));
  const u = (unit || '').toLowerCase();
  if (u === 'k' || u === 'thousand') return Math.round(n * 1_000);
  if (u === 'l' || u === 'lac' || u === 'lacs' || u === 'lakh' || u === 'lakhs') return Math.round(n * 100_000);
  return Math.round(n);
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

export function parseSearchQuery(input: string, knownCities: string[] = []): ParsedQuery {
  let text = ` ${input} `;
  const applied: string[] = [];
  const result: ParsedQuery = { text: '', isGeneric: false, applied };

  // Budget ceiling
  let m = text.match(MAX_RE);
  if (m) {
    const v = toRupees(m[1], m[2]);
    // a bare small number ("under 3") is more likely bedrooms than rupees: ignore it
    if (v >= 1000) {
      result.maxPrice = v;
      applied.push(`under ${fmt(v)}`);
      text = text.replace(MAX_RE, ' ');
    }
  }

  // Budget floor
  m = text.match(MIN_RE);
  if (m) {
    const v = toRupees(m[1], m[2]);
    if (v >= 1000) {
      result.minPrice = v;
      applied.push(`above ${fmt(v)}`);
      text = text.replace(MIN_RE, ' ');
    }
  }

  // Loose phrasing ("20k budget", "rent 15000") sets a ceiling if none was found yet
  if (result.maxPrice === undefined && result.minPrice === undefined) {
    m = text.match(LOOSE_RE);
    if (m) {
      const raw = m[1] ?? m[3];
      const unit = m[1] ? m[2] : m[4];
      const v = toRupees(raw, unit);
      if (v >= 1000) {
        result.maxPrice = v;
        applied.push(`under ${fmt(v)}`);
        text = text.replace(LOOSE_RE, ' ');
      }
    }
  }

  // Bedrooms (kept in the text too: "2BHK" is a useful semantic hint)
  m = input.match(BHK_RE);
  if (m) {
    result.bedrooms = parseInt(m[1], 10);
    applied.push(`${result.bedrooms} BHK`);
  } else if (RK_RE.test(input)) {
    result.bedrooms = 1;
    applied.push('1 BHK');
  }

  // City: whole-word match against the cities that actually exist in the database
  for (const city of knownCities) {
    const re = new RegExp(String.raw`\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\b`, 'i');
    if (re.test(input)) {
      result.city = city;
      applied.push(city);
      break;
    }
  }

  text = text.replace(/\s+/g, ' ').trim();
  result.text = text;

  const meaningful = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !GENERIC_WORDS.has(w) && !/^\d+$/.test(w) && !/^\d+(bhk|rk)$/.test(w) && !(result.city && w === result.city.toLowerCase()));
  result.isGeneric = meaningful.length === 0;

  return result;
}

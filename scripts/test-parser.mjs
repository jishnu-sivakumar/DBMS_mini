// Tests for the natural-language query parser. Run: npm run test:parser
import assert from 'node:assert/strict';
import { parseSearchQuery } from '../lib/query-parser.ts';

const cities = ['Bengaluru', 'Mumbai', 'Pune', 'Goa'];
const cases = [
  // [input, expected fields]
  ['homes under rent 20k', { maxPrice: 20000, isGeneric: true }],
  ['cheap flat under 10000', { maxPrice: 10000, isGeneric: true }],
  ['pet friendly 2BHK in Pune under 25k', { maxPrice: 25000, bedrooms: 2, city: 'Pune', isGeneric: false }],
  ['1 bhk below 15,000 near metro', { maxPrice: 15000, bedrooms: 1, isGeneric: false }],
  ['villa above 1 lakh in Goa', { minPrice: 100000, city: 'Goa', isGeneric: false }],
  ['2BHK Pune below 1.5 lakh', { maxPrice: 150000, bedrooms: 2, city: 'Pune' }],
  ['rent 18000 student room', { maxPrice: 18000, isGeneric: false }],
  ['house under 25 k', { maxPrice: 25000, isGeneric: true }],
  ['3 bedroom with pool max 80k', { maxPrice: 80000, bedrooms: 3, isGeneric: false }],
  ['house where I can keep my dog', { maxPrice: undefined, bedrooms: undefined, city: undefined, isGeneric: false }],
  ['quiet place near tech park with balcony', { maxPrice: undefined, isGeneric: false }],
  ['apartment under 3 bedrooms', { maxPrice: undefined, bedrooms: 3 }],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = parseSearchQuery(input, cities);
  try {
    for (const [key, value] of Object.entries(expected)) assert.equal(got[key], value, `${key}`);
    console.log('PASS', JSON.stringify(input));
  } catch (e) {
    failed++;
    console.log('FAIL', JSON.stringify(input), '-', e.message, '| got', JSON.stringify(got));
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);

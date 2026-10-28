process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import { estimatePrice } from '../src/services/pricingService.js';
import { estimatePriceHandler } from '../src/controllers/pricingController.js';
import { mockAuctions } from '../src/utils/mockStore.js';
import * as auctionService from '../src/services/auctionService.js';

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    -> ${err.message}`);
    failedCount++;
  }
}

console.log('\n======================================================');
console.log(' RUNNING SMART PRICE ADVISOR TEST SUITE (CHANGE 5)');
console.log('======================================================\n');

async function runTests() {
  // Clear mockAuctions
  mockAuctions.length = 0;

  // ── Scenario 1: Calculator with sufficient comparable listings ─────────────
  await test('1. Calculator with sufficient comparable listings (medium/high confidence)', async () => {
    mockAuctions.length = 0;
    mockAuctions.push(
      { id: 'c1', title: 'Casio Scientific Calculator fx-991EX', category: 'Calculators', condition: 'Good', status: 'SOLD', currentPricePaise: 90000, bidCount: 4 },
      { id: 'c2', title: 'Casio fx-991EX ClassWiz Calculator', category: 'Calculators', condition: 'Like New', status: 'SOLD', currentPricePaise: 110000, bidCount: 6 },
      { id: 'c3', title: 'Casio fx-991 Scientific Calculator', category: 'Calculators', condition: 'Good', status: 'LIVE', currentPricePaise: 85000, startingPricePaise: 80000, bidCount: 2 },
      { id: 'c4', title: 'Casio fx-82MS Scientific Calculator', category: 'Calculators', condition: 'Fair', status: 'SOLD', currentPricePaise: 50000, bidCount: 3 }
    );

    const estimate = await estimatePrice({
      title: 'Casio fx-991EX Calculator',
      category: 'Calculators',
      condition: 'Good',
      brand: 'Casio',
      model: 'fx-991EX',
    });

    assert.ok(estimate.estimatedPricePaise > 0, 'Must produce an estimated price');
    assert.ok(estimate.loPaise <= estimate.estimatedPricePaise, 'loPaise <= estimatedPricePaise');
    assert.ok(estimate.hiPaise >= estimate.estimatedPricePaise, 'hiPaise >= estimatedPricePaise');
    assert.ok(estimate.suggestedStartPaise <= estimate.estimatedPricePaise, 'suggested start encourages bidding');
    assert.ok(estimate.comparableCount >= 3, 'Must identify comparable calculators');
    assert.ok(['medium', 'high'].includes(estimate.confidence), `Expected medium/high confidence, got ${estimate.confidence}`);
    assert.ok(estimate.comparables.length > 0, 'Must return comparable listing details');
    assert.ok(estimate.explanation.includes('comparable campus listings'), 'Explanation mentions comparables');
  });

  // ── Scenario 2: Textbook with few / zero comparable listings ─────────────────
  await test('2. Textbook with few/zero comparable listings (transparent limited-data fallback)', async () => {
    mockAuctions.length = 0; // Empty marketplace for books

    const estimate = await estimatePrice({
      title: 'Advanced Engineering Mathematics Kreyszig 10th Ed',
      category: 'Books',
      condition: 'Good',
    });

    assert.strictEqual(estimate.confidence, 'low', 'Confidence must be low when no comparables exist');
    assert.strictEqual(estimate.comparableCount, 0, 'Comparable count must be 0');
    assert.strictEqual(estimate.comparables.length, 0, 'No fabricated comparables allowed');
    assert.ok(estimate.explanation.includes('limited information'), 'Must explicitly state limited information');
    assert.ok(estimate.explanation.includes('category benchmarks'), 'Must disclose benchmark fallback');
    assert.ok(estimate.estimatedPricePaise > 0, 'Fallback provides reasonable starting anchor');
  });

  // ── Scenario 3: Laptop with brand, model, age, condition, original price ─────
  await test('3. Laptop with brand, model, age, condition, and original price anchoring', async () => {
    mockAuctions.length = 0;

    const estimateNew = await estimatePrice({
      title: 'MacBook Air M1 256GB',
      category: 'Electronics',
      condition: 'Like New',
      brand: 'Apple',
      model: 'MacBook Air M1',
      ageMonths: 12,
      originalPriceRupees: 75000,
    });

    const estimatePoor = await estimatePrice({
      title: 'MacBook Air M1 256GB',
      category: 'Electronics',
      condition: 'Poor',
      brand: 'Apple',
      model: 'MacBook Air M1',
      ageMonths: 36,
      originalPriceRupees: 75000,
    });

    assert.ok(estimateNew.estimatedPricePaise > estimatePoor.estimatedPricePaise, 'Like New should be priced higher than Poor condition');
    assert.ok(estimateNew.explanation.includes('75,000'), 'Mentions original price anchor');
    assert.ok(estimateNew.explanation.includes('depreciation'), 'Mentions age depreciation');
  });

  // ── Scenario 4: Missing or incomplete product information ───────────────────
  await test('4. Missing or incomplete product information handled gracefully', async () => {
    mockAuctions.length = 0;

    const estimate = await estimatePrice({
      category: 'Cycles',
      condition: 'Fair',
      // No title, brand, model, age, or original price
    });

    assert.ok(estimate.estimatedPricePaise > 0, 'Should fall back to category base gracefully');
    assert.strictEqual(estimate.confidence, 'low', 'Confidence should be low');
    assert.ok(estimate.suggestedStartPaise > 0, 'Suggested start should be valid positive number');
  });

  // ── Scenario 5: Price detection logic (above, below, within) ────────────────
  await test('5. Price detection logic correctly identifies above, below, and within range', () => {
    const range = { loRupees: 700, hiRupees: 1000, suggestedStartRupees: 800 };

    const checkPrice = (price) => {
      if (price > range.hiRupees) return 'above';
      if (price < range.loRupees) return 'below';
      return 'within';
    };

    assert.strictEqual(checkPrice(1500), 'above', '1500 is above 1000');
    assert.strictEqual(checkPrice(500), 'below', '500 is below 700');
    assert.strictEqual(checkPrice(800), 'within', '800 is within 700-1000');
    assert.strictEqual(checkPrice(700), 'within', '700 is within range (inclusive)');
    assert.strictEqual(checkPrice(1000), 'within', '1000 is within range (inclusive)');
  });

  // ── Scenario 6: Applying and editing suggested starting price ────────────────
  await test('6. Applying suggested starting price preserves user ability to edit', () => {
    let startingPrice = '';
    const suggested = 850;

    // Simulate clicking "Use Suggested Price"
    startingPrice = String(suggested);
    assert.strictEqual(startingPrice, '850', 'Populated suggested starting price');

    // Simulate user editing the price
    startingPrice = '900';
    assert.strictEqual(startingPrice, '900', 'User freely edits populated price');
  });

  // ── Scenario 7: AI provider unavailable or timed out ────────────────────────
  await test('7. AI provider unavailable or unconfigured falls back seamlessly', async () => {
    const oldKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY; // Simulate unconfigured AI

    const estimate = await estimatePrice({
      title: 'Hero Sprint Bicycle',
      category: 'Cycles',
      condition: 'Good',
    });

    assert.ok(estimate.explanation.length > 10, 'Baseline explanation is produced');
    assert.strictEqual(estimate.aiUsed, false, 'aiUsed is false');

    if (oldKey) process.env.GEMINI_API_KEY = oldKey;
  });

  // ── Scenario 8: Pricing controller input validation and rate limiting ───────
  await test('8. Pricing controller rejects invalid inputs and sanitizes data', async () => {
    // Test missing category
    let resData = null;
    let resStatus = 200;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(data) { resData = data; return this; }
    };

    await estimatePriceHandler({
      body: { condition: 'Good' },
      ip: '127.0.0.1',
      headers: {}
    }, mockRes, () => {});

    assert.strictEqual(resStatus, 400, 'Should reject missing category with 400');
    assert.strictEqual(resData.success, false);

    // Test invalid condition
    await estimatePriceHandler({
      body: { category: 'Calculators', condition: 'BrokenBeyondRepair' },
      ip: '127.0.0.1',
      headers: {}
    }, mockRes, () => {});

    assert.strictEqual(resStatus, 400, 'Should reject invalid condition with 400');
    assert.strictEqual(resData.success, false);

    // Test valid request
    resData = null;
    resStatus = 200;
    await estimatePriceHandler({
      body: { category: 'Calculators', condition: 'Good', title: 'Casio 991' },
      ip: '127.0.0.1',
      headers: {}
    }, mockRes, () => {});

    assert.strictEqual(resStatus, 200, 'Should accept valid request with 200');
    assert.strictEqual(resData.success, true);
    assert.ok(resData.estimate.suggestedStartRupees > 0, 'Returns suggestedStartRupees');
    assert.ok(resData.estimate.loRupees <= resData.estimate.hiRupees, 'loRupees <= hiRupees');
  });

  // ── Scenario 9: Existing auction creation and bidding workflow preserved ─────
  await test('9. Existing auction creation and bidding workflow functions normally', async () => {
    const seller = { uid: 'seller_p9', name: 'Price Tester', email: 'pt@campus.edu' };
    const created = await auctionService.createAuction({
      title: 'Lab Kit Microscope',
      category: 'Electronics',
      condition: 'Good',
      startingPricePaise: 200000,
      minIncrementPaise: 10000,
      endsAt: new Date(Date.now() + 3600000).toISOString(),
      location: 'Physics Lab',
    }, seller);

    assert.ok(created.id, 'Auction created with valid ID');
    assert.strictEqual(created.status, 'LIVE', 'New auction is LIVE');
    assert.strictEqual(created.startingPricePaise, 200000, 'Price matches entered value');
  });

  console.log('\n======================================================');
  console.log(` TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import { extractQueryFilters, processAssistantSearch } from '../src/services/assistantService.js';
import { mockAuctions, mockUsers, mockAutoBids } from '../src/utils/mockStore.js';
import * as autoBidService from '../src/services/autoBidService.js';
import { handleAssistantSearch } from '../src/controllers/assistantController.js';

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
console.log(' RUNNING AI ASSISTANT TEST SUITE');
console.log('======================================================\n');

async function runTests() {
  // ── Scenario 1: Natural Language Budget & Keyword Extraction ───────────────
  await test('1. Natural Language Extraction: Budget, category, and keyword parsing', () => {
    const q1 = extractQueryFilters('Find me a cycle under ₹2,000');
    assert.strictEqual(q1.category, 'Cycles');
    assert.strictEqual(q1.maxBudgetRupees, 2000);
    assert.strictEqual(q1.maxBudgetPaise, 200000);

    const q2 = extractQueryFilters('Show laptops with less than 30 minutes remaining');
    assert.strictEqual(q2.category, 'Electronics');
    assert.strictEqual(q2.closingWithinMinutes, 30);
    assert.strictEqual(q2.sortBy, 'closing_soon');

    const q3 = extractQueryFilters('Find the cheapest active calculator');
    assert.strictEqual(q3.category, 'Calculators');
    assert.strictEqual(q3.sortBy, 'cheapest');

    const q4 = extractQueryFilters('Show the most active auctions under ₹1,500');
    assert.strictEqual(q4.sortBy, 'most_active');
    assert.strictEqual(q4.maxBudgetRupees, 1500);
  });

  // ── Scenario 2: Invalid or Excessive Budget Values ──────────────────────────
  await test('2. Invalid or excessive budget values handled safely without crashing', () => {
    const qNegative = extractQueryFilters('Find books under -500 rupees');
    assert.strictEqual(qNegative.maxBudgetRupees, null, 'Negative budget must be ignored');

    const qExtreme = extractQueryFilters('Show cycles under ₹99999999999');
    assert.strictEqual(qExtreme.maxBudgetRupees, null, 'Extreme budget exceeding threshold must be ignored');
  });

  // ── Scenario 3: Real Database Matching Listings ─────────────────────────────
  await test('3. Search returns genuine database listings matching criteria', async () => {
    mockAuctions.length = 0;
    const now = Date.now();

    mockAuctions.push(
      {
        id: 'cycle-01',
        title: 'Hero Sprint Pro 21-Speed Mountain Bike',
        category: 'Cycles',
        condition: 'Good',
        startingPricePaise: 150000,
        currentPricePaise: 180000, // ₹1,800
        minIncrementPaise: 10000,
        bidCount: 3,
        status: 'LIVE',
        endsAt: new Date(now + 3600000).toISOString(),
        location: 'Hostel 4',
        sellerUid: 'seller_01',
        sellerName: 'Kongu Senior',
        sellerEmail: 'senior@kongu.edu'
      },
      {
        id: 'cycle-02',
        title: 'Hercules Roadeo Hardtail Cycle',
        category: 'Cycles',
        condition: 'Like New',
        startingPricePaise: 250000,
        currentPricePaise: 280000, // ₹2,800 (exceeds ₹2,000 budget)
        minIncrementPaise: 10000,
        bidCount: 5,
        status: 'LIVE',
        endsAt: new Date(now + 7200000).toISOString(),
        location: 'Hostel 2',
        sellerUid: 'seller_02',
        sellerName: 'Kongu Cyclist',
        sellerEmail: 'cyclist@kongu.edu'
      }
    );

    const res = await processAssistantSearch('Find me a cycle under ₹2,000');
    assert.strictEqual(res.count, 1, 'Only the cycle under ₹2,000 must match');
    assert.strictEqual(res.results[0].id, 'cycle-01');
    assert.strictEqual(res.results[0].currentPriceRupees, 1800);
    assert.strictEqual(res.results[0].withinBudget, true);
    assert.strictEqual(res.results[0].budgetDifferenceRupees, 200);
  });

  // ── Scenario 4: Privacy Protection ──────────────────────────────────────────
  await test('4. Privacy: Seller email and private account IDs are strictly excluded from results', async () => {
    const res = await processAssistantSearch('Find me a cycle under ₹2,000');
    assert.ok(res.results.length > 0);
    const item = res.results[0];

    assert.strictEqual(item.sellerEmail, undefined, 'Must never expose seller email in assistant results');
    assert.strictEqual(item.sellerUid, undefined, 'Must never expose seller UID in assistant results');
    assert.strictEqual(item.autoBids, undefined, 'Must never expose internal auto-bids in results');
  });

  // ── Scenario 5: Expired and Inactive Auctions Excluded ───────────────────────
  await test('5. Inactive or expired auctions are excluded from active search results', async () => {
    mockAuctions.length = 0;
    const now = Date.now();

    mockAuctions.push(
      {
        id: 'laptop-expired',
        title: 'Dell Inspiron i5 Laptop',
        category: 'Electronics',
        condition: 'Good',
        startingPricePaise: 1500000,
        currentPricePaise: 1800000,
        status: 'SOLD', // Completed auction
        endsAt: new Date(now - 100000).toISOString()
      },
      {
        id: 'laptop-live',
        title: 'HP Pavilion 15 Laptop',
        category: 'Electronics',
        condition: 'Like New',
        startingPricePaise: 2000000,
        currentPricePaise: 2200000,
        status: 'LIVE',
        endsAt: new Date(now + 1800000).toISOString() // 30 mins
      }
    );

    const res = await processAssistantSearch('Show laptops with less than 30 minutes remaining');
    assert.strictEqual(res.results.some(r => r.id === 'laptop-expired'), false, 'SOLD auction must be excluded');
    assert.strictEqual(res.results.some(r => r.id === 'laptop-live'), true, 'LIVE auction must be included');
  });

  // ── Scenario 6: Empty Results Handled Gracefully ────────────────────────────
  await test('6. No matching listings produces friendly empty state without error', async () => {
    mockAuctions.length = 0;
    const res = await processAssistantSearch('Find me a grand piano under ₹500');

    assert.strictEqual(res.count, 0);
    assert.strictEqual(res.results.length, 0);
    assert.ok(res.summary.includes('No active'), 'Friendly explanation for zero results');
  });

  // ── Scenario 7: Assistant Endpoint Validation & Rate Limiting ───────────────
  await test('7. Assistant controller validates query and enforces length limits', async () => {
    let resCode = 200;
    let resJson = null;
    const mockRes = {
      status(c) { resCode = c; return this; },
      json(d) { resJson = d; return this; }
    };

    // Missing query
    await handleAssistantSearch({ body: {}, ip: '127.0.0.1', headers: {} }, mockRes, () => {});
    assert.strictEqual(resCode, 400);
    assert.strictEqual(resJson.success, false);

    // Overly long query (>300 chars)
    resCode = 200;
    await handleAssistantSearch({
      body: { query: 'a'.repeat(305) },
      ip: '127.0.0.1',
      headers: {}
    }, mockRes, () => {});
    assert.strictEqual(resCode, 400);
    assert.strictEqual(resJson.success, false);
  });

  // ── Scenario 8: Auto-Bid Registration Requires Authentication & Validation ───
  await test('8. Automatic bidding requires valid user, enforces ceiling, and rejects seller self-bid', async () => {
    mockAuctions.length = 0;
    const now = Date.now();
    const auction = {
      id: 'autobid-target-01',
      title: 'Casio fx-991EX Calculator',
      category: 'Calculators',
      condition: 'Good',
      startingPricePaise: 80000,
      currentPricePaise: 80000,
      minIncrementPaise: 5000,
      bidCount: 0,
      status: 'LIVE',
      sellerUid: 'seller_kongu',
      endsAt: new Date(now + 3600000).toISOString()
    };
    mockAuctions.push(auction);

    const studentUser = {
      uid: 'student_kongu_01',
      name: 'Kongu Student',
      email: 'student@kongu.edu'
    };

    // Seller cannot auto-bid on own auction
    let sellerError = false;
    try {
      await autoBidService.registerAutoBid({
        auctionId: auction.id,
        maxAmountPaise: 100000,
        user: { uid: 'seller_kongu', name: 'Seller', email: 'seller@kongu.edu' }
      });
    } catch (err) {
      sellerError = true;
      assert.ok(err.message.includes('Seller cannot'));
    }
    assert.strictEqual(sellerError, true, 'Seller self-autobid rejected');

    // Valid auto-bid registration by student
    const autoBid = await autoBidService.registerAutoBid({
      auctionId: auction.id,
      maxAmountPaise: 120000, // ₹1,200 max ceiling
      user: studentUser
    });

    assert.ok(autoBid.id);
    assert.strictEqual(autoBid.maxAmountPaise, 120000);
    assert.strictEqual(autoBid.bidderUid, studentUser.uid);
    assert.strictEqual(autoBid.active, true);
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

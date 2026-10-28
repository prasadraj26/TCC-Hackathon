/**
 * Comprehensive Test Suite for Campus Auction Core Bidding Engine & Lifecycle Rules.
 * Verifies all 11 critical test cases specified in Section 13.
 */

import assert from 'node:assert';
import { placeBid, getAuctionBids } from '../src/services/biddingService.js';
import { registerAutoBid, getAuctionAutoBids } from '../src/services/autoBidService.js';
import * as auctionService from '../src/services/auctionService.js';
import { mockAuctions, mockBids, mockAutoBids } from '../src/utils/mockStore.js';

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
console.log(' RUNNING CAMPUS BIDDING ENGINE HIGH-RISK TEST SUITE');
console.log('======================================================\n');

async function runTests() {
  const testAuctionId = 'test-auction-unit-01';
  const seller = { uid: 'seller_123', name: 'Seller Sam', email: 'sam@campus.edu' };
  const bidderA = { uid: 'bidder_aaa', name: 'Alice Junior', email: 'alice@campus.edu' };
  const bidderB = { uid: 'bidder_bbb', name: 'Bob Senior', email: 'bob@campus.edu' };
  const attacker = { uid: 'attacker_x', name: 'Mallory', email: 'mallory@campus.edu' };

  // Setup test auction
  function resetTestAuction(overrides = {}) {
    const existingIdx = mockAuctions.findIndex(a => a.id === testAuctionId);
    const auction = {
      id: testAuctionId,
      sellerUid: seller.uid,
      sellerName: seller.name,
      sellerEmail: seller.email,
      title: 'Lab Bicycle Test Listing',
      category: 'Cycles',
      condition: 'Good',
      startingPricePaise: 100000, // ₹1,000
      minIncrementPaise: 10000,   // ₹100
      currentPricePaise: 100000,
      currentLeaderUid: null,
      currentLeaderName: null,
      bidCount: 0,
      status: 'LIVE',
      createdAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour in future
      ...overrides
    };

    if (existingIdx >= 0) {
      mockAuctions[existingIdx] = auction;
    } else {
      mockAuctions.push(auction);
    }
    return auction;
  }

  // 1. Reject a bid below the minimum
  await test('1. Reject a bid below the minimum required price', async () => {
    resetTestAuction();
    let errorCaught = false;
    try {
      // Starting is ₹1,000 (100000 paise). Bid ₹500 (50000 paise).
      await placeBid(testAuctionId, 50000, bidderA);
    } catch (err) {
      errorCaught = true;
      assert(err.message.includes('must be at least'));
    }
    assert.strictEqual(errorCaught, true, 'Should reject bid below starting price');
  });

  // 2. Reject seller self-bidding
  await test('2. Reject seller self-bidding', async () => {
    resetTestAuction();
    let errorCaught = false;
    try {
      await placeBid(testAuctionId, 120000, seller);
    } catch (err) {
      errorCaught = true;
      assert(err.message.includes('Sellers cannot bid on their own listings'));
    }
    assert.strictEqual(errorCaught, true, 'Should reject seller self-bidding');
  });

  // 3. Reject bids after closing time
  await test('3. Reject bids after the closing time', async () => {
    resetTestAuction({
      endsAt: new Date(Date.now() - 5000).toISOString() // 5s in past
    });
    let errorCaught = false;
    try {
      await placeBid(testAuctionId, 110000, bidderA);
    } catch (err) {
      errorCaught = true;
      assert(err.message.includes('ended'));
    }
    assert.strictEqual(errorCaught, true, 'Should reject bids on expired auction');
  });

  // 4. Accept a valid bid
  await test('4. Accept a valid bid and update auction state', async () => {
    const a = resetTestAuction();
    const result = await placeBid(testAuctionId, 110000, bidderA); // ₹1,100
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.bid.amountPaise, 110000);
    assert.strictEqual(a.currentPricePaise, 110000);
    assert.strictEqual(a.currentLeaderUid, bidderA.uid);
    assert.strictEqual(a.bidCount, 1);
  });

  // 5. Extend the auction for a bid in the last 30 seconds (Anti-Sniping)
  await test('5. Extend closing deadline if bid arrives in final 30 seconds', async () => {
    // Auction ends in 15 seconds
    const a = resetTestAuction({
      currentPricePaise: 110000,
      bidCount: 1,
      endsAt: new Date(Date.now() + 15000).toISOString()
    });

    const result = await placeBid(testAuctionId, 120000, bidderB);
    assert.strictEqual(result.extended, true, 'Auction should be marked as extended');
    const newEndMs = new Date(result.newEndsAt).getTime();
    const diff = newEndMs - Date.now();
    assert(diff >= 58000 && diff <= 61000, 'Deadline should be extended to ~60s from now');
  });

  // 6. Handle repeated anti-sniping extensions
  await test('6. Repeated qualifying bids repeatedly extend the auction', async () => {
    const a = resetTestAuction({
      currentPricePaise: 120000,
      bidCount: 2,
      endsAt: new Date(Date.now() + 20000).toISOString()
    });

    const res1 = await placeBid(testAuctionId, 130000, bidderA);
    assert.strictEqual(res1.extended, true);
    const end1 = new Date(res1.newEndsAt).getTime();

    // Simulate another bid arriving while remaining time is under 30s
    a.endsAt = new Date(Date.now() + 10000).toISOString();
    const res2 = await placeBid(testAuctionId, 140000, bidderB);
    assert.strictEqual(res2.extended, true);
    const end2 = new Date(res2.newEndsAt).getTime();
    assert(end2 >= Date.now() + 58000, 'Repeated bid must extend new deadline');
  });

  // 7. Prevent conflicting concurrent bids from corrupting the leader
  await test('7. Concurrency simulation prevents race conditions from accepting stale bids', async () => {
    const a = resetTestAuction({
      currentPricePaise: 100000,
      bidCount: 0
    });

    // Simulate two concurrent requests that both observed current price = ₹1,000
    // Request 1 bids ₹1,100, Request 2 bids ₹1,100 at the same time
    const p1 = placeBid(testAuctionId, 110000, bidderA);
    const p2 = placeBid(testAuctionId, 110000, bidderB).catch(err => err);

    const [r1, r2] = await Promise.all([p1, p2]);

    // Exactly one must succeed, the other must fail because ₹1,100 is no longer valid once r1 executes!
    const oneFailed = (r1 instanceof Error) || (r2 instanceof Error);
    assert.strictEqual(oneFailed, true, 'One of the identical concurrent bids must be rejected');
    assert.strictEqual(a.currentPricePaise, 110000);
  });

  // 8. Keep current leading price consistent with accepted bid history
  await test('8. Current price strictly matches the highest accepted bid history record', async () => {
    const a = resetTestAuction({ currentPricePaise: 100000, bidCount: 0 });
    await placeBid(testAuctionId, 110000, bidderA);
    await placeBid(testAuctionId, 130000, bidderB);
    await placeBid(testAuctionId, 150000, bidderA);

    const bids = await getAuctionBids(testAuctionId);
    assert.strictEqual(bids[0].amountPaise, 150000);
    assert.strictEqual(a.currentPricePaise, bids[0].amountPaise);
    assert.strictEqual(a.currentLeaderUid, bids[0].bidderUid);
  });

  // 9. Enforce automatic-bidding maximums
  await test('9. Automatic bidding respects max limit and maintains lead with minimum increment', async () => {
    const a = resetTestAuction({
      currentPricePaise: 100000,
      minIncrementPaise: 10000,
      bidCount: 0
    });

    // Bidder A registers an auto-bid with max ₹2,000 (200000 paise)
    await registerAutoBid({
      auctionId: testAuctionId,
      maxAmountPaise: 200000,
      user: bidderA
    });

    // Bidder B manually places bid of ₹1,200
    await placeBid(testAuctionId, 120000, bidderB);

    // Auto-bidder A should have automatically outbid B to ₹1,300
    assert.strictEqual(a.currentLeaderUid, bidderA.uid);
    assert.strictEqual(a.currentPricePaise, 130000);
    assert(a.currentPricePaise <= 200000, 'Must never exceed authorized max');
  });

  // 10. Prevent unauthorized seller actions
  await test('10. Non-seller is rejected from performing seller lifecycle actions', async () => {
    const a = resetTestAuction({
      status: 'ENDED_PENDING_SELLER',
      currentPricePaise: 150000,
      currentLeaderUid: bidderA.uid
    });

    let errorCaught = false;
    try {
      await auctionService.approveWinningBid(testAuctionId, attacker);
    } catch (err) {
      errorCaught = true;
      assert(err.message.includes('Unauthorized'));
    }
    assert.strictEqual(errorCaught, true, 'Attacker cannot approve auction');
  });

  // 11. Prevent duplicate closing and conflicting outcome transitions
  await test('11. Enforce strict state machine transitions (prevent duplicate closes / invalid hops)', async () => {
    const a = resetTestAuction({
      status: 'ENDED_PENDING_SELLER',
      currentPricePaise: 150000,
      currentLeaderUid: bidderA.uid
    });

    // Valid: Approve -> RESERVED
    await auctionService.approveWinningBid(testAuctionId, seller);
    assert.strictEqual(a.status, 'RESERVED');

    // Invalid: Try to approve again or reject once already RESERVED
    let errorCaught = false;
    try {
      await auctionService.rejectWinningBid(testAuctionId, 'Changed mind', seller);
    } catch (err) {
      errorCaught = true;
      assert(err.message.includes('Invalid state transition'));
    }
    assert.strictEqual(errorCaught, true, 'Cannot transition from RESERVED to REJECTED');

    // Valid: Confirm handover -> SOLD
    await auctionService.confirmHandover(testAuctionId, seller);
    assert.strictEqual(a.status, 'SOLD');
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

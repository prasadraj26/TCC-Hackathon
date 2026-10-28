process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import { isKonguEmail, normalizeEmail, AUTH_ERROR_MESSAGES, KONGU_EMAIL_DOMAIN } from '../src/utils/authValidators.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { mockUsers, mockAuctions } from '../src/utils/mockStore.js';
import * as auctionService from '../src/services/auctionService.js';
import * as biddingService from '../src/services/biddingService.js';

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
console.log(' RUNNING KONGU EMAIL DOMAIN RESTRICTION TEST SUITE (CHANGE 6)');
console.log('======================================================\n');

async function runTests() {
  // ── Scenario 1 & 8: Domain validation, case variations, and lookalikes ──────
  await test('1. Email validation: Accept valid @kongu.edu addresses including student IDs', () => {
    assert.strictEqual(isKonguEmail('prasadrajv.23aid@kongu.edu'), true);
    assert.strictEqual(isKonguEmail('student123@kongu.edu'), true);
    assert.strictEqual(isKonguEmail('hod.cse@kongu.edu'), true);
    assert.strictEqual(isKonguEmail('john.doe+test@kongu.edu'), true);
  });

  await test('2. Email validation: Case variations and surrounding whitespace ignored', () => {
    assert.strictEqual(isKonguEmail('PrasadRajV.23AID@KONGU.EDU'), true);
    assert.strictEqual(isKonguEmail('  student@kongu.edu  '), true);
    assert.strictEqual(isKonguEmail('STUDENT@Kongu.Edu\n'), true);
    assert.strictEqual(normalizeEmail('  PrasadRajV.23AID@Kongu.Edu  '), 'prasadrajv.23aid@kongu.edu');
  });

  await test('3. Email validation: Reject public domains (Gmail, Yahoo, Outlook, etc.)', () => {
    assert.strictEqual(isKonguEmail('student@gmail.com'), false);
    assert.strictEqual(isKonguEmail('student@yahoo.com'), false);
    assert.strictEqual(isKonguEmail('student@outlook.com'), false);
    assert.strictEqual(isKonguEmail('student@hotmail.com'), false);
    assert.strictEqual(isKonguEmail('student@icloud.com'), false);
  });

  await test('4. Email validation: Reject domain lookalikes and subdomains', () => {
    assert.strictEqual(isKonguEmail('student@kongu.edu.example.com'), false);
    assert.strictEqual(isKonguEmail('student@fakekongu.edu'), false);
    assert.strictEqual(isKonguEmail('student@kongu.edu.in'), false);
    assert.strictEqual(isKonguEmail('student@sub.kongu.edu'), false);
    assert.strictEqual(isKonguEmail('student@notkongu.edu'), false);
    assert.strictEqual(isKonguEmail('@kongu.edu'), false);
    assert.strictEqual(isKonguEmail('kongu.edu'), false);
    assert.strictEqual(isKonguEmail(''), false);
    assert.strictEqual(isKonguEmail(null), false);
    assert.strictEqual(isKonguEmail(undefined), false);
  });

  // ── Scenario 5: Backend middleware enforcement ──────────────────────────────
  await test('5. Backend middleware: Reject unauthorized email domain with HTTP 403', async () => {
    // Setup an unauthorized user in mockUsers
    mockUsers['unauthorized_user_1'] = {
      uid: 'unauthorized_user_1',
      name: 'Gmail Student',
      email: 'student@gmail.com'
    };

    let statusCode = 200;
    let responseBody = null;
    let nextCalled = false;

    const req = {
      headers: {
        authorization: 'Bearer demo_unauthorized_user_1'
      }
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };

    await authenticate(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Middleware must not call next() for unauthorized domain');
    assert.strictEqual(statusCode, 403, 'Must return HTTP 403 Forbidden');
    assert.strictEqual(responseBody.success, false);
    assert.strictEqual(responseBody.error, AUTH_ERROR_MESSAGES.BACKEND_FORBIDDEN_DOMAIN);
  });

  await test('6. Backend middleware: Accept authorized @kongu.edu domain with HTTP 200 (next)', async () => {
    mockUsers['kongu_user_1'] = {
      uid: 'kongu_user_1',
      name: 'Prasad Raj',
      email: 'prasadrajv.23aid@kongu.edu'
    };

    let statusCode = 200;
    let responseBody = null;
    let nextCalled = false;

    const req = {
      headers: {
        authorization: 'Bearer demo_kongu_user_1'
      }
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };

    await authenticate(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Middleware must call next() for authorized @kongu.edu domain');
    assert.strictEqual(statusCode, 200);
    assert.ok(req.user, 'req.user must be populated');
    assert.strictEqual(req.user.email, 'prasadrajv.23aid@kongu.edu');
  });

  await test('7. Backend middleware: Missing token returns HTTP 401', async () => {
    let statusCode = 200;
    let responseBody = null;
    let nextCalled = false;

    const req = { headers: {} };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };

    await authenticate(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(statusCode, 401, 'Must return HTTP 401 Unauthorized for missing token');
  });

  // ── Scenario 6: Public auction browsing without login ───────────────────────
  await test('8. Public auction browsing remains accessible while logged out', async () => {
    // getAuctions service does not require authentication
    const auctions = await auctionService.getAuctions({});
    assert.ok(Array.isArray(auctions), 'Public listings fetch succeeds without user login');
  });

  // ── Scenario 7: Existing Kongu accounts, auctions, bids, and notifications ──
  await test('9. Kongu student accounts perform auction creation, bidding, and lifecycle actions', async () => {
    const konguSeller = {
      uid: 'kongu_seller_01',
      name: 'Seller Kongu',
      email: 'seller@kongu.edu'
    };
    const konguBidder = {
      uid: 'kongu_bidder_01',
      name: 'Bidder Kongu',
      email: 'bidder@kongu.edu'
    };

    // Create listing
    const auction = await auctionService.createAuction({
      title: 'Kongu Engineering Drafter & T-Square',
      category: 'Other',
      condition: 'Like New',
      startingPricePaise: 50000,
      minIncrementPaise: 5000,
      endsAt: new Date(Date.now() + 7200000).toISOString(),
      location: 'Mech Dept Block'
    }, konguSeller);

    assert.ok(auction.id, 'Auction created successfully');
    assert.strictEqual(auction.sellerEmail, 'seller@kongu.edu');

    // Place bid (auctionId, amountPaise, bidder)
    const bidResult = await biddingService.placeBid(auction.id, 55000, konguBidder);

    assert.strictEqual(bidResult.success, true);
    assert.ok(bidResult.bid, 'Bid placed successfully by Kongu student');

    const updatedAuction = await auctionService.getAuctionById(auction.id);
    assert.strictEqual(updatedAuction.currentPricePaise, 55000);
    assert.strictEqual(updatedAuction.currentLeaderUid, konguBidder.uid);
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

# CampusBid — Campus Auction Marketplace

A full-stack, transparent campus auction web application built for college graduating seniors and juniors to trade campus belongings (bicycles, scientific calculators, textbooks, monitors, hostel furniture) fairly and with complete price transparency.

---

## 1. Problem Statement & Solution

**The College Problem:**
On the final day of semester exams, graduating seniors leave campus and need to quickly liquidate used bicycles, calculators, books, and electronics. Juniors need these essentials at student-friendly prices. Currently, items are sold informally through campus chat groups where the fastest person to message wins, and prices are uncertain or unfair.

**The CampusBid Solution:**
Every listing is an independent real-time auction with:
- Dedicated starting price in integer minor units (paise).
- Minimum bid increment rule.
- Authoritative server-side closing countdown.
- 30-second **anti-sniping protection** (bids in the final 30 seconds extend closing by 60 seconds).
- Atomic Firestore transactional bidding engine.
- Public, transparent automatic bidding support.
- Seller approval and campus handover lifecycle (`LIVE` → `ENDED_PENDING_SELLER` → `RESERVED` → `SOLD`).

---

## 2. Architecture & Technology Stack

```
                          ┌────────────────────────┐
                          │   React 19 + Vite UI   │
                          │   (Pure CSS3, No TW)   │
                          └───────────┬────────────┘
                                      │ REST API / Bearer Auth
                                      ▼
                          ┌────────────────────────┐
                          │   Node.js + Express    │
                          │   REST Controller API  │
                          └─────┬────────────┬─────┘
                                │            │
                ┌───────────────┴────┐   ┌───┴────────────────┐
                ▼                    ▼   ▼                    ▼
     ┌───────────────────────┐ ┌──────────────┐ ┌──────────────────────┐
     │ Firebase Admin SDK    │ │ Cloudinary   │ │ In-Memory Fallback   │
     │ Auth + Firestore Txns │ │ Signed Media │ │ Demo & Test Store    │
     └───────────────────────┘ └──────────────┘ └──────────────────────┘
```

- **Frontend:** React 19, Vite, React Router v7, Lucide React icons, Native CSS3 (Design tokens, no Tailwind).
- **Backend:** Node.js, Express 5, JavaScript ES Modules (`"type": "module"`), CORS, Dotenv.
- **Database & Security:** Cloud Firestore with atomic transactions, Firebase Authentication, Firebase Admin SDK, and production `firestore.rules`.
- **Media CDN:** Cloudinary signed upload integration with server-generated API signatures.
- **Graceful Fallback:** Seamless Dual Mode — runs in **Local Demo Mode** out of the box with zero external configuration required, and automatically connects to live cloud services when real credentials are provided.

---

## 3. Project Directory Structure

```
campus-auction/
├── web/                           # Frontend React + Vite client
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/            # Header, Footer, CountdownTimer, DemoModeBanner
│   │   │   ├── auction/           # AuctionCard, BidHistory, AutoBidModal, SellerActionModal
│   │   ├── context/               # AuthContext.jsx
│   │   ├── pages/                 # Home, AuctionDetails, CreateListing, MyAuctions, Notifications, Profile, Login, Register, NotFound
│   │   ├── services/              # firebase.js, authService.js, auctionService.js, biddingService.js, notificationService.js, uploadService.js
│   │   ├── styles/                # global.css, layout.css, components.css, auction.css, pages.css
│   │   ├── utils/                 # formatters.js (INR paise conversion, dates)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── package.json
│   ├── index.html
│   └── vite.config.js
├── server/                        # Backend REST Express Server
│   ├── src/
│   │   ├── config/                # firebaseAdmin.js
│   │   ├── middleware/            # authenticate.js, errorHandler.js
│   │   ├── routes/                # auctions.js, bids.js, autoBids.js, uploads.js, notifications.js
│   │   ├── controllers/           # auctionController.js, biddingController.js, uploadController.js, notificationController.js
│   │   ├── services/              # auctionService.js, biddingService.js, autoBidService.js, notificationService.js
│   │   ├── utils/                 # money.js, mockStore.js (seed items & transactional state)
│   │   └── app.js                 # Express server & background sweep scheduler
│   ├── test/                      # bidding.test.js (11 critical test cases)
│   ├── .env.example
│   └── package.json
├── firestore.rules                # Production security rules
├── firestore.indexes.json         # Query compound indexes
├── .gitignore
├── package.json                   # Root monorepo scripts
└── README.md
```

---

## 4. Sale Lifecycle State Machine

```
              ┌──────────────────────────────────────────────┐
              │                     LIVE                     │
              └──────┬────────────────────────────────┬──────┘
                     │ Deadline passed (bids > 0)     │ Deadline passed (0 bids)
                     ▼                                ▼
       ┌───────────────────────────┐            ┌───────────┐
       │   ENDED_PENDING_SELLER    │            │  UNSOLD   │
       └─────┬───────────────┬─────┘            └───────────┘
             │ Seller        │ Seller
             │ Approves      │ Rejects
             ▼               ▼
       ┌───────────┐   ┌───────────┐
       │ RESERVED  │   │ REJECTED  │
       └─────┬─────┘   └───────────┘
             │
     ┌───────┴───────────────┐
     │ Meetup & Handover     │ Buyer no-show
     ▼                       ▼
┌───────────┐          ┌───────────────┐
│   SOLD    │          │ PICKUP_FAILED │
└───────────┘          └───────────────┘

* Note: Active listings can also transition to CANCELLED by the seller before sale.
```

---

## 5. Bidding Engine & Concurrency Design

### Minor Units (Paise)
All monetary values are stored as integers in paise (`1 INR = 100 paise`). For example, ₹500 is stored as `50000` paise. Bid validation uses integer comparison to prevent floating-point rounding errors.

### Atomic Concurrency
Every bid executes within a Firestore transaction:
1. Reads authoritative auction state and deadline.
2. Rejects bids if auction is expired (`now >= endsAt`) or inactive (`status !== 'LIVE'`).
3. Rejects seller self-bidding (`bidderUid === sellerUid`).
4. Validates `bidAmountPaise >= currentPricePaise + minIncrementPaise` (or `>= startingPricePaise` for the first bid).
5. **Anti-Sniping:** If remaining time is $\le 30$ seconds, sets `endsAt = now + 60s`.
6. Creates an immutable bid document in `/auctions/{id}/bids/{bidId}`.
7. Atomically updates auction `currentPricePaise`, `currentLeaderUid`, `bidCount`, and `endsAt`.

### Automatic Bidding
- Students set an authorized maximum bid.
- In accordance with collegiate transparency, maximum bids are publicly displayed to prevent hidden unfair sniping.
- Equal maximum bids are resolved deterministically: earlier registration time (`createdAt`) wins.
- The engine bids only enough to maintain the lead using the auction's minimum increment.

---

## 6. Environment Variables

### Frontend (`web/.env`):
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=1:your-app-id:web:your-hash
```

### Backend (`server/.env`):
```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

> **Note on Demo Mode:** When environment variables are omitted or kept as placeholder values, CampusBid runs in **Evaluation Demo Mode** with realistic seed items, in-memory atomic transactions, and 1-click persona switchers (Alex Sharma, Priya Patel, Rohan Verma).

---

## 7. Installation & Quick Start

### 1. Start Backend Server
```bash
cd campus-auction/server
npm start
# Server listens on http://localhost:5000
```

### 2. Start Frontend Web Client
```bash
cd campus-auction/web
npm run dev
# Vite dev server opens on http://localhost:5173
```

### 3. Build for Production
```bash
cd campus-auction/web
npm run build
```

---

## 8. Verification & Test Suite

The server includes an automated test suite verifying all 11 critical edge cases:

```bash
cd campus-auction/server
npm test
```

**Test Coverage:**
1. Reject a bid below the minimum starting price.
2. Reject seller self-bidding.
3. Reject bids after closing deadline.
4. Accept a valid bid and update auction state.
5. Extend closing deadline if bid arrives in final 30 seconds (Anti-Sniping).
6. Repeated qualifying bids repeatedly extend the auction.
7. Concurrency simulation prevents race conditions from accepting stale bids.
8. Current price strictly matches the highest accepted bid history record.
9. Automatic bidding respects max limit and maintains lead with minimum increment.
10. Non-seller is rejected from performing seller lifecycle actions.
11. Enforce strict state machine transitions (prevent duplicate closes / invalid hops).

**All 11 tests pass with 0 failures.**

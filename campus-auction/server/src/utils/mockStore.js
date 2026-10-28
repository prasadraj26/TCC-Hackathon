/**
 * In-Memory Transactional Store for Local / Demo / Test Mode.
 * Mirrors Firestore collection structure and provides atomic transaction semantics
 * so all bidding rules, anti-sniping, and state machine transitions work out of the box
 * before Firebase service-account credentials are provided.
 */

const now = Date.now();

// Initial mock users
export const mockUsers = {
  'user_alex_senior': {
    uid: 'user_alex_senior',
    email: 'alex.sharma@campus.edu',
    displayName: 'Alex Sharma (Graduating Senior)',
    campusYear: 'Final Year - B.Tech CS',
    hostel: 'Hostel 4, Room 218'
  },
  'user_priya_junior': {
    uid: 'user_priya_junior',
    email: 'priya.patel@campus.edu',
    displayName: 'Priya Patel (Junior 2nd Year)',
    campusYear: '2nd Year - Mechanical',
    hostel: 'Hostel 7, Room 104'
  },
  'user_rohan_tech': {
    uid: 'user_rohan_tech',
    email: 'rohan.verma@campus.edu',
    displayName: 'Rohan Verma (3rd Year)',
    campusYear: '3rd Year - Electrical',
    hostel: 'Hostel 2, Room 302'
  }
};

// Initial mock auctions
export const mockAuctions = [
  {
    id: 'auction-cycle-01',
    sellerUid: 'user_alex_senior',
    sellerName: 'Alex Sharma',
    sellerEmail: 'alex.sharma@campus.edu',
    title: 'Hero Sprint Pro 21-Speed Mountain Bicycle',
    category: 'Cycles',
    condition: 'Good',
    description: 'Perfect for campus commuting between academic blocks and hostels. Front disc brake, 21-speed Shimano gears, sturdy lock and helmet included. Serviced last month.',
    images: [
      'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=800&q=80'
    ],
    startingPricePaise: 350000, // ₹3,500
    minIncrementPaise: 10000,   // ₹100
    currentPricePaise: 380000,   // ₹3,800
    currentLeaderUid: 'user_priya_junior',
    currentLeaderName: 'Priya Patel',
    bidCount: 3,
    status: 'LIVE',
    createdAt: new Date(now - 3600000 * 24).toISOString(),
    // Closes in 45 minutes for live demo of countdown & anti-sniping
    endsAt: new Date(now + 45 * 60 * 1000).toISOString(),
    location: 'Hostel 4 Cycle Stand',
    outcome: null,
    outcomeNote: null
  },
  {
    id: 'auction-calc-02',
    sellerUid: 'user_alex_senior',
    sellerName: 'Alex Sharma',
    sellerEmail: 'alex.sharma@campus.edu',
    title: 'Casio fx-991EX Classwiz Scientific Calculator',
    category: 'Calculators',
    condition: 'Like New',
    description: 'Essential for Engineering Math, Physics, and Electrical exams. High-resolution spreadsheet display. Clean screen, all keys crisp, includes original protective hard cover.',
    images: [
      'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80'
    ],
    startingPricePaise: 80000,  // ₹800
    minIncrementPaise: 5000,    // ₹50
    currentPricePaise: 95000,   // ₹950
    currentLeaderUid: 'user_rohan_tech',
    currentLeaderName: 'Rohan Verma',
    bidCount: 2,
    status: 'LIVE',
    createdAt: new Date(now - 3600000 * 12).toISOString(),
    endsAt: new Date(now + 3 * 3600000).toISOString(), // 3 hours
    location: 'Central Library Foyer',
    outcome: null,
    outcomeNote: null
  },
  {
    id: 'auction-books-03',
    sellerUid: 'user_alex_senior',
    sellerName: 'Alex Sharma',
    sellerEmail: 'alex.sharma@campus.edu',
    title: 'Core CS Textbook Set: Cormen Algorithms + Tanenbaum Networks',
    category: 'Books',
    condition: 'Good',
    description: 'Standard textbook bundle for Computer Science students. Includes CLRS Introduction to Algorithms (3rd Ed) and Computer Networks. Highlights on key exam questions.',
    images: [
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80'
    ],
    startingPricePaise: 60000, // ₹600
    minIncrementPaise: 5000,   // ₹50
    currentPricePaise: 60000,  // ₹600 (no bids yet)
    currentLeaderUid: null,
    currentLeaderName: null,
    bidCount: 0,
    status: 'LIVE',
    createdAt: new Date(now - 3600000 * 6).toISOString(),
    endsAt: new Date(now + 24 * 3600000).toISOString(), // 24 hours
    location: 'Hostel 4 Room 218',
    outcome: null,
    outcomeNote: null
  },
  {
    id: 'auction-elec-04',
    sellerUid: 'user_rohan_tech',
    sellerName: 'Rohan Verma',
    sellerEmail: 'rohan.verma@campus.edu',
    title: 'Keychron K2 Wireless Mechanical Keyboard (Brown Switches)',
    category: 'Electronics',
    condition: 'Like New',
    description: 'White LED backlight, 75% compact layout, Mac/Windows swappable keycaps. Great for coding and late-night assignment typing. Type-C cable and keycap puller included.',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80'
    ],
    startingPricePaise: 250000, // ₹2,500
    minIncrementPaise: 10000,   // ₹100
    currentPricePaise: 280000,  // ₹2,800
    currentLeaderUid: 'user_alex_senior',
    currentLeaderName: 'Alex Sharma',
    bidCount: 3,
    status: 'LIVE',
    createdAt: new Date(now - 3600000 * 48).toISOString(),
    endsAt: new Date(now + 3600000 * 5).toISOString(),
    location: 'Hostel 2 Common Room',
    outcome: null,
    outcomeNote: null
  },
  {
    id: 'auction-furn-05',
    sellerUid: 'user_alex_senior',
    sellerName: 'Alex Sharma',
    sellerEmail: 'alex.sharma@campus.edu',
    title: 'Ergonomic Mesh Study Chair with Headrest',
    category: 'Furniture',
    condition: 'Good',
    description: 'High-back breathable mesh chair with adjustable lumbar support and height lever. Clean and fully functional, perfect for hostel study table.',
    images: [
      'https://images.unsplash.com/photo-1580481077195-c3a82104536b?auto=format&fit=crop&w=800&q=80'
    ],
    startingPricePaise: 120000, // ₹1,200
    minIncrementPaise: 10000,   // ₹100
    currentPricePaise: 150000,  // ₹1,500
    currentLeaderUid: 'user_priya_junior',
    currentLeaderName: 'Priya Patel',
    bidCount: 3,
    status: 'ENDED_PENDING_SELLER',
    createdAt: new Date(now - 3600000 * 72).toISOString(),
    endsAt: new Date(now - 3600000 * 2).toISOString(), // ended 2h ago
    location: 'Hostel 4 Ground Floor Gate',
    outcome: null,
    outcomeNote: null
  }
];

// Initial mock bids
export const mockBids = [
  {
    id: 'bid-cycle-1',
    auctionId: 'auction-cycle-01',
    bidderUid: 'user_rohan_tech',
    bidderName: 'Rohan Verma',
    amountPaise: 350000,
    timestamp: new Date(now - 3600000 * 18).toISOString(),
    type: 'MANUAL'
  },
  {
    id: 'bid-cycle-2',
    auctionId: 'auction-cycle-01',
    bidderUid: 'user_priya_junior',
    bidderName: 'Priya Patel',
    amountPaise: 365000,
    timestamp: new Date(now - 3600000 * 10).toISOString(),
    type: 'MANUAL'
  },
  {
    id: 'bid-cycle-3',
    auctionId: 'auction-cycle-01',
    bidderUid: 'user_priya_junior',
    bidderName: 'Priya Patel',
    amountPaise: 380000,
    timestamp: new Date(now - 3600000 * 2).toISOString(),
    type: 'MANUAL'
  },
  {
    id: 'bid-calc-1',
    auctionId: 'auction-calc-02',
    bidderUid: 'user_priya_junior',
    bidderName: 'Priya Patel',
    amountPaise: 85000,
    timestamp: new Date(now - 3600000 * 8).toISOString(),
    type: 'MANUAL'
  },
  {
    id: 'bid-calc-2',
    auctionId: 'auction-calc-02',
    bidderUid: 'user_rohan_tech',
    bidderName: 'Rohan Verma',
    amountPaise: 95000,
    timestamp: new Date(now - 3600000 * 3).toISOString(),
    type: 'MANUAL'
  }
];

// Auto-bids collection
export const mockAutoBids = [
  {
    id: 'autobid-1',
    auctionId: 'auction-cycle-01',
    bidderUid: 'user_priya_junior',
    bidderName: 'Priya Patel',
    maxAmountPaise: 450000, // ₹4,500
    createdAt: new Date(now - 3600000 * 10).toISOString(),
    active: true
  }
];

// Notifications collection
export const mockNotifications = [
  {
    id: 'notif-1',
    userId: 'user_priya_junior',
    title: 'Leading Bid!',
    message: 'Your bid of ₹3,800 is currently the highest bid on "Hero Sprint Pro 21-Speed Mountain Bicycle".',
    type: 'LEADING_BID',
    auctionId: 'auction-cycle-01',
    read: false,
    createdAt: new Date(now - 3600000 * 2).toISOString()
  },
  {
    id: 'notif-2',
    userId: 'user_alex_senior',
    title: 'Auction Ended: Action Required',
    message: 'Your auction "Ergonomic Mesh Study Chair with Headrest" ended with a winning bid of ₹1,500. Please review and approve.',
    type: 'AUCTION_ENDED',
    auctionId: 'auction-furn-05',
    read: false,
    createdAt: new Date(now - 3600000 * 2).toISOString()
  }
];

// Saved searches collection
export const mockSavedSearches = [
  {
    id: 'saved-1',
    userId: 'user_priya_junior',
    keyword: 'bicycle',
    category: 'Cycles',
    maxPricePaise: 500000,
    createdAt: new Date(now - 3600000 * 48).toISOString()
  }
];

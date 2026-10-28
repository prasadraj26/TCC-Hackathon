/**
 * assistantService.js
 *
 * AI Assistant service for CampusBid.
 * Translates student natural-language inquiries into validated auction filters,
 * discovers genuine active listings, and provides contextual conversational assistance.
 */

import { getAuctions } from './auctionService.js';

// Category keywords dictionary for resilient natural-language recognition
const CATEGORY_MAP = {
  Cycles: ['cycle', 'cycles', 'bicycle', 'bicycles', 'bike', 'bikes', 'btwin', 'hero', 'hercules', 'gear cycle'],
  Calculators: ['calculator', 'calculators', 'calc', 'scientific calculator', 'casio', 'fx-991', 'fx991', 'classwiz'],
  Electronics: [
    'laptop', 'laptops', 'macbook', 'dell', 'hp', 'lenovo', 'thinkpad', 'asus', 'phone', 'phones',
    'mobile', 'electronics', 'headphone', 'headphones', 'earphone', 'earphones', 'charger',
    'adapter', 'mouse', 'keyboard', 'monitor', 'screen', 'tablet', 'ipad', 'speaker', 'powerbank'
  ],
  Books: [
    'book', 'books', 'textbook', 'textbooks', 'novel', 'novels', 'notes', 'guide',
    'maths', 'mathematics', 'physics', 'chemistry', 'engineering mathematics', 'kreyszig', 'semester'
  ],
  Furniture: ['furniture', 'chair', 'chairs', 'table', 'tables', 'desk', 'desks', 'mattress', 'cot', 'bed', 'shelf', 'rack'],
  Other: ['drafter', 't-square', 'lab coat', 'apron', 'component', 'arduino', 'raspberry']
};

/**
 * Extracts structured intent and search parameters from a natural-language query.
 * Works deterministically without external dependencies, with optional Gemini AI enhancement.
 *
 * @param {string} query
 * @returns {object} Extracted parameters
 */
export function extractQueryFilters(query = '') {
  const clean = query.trim().toLowerCase();

  // 1. Extract budget (e.g., "under 2000", "below ₹1,500", "less than 500", "budget 3000", "max 2500")
  let maxBudgetRupees = null;
  const budgetPatterns = [
    /(?:under|below|less than|within|max|budget of|upto|up to)\s*(?:₹|rs\.?|inr)?\s*(-?\s*[0-9,]+)/i,
    /(?:₹|rs\.?|inr)\s*(-?\s*[0-9,]+)\s*(?:or less|max|budget)?/i,
    /(-?\s*[0-9,]+)\s*(?:rupees|rs|inr)\s*(?:max|budget|or less)?/i
  ];

  for (const regex of budgetPatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const cleanNum = match[1].replace(/[\s,]/g, '');
      const parsed = parseInt(cleanNum, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1_000_000) {
        maxBudgetRupees = parsed;
        break;
      }
    }
  }

  // 2. Extract closing-time constraint (e.g., "less than 30 minutes", "within 1 hour", "under 45 mins", "closing soon")
  let closingWithinMinutes = null;
  const timeMatch = clean.match(/(?:less than|under|within|in)\s*([0-9]+)\s*(?:min|mins|minute|minutes)/i);
  if (timeMatch && timeMatch[1]) {
    closingWithinMinutes = parseInt(timeMatch[1], 10);
  } else if (clean.includes('1 hour') || clean.includes('an hour')) {
    closingWithinMinutes = 60;
  } else if (clean.includes('2 hours')) {
    closingWithinMinutes = 120;
  } else if (clean.includes('closing soon') || clean.includes('ending soon') || clean.includes('ending today')) {
    closingWithinMinutes = 180; // default 3 hours for generic "closing soon"
  }

  // 3. Extract sorting preference
  let sortBy = 'relevance';
  if (/cheapest|lowest price|least expensive|affordable|lowest/i.test(clean)) {
    sortBy = 'cheapest';
  } else if (/most active|trending|popular|most bids|highest activity|most popular/i.test(clean)) {
    sortBy = 'most_active';
  } else if (/closing soon|ending soon|less than|ending earliest/i.test(clean)) {
    sortBy = 'closing_soon';
  }

  // 4. Extract Category and core search keyword
  let matchedCategory = null;
  let matchedKeyword = '';

  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(clean)) {
        matchedCategory = category;
        matchedKeyword = kw;
        break;
      }
    }
    if (matchedCategory) break;
  }

  // Fallback: If no predefined category matched, find prominent words (excluding stopwords/budget words)
  if (!matchedCategory) {
    const stopwords = new Set([
      'find', 'me', 'a', 'an', 'the', 'show', 'list', 'cheapest', 'active', 'under', 'below',
      'less', 'than', 'auctions', 'auction', 'items', 'item', 'campus', 'bid', 'for', 'with',
      'remaining', 'minutes', 'hours', 'time', 'price', 'inr', 'rs', 'rupees'
    ]);
    const words = clean.split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w) && !/^\d+$/.test(w));
    if (words.length > 0) {
      matchedKeyword = words[0];
    }
  }

  return {
    category: matchedCategory,
    keyword: matchedKeyword,
    maxBudgetRupees,
    maxBudgetPaise: maxBudgetRupees ? maxBudgetRupees * 100 : null,
    closingWithinMinutes,
    sortBy,
    status: clean.includes('sold') ? 'SOLD' : 'LIVE'
  };
}

/**
 * Searches real auctions based on the natural-language request.
 *
 * @param {string} query - Student natural-language query
 * @returns {Promise<object>} Structured results and conversational summary
 */
export async function processAssistantSearch(query = '') {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      query: '',
      summary: 'Please enter a search query (e.g., "Find me a cycle under ₹2,000" or "Cheapest calculator").',
      filters: {},
      results: [],
      count: 0
    };
  }

  const parsed = extractQueryFilters(query);
  const now = Date.now();

  // Fetch real active auctions
  const allAuctions = await getAuctions({
    status: parsed.status || 'LIVE'
  });

  // Filter listings based on extracted criteria
  let filtered = allAuctions.filter(auction => {
    // 1. Status check
    if (parsed.status && auction.status !== parsed.status) {
      return false;
    }

    // 2. Budget constraint (against currentPricePaise)
    if (parsed.maxBudgetPaise && auction.currentPricePaise > parsed.maxBudgetPaise) {
      return false;
    }

    // 3. Category match
    if (parsed.category && auction.category !== parsed.category) {
      // If category didn't match directly, allow keyword match in title
      const titleLower = (auction.title || '').toLowerCase();
      if (!parsed.keyword || !titleLower.includes(parsed.keyword)) {
        return false;
      }
    }

    // 4. Keyword match (if extracted and not category-specific)
    if (!parsed.category && parsed.keyword) {
      const combined = `${auction.title || ''} ${auction.description || ''}`.toLowerCase();
      if (!combined.includes(parsed.keyword)) {
        return false;
      }
    }

    // 5. Closing time constraint
    if (parsed.closingWithinMinutes && auction.endsAt) {
      const remainingMs = new Date(auction.endsAt).getTime() - now;
      if (remainingMs <= 0 || remainingMs > parsed.closingWithinMinutes * 60 * 1000) {
        return false;
      }
    }

    return true;
  });

  // Apply sorting
  if (parsed.sortBy === 'cheapest') {
    filtered.sort((a, b) => (a.currentPricePaise || 0) - (b.currentPricePaise || 0));
  } else if (parsed.sortBy === 'most_active') {
    filtered.sort((a, b) => (b.bidCount || 0) - (a.bidCount || 0));
  } else if (parsed.sortBy === 'closing_soon') {
    filtered.sort((a, b) => new Date(a.endsAt) - new Date(b.endsAt));
  }

  // Secondary fallback: If strict filter yielded 0 results, check if relaxed search finds relevant items
  let relaxedResults = [];
  let isRelaxed = false;

  if (filtered.length === 0 && (parsed.maxBudgetPaise || parsed.closingWithinMinutes)) {
    relaxedResults = allAuctions.filter(auction => {
      if (auction.status !== (parsed.status || 'LIVE')) return false;
      if (parsed.category && auction.category === parsed.category) return true;
      if (parsed.keyword && (auction.title || '').toLowerCase().includes(parsed.keyword)) return true;
      return false;
    });

    if (parsed.sortBy === 'cheapest') {
      relaxedResults.sort((a, b) => (a.currentPricePaise || 0) - (b.currentPricePaise || 0));
    }
    if (relaxedResults.length > 0) {
      isRelaxed = true;
    }
  }

  const finalItems = (filtered.length > 0 ? filtered : relaxedResults).slice(0, 8);

  // Sanitize every result to protect user privacy (no email, no UIDs, no auto-bid secret max limits)
  const sanitizedResults = finalItems.map(a => {
    const endsAtTime = new Date(a.endsAt).getTime();
    const remainingMs = Math.max(0, endsAtTime - now);
    const minutesLeft = Math.floor(remainingMs / 60000);
    const hoursLeft = Math.floor(minutesLeft / 60);

    let timeRemainingLabel = 'Ending soon';
    if (remainingMs <= 0) {
      timeRemainingLabel = 'Closed';
    } else if (hoursLeft > 24) {
      timeRemainingLabel = `${Math.floor(hoursLeft / 24)}d left`;
    } else if (hoursLeft > 0) {
      timeRemainingLabel = `${hoursLeft}h ${minutesLeft % 60}m left`;
    } else {
      timeRemainingLabel = `${minutesLeft}m left`;
    }

    return {
      id: a.id,
      title: a.title,
      category: a.category,
      condition: a.condition,
      currentPricePaise: a.currentPricePaise,
      currentPriceRupees: Math.round(a.currentPricePaise / 100),
      startingPriceRupees: Math.round(a.startingPricePaise / 100),
      minIncrementRupees: Math.round(a.minIncrementPaise / 100),
      bidCount: a.bidCount || 0,
      status: a.status,
      endsAt: a.endsAt,
      timeRemainingLabel,
      location: a.location || 'Campus Central',
      images: Array.isArray(a.images) ? a.images : [],
      sellerName: a.sellerName || 'Campus Student',
      // Explicit comparison helper for the student
      withinBudget: parsed.maxBudgetRupees
        ? Math.round(a.currentPricePaise / 100) <= parsed.maxBudgetRupees
        : true,
      budgetDifferenceRupees: parsed.maxBudgetRupees
        ? parsed.maxBudgetRupees - Math.round(a.currentPricePaise / 100)
        : null
    };
  });

  // Build conversational summary
  let summary = '';
  if (filtered.length > 0) {
    const budgetPhrase = parsed.maxBudgetRupees ? ` under ₹${parsed.maxBudgetRupees.toLocaleString('en-IN')}` : '';
    const timePhrase = parsed.closingWithinMinutes ? ` closing within ${parsed.closingWithinMinutes} minutes` : '';
    const catPhrase = parsed.category || parsed.keyword || 'campus item';
    summary = `Found ${filtered.length} active ${catPhrase}${filtered.length > 1 ? 's' : ''}${budgetPhrase}${timePhrase}.`;
  } else if (isRelaxed && relaxedResults.length > 0) {
    if (parsed.maxBudgetRupees) {
      summary = `No active listings found under ₹${parsed.maxBudgetRupees.toLocaleString('en-IN')}. Here are active ${parsed.category || parsed.keyword || 'items'} available slightly above your budget:`;
    } else if (parsed.closingWithinMinutes) {
      summary = `No listings are closing within ${parsed.closingWithinMinutes} minutes. Here are other active ${parsed.category || parsed.keyword || 'items'} currently available:`;
    }
  } else {
    const catPhrase = parsed.category || parsed.keyword || 'items';
    summary = `No active ${catPhrase} currently match your request. You can try adjusting your budget or browsing the Explore page.`;
  }

  return {
    query,
    summary,
    filters: {
      category: parsed.category,
      keyword: parsed.keyword,
      maxBudgetRupees: parsed.maxBudgetRupees,
      closingWithinMinutes: parsed.closingWithinMinutes,
      sortBy: parsed.sortBy,
      status: parsed.status
    },
    results: sanitizedResults,
    count: filtered.length,
    isRelaxed
  };
}

/**
 * pricingService.js
 *
 * Smart Price Advisor — estimates fair second-hand campus item prices.
 *
 * Strategy:
 *   1. Fetch comparable CampusBid listings from Firestore (same category,
 *      similar keywords, any status).
 *   2. Weight: SOLD > ENDED_PENDING_SELLER > LIVE listings.
 *   3. Apply condition multiplier to normalize to the queried condition.
 *   4. Optionally use Gemini (GEMINI_API_KEY env var) to generate an
 *      explanation and refine the estimate.
 *   5. Fall back to category-based conservative estimates if data is scarce.
 *
 * Never exposes secrets to the client. All Firestore and AI calls are
 * server-side only.
 */

import { db, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { mockAuctions } from '../utils/mockStore.js';

// ─── Condition multipliers ────────────────────────────────────────────────────
// Used to normalise prices across conditions.
const CONDITION_MULTIPLIER = {
  'New':       1.00,
  'Like New':  0.88,
  'Good':      0.72,
  'Fair':      0.55,
  'Poor':      0.38,
};

// ─── Category fallback base prices (paise) when no comparable exists ─────────
const CATEGORY_FALLBACK = {
  Cycles:      { base: 300000, lo: 0.5, hi: 2.0 },  // ₹3000
  Calculators: { base: 40000,  lo: 0.5, hi: 1.8 },  // ₹400
  Books:       { base: 8000,   lo: 0.3, hi: 1.5 },  // ₹80
  Electronics: { base: 500000, lo: 0.4, hi: 2.0 },  // ₹5000
  Furniture:   { base: 150000, lo: 0.4, hi: 1.8 },  // ₹1500
  Other:       { base: 50000,  lo: 0.3, hi: 2.0 },  // ₹500
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function conditionFactor(condition) {
  return CONDITION_MULTIPLIER[condition] ?? CONDITION_MULTIPLIER['Good'];
}

/** Simple keyword tokenizer for title similarity */
function tokenize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/** Jaccard similarity between two token arrays */
function similarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/** Status weight for pricing evidence quality */
// ─── Status weight for pricing evidence quality ───────────────────────────────
function listingWeight(status, bidCount = 0) {
  if (status === 'SOLD')                  return 1.00;
  if (status === 'RESERVED')              return 0.90;
  if (status === 'ENDED_PENDING_SELLER')  return 0.85;
  if (status === 'LIVE' && bidCount > 0)  return 0.50; // Active listing with real bidding activity
  if (status === 'LIVE')                  return 0.30; // Unbid asking price is weaker supporting evidence
  return 0.20;
}

// ─── Main pricing function ────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.category
 * @param {string} params.condition
 * @param {string} [params.brand]
 * @param {string} [params.model]
 * @param {number} [params.ageMonths]        — item age in months
 * @param {number} [params.originalPriceRupees] — original purchase price
 * @param {string} [params.details]          — free-text additional details
 * @returns {Promise<PriceEstimate>}
 */
export async function estimatePrice({
  title = '',
  category = 'Other',
  condition = 'Good',
  brand = '',
  model = '',
  ageMonths,
  originalPriceRupees,
  details = '',
}) {
  // ── 1. Fetch comparable listings ─────────────────────────────────────────
  let allListings = [];

  if (isFirebaseConfigured && db) {
    try {
      // Fetch same-category listings without orderBy to avoid requiring a Firestore composite index
      const snap = await db.collection('auctions')
        .where('category', '==', category)
        .limit(200)
        .get();

      allListings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allListings.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      // Firestore query error — fall through to mock store
      console.error('[PricingService] Firestore query error:', err.message);
    }
  }

  // Fallback: search mock store
  if (!allListings.length) {
    const rawMock = Array.isArray(mockAuctions) ? mockAuctions : Object.values(mockAuctions || {});
    allListings = rawMock.filter(a => a && a.category === category);
  }

  // ── 2. Deduplicate and filter invalid records ────────────────────────────
  const seenIds = new Set();
  const validListings = allListings.filter(item => {
    if (!item || !item.id || seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    if (item.status === 'CANCELLED' || item.status === 'WITHDRAWN') return false;
    const price = item.currentPricePaise || item.startingPricePaise;
    return typeof price === 'number' && price > 0 && !isNaN(price);
  });

  // ── 3. Score and rank comparables ────────────────────────────────────────
  const queryTokens = [
    ...tokenize(title),
    ...tokenize(brand),
    ...tokenize(model),
  ];

  const scored = validListings
    .map(listing => {
      const listingTokens = tokenize(listing.title);
      const sim = queryTokens.length
        ? similarity(queryTokens, listingTokens)
        : 0.3; // no title yet — accept any same-category listing

      const pricePaise = listing.currentPricePaise || listing.startingPricePaise || 0;
      if (!pricePaise || pricePaise <= 0) return null;

      const weight = listingWeight(listing.status, listing.bidCount || 0) * (0.3 + 0.7 * sim);

      return {
        id: listing.id,
        title: listing.title || 'Campus Item',
        condition: listing.condition || 'Good',
        status: listing.status || 'LIVE',
        pricePaise,
        sim,
        weight,
      };
    })
    .filter(Boolean)
    .filter(x => x.weight > 0.1)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10); // top 10 comparable listings

  // ── 3. Normalise prices to the queried condition ──────────────────────────
  const targetFactor = conditionFactor(condition);

  const normalisedPrices = scored.map(s => {
    const listingFactor = conditionFactor(s.condition);
    // Normalise: what would this listing cost at targetCondition?
    return (s.pricePaise / listingFactor) * targetFactor * s.weight;
  });

  // ── 4. Compute weighted average and spread ────────────────────────────────
  let estimatedPricePaise = null;
  let confidence = 'low';
  let loPaise, hiPaise;

  const totalWeight = scored.reduce((s, x) => s + x.weight, 0);

  if (normalisedPrices.length >= 3 && totalWeight > 0) {
    const weightedSum = normalisedPrices.reduce((s, v) => s + v, 0);
    estimatedPricePaise = Math.round(weightedSum / totalWeight);

    // Compute spread from weighted std-dev
    const mean = estimatedPricePaise;
    const variance = scored.reduce((acc, s, i) => {
      const diff = (normalisedPrices[i] / s.weight) - mean;
      return acc + s.weight * diff * diff;
    }, 0) / totalWeight;
    const stdDev = Math.sqrt(Math.max(variance, 0));

    loPaise = Math.round(Math.max(100, mean - stdDev));
    hiPaise = Math.round(mean + stdDev);

    // Clamp spread to [–40%, +50%]
    loPaise = Math.max(loPaise, Math.round(mean * 0.6));
    hiPaise = Math.min(hiPaise, Math.round(mean * 1.5));

    confidence = scored.length >= 6 ? 'high'
               : scored.length >= 3 ? 'medium'
               :                      'low';
  } else if (normalisedPrices.length >= 1 && totalWeight > 0) {
    // Single or two comparables — use them with wide spread
    const weightedSum = normalisedPrices.reduce((s, v) => s + v, 0);
    estimatedPricePaise = Math.round(weightedSum / totalWeight);
    loPaise = Math.round(estimatedPricePaise * 0.65);
    hiPaise = Math.round(estimatedPricePaise * 1.45);
    confidence = 'low';
  } else {
    // ── Fallback: category base price adjusted by condition and age ──────────
    const fb = CATEGORY_FALLBACK[category] || CATEGORY_FALLBACK['Other'];
    let base = fb.base;

    // Age depreciation: ~5% per 6 months, max 70% depreciation
    if (ageMonths && ageMonths > 0) {
      const periods = Math.floor(ageMonths / 6);
      const depreciation = Math.min(0.70, periods * 0.05);
      base = Math.round(base * (1 - depreciation));
    }

    // Original price anchor (if provided and reasonable)
    if (originalPriceRupees && originalPriceRupees > 0) {
      const originalPaise = Math.round(originalPriceRupees * 100);
      // Blend: 60% original-price-based, 40% category base
      const originalBased = Math.round(originalPaise * targetFactor);
      base = Math.round(0.6 * originalBased + 0.4 * base * targetFactor);
    } else {
      base = Math.round(base * targetFactor);
    }

    estimatedPricePaise = base;
    loPaise = Math.round(base * fb.lo);
    hiPaise = Math.round(base * fb.hi);
    confidence = 'low';
  }

  // Suggested starting price: 85% of estimated (encourages bidding)
  const suggestedStartPaise = Math.round(estimatedPricePaise * 0.85);

  // ── 5. Optionally call Gemini for an explanation ──────────────────────────
  let explanation = buildBaselineExplanation({
    title, category, condition, brand, model, ageMonths,
    originalPriceRupees, comparable: scored, confidence,
    estimatedPricePaise,
  });

  if (process.env.GEMINI_API_KEY) {
    try {
      explanation = await callGeminiForExplanation({
        title, category, condition, brand, model, ageMonths,
        originalPriceRupees, details,
        estimatedPricePaise,
        loPaise,
        hiPaise,
        comparableCount: scored.length,
      });
    } catch (aiErr) {
      // Gemini failed — keep baseline explanation
      console.warn('[PricingService] Gemini explanation failed, using baseline:', aiErr.message);
    }
  }

  // ── 6. Build comparable listing summaries for display ─────────────────────
  const comparables = scored.slice(0, 4).map(s => ({
    id: s.id,
    title: s.title,
    condition: s.condition,
    status: s.status,
    priceRupees: Math.round(s.pricePaise / 100),
    isConfirmedSale: s.status === 'SOLD',
  }));

  return {
    suggestedStartPaise,
    estimatedPricePaise,
    loPaise,
    hiPaise,
    confidence,
    explanation,
    comparables,
    comparableCount: scored.length,
    aiUsed: Boolean(process.env.GEMINI_API_KEY),
  };
}

// ─── Baseline text explanation ────────────────────────────────────────────────

function buildBaselineExplanation({ title, category, condition, brand, model,
  ageMonths, originalPriceRupees, comparable, confidence, estimatedPricePaise }) {

  const parts = [];

  if (comparable.length >= 3) {
    parts.push(`Based on ${comparable.length} comparable campus listings in the ${category} category.`);
  } else if (comparable.length > 0) {
    parts.push(`Based on limited information: only ${comparable.length} comparable campus listing${comparable.length > 1 ? 's' : ''} found in ${category}; estimate has wider uncertainty.`);
  } else {
    parts.push(`No comparable campus listings found in the ${category} category. This estimate is based on limited information and conservative category benchmarks.`);
  }

  if (condition) {
    const multiplierPct = Math.round(conditionFactor(condition) * 100);
    parts.push(`"${condition}" condition typically retains ~${multiplierPct}% of like-new value.`);
  }

  if (ageMonths && ageMonths > 0) {
    const years = (ageMonths / 12).toFixed(1);
    parts.push(`Item age of ~${years}y has been factored into depreciation.`);
  }

  if (originalPriceRupees && originalPriceRupees > 0) {
    parts.push(`Original purchase price of ₹${originalPriceRupees.toLocaleString('en-IN')} was used as an anchor.`);
  }

  const soldComparables = comparable.filter(c => c.status === 'SOLD').length;
  if (soldComparables > 0) {
    parts.push(`${soldComparables} completed sale${soldComparables > 1 ? 's' : ''} found — these carry stronger weight.`);
  }

  parts.push(`This estimate is advisory. Set a price you're comfortable with.`);

  return parts.join(' ');
}

// ─── Gemini AI explanation ────────────────────────────────────────────────────

async function callGeminiForExplanation({
  title, category, condition, brand, model,
  ageMonths, originalPriceRupees, details,
  estimatedPricePaise, loPaise, hiPaise, comparableCount,
}) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const productDesc = [
    title && `Title: ${title}`,
    category && `Category: ${category}`,
    condition && `Condition: ${condition}`,
    brand && `Brand: ${brand}`,
    model && `Model: ${model}`,
    ageMonths != null && `Age: ~${ageMonths} months`,
    originalPriceRupees && `Original price: ₹${originalPriceRupees}`,
    details && `Details: ${details}`,
  ].filter(Boolean).join('\n');

  const prompt = `You are a fair-price advisor for a campus second-hand marketplace in India.

A student wants to sell this item:
${productDesc}

Our pricing engine estimates:
- Mid-point: ₹${Math.round(estimatedPricePaise / 100)}
- Range: ₹${Math.round(loPaise / 100)} – ₹${Math.round(hiPaise / 100)}
- Based on: ${comparableCount} comparable campus listings

Write a 2–3 sentence explanation (plain text, no markdown, no bullet points) of why this price is reasonable for a campus second-hand marketplace. Mention the condition, category trend, and any notable factors. Do not invent prices or data not given above.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 120,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim() || null;
  } finally {
    clearTimeout(timeout);
  }
}

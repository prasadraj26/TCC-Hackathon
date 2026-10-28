/**
 * pricingController.js
 *
 * POST /api/pricing/estimate
 * Returns a fair-price estimate for a campus second-hand item.
 */

import { estimatePrice } from '../services/pricingService.js';

// Simple in-process rate limit: max 30 requests per IP per minute
const rateLimitMap = new Map(); // ip => { count, resetAt }
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const VALID_CATEGORIES = ['Cycles', 'Books', 'Calculators', 'Electronics', 'Furniture', 'Other'];
const VALID_CONDITIONS  = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

export async function estimatePriceHandler(req, res, next) {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: 'Too many pricing requests. Please wait a moment and try again.'
      });
    }

    const {
      title,
      category,
      condition,
      brand,
      model,
      ageMonths,
      originalPriceRupees,
      details,
    } = req.body;

    // ── Validate required fields ─────────────────────────────────────────────
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`
      });
    }

    if (!condition || !VALID_CONDITIONS.includes(condition)) {
      return res.status(400).json({
        success: false,
        error: `Invalid condition. Must be one of: ${VALID_CONDITIONS.join(', ')}.`
      });
    }

    // ── Sanitise / normalise optional numeric fields ────────────────────────
    const ageMonthsNum = ageMonths != null && ageMonths !== ''
      ? Math.max(0, Math.min(600, Number(ageMonths)))
      : undefined;

    const origPriceNum = originalPriceRupees != null && originalPriceRupees !== ''
      ? Math.max(0, Math.min(10_000_000, Number(originalPriceRupees)))
      : undefined;

    if (ageMonthsNum !== undefined && isNaN(ageMonthsNum)) {
      return res.status(400).json({ success: false, error: 'ageMonths must be a number.' });
    }

    if (origPriceNum !== undefined && isNaN(origPriceNum)) {
      return res.status(400).json({ success: false, error: 'originalPriceRupees must be a number.' });
    }

    // ── Run pricing engine ──────────────────────────────────────────────────
    const estimate = await estimatePrice({
      title:                (title       || '').slice(0, 200),
      category,
      condition,
      brand:                (brand       || '').slice(0, 100),
      model:                (model       || '').slice(0, 100),
      ageMonths:            ageMonthsNum,
      originalPriceRupees:  origPriceNum,
      details:              (details     || '').slice(0, 500),
    });

    res.json({
      success: true,
      estimate: {
        suggestedStartRupees:  Math.round(estimate.suggestedStartPaise  / 100),
        estimatedMidRupees:    Math.round(estimate.estimatedPricePaise  / 100),
        loRupees:              Math.round(estimate.loPaise              / 100),
        hiRupees:              Math.round(estimate.hiPaise              / 100),
        confidence:            estimate.confidence,
        explanation:           estimate.explanation,
        comparables:           estimate.comparables,
        comparableCount:       estimate.comparableCount,
        aiUsed:                estimate.aiUsed,
      }
    });
  } catch (err) {
    console.error('[PricingController] Error:', err.message);
    next(err);
  }
}

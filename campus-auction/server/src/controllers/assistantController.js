/**
 * assistantController.js
 *
 * Controller for AI Assistant natural-language search endpoint.
 * POST /api/assistant/search
 */

import { processAssistantSearch } from '../services/assistantService.js';

// In-process rate limiting: max 40 queries per IP per minute
const rateLimitMap = new Map();
const RATE_LIMIT = 40;
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

export async function handleAssistantSearch(req, res, next) {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        success: false,
        error: 'Too many assistant requests. Please wait a moment and try again.'
      });
    }

    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required.'
      });
    }

    if (query.trim().length > 300) {
      return res.status(400).json({
        success: false,
        error: 'Query is too long. Please keep questions under 300 characters.'
      });
    }

    const result = await processAssistantSearch(query.trim());

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[AssistantController] Error:', error.message);
    next(error);
  }
}

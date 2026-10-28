import { API_BASE } from './apiConfig';

/**
 * Sends a natural language inquiry to the CampusBid AI Assistant.
 *
 * @param {string} query - Student query, e.g. "Find me a cycle under ₹2,000"
 * @returns {Promise<object>} Structured results and conversational response
 */
export async function queryAssistant(query) {
  const res = await fetch(`${API_BASE}/assistant/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to get assistant response');
  }

  return data;
}

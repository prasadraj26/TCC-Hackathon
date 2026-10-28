import { API_BASE } from './apiConfig';

export async function placeBid(auctionId, amountPaise, headers) {
  const res = await fetch(`${API_BASE}/auctions/${auctionId}/bids`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amountPaise })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to place bid');
  return data;
}

export async function fetchAuctionBids(auctionId) {
  const res = await fetch(`${API_BASE}/auctions/${auctionId}/bids`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch bids');
  return data.bids;
}

export async function setAutoBid(auctionId, maxAmountPaise, headers) {
  const res = await fetch(`${API_BASE}/auctions/${auctionId}/auto-bid`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ maxAmountPaise })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to register auto-bid');
  return data.autoBid;
}

export async function fetchAuctionAutoBids(auctionId) {
  const res = await fetch(`${API_BASE}/auctions/${auctionId}/auto-bids`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch auto-bids');
  return data.autoBids;
}

export async function cancelAutoBid(auctionId, headers) {
  const res = await fetch(`${API_BASE}/auctions/${auctionId}/auto-bid`, {
    method: 'DELETE',
    headers
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to cancel auto-bid');
  return data;
}

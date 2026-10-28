const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export async function fetchAuctions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.category && filters.category !== 'All') params.append('category', filters.category);
  if (filters.condition && filters.condition !== 'All') params.append('condition', filters.condition);
  if (filters.status) params.append('status', filters.status);
  if (filters.tab) params.append('tab', filters.tab);
  if (filters.sellerUid) params.append('sellerUid', filters.sellerUid);
  if (filters.bidderUid) params.append('bidderUid', filters.bidderUid);
  if (filters.minPricePaise) params.append('minPricePaise', filters.minPricePaise);
  if (filters.maxPricePaise) params.append('maxPricePaise', filters.maxPricePaise);

  const res = await fetch(`${API_BASE}/auctions?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch auctions');
  return data.auctions;
}

export async function fetchAuctionById(id) {
  const res = await fetch(`${API_BASE}/auctions/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch auction');
  return data.auction;
}

export async function createAuction(auctionData, headers) {
  const res = await fetch(`${API_BASE}/auctions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(auctionData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create auction');
  return data.auction;
}

export async function updateAuction(id, updates, headers) {
  const res = await fetch(`${API_BASE}/auctions/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update auction');
  return data.auction;
}

export async function cancelAuction(id, reason, headers) {
  const res = await fetch(`${API_BASE}/auctions/${id}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to cancel auction');
  return data.auction;
}

export async function approveWinningBid(id, headers) {
  const res = await fetch(`${API_BASE}/auctions/${id}/approve`, {
    method: 'POST',
    headers
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to approve winning bid');
  return data.auction;
}

export async function rejectWinningBid(id, reason, headers) {
  const res = await fetch(`${API_BASE}/auctions/${id}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reject winning bid');
  return data.auction;
}

export async function confirmHandover(id, headers) {
  const res = await fetch(`${API_BASE}/auctions/${id}/handover`, {
    method: 'POST',
    headers
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to confirm handover');
  return data.auction;
}

export async function markPickupFailed(id, reason, headers) {
  const res = await fetch(`${API_BASE}/auctions/${id}/pickup-failed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to report failed pickup');
  return data.auction;
}

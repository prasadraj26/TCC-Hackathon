import { API_BASE } from './apiConfig';

export async function fetchNotifications(headers) {
  const res = await fetch(`${API_BASE}/notifications`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch notifications');
  return data.notifications;
}

export async function markNotificationRead(id, headers) {
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: 'PATCH',
    headers
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to mark notification as read');
  return data.success;
}

export async function markAllNotificationsRead(headers) {
  const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
    method: 'POST',
    headers
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to mark all notifications as read');
  return data.success;
}

export async function fetchSavedSearches(headers) {
  const res = await fetch(`${API_BASE}/notifications/saved-searches`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch saved searches');
  return data.savedSearches;
}

export async function createSavedSearch(searchData, headers) {
  const res = await fetch(`${API_BASE}/notifications/saved-searches`, {
    method: 'POST',
    headers,
    body: JSON.stringify(searchData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create saved search');
  return data.savedSearch;
}

export async function deleteSavedSearch(id, headers) {
  const res = await fetch(`${API_BASE}/notifications/saved-searches/${id}`, {
    method: 'DELETE',
    headers
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete saved search');
  return data.success;
}

/**
 * Browser Web Notification API support.
 * Works while site is open or in background tabs.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return await Notification.requestPermission();
}

export function sendLocalNotification(title, options = {}) {
  if ('Notification' in window && Notification.permission === 'granted') {
    return new Notification(title, {
      icon: '/vite.svg',
      badge: '/vite.svg',
      ...options
    });
  }
}

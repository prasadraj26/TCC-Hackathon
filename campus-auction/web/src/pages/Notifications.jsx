import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  requestNotificationPermission,
  sendLocalNotification
} from '../services/notificationService';
import { formatDate } from '../utils/formatters';
import {
  Bell,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Gavel,
  CheckCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function Notifications() {
  const { currentUser, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [browserPermission, setBrowserPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const list = await fetchNotifications(headers);
      setNotifications(list || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err.message || 'Failed to load notifications. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!currentUser) return;
    loadNotifications();
  }, [currentUser, loadNotifications]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const headers = await getAuthHeaders();
      await markNotificationRead(id, headers);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      await markAllNotificationsRead(headers);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      setError('Could not mark all notifications as read. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCardClick = (notif) => {
    if (notif.auctionId) {
      if (!notif.read) {
        handleMarkAsRead(notif.id);
      }
      navigate(`/auctions/${notif.auctionId}`);
    }
  };

  const handleEnableBrowserNotifications = async () => {
    const res = await requestNotificationPermission();
    setBrowserPermission(res);
    if (res === 'granted') {
      sendLocalNotification('CampusBid Notifications Enabled!', {
        body: 'You will receive instant alerts for new bids, outbids, extensions, and sale approvals while using CampusBid.'
      });
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'NEW_BID':
        return <Gavel size={18} color="#10b981" />;
      case 'OUTBID':
      case 'OUTBID_AUTO':
        return <AlertTriangle size={18} color="#ef4444" />;
      case 'ANTI_SNIPING_EXTENSION':
        return <Clock size={18} color="#f59e0b" />;
      case 'AUCTION_ENDED_SELLER':
        return <Clock size={18} color="#f59e0b" />;
      case 'BID_APPROVED':
      case 'AUCTION_WON_BUYER':
      case 'SALE_COMPLETED':
        return <ShieldCheck size={18} color="#10b981" />;
      case 'AUCTION_UNSOLD':
      case 'BID_REJECTED':
      case 'PICKUP_FAILED':
        return <AlertTriangle size={18} color="#64748b" />;
      case 'SAVED_SEARCH_MATCH':
        return <Sparkles size={18} color="#3b82f6" />;
      default:
        return <Bell size={18} color="#64748b" />;
    }
  };

  if (!currentUser) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <h2>Sign In to View Notifications</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Real-time notifications are tied to your authenticated student account.
        </p>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>Log In</Link>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="container" style={{ maxWidth: '780px', paddingBottom: '4rem' }}>
      <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Notifications</h1>
            {unreadCount > 0 && (
              <span style={{
                background: '#fee2e2',
                color: '#dc2626',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px'
              }}>
                {unreadCount} unread
              </span>
            )}
          </div>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            Real-time campus auction alerts, outbid warnings, and handover notices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {unreadCount > 0 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleMarkAllAsRead}
              disabled={actionLoading}
              title="Mark all notifications as read"
            >
              <CheckCheck size={14} />
              {actionLoading ? 'Marking...' : 'Mark all as read'}
            </button>
          )}

          {/* Browser Permission Toggle */}
          {browserPermission !== 'granted' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleEnableBrowserNotifications}
            >
              <Bell size={14} /> Enable Browser Alerts
            </button>
          )}
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div className="alert-box alert-error" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} color="#ef4444" />
            <span>{error}</span>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={loadNotifications}
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Note about background notification scope */}
      <div className="alert-box alert-info" style={{ fontSize: '0.825rem', marginBottom: '1.5rem' }}>
        <div>
          <strong>Persistent Campus Alerts:</strong> Notifications are securely synced to your account in Cloud Firestore. Outbid alerts, new bids, and closing outcomes persist across device sessions.
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--color-text-light)' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
          <div>Loading your notifications...</div>
        </div>
      ) : notifications.length > 0 ? (
        <div>
          {notifications.map((notif) => {
            const isClickable = Boolean(notif.auctionId);
            return (
              <div
                key={notif.id}
                className={`notif-card ${!notif.read ? 'unread' : ''}`}
                onClick={() => handleCardClick(notif)}
                style={{
                  cursor: isClickable ? 'pointer' : 'default',
                  position: 'relative'
                }}
              >
                <div className="notif-icon-box">
                  {getNotificationIcon(notif.type)}
                </div>

                <div className="notif-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div className="notif-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>{notif.title}</span>
                      {!notif.read && (
                        <span
                          title="Unread"
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-accent)',
                            display: 'inline-block'
                          }}
                        />
                      )}
                    </div>
                    <span className="notif-time">{formatDate(notif.createdAt)}</span>
                  </div>
                  <div className="notif-msg">{notif.message}</div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'center' }}>
                    {notif.auctionId && (
                      <span
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.2rem 0.55rem', pointerEvents: 'none' }}
                      >
                        View Auction <ArrowRight size={12} />
                      </span>
                    )}
                    {!notif.read && (
                      <button
                        type="button"
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--color-accent)',
                          fontWeight: 600,
                          background: 'none',
                          border: 'none',
                          padding: '0.2rem 0.4rem',
                          cursor: 'pointer'
                        }}
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Bell size={28} /></div>
          <h3>No notifications yet</h3>
          <p>You'll be alerted whenever someone outbids you, places a bid on your auction, or an auction ends.</p>
        </div>
      )}
    </div>
  );
}

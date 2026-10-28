import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchNotifications,
  markNotificationRead,
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
  Sparkles
} from 'lucide-react';

export default function Notifications() {
  const { currentUser, getAuthHeaders } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [browserPermission, setBrowserPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const list = await fetchNotifications(headers);
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!currentUser) return;
    loadNotifications();
  }, [currentUser, loadNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      const headers = await getAuthHeaders();
      await markNotificationRead(id, headers);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnableBrowserNotifications = async () => {
    const res = await requestNotificationPermission();
    setBrowserPermission(res);
    if (res === 'granted') {
      sendLocalNotification('CampusBid Notifications Enabled!', {
        body: 'You will receive instant alerts for outbids, extensions, and sale approvals while using CampusBid.'
      });
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'OUTBID':
      case 'OUTBID_AUTO':
        return <AlertTriangle size={18} color="#ef4444" />;
      case 'ANTI_SNIPING_EXTENSION':
        return <Clock size={18} color="#f59e0b" />;
      case 'BID_APPROVED':
      case 'AUCTION_WON_BUYER':
      case 'SALE_COMPLETED':
        return <ShieldCheck size={18} color="#10b981" />;
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
        <Link to="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>Log In</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '780px', paddingBottom: '4rem' }}>
      <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>Notifications</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Real-time campus auction alerts, outbid warnings, and handover notices.
          </p>
        </div>

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

      {/* Note about background notification scope */}
      <div className="alert-box alert-info" style={{ fontSize: '0.825rem', marginBottom: '1.5rem' }}>
        <div>
          <strong>Browser Alerts Active:</strong> Web notification alerts display while CampusBid is open in your browser (including background tabs). Offline push when the browser is completely closed requires full Push Service Worker setup.
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-light)' }}>
          Loading notifications...
        </div>
      ) : notifications.length > 0 ? (
        <div>
          {notifications.map((notif) => (
            <div key={notif.id} className={`notif-card ${!notif.read ? 'unread' : ''}`}>
              <div className="notif-icon-box">
                {getNotificationIcon(notif.type)}
              </div>

              <div className="notif-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="notif-title">{notif.title}</div>
                  <span className="notif-time">{formatDate(notif.createdAt)}</span>
                </div>
                <div className="notif-msg">{notif.message}</div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {notif.auctionId && (
                    <Link
                      to={`/auctions/${notif.auctionId}`}
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.78rem', padding: '0.2rem 0.55rem' }}
                      onClick={() => handleMarkAsRead(notif.id)}
                    >
                      View Auction <ArrowRight size={12} />
                    </Link>
                  )}
                  {!notif.read && (
                    <button
                      type="button"
                      style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', cursor: 'pointer' }}
                      onClick={() => handleMarkAsRead(notif.id)}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Bell size={28} /></div>
          <h3>All caught up!</h3>
          <p>No new notifications. You'll be alerted whenever someone outbids you or responds to your listing.</p>
        </div>
      )}
    </div>
  );
}

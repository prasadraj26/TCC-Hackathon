import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchNotifications } from '../../services/notificationService';
import {
  Gavel,
  PlusCircle,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  Search,
  BookmarkCheck
} from 'lucide-react';

export default function Header() {
  const { currentUser, logout, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    let mounted = true;
    async function loadNotifs() {
      try {
        const headers = await getAuthHeaders();
        const list = await fetchNotifications(headers);
        if (mounted) {
          const unread = list.filter(n => !n.read).length;
          setUnreadCount(unread);
        }
      } catch (e) {
        // silent
      }
    }

    loadNotifs();
    window.addEventListener('notifications-updated', loadNotifs);
    const interval = setInterval(loadNotifs, 15000); // Polling unread count
    return () => {
      mounted = false;
      window.removeEventListener('notifications-updated', loadNotifs);
      clearInterval(interval);
    };
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    setUserDropdownOpen(false);
    navigate('/');
  };

  return (
    <header className="app-header">
      <div className="container header-inner">
        {/* Logo */}
        <Link to="/" className="brand-logo">
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            borderRadius: '10px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Gavel size={20} />
          </div>
          <span>CampusBid</span>
          <span className="brand-badge">Campus</span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            Explore
          </NavLink>
          <NavLink to="/my-auctions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            My Auctions
          </NavLink>
          <NavLink to="/my-auctions?tab=saved" className="nav-link">
            <BookmarkCheck size={16} />
            Saved Searches
          </NavLink>
        </nav>

        {/* Header Right Actions */}
        <div className="header-actions">
          {currentUser ? (
            <>
              <Link to="/create-listing" className="btn btn-accent btn-sm btn-create-nav">
                <PlusCircle size={16} />
                <span>Post Auction</span>
              </Link>

              {/* Notification Bell */}
              <Link to="/notifications" className="notif-bell-btn" title="Notifications">
                <Bell size={18} />
                {unreadCount > 0 && <span className="notif-badge-count">{unreadCount}</span>}
              </Link>

              {/* User Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  className="user-menu-pill"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                >
                  <div className="user-avatar-circle">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                  </div>
                  <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.displayName || currentUser.email.split('@')[0]}
                  </span>
                </button>

                {userDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '220px',
                    background: 'white',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-xl)',
                    padding: '0.5rem',
                    zIndex: 200
                  }}>
                    <div style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{currentUser.displayName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>{currentUser.email}</div>
                    </div>
                    <Link
                      to="/profile"
                      className="nav-link"
                      style={{ padding: '0.6rem 0.8rem', width: '100%', borderRadius: '6px' }}
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <User size={16} /> Profile & Stats
                    </Link>
                    <Link
                      to="/my-auctions"
                      className="nav-link"
                      style={{ padding: '0.6rem 0.8rem', width: '100%', borderRadius: '6px' }}
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <Gavel size={16} /> My Listings & Bids
                    </Link>
                    <button
                      onClick={handleLogout}
                      style={{
                        padding: '0.6rem 0.8rem',
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'var(--color-danger)',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        borderTop: '1px solid var(--color-border-subtle)',
                        marginTop: '0.3rem'
                      }}
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/login" className="btn btn-outline btn-sm">
                Log In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            className="mobile-nav-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle Navigation"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute',
          top: 'var(--header-height)',
          left: 0,
          right: 0,
          background: 'white',
          borderBottom: '1px solid var(--color-border)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <Link to="/" onClick={() => setMenuOpen(false)} className="nav-link">
            Explore Auctions
          </Link>
          <Link to="/my-auctions" onClick={() => setMenuOpen(false)} className="nav-link">
            My Auctions & Bids
          </Link>
          <Link to="/my-auctions?tab=saved" onClick={() => setMenuOpen(false)} className="nav-link">
            Saved Searches
          </Link>
          <Link to="/create-listing" onClick={() => setMenuOpen(false)} className="btn btn-accent btn-sm">
            + Post Auction
          </Link>
        </div>
      )}
    </header>
  );
}

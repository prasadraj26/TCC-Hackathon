import React, { useState, useEffect, useRef } from 'react';
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
  BookmarkCheck,
  Package,
  Trophy,
  TrendingUp,
  ChevronDown,
  Layers
} from 'lucide-react';

export default function Header() {
  const { currentUser, logout, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const dropdownRef = useRef(null);
  const closeTimeoutRef = useRef(null);

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

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setUserDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    // 200ms grace period prevents flicker when moving pointer between pill and menu
    closeTimeoutRef.current = setTimeout(() => {
      setUserDropdownOpen(false);
    }, 200);
  };

  const handleTriggerClick = (e) => {
    e.stopPropagation();
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setUserDropdownOpen(prev => !prev);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setUserDropdownOpen(false);
    }
  };

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
          {currentUser ? (
            <>
              <NavLink to="/my-auctions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                My Auctions
              </NavLink>
              <NavLink to="/my-bids" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                My Bids
              </NavLink>
              <NavLink to="/won-items" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Won Items
              </NavLink>
            </>
          ) : null}
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

              {/* User Dropdown with seamless hover, click, and keyboard interaction */}
              <div
                className="user-dropdown-container"
                ref={dropdownRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onKeyDown={handleKeyDown}
                style={{ position: 'relative' }}
              >
                <button
                  type="button"
                  className="user-menu-pill"
                  onClick={handleTriggerClick}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                >
                  <div className="user-avatar-circle">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                  </div>
                  <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.displayName || currentUser.email.split('@')[0]}
                  </span>
                  <ChevronDown size={14} style={{ opacity: 0.6, transition: 'transform 0.2s', transform: userDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </button>

                {userDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      paddingTop: '6px', // Invisible hover bridge prevents premature mouseleave
                      zIndex: 200
                    }}
                  >
                    <div style={{
                      width: '230px',
                      background: 'white',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-xl)',
                      padding: '0.5rem'
                    }}>
                      <div style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{currentUser.displayName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>{currentUser.email}</div>
                      </div>

                      <div style={{ padding: '0.3rem 0' }}>
                        <Link
                          to="/profile"
                          className="nav-link"
                          style={{ padding: '0.55rem 0.8rem', width: '100%', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.55rem' }}
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <User size={16} /> Profile & Settings
                        </Link>
                        <Link
                          to="/my-auctions"
                          className="nav-link"
                          style={{ padding: '0.55rem 0.8rem', width: '100%', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.55rem' }}
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <Package size={16} /> My Listings
                        </Link>
                        <Link
                          to="/my-bids"
                          className="nav-link"
                          style={{ padding: '0.55rem 0.8rem', width: '100%', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.55rem' }}
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <Gavel size={16} /> My Bids
                        </Link>
                        <Link
                          to="/won-items"
                          className="nav-link"
                          style={{ padding: '0.55rem 0.8rem', width: '100%', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.55rem' }}
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <Trophy size={16} /> Won Items
                        </Link>
                        <Link
                          to="/auction-analytics"
                          className="nav-link"
                          style={{ padding: '0.55rem 0.8rem', width: '100%', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.55rem' }}
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <TrendingUp size={16} /> Auction Analytics
                        </Link>
                        <Link
                          to="/my-auctions?tab=saved"
                          className="nav-link"
                          style={{ padding: '0.55rem 0.8rem', width: '100%', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.55rem' }}
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <BookmarkCheck size={16} /> Saved Searches
                        </Link>
                      </div>

                      <button
                        type="button"
                        onClick={handleLogout}
                        style={{
                          padding: '0.6rem 0.8rem',
                          width: '100%',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.55rem',
                          color: 'var(--color-danger)',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          background: 'none',
                          border: 'none',
                          borderTop: '1px solid var(--color-border-subtle)',
                          cursor: 'pointer'
                        }}
                      >
                        <LogOut size={16} /> Sign Out
                      </button>
                    </div>
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
        <div className="mobile-drawer" role="dialog" aria-label="Navigation menu">
          <Link to="/" onClick={() => setMenuOpen(false)} className="drawer-link">
            <Layers size={18} /> Explore Auctions
          </Link>
          {currentUser ? (
            <>
              <div className="drawer-divider" />
              <Link to="/my-auctions" onClick={() => setMenuOpen(false)} className="drawer-link">
                <Package size={18} /> My Listings
              </Link>
              <Link to="/my-bids" onClick={() => setMenuOpen(false)} className="drawer-link">
                <Gavel size={18} /> My Bids
              </Link>
              <Link to="/won-items" onClick={() => setMenuOpen(false)} className="drawer-link">
                <Trophy size={18} /> Won Items
              </Link>
              <Link to="/auction-analytics" onClick={() => setMenuOpen(false)} className="drawer-link">
                <TrendingUp size={18} /> Auction Analytics
              </Link>
              <Link to="/profile" onClick={() => setMenuOpen(false)} className="drawer-link">
                <User size={18} /> My Profile
              </Link>
              <div className="drawer-divider" />
              <Link to="/create-listing" onClick={() => setMenuOpen(false)} className="btn btn-accent" style={{ justifyContent: 'center', minHeight: '44px' }}>
                <PlusCircle size={18} /> Post an Auction
              </Link>
              <button type="button" onClick={handleLogout} className="drawer-signout">
                <LogOut size={18} /> Sign Out
              </button>
            </>
          ) : (
            <div className="drawer-auth-row">
              <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn-outline">
                Log In
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} className="btn btn-primary">
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

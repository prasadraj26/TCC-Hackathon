import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchAuctions } from '../services/auctionService';
import { Mail, LogOut, Package } from 'lucide-react';

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    sellingCount: 0,
    biddingCount: 0,
    soldCount: 0
  });

  useEffect(() => {
    if (!currentUser) return;
    async function loadStats() {
      try {
        const [selling, bidding] = await Promise.all([
          fetchAuctions({ sellerUid: currentUser.uid }),
          fetchAuctions({ bidderUid: currentUser.uid })
        ]);
        const sold = selling.filter(a => a.status === 'SOLD').length;
        setStats({
          sellingCount: selling.length,
          biddingCount: bidding.length,
          soldCount: sold
        });
      } catch (_err) {
        // ignore
      }
    }
    loadStats();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <h2>Sign In to View Profile</h2>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>Log In</Link>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="container" style={{ maxWidth: '680px', paddingBottom: '4rem' }}>
      <div style={{ margin: '1.5rem 0' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>Student Profile</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Your verified campus identity and marketplace metrics.
        </p>
      </div>

      <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--color-accent)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            fontWeight: 800
          }}>
            {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem' }}>{currentUser.displayName || 'Campus Student'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-light)', fontSize: '0.88rem' }}>
              <Mail size={14} />
              <span>{currentUser.email}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-light)', fontWeight: 700 }}>
              Campus Role / Year
            </div>
            <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
              {currentUser.campusYear || currentUser.role || 'Final Year B.Tech'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-light)', fontWeight: 700 }}>
              Hostel Pickup Spot
            </div>
            <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
              {currentUser.hostel || 'Hostel 4'}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {stats.sellingCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
              My Listings
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-accent)' }}>
              {stats.biddingCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
              Active Bids
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>
              {stats.soldCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
              Completed Sales
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/my-auctions" className="btn btn-outline" style={{ flex: 1 }}>
          <Package size={16} /> Manage My Auctions
        </Link>
        <button
          onClick={handleLogout}
          className="btn btn-outline"
          style={{ color: 'var(--color-danger)' }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}

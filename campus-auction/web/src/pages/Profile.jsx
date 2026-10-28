import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchAuctions } from '../services/auctionService';
import { Mail, LogOut, Package, Edit2, Check, X, AlertTriangle } from 'lucide-react';

export default function Profile() {
  const { currentUser, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    sellingCount: 0,
    biddingCount: 0,
    soldCount: 0
  });

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [hostelInput, setHostelInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (currentUser) {
      setNameInput(currentUser.name || currentUser.displayName || '');
      setYearInput(currentUser.campusYear || '');
      setHostelInput(currentUser.hostel || '');
    }
  }, [currentUser]);

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
        <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 1.5rem' }}>
          Please sign in with your student account to access your campus profile and statistics.
        </p>
        <Link to="/login" className="btn btn-primary">Log In</Link>
      </div>
    );
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setFeedback({ type: 'danger', message: 'Name cannot be empty.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await updateProfile({
        name: nameInput.trim(),
        campusYear: yearInput.trim(),
        hostel: hostelInput.trim()
      });
      setFeedback({ type: 'success', message: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const hasName = Boolean(currentUser.name || currentUser.displayName);
  const displayName = currentUser.name || currentUser.displayName || 'Profile Incomplete';

  return (
    <div className="container" style={{ maxWidth: '680px', paddingBottom: '4rem' }}>
      <div style={{ margin: '1.5rem 0' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>Student Profile</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Your campus profile and marketplace metrics.
        </p>
      </div>

      {!hasName && !isEditing && (
        <div className="alert-box alert-warning" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Profile Incomplete:</strong> Please set your full name so campus buyers and sellers recognize you on listings and bids.
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => setIsEditing(true)}
              >
                Set Your Name Now
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`alert-box alert-${feedback.type}`} style={{ marginBottom: '1.5rem' }}>
          {feedback.message}
        </div>
      )}

      <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: hasName ? 'var(--color-accent)' : '#94a3b8',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              fontWeight: 800
            }}>
              {hasName ? displayName[0].toUpperCase() : 'U'}
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', color: hasName ? 'inherit' : 'var(--color-text-muted)' }}>
                {displayName}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-light)', fontSize: '0.88rem' }}>
                <Mail size={14} />
                <span>{currentUser.email}</span>
              </div>
            </div>
          </div>

          {!isEditing && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 size={14} /> Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveProfile} style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Rahul Sharma"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Campus Role / Year</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Final Year CS"
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hostel Pickup Spot</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Hostel 3, Room 112"
                  value={hostelInput}
                  onChange={(e) => setHostelInput(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-accent btn-sm" disabled={saving}>
                <Check size={14} /> {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setIsEditing(false);
                  setNameInput(currentUser.name || currentUser.displayName || '');
                  setYearInput(currentUser.campusYear || '');
                  setHostelInput(currentUser.hostel || '');
                }}
                disabled={saving}
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-light)', fontWeight: 700 }}>
                Campus Role / Year
              </div>
              <div style={{ fontWeight: 600, marginTop: '0.2rem', color: currentUser.campusYear ? 'inherit' : 'var(--color-text-light)' }}>
                {currentUser.campusYear || 'Not specified'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-light)', fontWeight: 700 }}>
                Hostel Pickup Spot
              </div>
              <div style={{ fontWeight: 600, marginTop: '0.2rem', color: currentUser.hostel ? 'inherit' : 'var(--color-text-light)' }}>
                {currentUser.hostel || 'Not specified'}
              </div>
            </div>
          </div>
        )}

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

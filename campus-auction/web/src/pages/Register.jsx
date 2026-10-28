import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Gavel } from 'lucide-react';
import { isKonguEmail, AUTH_ERROR_MESSAGES, normalizeEmail } from '../utils/authValidators';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [campusYear, setCampusYear] = useState('');
  const [hostel, setHostel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please provide your actual full name.');
      return;
    }

    const normalized = normalizeEmail(email);
    if (!isKonguEmail(normalized)) {
      setError(AUTH_ERROR_MESSAGES.REGISTRATION_DOMAIN_DISALLOWED);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await register(normalized, password, displayName.trim(), {
        campusYear: campusYear.trim(),
        hostel: hostel.trim()
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="auth-page-container">
        <div className="auth-card">
          <div className="auth-header">
            <div style={{
              background: '#10b981',
              color: 'white',
              borderRadius: '10px',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem'
            }}>
              <Gavel size={24} />
            </div>
            <h1>Student Registration</h1>
            <p>Join CampusBid to buy and sell second-hand essentials</p>
          </div>

          {error && <div className="alert-box alert-danger">{error}</div>}

          <form onSubmit={handleRegisterSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Rahul Sharma"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kongu College Email *</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. prasadrajv.23aid@kongu.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="form-hint">Must end in @kongu.edu. Other email domains are not accepted.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                type="password"
                className="form-input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Year & Branch</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Final Year CS"
                  value={campusYear}
                  onChange={(e) => setCampusYear(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hostel or Class</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Hostel 3, AAB001"
                  value={hostel}
                  onChange={(e) => setHostel(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-accent btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Register as Student'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

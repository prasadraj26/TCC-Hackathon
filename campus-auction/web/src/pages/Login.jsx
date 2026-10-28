import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Gavel } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
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
            <h1>Campus Student Login</h1>
            <p>Access your listings and active campus bids</p>
          </div>

          {error && <div className="alert-box alert-danger">{error}</div>}

          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Campus Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="name@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            New to campus auctions?{' '}
            <Link to="/register" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

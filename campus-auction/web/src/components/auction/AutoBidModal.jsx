import React, { useState } from 'react';
import { formatINR, toPaise } from '../../utils/formatters';
import { Bot, AlertCircle, X } from 'lucide-react';

export default function AutoBidModal({ isOpen, onClose, auction, onSetAutoBid }) {
  const [maxRupees, setMaxRupees] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !auction) return null;

  const minRequiredPaise = auction.bidCount === 0
    ? auction.startingPricePaise
    : auction.currentPricePaise + auction.minIncrementPaise;

  const minRequiredRupees = minRequiredPaise / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const rupeesNum = parseFloat(maxRupees);
    if (isNaN(rupeesNum) || rupeesNum <= 0) {
      setError('Please enter a valid rupee amount.');
      return;
    }

    const maxPaise = toPaise(rupeesNum);
    if (maxPaise < minRequiredPaise) {
      setError(`Maximum bid must be at least ${formatINR(minRequiredPaise)}`);
      return;
    }

    setLoading(true);
    try {
      await onSetAutoBid(maxPaise);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Bot size={20} color="#7e22ce" />
            <span>Enable Automatic Bidding</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-text-light)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="alert-box alert-info" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>How Auto-Bidding Works:</strong> Our engine will automatically place bids on your behalf using the auction's minimum increment (<strong>{formatINR(auction.minIncrementPaise)}</strong>) whenever you are outbid, up to your specified maximum.
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              <strong>Collegiate Transparency Note:</strong> In accordance with our campus fairness policy, active auto-bid limits are visible in the auction record to prevent hidden sniping.
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Your Maximum Bid (in INR)</span>
                <span style={{ color: 'var(--color-text-light)', fontWeight: 400 }}>
                  Min: {formatINR(minRequiredPaise)}
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '10px', fontWeight: 700, color: '#64748b' }}>₹</span>
                <input
                  type="number"
                  className="form-input"
                  style={{ paddingLeft: '28px' }}
                  placeholder={`e.g. ${minRequiredRupees + 200}`}
                  value={maxRupees}
                  onChange={(e) => setMaxRupees(e.target.value)}
                  min={minRequiredRupees}
                  step="1"
                  required
                />
              </div>
              {error && <span className="form-error">{error}</span>}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-accent" disabled={loading}>
              {loading ? 'Activating...' : 'Activate Auto-Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

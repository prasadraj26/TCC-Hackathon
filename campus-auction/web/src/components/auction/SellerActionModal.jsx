import React, { useState } from 'react';
import { formatINR } from '../../utils/formatters';
import { ShieldAlert, CheckCircle, XCircle, PackageCheck, X } from 'lucide-react';

export default function SellerActionModal({ isOpen, onClose, actionType, auction, onConfirm }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !auction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onConfirm(actionType, reason);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getActionDetails = () => {
    switch (actionType) {
      case 'APPROVE':
        return {
          title: 'Approve Winning Bid',
          icon: <CheckCircle size={22} color="#10b981" />,
          description: `You are accepting the final winning bid of ${formatINR(auction.currentPricePaise)} from ${auction.currentLeaderName || 'the winning student'}. This will mark the listing as RESERVED and notify the winner to coordinate campus handover.`,
          btnClass: 'btn-accent',
          btnText: 'Approve & Reserve Item',
          requiresReason: false
        };
      case 'REJECT':
        return {
          title: 'Reject Winning Bid',
          icon: <XCircle size={22} color="#ef4444" />,
          description: `Decline the winning bid of ${formatINR(auction.currentPricePaise)}. The auction will transition to REJECTED.`,
          btnClass: 'btn-danger',
          btnText: 'Confirm Rejection',
          requiresReason: true,
          reasonPlaceholder: 'e.g. Bid below personal reserve value, or item unavailable'
        };
      case 'HANDOVER':
        return {
          title: 'Confirm Campus Handover',
          icon: <PackageCheck size={22} color="#10b981" />,
          description: `Confirm that you met the buyer in person on campus and completed the item handover. This permanently marks the auction as SOLD.`,
          btnClass: 'btn-accent',
          btnText: 'Confirm Handover & Complete Sale',
          requiresReason: false
        };
      case 'PICKUP_FAILED':
        return {
          title: 'Mark Pickup Failed',
          icon: <ShieldAlert size={22} color="#f59e0b" />,
          description: `Report that the buyer failed to show up for the agreed campus handover. This records PICKUP_FAILED in the audit history.`,
          btnClass: 'btn-danger',
          btnText: 'Mark Pickup Failed',
          requiresReason: true,
          reasonPlaceholder: 'e.g. Buyer did not arrive at hostel meetup point'
        };
      case 'CANCEL':
      default:
        return {
          title: 'Cancel Listing',
          icon: <ShieldAlert size={22} color="#ef4444" />,
          description: 'Are you sure you want to cancel this listing? All active bidders will be notified with your cancellation reason.',
          btnClass: 'btn-danger',
          btnText: 'Cancel Auction',
          requiresReason: true,
          reasonPlaceholder: 'e.g. Decided to keep item, or gave to room partner'
        };
    }
  };

  const details = getActionDetails();

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {details.icon}
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{details.title}</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-text-light)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.925rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              {details.description}
            </p>

            {details.requiresReason && (
              <div className="form-group">
                <label className="form-label">
                  Reason / Outcome Note <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder={details.reasonPlaceholder}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>
            )}

            {error && <div className="alert-box alert-danger">{error}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Back
            </button>
            <button type="submit" className={`btn ${details.btnClass}`} disabled={loading}>
              {loading ? 'Processing...' : details.btnText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

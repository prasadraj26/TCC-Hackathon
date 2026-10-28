import React from 'react';
import { formatINR, formatDate } from '../../utils/formatters';
import { Crown, Bot, User, ShieldCheck } from 'lucide-react';

export default function BidHistory({ bids = [], currentLeaderUid }) {
  if (!bids || bids.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-light)' }}>
        No bids have been placed yet. Be the first student to bid!
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="bid-table">
        <thead>
          <tr>
            <th>Bidder</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Placed At</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {bids.map((bid, index) => {
            const isLeading = index === 0;
            const isAuto = bid.type === 'AUTO';

            return (
              <tr key={bid.id || index} className={isLeading ? 'leader-row' : ''}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: isLeading ? 700 : 500 }}>
                    {isLeading ? <Crown size={15} color="#10b981" /> : <User size={14} color="#64748b" />}
                    <span>{bid.bidderName || 'User'}</span>
                  </div>
                </td>
                <td style={{ fontWeight: 700, color: isLeading ? 'var(--color-accent)' : 'inherit' }}>
                  {formatINR(bid.amountPaise)}
                </td>
                <td>
                  {isAuto ? (
                    <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}>
                      <Bot size={11} /> Auto-Bid
                    </span>
                  ) : (
                    <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                      Manual
                    </span>
                  )}
                </td>
                <td style={{ fontSize: '0.825rem', color: 'var(--color-text-light)' }}>
                  {formatDate(bid.timestamp)}
                </td>
                <td>
                  {isLeading ? (
                    <span className="badge badge-live">Leading</span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Outbid</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

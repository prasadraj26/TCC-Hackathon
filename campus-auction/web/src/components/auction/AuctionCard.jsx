import React from 'react';
import { Link } from 'react-router-dom';
import CountdownTimer from '../common/CountdownTimer';
import { formatINR } from '../../utils/formatters';
import { MapPin, Users, Flame } from 'lucide-react';

export default function AuctionCard({ auction }) {
  const isLive = auction.status === 'LIVE';
  const hasBids = (auction.bidCount || 0) > 0;

  return (
    <Link to={`/auctions/${auction.id}`} className="card auction-card">
      <div className="auction-card-media">
        <img
          src={auction.images?.[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80'}
          alt={auction.title}
          loading="lazy"
        />

        <div className="auction-card-badges">
          <span className="badge badge-category">
            {auction.category}
          </span>
          <span className="badge badge-condition">
            {auction.condition}
          </span>
        </div>

        {isLive ? (
          <CountdownTimer endsAt={auction.endsAt} compact />
        ) : (
          <div className="auction-countdown-pill" style={{ backgroundColor: '#334155' }}>
            <span>{auction.status.replace(/_/g, ' ')}</span>
          </div>
        )}
      </div>

      <div className="auction-card-content">
        <h3 className="auction-card-title">{auction.title}</h3>

        <div className="auction-card-location">
          <MapPin size={13} />
          <span>{auction.location || 'Campus'}</span>
        </div>

        <div className="auction-card-footer">
          <div>
            <div className="price-subtext">
              {hasBids ? 'Current Bid' : 'Starting Price'}
            </div>
            <div className="current-price-val">
              {formatINR(auction.currentPricePaise)}
            </div>
          </div>

          <div className="bid-count-badge">
            <Users size={14} />
            <span>{auction.bidCount || 0} {auction.bidCount === 1 ? 'bid' : 'bids'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

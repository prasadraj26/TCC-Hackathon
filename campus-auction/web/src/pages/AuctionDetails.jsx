import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchAuctionById,
  approveWinningBid,
  rejectWinningBid,
  confirmHandover,
  markPickupFailed,
  cancelAuction
} from '../services/auctionService';
import {
  placeBid,
  fetchAuctionBids,
  setAutoBid,
  fetchAuctionAutoBids,
  cancelAutoBid
} from '../services/biddingService';
import CountdownTimer from '../components/common/CountdownTimer';
import BidHistory from '../components/auction/BidHistory';
import AutoBidModal from '../components/auction/AutoBidModal';
import SellerActionModal from '../components/auction/SellerActionModal';
import { formatINR, toPaise, toRupees } from '../utils/formatters';
import {
  ShieldAlert,
  ShieldCheck,
  MapPin,
  User,
  Clock,
  Sparkles,
  Bot,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Package
} from 'lucide-react';

export default function AuctionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, getAuthHeaders } = useAuth();

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [autoBids, setAutoBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);

  // Bid form state
  const [bidRupees, setBidRupees] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidFeedback, setBidFeedback] = useState(null);

  // Modals state
  const [autoBidModalOpen, setAutoBidModalOpen] = useState(false);
  const [sellerModalOpen, setSellerModalOpen] = useState(false);
  const [sellerActionType, setSellerActionType] = useState('APPROVE');

  useEffect(() => {
    loadAuctionData();
    const interval = setInterval(loadAuctionData, 8000); // Polling updates
    return () => clearInterval(interval);
  }, [id]);

  async function loadAuctionData() {
    try {
      const [auctionData, bidsData, autoBidsData] = await Promise.all([
        fetchAuctionById(id),
        fetchAuctionBids(id),
        fetchAuctionAutoBids(id).catch(() => [])
      ]);
      setAuction(auctionData);
      setBids(bidsData);
      setAutoBids(autoBidsData);

      // Default the bid input to next minimum required
      if (!bidRupees) {
        const nextMinPaise = (auctionData.bidCount || 0) === 0
          ? auctionData.startingPricePaise
          : auctionData.currentPricePaise + auctionData.minIncrementPaise;
        setBidRupees((nextMinPaise / 100).toString());
      }
    } catch (err) {
      setError(err.message || 'Failed to load auction.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        Loading auction details...
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="alert-box alert-danger" style={{ maxWidth: '500px', margin: '0 auto' }}>
          {error || 'Auction not found.'}
        </div>
        <Link to="/" className="btn btn-outline" style={{ marginTop: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to Explore
        </Link>
      </div>
    );
  }

  const isSeller = currentUser?.uid === auction.sellerUid;
  const isLeader = currentUser?.uid === auction.currentLeaderUid;
  const isLive = auction.status === 'LIVE';

  const minRequiredPaise = (auction.bidCount || 0) === 0
    ? auction.startingPricePaise
    : auction.currentPricePaise + auction.minIncrementPaise;

  const handleQuickAdd = (incrementRupees) => {
    const currentInputVal = parseFloat(bidRupees) || (minRequiredPaise / 100);
    setBidRupees((currentInputVal + incrementRupees).toString());
  };

  const handlePlaceBidSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setBidFeedback(null);
    const amountPaise = toPaise(parseFloat(bidRupees));

    if (amountPaise < minRequiredPaise) {
      setBidFeedback({
        type: 'danger',
        message: `Your bid must be at least ${formatINR(minRequiredPaise)}`
      });
      return;
    }

    setSubmittingBid(true);
    try {
      const headers = await getAuthHeaders();
      const res = await placeBid(auction.id, amountPaise, headers);

      let msg = `Bid of ${formatINR(amountPaise)} successfully accepted!`;
      if (res.extended) {
        msg += ' ⏱️ Anti-sniping extended deadline by 60 seconds!';
      }
      setBidFeedback({ type: 'success', message: msg });
      await loadAuctionData();
    } catch (err) {
      setBidFeedback({ type: 'danger', message: err.message });
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleSetAutoBid = async (maxAmountPaise) => {
    const headers = await getAuthHeaders();
    await setAutoBid(auction.id, maxAmountPaise, headers);
    await loadAuctionData();
    setBidFeedback({
      type: 'success',
      message: `Automatic bidding activated up to ${formatINR(maxAmountPaise)}!`
    });
  };

  const handleCancelAutoBid = async () => {
    const headers = await getAuthHeaders();
    await cancelAutoBid(auction.id, headers);
    await loadAuctionData();
    setBidFeedback({
      type: 'info',
      message: 'Automatic bidding cancelled.'
    });
  };

  const handleSellerConfirm = async (actionType, reason) => {
    const headers = await getAuthHeaders();
    if (actionType === 'APPROVE') {
      await approveWinningBid(auction.id, headers);
    } else if (actionType === 'REJECT') {
      await rejectWinningBid(auction.id, reason, headers);
    } else if (actionType === 'HANDOVER') {
      await confirmHandover(auction.id, headers);
    } else if (actionType === 'PICKUP_FAILED') {
      await markPickupFailed(auction.id, reason, headers);
    } else if (actionType === 'CANCEL') {
      await cancelAuction(auction.id, reason, headers);
    }
    await loadAuctionData();
  };

  const openSellerModal = (type) => {
    setSellerActionType(type);
    setSellerModalOpen(true);
  };

  const userAutoBid = autoBids.find(b => b.bidderUid === currentUser?.uid && b.active);

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {/* Breadcrumb */}
      <div style={{ margin: '1.25rem 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
        <Link to="/" style={{ color: 'var(--color-text-light)' }}>Auctions</Link>
        <span style={{ color: 'var(--color-text-light)' }}>/</span>
        <span style={{ color: 'var(--color-text-light)' }}>{auction.category}</span>
        <span style={{ color: 'var(--color-text-light)' }}>/</span>
        <span style={{ fontWeight: 600 }}>{auction.title}</span>
      </div>

      {/* State Machine Status Banners */}
      {auction.status === 'ENDED_PENDING_SELLER' && (
        <div className="alert-box alert-warning">
          <Clock size={20} />
          <div>
            <strong>Auction Ended — Awaiting Seller Review:</strong> The bidding period has concluded with a winning bid of {formatINR(auction.currentPricePaise)} from {auction.currentLeaderName || 'Buyer'}. Awaiting seller approval.
          </div>
        </div>
      )}

      {auction.status === 'RESERVED' && (
        <div className="alert-box alert-info">
          <CheckCircle2 size={20} />
          <div>
            <strong>Item Reserved for Handover:</strong> The seller approved the winning price! Winner ({auction.currentLeaderName}) and seller can meet at <strong>{auction.location}</strong> to complete handover.
          </div>
        </div>
      )}

      {auction.status === 'SOLD' && (
        <div className="alert-box alert-success">
          <CheckCircle2 size={20} />
          <div>
            <strong>Sale Successfully Completed:</strong> Campus handover was confirmed. Congratulations to buyer and seller!
          </div>
        </div>
      )}

      {auction.status === 'REJECTED' && (
        <div className="alert-box alert-danger">
          <ShieldAlert size={20} />
          <div>
            <strong>Bid Rejected by Seller:</strong> {auction.outcomeNote || 'The seller decided not to proceed with this final price.'}
          </div>
        </div>
      )}

      {auction.status === 'CANCELLED' && (
        <div className="alert-box alert-danger">
          <ShieldAlert size={20} />
          <div>
            <strong>Auction Cancelled:</strong> {auction.outcomeNote || 'Listing cancelled by seller.'}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="auction-detail-grid">
        {/* Left Column: Media & Information */}
        <div>
          {/* Main Photo Gallery */}
          <div className="auction-gallery-main">
            {auction.images?.[selectedImage] ? (
              <img
                src={auction.images[selectedImage]}
                alt={auction.title}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                minHeight: '360px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg-alt, #f8fafc)',
                color: 'var(--color-text-light, #94a3b8)',
                gap: '0.75rem'
              }}>
                <Package size={52} opacity={0.35} />
                <span style={{ fontSize: '0.9rem' }}>No item image uploaded</span>
              </div>
            )}
          </div>

          {/* Photo Thumbnails */}
          {auction.images && auction.images.length > 1 && (
            <div className="auction-thumbnails">
              {auction.images.map((img, idx) => (
                <div
                  key={idx}
                  className={`auction-thumb ${selectedImage === idx ? 'active' : ''}`}
                  onClick={() => setSelectedImage(idx)}
                >
                  <img src={img} alt={`thumb-${idx}`} />
                </div>
              ))}
            </div>
          )}

          {/* Title and Badges */}
          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span className="badge badge-category">{auction.category}</span>
            <span className="badge badge-condition">Condition: {auction.condition}</span>
            <span className={`badge badge-${auction.status.toLowerCase().replace(/_/g, '-')}`}>
              {auction.status.replace(/_/g, ' ')}
            </span>
          </div>

          <h1 style={{ fontSize: '1.9rem', marginBottom: '0.75rem' }}>{auction.title}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.925rem', marginBottom: '1.5rem' }}>
            <MapPin size={16} />
            <span>Campus Pickup Location: <strong>{auction.location || 'Campus Central Block'}</strong></span>
          </div>

          {/* Description */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Item Description</h3>
            <p style={{ whiteSpace: 'pre-line', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              {auction.description || 'No additional description provided by the seller.'}
            </p>
          </div>

          {/* Seller Profile Card */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#334155'
              }}>
                <User size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{auction.sellerName || 'User'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                  {auction.sellerEmail || 'Campus Seller'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--color-text-light)', textAlign: 'right' }}>
              Hostel Pickup Spot<br /><strong>{auction.location}</strong>
            </div>
          </div>

          {/* Full Public Bid History */}
          <div className="bid-history-container">
            <div className="bid-history-header">
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Public Bid History ({bids.length})</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                Immutable Ledger
              </span>
            </div>
            <BidHistory bids={bids} currentLeaderUid={auction.currentLeaderUid} />
          </div>
        </div>

        {/* Right Column: Sticky Bid Panel & Controls */}
        <div>
          <div className="bid-panel-card">
            {/* Live Countdown */}
            {isLive ? (
              <CountdownTimer endsAt={auction.endsAt} onExpire={loadAuctionData} />
            ) : (
              <div className="countdown-ticker-box" style={{ background: '#334155' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  {auction.status.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                  Bidding closed
                </div>
              </div>
            )}

            {/* Price Hero */}
            <div className="price-hero">
              <div className="price-hero-label">
                {(auction.bidCount || 0) > 0 ? 'Current Leading Bid' : 'Starting Price'}
              </div>
              <div className="price-hero-amount">
                {formatINR(auction.currentPricePaise)}
              </div>
              <div className="price-hero-meta">
                <span>Min Increment: <strong>{formatINR(auction.minIncrementPaise)}</strong></span>
                <span>Total Bids: <strong>{auction.bidCount || 0}</strong></span>
              </div>
            </div>

            {/* Anti-Sniping Policy Highlight */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Clock size={16} color="#10b981" style={{ flexShrink: 0 }} />
              <span>
                <strong>Anti-Sniping:</strong> Bids in the final 30 seconds extend closing time by 60 seconds.
              </span>
            </div>

            {/* Feedback Message */}
            {bidFeedback && (
              <div className={`alert-box alert-${bidFeedback.type}`}>
                {bidFeedback.message}
              </div>
            )}

            {/* MANUAL BIDDING FORM */}
            {isLive && !isSeller && (
              <form onSubmit={handlePlaceBidSubmit} style={{ marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">
                    <span>Place Your Bid</span>
                    <span style={{ color: 'var(--color-text-light)', fontWeight: 400 }}>
                      Min: {formatINR(minRequiredPaise)}
                    </span>
                  </label>

                  {/* Quick-add chips */}
                  <div className="quick-bid-row">
                    <button type="button" className="quick-chip" onClick={() => handleQuickAdd(50)}>+₹50</button>
                    <button type="button" className="quick-chip" onClick={() => handleQuickAdd(100)}>+₹100</button>
                    <button type="button" className="quick-chip" onClick={() => handleQuickAdd(250)}>+₹250</button>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '10px', fontWeight: 700, color: '#64748b' }}>₹</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ paddingLeft: '28px', fontSize: '1.1rem', fontWeight: 700 }}
                      value={bidRupees}
                      onChange={(e) => setBidRupees(e.target.value)}
                      min={minRequiredPaise / 100}
                      step="1"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-accent btn-lg"
                  style={{ width: '100%' }}
                  disabled={submittingBid}
                >
                  {submittingBid ? 'Validating Bid...' : isLeader ? 'Raise Your Leading Bid' : 'Place Bid Now'}
                </button>
              </form>
            )}

            {/* Seller Warning if viewing own listing */}
            {isSeller && (
              <div className="alert-box alert-info" style={{ marginBottom: '1.5rem' }}>
                <Lock size={16} style={{ flexShrink: 0 }} />
                <span>You are the seller of this listing. Self-bidding is disabled.</span>
              </div>
            )}

            {/* AUTOMATIC BIDDING CONTROLS */}
            {isLive && !isSeller && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.925rem' }}>
                    <Bot size={18} color="#7e22ce" />
                    <span>Automatic Bidding</span>
                  </div>
                  {userAutoBid ? (
                    <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>Active</span>
                  ) : null}
                </div>

                {userAutoBid ? (
                  <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#581c87', marginBottom: '0.4rem' }}>
                      Auto-bid set up to <strong>{formatINR(userAutoBid.maxAmountPaise)}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={handleCancelAutoBid}
                    >
                      Cancel Auto-Bid
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => {
                      if (!currentUser) navigate('/login');
                      else setAutoBidModalOpen(true);
                    }}
                  >
                    <Bot size={15} /> Set Auto-Bid Limit
                  </button>
                )}
              </div>
            )}

            {/* SELLER CONTROL WORKFLOW BUTTONS */}
            {isSeller && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Seller Actions</h4>

                {auction.status === 'LIVE' && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => openSellerModal('CANCEL')}
                  >
                    Cancel Auction Listing
                  </button>
                )}

                {auction.status === 'ENDED_PENDING_SELLER' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <button
                      type="button"
                      className="btn btn-accent"
                      style={{ width: '100%' }}
                      onClick={() => openSellerModal('APPROVE')}
                    >
                      ✓ Approve Winning Bid ({formatINR(auction.currentPricePaise)})
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => openSellerModal('REJECT')}
                    >
                      ✗ Reject Winning Bid
                    </button>
                  </div>
                )}

                {auction.status === 'RESERVED' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <button
                      type="button"
                      className="btn btn-accent"
                      style={{ width: '100%' }}
                      onClick={() => openSellerModal('HANDOVER')}
                    >
                      Confirm Campus Handover (Mark SOLD)
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => openSellerModal('PICKUP_FAILED')}
                    >
                      Report Pickup Failed
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auto Bid Modal */}
      <AutoBidModal
        isOpen={autoBidModalOpen}
        onClose={() => setAutoBidModalOpen(false)}
        auction={auction}
        onSetAutoBid={handleSetAutoBid}
      />

      {/* Seller Action Modal */}
      <SellerActionModal
        isOpen={sellerModalOpen}
        onClose={() => setSellerModalOpen(false)}
        actionType={sellerActionType}
        auction={auction}
        onConfirm={handleSellerConfirm}
      />
    </div>
  );
}

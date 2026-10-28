import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { queryAssistant } from '../services/assistantService';
import { setAutoBid } from '../services/biddingService';
import { formatINR } from '../utils/formatters';
import {
  Sparkles,
  Send,
  Gavel,
  Clock,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  X,
  Info,
  ShieldCheck,
  Zap
} from 'lucide-react';

const SUGGESTIONS = [
  'Find me a cycle under ₹2,000',
  'Show laptops with less than 30 minutes remaining',
  'Find the cheapest active calculator',
  'Show the most active auctions under ₹1,500'
];

export default function Assistant() {
  const { currentUser, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hi! I'm your CampusBid AI Assistant. Ask me in natural language to find campus essentials, filter by budget, check closing times, or set up automated bidding.",
      timestamp: new Date(),
      isWelcome: true
    }
  ]);

  // Modal state for explicit auto-bid setup
  const [selectedAuctionForAutoBid, setSelectedAuctionForAutoBid] = useState(null);
  const [autoBidAmountInput, setAutoBidAmountInput] = useState('');
  const [autoBidLoading, setAutoBidLoading] = useState(false);
  const [autoBidError, setAutoBidError] = useState('');

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (queryText) => {
    const text = (queryText || input).trim();
    if (!text || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMessage = {
      id: userMessageId,
      sender: 'user',
      text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await queryAssistant(text);
      const assistantMessageId = `asst-${Date.now()}`;
      const assistantMessage = {
        id: assistantMessageId,
        sender: 'assistant',
        text: data.summary,
        filters: data.filters,
        results: data.results || [],
        count: data.count || 0,
        isRelaxed: data.isRelaxed,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue processing your query. Please try again or rephrase your question.',
        isError: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAutoBidModal = (item) => {
    // If not logged in, prompt user
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const minRequired = item.bidCount === 0
      ? item.startingPriceRupees
      : item.currentPriceRupees + item.minIncrementRupees;

    setSelectedAuctionForAutoBid(item);
    setAutoBidAmountInput(String(Math.max(minRequired, item.currentPriceRupees + item.minIncrementRupees)));
    setAutoBidError('');
  };

  const handleConfirmAutoBid = async (e) => {
    e.preventDefault();
    if (!selectedAuctionForAutoBid) return;

    const maxRupees = parseFloat(autoBidAmountInput);
    const minRequired = selectedAuctionForAutoBid.bidCount === 0
      ? selectedAuctionForAutoBid.startingPriceRupees
      : selectedAuctionForAutoBid.currentPriceRupees + selectedAuctionForAutoBid.minIncrementRupees;

    if (isNaN(maxRupees) || maxRupees < minRequired) {
      setAutoBidError(`Maximum limit must be at least ₹${minRequired.toLocaleString('en-IN')}`);
      return;
    }

    setAutoBidLoading(true);
    setAutoBidError('');
    try {
      const headers = await getAuthHeaders();
      const maxAmountPaise = Math.round(maxRupees * 100);
      await setAutoBid(selectedAuctionForAutoBid.id, maxAmountPaise, headers);

      // Successfully activated auto-bid
      const auctionTitle = selectedAuctionForAutoBid.title;
      const targetId = selectedAuctionForAutoBid.id;
      setSelectedAuctionForAutoBid(null);

      // Inject confirmation message into chat
      setMessages(prev => [
        ...prev,
        {
          id: `autobid-conf-${Date.now()}`,
          sender: 'assistant',
          text: `✅ Automatic bidding activated for "${auctionTitle}" with a maximum ceiling of ₹${maxRupees.toLocaleString('en-IN')}. The system will bid incrementally whenever you are outbid until this limit is reached.`,
          isSuccessBanner: true,
          actionAuctionId: targetId,
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      setAutoBidError(err.message || 'Failed to activate automatic bidding.');
    } finally {
      setAutoBidLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '960px', paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div style={{ margin: '1.5rem 0 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <div style={{
            background: 'var(--color-accent-light)',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-accent-border)',
            padding: '0.35rem 0.5rem',
            borderRadius: 'var(--radius-md)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={20} />
          </div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>CampusBid AI Assistant</h1>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', margin: 0 }}>
          Ask in natural language to search active campus auctions, compare prices to your budget, and set up automatic bidding.
        </p>
      </div>

      {/* Suggestion Chips */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '1.25rem'
      }}>
        {SUGGESTIONS.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            className="suggestion-chip"
            onClick={() => handleSend(suggestion)}
            disabled={loading}
            style={{
              background: 'white',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-full)',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              color: 'var(--color-text-main)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            <Sparkles size={13} color="var(--color-accent)" />
            {suggestion}
          </button>
        ))}
      </div>

      {/* Chat Container */}
      <div className="chat-card" style={{
        background: 'white',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '520px',
        maxHeight: '75vh',
        overflow: 'hidden'
      }}>
        {/* Messages Feed */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start',
                gap: '0.65rem'
              }}
            >
              {msg.sender === 'assistant' && (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-accent-light)',
                  border: '1px solid var(--color-accent-border)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  <Sparkles size={16} />
                </div>
              )}

              <div style={{
                maxWidth: msg.sender === 'user' ? '75%' : '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {/* Bubble */}
                <div style={{
                  background: msg.sender === 'user'
                    ? 'var(--color-primary)'
                    : msg.isError
                      ? 'var(--color-danger-bg)'
                      : msg.isSuccessBanner
                        ? '#ecfdf5'
                        : '#f8fafc',
                  color: msg.sender === 'user'
                    ? '#ffffff'
                    : msg.isError
                      ? '#991b1b'
                      : msg.isSuccessBanner
                        ? '#065f46'
                        : 'var(--color-text-main)',
                  border: msg.sender === 'user'
                    ? 'none'
                    : msg.isError
                      ? '1px solid var(--color-danger-border)'
                      : msg.isSuccessBanner
                        ? '1px solid var(--color-accent-border)'
                        : '1px solid var(--color-border)',
                  borderRadius: msg.sender === 'user'
                    ? '18px 18px 4px 18px'
                    : '4px 18px 18px 18px',
                  padding: '0.85rem 1.15rem',
                  fontSize: '0.92rem',
                  lineHeight: 1.55,
                  boxShadow: msg.sender === 'user' ? 'var(--shadow-sm)' : 'none'
                }}>
                  {msg.text}

                  {msg.isWelcome && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      background: '#ffffff',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#92400e', marginBottom: '0.25rem' }}>
                        <Info size={14} /> Bid vs. Budget Concept
                      </div>
                      The <strong>Current Bid</strong> is the prevailing highest offer right now. Your <strong>Budget</strong> is your ceiling. Because auctions are competitive, final winning prices may climb before closing time!
                    </div>
                  )}

                  {msg.actionAuctionId && (
                    <div style={{ marginTop: '0.65rem' }}>
                      <Link to={`/auctions/${msg.actionAuctionId}`} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        View Auction Details <ExternalLink size={14} />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Filter tags breakdown */}
                {msg.filters && (msg.filters.category || msg.filters.maxBudgetRupees || msg.filters.closingWithinMinutes) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', paddingLeft: '0.25rem' }}>
                    {msg.filters.category && (
                      <span className="badge badge-outline" style={{ fontSize: '0.72rem' }}>
                        Category: {msg.filters.category}
                      </span>
                    )}
                    {msg.filters.maxBudgetRupees && (
                      <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
                        Max Budget: {formatINR(msg.filters.maxBudgetRupees)}
                      </span>
                    )}
                    {msg.filters.closingWithinMinutes && (
                      <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                        Within: {msg.filters.closingWithinMinutes}m
                      </span>
                    )}
                    {msg.filters.sortBy && msg.filters.sortBy !== 'relevance' && (
                      <span className="badge" style={{ fontSize: '0.72rem', background: '#f1f5f9' }}>
                        Sort: {msg.filters.sortBy.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                )}

                {/* Product Result Cards */}
                {msg.results && msg.results.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '0.85rem',
                    marginTop: '0.5rem'
                  }}>
                    {msg.results.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: 'var(--shadow-xs)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                        }}
                      >
                        {/* Image banner */}
                        <div style={{
                          height: '140px',
                          background: '#f1f5f9',
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {item.images && item.images.length > 0 ? (
                            <img
                              src={item.images[0]}
                              alt={item.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ color: 'var(--color-text-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                              <Gavel size={28} />
                              <span style={{ fontSize: '0.75rem' }}>Campus Auction</span>
                            </div>
                          )}

                          {/* Status Badge */}
                          <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                            <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                              LIVE
                            </span>
                          </div>

                          {/* Time badge */}
                          <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            background: 'rgba(15, 23, 42, 0.78)',
                            color: 'white',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            <Clock size={12} />
                            {item.timeRemainingLabel}
                          </div>
                        </div>

                        {/* Card Content */}
                        <div style={{ padding: '0.85rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)', fontWeight: 700 }}>
                              {item.category}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                              {item.condition}
                            </span>
                          </div>

                          <h3 style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            margin: 0,
                            lineHeight: 1.3,
                            color: 'var(--color-primary)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {item.title}
                          </h3>

                          {/* Pricing details & budget comparison */}
                          <div style={{
                            background: 'var(--color-surface-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.5rem 0.65rem',
                            marginTop: '0.2rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Current Bid:</span>
                              <strong style={{ fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                                {formatINR(item.currentPriceRupees)}
                              </strong>
                            </div>

                            {item.budgetDifferenceRupees !== null && (
                              <div style={{
                                marginTop: '0.3rem',
                                paddingTop: '0.3rem',
                                borderTop: '1px dashed var(--color-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '0.75rem'
                              }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Your Target:</span>
                                <span style={{
                                  fontWeight: 700,
                                  color: item.withinBudget ? '#059669' : '#dc2626'
                                }}>
                                  {item.withinBudget
                                    ? `₹${item.budgetDifferenceRupees.toLocaleString('en-IN')} under budget`
                                    : `₹${Math.abs(item.budgetDifferenceRupees).toLocaleString('en-IN')} over budget`}
                                </span>
                              </div>
                            )}

                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-light)', marginTop: '0.3rem' }}>
                              {item.bidCount} {item.bidCount === 1 ? 'bid placed' : 'bids placed'} • Pickup: {item.location}
                            </div>
                          </div>

                          {/* Card Action Buttons */}
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.4rem' }}>
                            <Link
                              to={`/auctions/${item.id}`}
                              className="btn btn-outline btn-sm"
                              style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem' }}
                            >
                              <ExternalLink size={13} /> View Listing
                            </Link>
                            <button
                              type="button"
                              className="btn btn-accent btn-sm"
                              onClick={() => handleOpenAutoBidModal(item)}
                              title="Set an automated bidding limit on this item"
                              style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem' }}
                            >
                              <Zap size={13} /> Set Auto-Bid
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Loading Indicator */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-accent-light)',
                border: '1px solid var(--color-accent-border)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={16} />
              </div>
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--color-border)',
                borderRadius: '4px 18px 18px 18px',
                padding: '0.65rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <span className="assistant-dot" style={{ animationDelay: '0s' }} />
                <span className="assistant-dot" style={{ animationDelay: '0.2s' }} />
                <span className="assistant-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '0.75rem 1rem',
          background: 'white'
        }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Find me a cycle under ₹2,000 or cheapest calculators..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              maxLength={300}
              style={{
                borderRadius: 'var(--radius-full)',
                paddingLeft: '1.1rem',
                paddingRight: '1.1rem',
                fontSize: '0.92rem'
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!input.trim() || loading}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '0.6rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0
              }}
            >
              <Send size={15} />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* ── Auto-Bid Explicit Confirmation Modal ────────────────────────────── */}
      {selectedAuctionForAutoBid && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000,
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--color-border)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-surface-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={18} color="var(--color-accent)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Confirm Automatic Bidding</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuctionForAutoBid(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmAutoBid} style={{ padding: '1.25rem' }}>
              {autoBidError && (
                <div className="alert-box alert-danger" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={16} /> {autoBidError}
                </div>
              )}

              {/* Auction Summary */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Selected Auction
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)', marginTop: '0.15rem' }}>
                  {selectedAuctionForAutoBid.title}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Current Bid:</span>
                  <strong>{formatINR(selectedAuctionForAutoBid.currentPriceRupees)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Min Increment:</span>
                  <span>+{formatINR(selectedAuctionForAutoBid.minIncrementRupees)}</span>
                </div>
              </div>

              {/* Input for Max Bid */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Your Maximum Bid Ceiling (INR) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', fontWeight: 700, color: '#64748b' }}>₹</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ paddingLeft: '28px', fontSize: '1.05rem', fontWeight: 700 }}
                    value={autoBidAmountInput}
                    onChange={(e) => setAutoBidAmountInput(e.target.value)}
                    min={selectedAuctionForAutoBid.bidCount === 0
                      ? selectedAuctionForAutoBid.startingPriceRupees
                      : selectedAuctionForAutoBid.currentPriceRupees + selectedAuctionForAutoBid.minIncrementRupees}
                    step={selectedAuctionForAutoBid.minIncrementRupees}
                    required
                  />
                </div>
                <span className="form-hint">
                  Minimum allowed auto-bid: {formatINR(selectedAuctionForAutoBid.bidCount === 0
                    ? selectedAuctionForAutoBid.startingPriceRupees
                    : selectedAuctionForAutoBid.currentPriceRupees + selectedAuctionForAutoBid.minIncrementRupees)}
                </span>
              </div>

              {/* Transparent Rules Breakdown */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                fontSize: '0.78rem',
                color: '#1e40af',
                lineHeight: 1.45,
                marginBottom: '1.25rem'
              }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                  <ShieldCheck size={14} /> Explicit Auto-Bid Rules:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
                  <li>The system will place bids on your behalf in minimum increments only when outbid.</li>
                  <li>Bidding stops immediately once your maximum limit is reached.</li>
                  <li>Anti-sniping extensions (+60s) apply if bids arrive in the final 30 seconds.</li>
                  <li>You can cancel or change your limit anytime before the auction closes.</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setSelectedAuctionForAutoBid(null)}
                  disabled={autoBidLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-accent"
                  disabled={autoBidLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Zap size={15} />
                  {autoBidLoading ? 'Activating...' : 'Confirm & Activate Auto-Bid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        .suggestion-chip:hover {
          border-color: var(--color-accent) !important;
          background: var(--color-accent-light) !important;
          transform: translateY(-1px);
        }
        .assistant-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          background: var(--color-accent);
          border-radius: 50%;
          animation: assistant-bounce 1.2s infinite ease-in-out;
        }
        @keyframes assistant-bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

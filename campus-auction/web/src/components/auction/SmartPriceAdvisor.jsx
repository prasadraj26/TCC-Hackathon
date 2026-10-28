/**
 * SmartPriceAdvisor.jsx
 *
 * A compact, self-contained AI/comparable-data price advisory widget
 * for the Create Listing page. Receives the current form field values
 * as props (title, category, condition) so it can auto-populate them.
 * Additional optional fields (brand, model, age, original price) are
 * collected inside this component.
 *
 * Props:
 *   title         {string}   current listing title
 *   category      {string}   current category
 *   condition     {string}   current condition
 *   onUseSuggested {fn}      callback(rupees) — fills the Starting Price field
 *   getAuthHeaders {fn}      from useAuth()
 */

import { useState, useRef, useEffect } from 'react';
import { fetchPriceEstimate } from '../../services/pricingService';
import { Sparkles, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const CONFIDENCE_COLOR = {
  high:   { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0', label: 'High' },
  medium: { bg: '#fffbeb', color: '#92400e', border: '#fde68a', label: 'Medium' },
  low:    { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', label: 'Low'  },
};

function formatINR(rupees) {
  return '₹' + Math.round(rupees).toLocaleString('en-IN');
}

export default function SmartPriceAdvisor({
  title,
  category,
  condition,
  onUseSuggested,
  onEstimate,
  getAuthHeaders,
}) {
  const [expanded, setExpanded] = useState(false);

  // Extra optional fields (inside this component only)
  const [brand, setBrand]           = useState('');
  const [model, setModel]           = useState('');
  const [ageMonths, setAgeMonths]   = useState('');
  const [origPrice, setOrigPrice]   = useState('');
  const [details, setDetails]       = useState('');

  const [loading, setLoading]   = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [error, setError]       = useState('');

  // Track last-estimated payload so we can detect stale results
  const lastParamsRef = useRef(null);

  const currentParams = JSON.stringify({ title, category, condition, brand, model, ageMonths, origPrice });
  const isStale = estimate && lastParamsRef.current !== currentParams;

  // Invalidate parent estimate whenever item inputs change and render estimate stale
  useEffect(() => {
    if (isStale) {
      onEstimate?.(null);
    }
  }, [isStale, onEstimate]);

  const handleEstimate = async () => {
    if (!category || !condition) {
      setError('Please select a category and condition first.');
      return;
    }
    setLoading(true);
    setError('');
    setEstimate(null);
    try {
      const headers = await getAuthHeaders();
      const result = await fetchPriceEstimate({
        title:                title || '',
        category,
        condition,
        brand:                brand || '',
        model:                model || '',
        ageMonths:            ageMonths !== '' ? Number(ageMonths) : undefined,
        originalPriceRupees:  origPrice !== '' ? Number(origPrice) : undefined,
        details:              details || '',
      }, headers);
      setEstimate(result);
      lastParamsRef.current = currentParams;
      onEstimate?.(result);
    } catch (err) {
      setError(err.message || 'Could not generate estimate. Try again.');
      onEstimate?.(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUsePrice = () => {
    if (estimate && onUseSuggested) {
      onUseSuggested(estimate.suggestedStartRupees);
    }
  };

  const conf = estimate ? (CONFIDENCE_COLOR[estimate.confidence] || CONFIDENCE_COLOR.low) : null;

  return (
    <div className="smart-advisor-widget" style={{
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginBottom: '1.25rem',
    }}>
      {/* ── Header / Toggle ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.85rem 1.1rem',
          background: expanded ? 'var(--color-accent-light)' : 'var(--color-surface-subtle)',
          borderBottom: expanded ? '1px solid var(--color-accent-border)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Sparkles size={16} color="var(--color-accent)" style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)', flex: 1 }}>
          Smart Price Advisor
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginRight: '0.5rem' }}>
          Get a fair-price estimate
        </span>
        {expanded ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
      </button>

      {expanded && (
        <div style={{ padding: '1rem 1.1rem', background: 'white' }}>

          {/* ── Optional detail fields ──────────────────────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            marginBottom: '0.85rem',
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Brand (optional)</label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                placeholder="e.g. Casio, Hero"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Model (optional)</label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                placeholder="e.g. fx-991ES"
                value={model}
                onChange={e => setModel(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Age (months, optional)</label>
              <input
                type="number"
                className="form-input"
                style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                placeholder="e.g. 18"
                value={ageMonths}
                onChange={e => setAgeMonths(e.target.value)}
                min="0"
                max="600"
                step="1"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Original price ₹ (optional)</label>
              <input
                type="number"
                className="form-input"
                style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                placeholder="e.g. 1200"
                value={origPrice}
                onChange={e => setOrigPrice(e.target.value)}
                min="0"
                step="1"
              />
            </div>
          </div>

          {/* Stale warning */}
          {isStale && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.78rem', color: '#92400e',
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem',
              marginBottom: '0.75rem',
            }}>
              <Info size={13} />
              Item details changed — click Estimate again for an updated price.
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.82rem', color: '#991b1b',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.75rem',
              marginBottom: '0.75rem',
            }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Estimate button */}
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={handleEstimate}
            disabled={loading}
            style={{ width: '100%', marginBottom: estimate ? '1rem' : 0, justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <span className="advisor-spinner" /> Estimating…
              </>
            ) : (
              <>
                <Sparkles size={15} /> Estimate Fair Price
              </>
            )}
          </button>

          {/* ── Result panel ─────────────────────────────────────────────── */}
          {estimate && !isStale && (
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              {/* Price summary row */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                borderBottom: '1px solid var(--color-accent-border)',
                padding: '0.9rem 1rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', letterSpacing: '0.05em' }}>
                    Suggested Starting Price
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-accent)', lineHeight: 1.1 }}>
                    {formatINR(estimate.suggestedStartRupees)}
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', letterSpacing: '0.05em' }}>
                    Est. Range
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {formatINR(estimate.loRupees)} – {formatINR(estimate.hiRupees)}
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', letterSpacing: '0.05em' }}>
                    Confidence
                  </div>
                  <span style={{
                    display: 'inline-block',
                    background: conf.bg,
                    color: conf.color,
                    border: `1px solid ${conf.border}`,
                    borderRadius: 'var(--radius-full)',
                    padding: '0.15rem 0.55rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}>
                    {conf.label}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleUsePrice}
                  title="Fill in the Starting Price field with this suggestion"
                  style={{ flexShrink: 0 }}
                >
                  <CheckCircle2 size={14} /> Use Suggested Price
                </button>
              </div>

              {/* Explanation */}
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                {estimate.explanation}
                {estimate.aiUsed && (
                  <span style={{ marginLeft: '0.4rem', fontSize: '0.73rem', color: 'var(--color-accent)', fontWeight: 600 }}>
                    ✦ AI-enhanced
                  </span>
                )}
              </div>

              {/* Comparable listings */}
              {estimate.comparables && estimate.comparables.length > 0 && (
                <div style={{
                  borderTop: '1px solid var(--color-border)',
                  padding: '0.7rem 1rem',
                  background: '#f8fafc',
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Comparable Campus Listings
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {estimate.comparables.map((c, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                      }}>
                        <span style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--color-text-main)',
                          maxWidth: '60%',
                        }} title={c.title}>
                          {c.title}
                        </span>
                        <span style={{ color: 'var(--color-text-light)', flexShrink: 0 }}>{c.condition}</span>
                        <span style={{
                          fontWeight: 700,
                          color: c.status === 'SOLD' ? '#059669' : 'var(--color-text-main)',
                          flexShrink: 0,
                        }}>
                          {formatINR(c.priceRupees)}
                          {c.status === 'SOLD' && (
                            <span style={{ marginLeft: '0.25rem', fontSize: '0.7rem', color: '#059669' }}>sold</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {estimate.comparableCount === 0 && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                      No comparable campus listings found. Estimate based on category benchmarks.
                    </div>
                  )}
                </div>
              )}

              {/* Advisory disclaimer */}
              <div style={{
                borderTop: '1px solid var(--color-border)',
                padding: '0.5rem 1rem',
                fontSize: '0.73rem',
                color: 'var(--color-text-light)',
              }}>
                This estimate is advisory only. You remain in full control of your starting price.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline spinner style */}
      <style>{`
        .advisor-spinner {
          display: inline-block;
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: advisor-spin 0.7s linear infinite;
          margin-right: 0.25rem;
        }
        @keyframes advisor-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

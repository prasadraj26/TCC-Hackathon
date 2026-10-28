import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function CountdownTimer({ endsAt, onExpire, compact = false }) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
    }
    return {
      total: diff,
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      ended: false
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining.ended) {
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endsAt]);

  if (timeLeft.ended) {
    return (
      <div className={`auction-countdown-pill ${compact ? '' : 'ended'}`} style={{ backgroundColor: '#475569' }}>
        <Clock size={compact ? 12 : 16} />
        <span>Auction Ended</span>
      </div>
    );
  }

  const isCritical = timeLeft.total <= 5 * 60 * 1000; // < 5 mins
  const isWarning = timeLeft.total <= 60 * 60 * 1000;  // < 1 hour

  if (compact) {
    const text = timeLeft.days > 0 
      ? `${timeLeft.days}d ${timeLeft.hours}h` 
      : timeLeft.hours > 0 
      ? `${timeLeft.hours}h ${timeLeft.minutes}m` 
      : `${timeLeft.minutes}m ${timeLeft.seconds}s`;

    return (
      <div className={`auction-countdown-pill ${isCritical ? 'critical' : ''}`}>
        <Clock size={12} />
        <span>{text} left</span>
      </div>
    );
  }

  // Full Ticker Box for Detail Page
  return (
    <div className="countdown-ticker-box">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: isCritical ? '#fca5a5' : '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
        <Clock size={16} />
        <span>{isCritical ? 'CLOSING VERY SOON (ANTI-SNIPING ACTIVE)' : 'AUCTION CLOSES IN'}</span>
      </div>
      <div className="countdown-digits">
        {timeLeft.days > 0 && (
          <div className="digit-block">
            <span className="digit-val">{String(timeLeft.days).padStart(2, '0')}</span>
            <span className="digit-lbl">Days</span>
          </div>
        )}
        <div className="digit-block">
          <span className="digit-val">{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="digit-lbl">Hours</span>
        </div>
        <div className="digit-block">
          <span className="digit-val">{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="digit-lbl">Mins</span>
        </div>
        <div className="digit-block">
          <span className="digit-val" style={{ color: isCritical ? '#ef4444' : 'inherit' }}>
            {String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span className="digit-lbl">Secs</span>
        </div>
      </div>
    </div>
  );
}

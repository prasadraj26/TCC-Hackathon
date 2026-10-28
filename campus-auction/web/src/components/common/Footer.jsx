import React from 'react';
import { Link } from 'react-router-dom';
import { Gavel, ShieldCheck, Clock, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Col */}
          <div className="footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{
                background: '#10b981',
                color: 'white',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Gavel size={18} />
              </div>
              <h3 style={{ margin: 0 }}>CampusBid</h3>
            </div>
            <p>
              The transparent campus marketplace. Graduating seniors list their used bicycles, calculators, and books; juniors win at fair market prices through real-time peer auctions.
            </p>
          </div>

          {/* Categories */}
          <div className="footer-col">
            <h4>Popular Categories</h4>
            <ul>
              <li><Link to="/?category=Cycles">Cycles & Commute</Link></li>
              <li><Link to="/?category=Calculators">Calculators (Casio fx)</Link></li>
              <li><Link to="/?category=Books">Engineering Textbooks</Link></li>
              <li><Link to="/?category=Electronics">Electronics & Keyboards</Link></li>
              <li><Link to="/?category=Furniture">Hostel Study Furniture</Link></li>
            </ul>
          </div>

          {/* Fair Rules */}
          <div className="footer-col">
            <h4>Bidding Rules</h4>
            <ul>
              <li><span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={14} color="#10b981" /> 30s Anti-Sniping</span></li>
              <li><span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ShieldCheck size={14} color="#10b981" /> Atomic Concurrency</span></li>
              <li><span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MapPin size={14} color="#10b981" /> In-Person Handover</span></li>
              <li><span>Public Bid Records</span></li>
            </ul>
          </div>

          {/* Hackathon Specs */}
          <div className="footer-col">
            <h4>Bid Now</h4>
            <ul>
              <li><span>Bid</span></li>
              <li><span>Win</span></li>
              <li><span>Receive</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} CampusBid .
          </div>
          <div>
            Safe On-Campus Student Trading
          </div>
        </div>
      </div>
    </footer>
  );
}

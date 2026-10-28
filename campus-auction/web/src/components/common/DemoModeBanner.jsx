import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, UserCheck } from 'lucide-react';

export default function DemoModeBanner() {
  const { isDemoMode, currentUser, demoUsers, switchDemoUser } = useAuth();

  if (!isDemoMode) return null;

  return (
    <div className="demo-mode-banner">
      <div className="container demo-banner-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} color="#059669" />
          <span>
            <strong>Evaluation Demo Mode:</strong> Switch student personas to test bidding, outbid alerts, anti-sniping, and seller approval workflows:
          </span>
        </div>
        <div className="demo-persona-switchers">
          {demoUsers.map((user) => {
            const isActive = currentUser?.uid === user.uid;
            return (
              <button
                key={user.uid}
                className={`persona-btn ${isActive ? 'active' : ''}`}
                onClick={() => switchDemoUser(user)}
                title={`Switch to ${user.displayName} (${user.role})`}
              >
                {isActive && <UserCheck size={12} style={{ display: 'inline', marginRight: '3px' }} />}
                {user.displayName.split(' ')[0]} ({user.role.includes('Seller') ? 'Seller' : 'Buyer'})
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

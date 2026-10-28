import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchAuctions } from '../services/auctionService';
import AuctionCard from '../components/auction/AuctionCard';
import {
  Search,
  Bike,
  BookOpen,
  Calculator,
  Laptop,
  Armchair,
  Package,
  Layers,
  Sparkles,
  Clock,
  Flame,
  ArrowRight
} from 'lucide-react';

const CATEGORIES = [
  { name: 'All', icon: <Layers size={16} /> },
  { name: 'Cycles', icon: <Bike size={16} /> },
  { name: 'Calculators', icon: <Calculator size={16} /> },
  { name: 'Books', icon: <BookOpen size={16} /> },
  { name: 'Electronics', icon: <Laptop size={16} /> },
  { name: 'Furniture', icon: <Armchair size={16} /> },
  { name: 'Other', icon: <Package size={16} /> }
];

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') || 'All';

  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, CLOSING_SOON, FEATURED, RECENT
  const [conditionFilter, setConditionFilter] = useState('All');

  const loadAuctions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuctions({
        category: activeCategory,
        tab: activeTab,
        condition: conditionFilter,
        search: searchQuery
      });
      setAuctions(data);
    } catch (err) {
      console.error('Failed to load auctions:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, activeTab, conditionFilter, searchQuery]);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAuctions();
  };

  const handleCategorySelect = (catName) => {
    if (catName === 'All') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', catName);
    }
    setSearchParams(searchParams);
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-pill-badge">
            <Sparkles size={14} />
            <span>Campus Final Exams Marketplace</span>
          </div>

          <h1 className="hero-title">
            Transparent Campus Auctions for Seniors & Juniors
          </h1>

          <p className="hero-subtitle">
            Graduating seniors pass on cycles, calculators, textbooks, and hostel gear. 
            Juniors bid fairly with real-time timers and anti-sniping protection.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="search-bar-container">
            <div className="search-input-wrapper">
              <Search size={20} color="#94a3b8" style={{ marginRight: '0.6rem' }} />
              <input
                type="text"
                placeholder="Search cycles, Casio calculators, engineering books, monitors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-accent btn-sm">
                Search
              </button>
            </div>
          </form>

          {/* Category Shortcuts */}
          <div className="categories-bar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                className={`category-chip ${activeCategory === cat.name ? 'active' : ''}`}
                onClick={() => handleCategorySelect(cat.name)}
              >
                {cat.icon}
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Listings Section */}
      <section className="container" style={{ paddingTop: '2.5rem' }}>
        <div className="section-header-row">
          {/* Filter Tabs */}
          <div className="tabs-nav" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <button
              className={`tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              All Listings
            </button>
            <button
              className={`tab-btn ${activeTab === 'CLOSING_SOON' ? 'active' : ''}`}
              onClick={() => setActiveTab('CLOSING_SOON')}
            >
              <Clock size={16} color="#d97706" />
              Closing Soon
            </button>
            <button
              className={`tab-btn ${activeTab === 'FEATURED' ? 'active' : ''}`}
              onClick={() => setActiveTab('FEATURED')}
            >
              <Flame size={16} color="#ef4444" />
              Most Active
            </button>
            <button
              className={`tab-btn ${activeTab === 'RECENT' ? 'active' : ''}`}
              onClick={() => setActiveTab('RECENT')}
            >
              Recently Listed
            </button>
          </div>

          {/* Condition Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
              Condition:
            </span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
            >
              <option value="All">All Conditions</option>
              <option value="Like New">Like New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
            </select>
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-light)' }}>
            Loading live campus auctions...
          </div>
        ) : auctions.length > 0 ? (
          <div className="auction-grid" style={{ marginTop: '1.5rem' }}>
            {auctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: '2rem' }}>
            <div className="empty-state-icon">
              <Search size={28} />
            </div>
            <h3>No auctions found</h3>
            <p>
              No listings matched your active filter or search query. Try clearing your search or post the first listing in this category!
            </p>
            <Link to="/create-listing" className="btn btn-accent btn-sm">
              Post an Item for Auction
            </Link>
          </div>
        )}

        {/* Graduating Senior Call to Action */}
        <div className="cta-banner">
          <div className="cta-text">
            <h2>Leaving Campus After Final Exams?</h2>
            <p>
              Don't abandon your bicycle, mini-fridge, or engineering calculators. 
              List them in under 2 minutes. Transparent bidding guarantees fair value without endless WhatsApp messages.
            </p>
          </div>
          <Link to="/create-listing" className="btn btn-accent btn-lg">
            Post an Auction <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}

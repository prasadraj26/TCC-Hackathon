import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchAuctions } from '../services/auctionService';
import {
  fetchSavedSearches,
  createSavedSearch,
  deleteSavedSearch
} from '../services/notificationService';
import AuctionCard from '../components/auction/AuctionCard';
import { formatINR } from '../utils/formatters';
import {
  Gavel,
  Package,
  BookmarkCheck,
  Plus,
  Trash2,
  ExternalLink
} from 'lucide-react';

export default function MyAuctions() {
  const { currentUser, getAuthHeaders } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'listings';

  const [myListings, setMyListings] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  // New saved search form state
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('All');
  const [newMaxRupees, setNewMaxRupees] = useState('');
  const [creatingSearch, setCreatingSearch] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser, currentTab]);

  async function loadData() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (currentTab === 'listings') {
        const listings = await fetchAuctions({ sellerUid: currentUser.uid });
        setMyListings(listings);
      } else if (currentTab === 'bids') {
        // Fetch auctions where user is currently leading or has placed bids
        const bidsAuctions = await fetchAuctions({ bidderUid: currentUser.uid });
        setMyBids(bidsAuctions);
      } else if (currentTab === 'saved') {
        const searches = await fetchSavedSearches(headers);
        setSavedSearches(searches);
      }
    } catch (err) {
      console.error('Failed to load My Auctions:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleTabChange = (tabName) => {
    searchParams.set('tab', tabName);
    setSearchParams(searchParams);
  };

  const handleCreateSearch = async (e) => {
    e.preventDefault();
    setCreatingSearch(true);
    try {
      const headers = await getAuthHeaders();
      await createSavedSearch({
        keyword: newKeyword,
        category: newCategory,
        maxPricePaise: newMaxRupees ? parseFloat(newMaxRupees) * 100 : null
      }, headers);

      setNewKeyword('');
      setNewMaxRupees('');
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingSearch(false);
    }
  };

  const handleDeleteSearch = async (id) => {
    try {
      const headers = await getAuthHeaders();
      await deleteSavedSearch(id, headers);
      setSavedSearches(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!currentUser) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <h2>Sign In to View Your Auctions</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          Track the items you've listed for campus sale and monitors your active bids.
        </p>
        <Link to="/login" className="btn btn-primary">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <div style={{ margin: '1.5rem 0' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>My Campus Auctions</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Manage your listings, approve winning buyers, and track items you've bid on.
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${currentTab === 'listings' ? 'active' : ''}`}
          onClick={() => handleTabChange('listings')}
        >
          <Package size={17} />
          <span>My Listings (Seller)</span>
        </button>
        <button
          className={`tab-btn ${currentTab === 'bids' ? 'active' : ''}`}
          onClick={() => handleTabChange('bids')}
        >
          <Gavel size={17} />
          <span>My Bids (Buyer)</span>
        </button>
        <button
          className={`tab-btn ${currentTab === 'saved' ? 'active' : ''}`}
          onClick={() => handleTabChange('saved')}
        >
          <BookmarkCheck size={17} />
          <span>Saved Searches</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-light)' }}>
          Loading your data...
        </div>
      ) : (
        <>
          {/* TAB 1: MY LISTINGS (SELLER) */}
          {currentTab === 'listings' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Total Listings: {myListings.length}
                </div>
                <Link to="/create-listing" className="btn btn-accent btn-sm">
                  + Create New Listing
                </Link>
              </div>

              {myListings.length > 0 ? (
                <div className="auction-grid">
                  {myListings.map(auction => (
                    <div key={auction.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      <AuctionCard auction={auction} />
                      {/* Seller Action Prompt */}
                      {auction.status === 'ENDED_PENDING_SELLER' && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <Link
                            to={`/auctions/${auction.id}`}
                            className="btn btn-accent btn-sm"
                            style={{ width: '100%' }}
                          >
                            Review & Approve Bid ({formatINR(auction.currentPricePaise)})
                          </Link>
                        </div>
                      )}
                      {auction.status === 'RESERVED' && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <Link
                            to={`/auctions/${auction.id}`}
                            className="btn btn-outline btn-sm"
                            style={{ width: '100%', borderColor: '#10b981', color: '#047857' }}
                          >
                            Ready for Meetup & Handover
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><Package size={28} /></div>
                  <h3>You haven't listed any items yet</h3>
                  <p>Graduating or clearing hostel room? Post an auction in under 2 minutes!</p>
                  <Link to="/create-listing" className="btn btn-accent btn-sm">Post Your First Listing</Link>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY BIDS (BUYER) */}
          {currentTab === 'bids' && (
            <div>
              {myBids.length > 0 ? (
                <div className="auction-grid">
                  {myBids.map(auction => (
                    <div key={auction.id}>
                      <AuctionCard auction={auction} />
                      <div style={{ marginTop: '0.4rem', textAlign: 'center' }}>
                        {auction.currentLeaderUid === currentUser.uid ? (
                          <span className="badge badge-live">You are leading this auction</span>
                        ) : (
                          <span className="badge badge-cancelled">Outbid — Tap to bid again</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><Gavel size={28} /></div>
                  <h3>No active bids</h3>
                  <p>Explore the campus marketplace and bid on bicycles, calculators, and books.</p>
                  <Link to="/" className="btn btn-primary btn-sm">Explore Live Auctions</Link>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SAVED SEARCHES */}
          {currentTab === 'saved' && (
            <div style={{ maxWidth: '720px' }}>
              {/* Create Saved Search Card */}
              <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>Create a Search Alert</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                  Get an in-app and browser alert the moment a graduating senior lists an item matching your criteria.
                </p>

                <form onSubmit={handleCreateSearch}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Keyword (e.g. cycle, Casio)"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                    />
                    <select
                      className="form-select"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      <option value="All">All Categories</option>
                      <option value="Cycles">Cycles</option>
                      <option value="Calculators">Calculators</option>
                      <option value="Books">Books</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Furniture">Furniture</option>
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Max ₹ price"
                      value={newMaxRupees}
                      onChange={(e) => setNewMaxRupees(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-accent btn-sm" disabled={creatingSearch}>
                    <Plus size={15} /> Save Search Alert
                  </button>
                </form>
              </div>

              {/* List of Saved Searches */}
              {savedSearches.length > 0 ? (
                <div>
                  <h4 style={{ marginBottom: '1rem' }}>Active Saved Alerts ({savedSearches.length})</h4>
                  {savedSearches.map(s => (
                    <div
                      key={s.id}
                      className="card"
                      style={{ padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          {s.keyword ? `"${s.keyword}"` : 'Any Item'} in {s.category || 'All Categories'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                          {s.maxPricePaise ? `Max budget: ${formatINR(s.maxPricePaise)}` : 'No budget limit'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Link
                          to={`/?category=${s.category || 'All'}&search=${s.keyword || ''}`}
                          className="btn btn-outline btn-sm"
                        >
                          <ExternalLink size={14} /> View
                        </Link>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          onClick={() => handleDeleteSearch(s.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><BookmarkCheck size={28} /></div>
                  <h3>No saved searches yet</h3>
                  <p>Save searches above to get alerted when seniors post new listings.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

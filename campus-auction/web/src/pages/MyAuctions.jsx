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
  ExternalLink,
  Trophy,
  TrendingUp,
  Clock,
  ShieldCheck,
  MapPin,
  CheckCircle2
} from 'lucide-react';

export default function MyAuctions({ initialTab }) {
  const { currentUser, getAuthHeaders } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || initialTab || 'listings';

  const [myListings, setMyListings] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [myWonItems, setMyWonItems] = useState([]);
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
        setMyListings(listings || []);
      } else if (currentTab === 'bids') {
        const bidsAuctions = await fetchAuctions({ bidderUid: currentUser.uid });
        setMyBids(bidsAuctions || []);
      } else if (currentTab === 'won') {
        const wonAuctions = await fetchAuctions({ winnerUid: currentUser.uid });
        setMyWonItems(wonAuctions || []);
      } else if (currentTab === 'analytics') {
        // Fetch all datasets in parallel for 100% real user metrics
        const [listings, bidsAuctions, wonAuctions] = await Promise.all([
          fetchAuctions({ sellerUid: currentUser.uid }),
          fetchAuctions({ bidderUid: currentUser.uid }),
          fetchAuctions({ winnerUid: currentUser.uid })
        ]);
        setMyListings(listings || []);
        setMyBids(bidsAuctions || []);
        setMyWonItems(wonAuctions || []);
      } else if (currentTab === 'saved') {
        const searches = await fetchSavedSearches(headers);
        setSavedSearches(searches || []);
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
          Track the items you've listed for campus sale, monitor active bids, and view won items.
        </p>
        <Link to="/login" className="btn btn-primary">
          Log In
        </Link>
      </div>
    );
  }

  // Real Analytics Calculations (No placeholder data)
  const totalListings = myListings.length;
  const activeListings = myListings.filter(a => a.status === 'LIVE').length;
  const soldListings = myListings.filter(a => a.status === 'SOLD');
  const reservedListings = myListings.filter(a => a.status === 'RESERVED').length;
  const pendingSellerListings = myListings.filter(a => a.status === 'ENDED_PENDING_SELLER').length;
  const totalRevenuePaise = soldListings.reduce((sum, a) => sum + (a.currentPricePaise || 0), 0);
  const totalBidsReceived = myListings.reduce((sum, a) => sum + (a.bidCount || 0), 0);
  const avgSalePricePaise = soldListings.length > 0 ? Math.round(totalRevenuePaise / soldListings.length) : 0;

  const totalBidsPlaced = myBids.length;
  const currentlyLeading = myBids.filter(a => a.status === 'LIVE' && a.currentLeaderUid === currentUser.uid).length;
  const itemsWonCount = myWonItems.length;
  const completedPurchases = myWonItems.filter(a => a.status === 'SOLD');
  const totalSpentPaise = completedPurchases.reduce((sum, a) => sum + (a.currentPricePaise || 0), 0);

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <div style={{ margin: '1.5rem 0' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>Personal Auction Hub</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Manage your listings, monitor bids, collect won items, and review real marketplace performance.
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs-nav" style={{ flexWrap: 'wrap' }}>
        <button
          className={`tab-btn ${currentTab === 'listings' ? 'active' : ''}`}
          onClick={() => handleTabChange('listings')}
        >
          <Package size={17} />
          <span>My Listings</span>
        </button>
        <button
          className={`tab-btn ${currentTab === 'bids' ? 'active' : ''}`}
          onClick={() => handleTabChange('bids')}
        >
          <Gavel size={17} />
          <span>My Bids</span>
        </button>
        <button
          className={`tab-btn ${currentTab === 'won' ? 'active' : ''}`}
          onClick={() => handleTabChange('won')}
        >
          <Trophy size={17} />
          <span>Won Items</span>
        </button>
        <button
          className={`tab-btn ${currentTab === 'analytics' ? 'active' : ''}`}
          onClick={() => handleTabChange('analytics')}
        >
          <TrendingUp size={17} />
          <span>Auction Analytics</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
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
                  <p>Graduating or clearing your room? Post an auction in under 2 minutes!</p>
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
                        {auction.status === 'LIVE' ? (
                          auction.currentLeaderUid === currentUser.uid ? (
                            <span className="badge badge-live">You are leading this auction</span>
                          ) : (
                            <span className="badge badge-cancelled">Outbid — Tap to bid again</span>
                          )
                        ) : auction.currentLeaderUid === currentUser.uid ? (
                          <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                            ✓ You won this auction
                          </span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
                            Auction Ended
                          </span>
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

          {/* TAB 3: WON ITEMS */}
          {currentTab === 'won' && (
            <div>
              {myWonItems.length > 0 ? (
                <div className="auction-grid">
                  {myWonItems.map(auction => (
                    <div key={auction.id} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div>
                          <span className="badge badge-category" style={{ marginBottom: '0.4rem', display: 'inline-block' }}>
                            {auction.category}
                          </span>
                          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{auction.title}</h3>
                        </div>
                        {auction.status === 'SOLD' ? (
                          <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                            ✓ Handover Complete
                          </span>
                        ) : auction.status === 'RESERVED' ? (
                          <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                            Meetup & Handover Ready
                          </span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                            Seller Reviewing
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-alt, #f8fafc)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>Winning Price</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                            {formatINR(auction.currentPricePaise)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>Seller</div>
                          <div style={{ fontWeight: 600 }}>{auction.sellerName || 'Campus Seller'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                        <MapPin size={14} color="#64748b" />
                        <span>Pickup Location: <strong>{auction.location || 'Campus Central'}</strong></span>
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                        <Link to={`/auctions/${auction.id}`} className="btn btn-outline btn-sm" style={{ width: '100%' }}>
                          View Auction & Pickup Instructions <ExternalLink size={14} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><Trophy size={28} /></div>
                  <h3>No won auctions yet</h3>
                  <p>When you place the winning bid on a campus auction, the item will appear here for handover coordination.</p>
                  <Link to="/" className="btn btn-primary btn-sm">Browse Live Auctions</Link>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUCTION ANALYTICS */}
          {currentTab === 'analytics' && (
            <div style={{ maxWidth: '900px' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>Real Marketplace Performance</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  Live metrics calculated directly from your authenticated listings, bids, and purchase records.
                </p>
              </div>

              {/* Seller Overview Cards */}
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Seller Performance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '0.3rem' }}>Total Revenue</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>{formatINR(totalRevenuePaise)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>From {soldListings.length} completed sales</div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '0.3rem' }}>Active Listings</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-primary)' }}>{activeListings}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>{totalListings} total posted</div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '0.3rem' }}>Total Bids Received</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>{totalBidsReceived}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>Across all your listings</div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '0.3rem' }}>Avg. Sale Price</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4f46e5' }}>{formatINR(avgSalePricePaise)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>Per sold item</div>
                </div>
              </div>

              {/* Buyer Overview Cards */}
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Buyer Performance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '0.3rem' }}>Auctions Bid On</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-primary)' }}>{totalBidsPlaced}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>Total auctions participated</div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '0.3rem' }}>Currently Leading</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{currentlyLeading}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>Active top bids</div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '0.3rem' }}>Auctions Won</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#8b5cf6' }}>{itemsWonCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>{completedPurchases.length} completed purchases</div>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '0.3rem' }}>Total Spent</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f766e' }}>{formatINR(totalSpentPaise)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>On completed handovers</div>
                </div>
              </div>

              {/* Status Distribution Summary */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Listing Status Breakdown</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '130px', padding: '0.75rem', background: '#ecfdf5', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#059669' }}>{activeListings}</div>
                    <div style={{ fontSize: '0.8rem', color: '#047857' }}>Live & Active</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '130px', padding: '0.75rem', background: '#eff6ff', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1d4ed8' }}>{reservedListings}</div>
                    <div style={{ fontSize: '0.8rem', color: '#1e40af' }}>Reserved</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '130px', padding: '0.75rem', background: '#f0fdf4', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#15803d' }}>{soldListings.length}</div>
                    <div style={{ fontSize: '0.8rem', color: '#166534' }}>Completed (Sold)</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '130px', padding: '0.75rem', background: '#fffbeb', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#b45309' }}>{pendingSellerListings}</div>
                    <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Awaiting Approval</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SAVED SEARCHES */}
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
                      <option value="Other">Other</option>
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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createAuction } from '../services/auctionService';
import { uploadImage } from '../services/uploadService';
import { formatINR, toPaise } from '../utils/formatters';
import {
  Upload,
  Clock,
  MapPin,
  X
} from 'lucide-react';

const CATEGORIES = ['Cycles', 'Books', 'Calculators', 'Electronics', 'Furniture', 'Other'];
const CONDITIONS = ['Like New', 'Good', 'Fair', 'New', 'Poor'];

export default function CreateListing() {
  const { currentUser, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Cycles');
  const [condition, setCondition] = useState('Good');
  const [description, setDescription] = useState('');
  const [startingPriceRupees, setStartingPriceRupees] = useState('');
  const [minIncrementRupees, setMinIncrementRupees] = useState('50');
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16));
  const [location, setLocation] = useState('');
  const [images, setImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const imageUrl = await uploadImage(file, headers);
      setImages(prev => [...prev, imageUrl]);
    } catch (err) {
      setError(err.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setError('');
    const startingRupees = parseFloat(startingPriceRupees);
    const incrementRupees = parseFloat(minIncrementRupees);

    if (isNaN(startingRupees) || startingRupees <= 0) {
      setError('Please provide a valid starting price.');
      return;
    }

    if (isNaN(incrementRupees) || incrementRupees <= 0) {
      setError('Please provide a valid minimum bid increment.');
      return;
    }

    if (new Date(endsAt).getTime() <= Date.now()) {
      setError('Closing date and time must be in the future.');
      return;
    }

    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const newAuction = await createAuction({
        title,
        category,
        condition,
        description,
        images: images,
        startingPricePaise: toPaise(startingRupees),
        minIncrementPaise: toPaise(incrementRupees),
        endsAt: new Date(endsAt).toISOString(),
        location
      }, headers);

      navigate(`/auctions/${newAuction.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '960px', margin: '1.5rem auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>List an Item for Campus Auction</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          Final day of exams? Sell your used items transparently to campus juniors with automated countdowns.
        </p>

        {error && <div className="alert-box alert-danger">{error}</div>}

        <div className="create-listing-grid">
          {/* Form Card */}
          <form onSubmit={handleSubmit} className="form-card">
            <div className="form-group">
              <label className="form-label">Item Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Hero Sprint Pro 21-Speed Mountain Bike"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Condition *</label>
                <select
                  className="form-select"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  required
                >
                  {CONDITIONS.map(cond => <option key={cond} value={cond}>{cond}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Starting Price (INR) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', fontWeight: 700, color: '#64748b' }}>₹</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ paddingLeft: '28px' }}
                    placeholder="e.g. 1500"
                    value={startingPriceRupees}
                    onChange={(e) => setStartingPriceRupees(e.target.value)}
                    min="1"
                    step="1"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Min Increment (INR) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', fontWeight: 700, color: '#64748b' }}>₹</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ paddingLeft: '28px' }}
                    placeholder="e.g. 50"
                    value={minIncrementRupees}
                    onChange={(e) => setMinIncrementRupees(e.target.value)}
                    min="5"
                    step="5"
                    required
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Closing Date & Time *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                />
                <span className="form-hint">Server will enforce anti-sniping extension</span>
              </div>

              <div className="form-group">
                <label className="form-label">Hostel Pickup Spot *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Hostel 4 Common Room"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows="4"
                placeholder="Describe accessories, exact condition, usage history, included chargers/locks..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Photos Upload & Preview */}
            <div className="form-group">
              <div style={{ marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Item Photos (Optional)</label>
              </div>

              <label className="photo-uploader">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageFileChange}
                  disabled={uploadingImage}
                />
                <Upload size={28} color="#64748b" style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {uploadingImage ? 'Uploading via Cloudinary...' : 'Click or drop photos to upload'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: '0.25rem' }}>
                  Cloudinary signed upload flow or instant local preview
                </div>
              </label>

              {images.length > 0 && (
                <div className="image-preview-strip">
                  {images.map((img, i) => (
                    <div key={i} className="preview-thumb">
                      <img src={img} alt={`preview-${i}`} />
                      <button
                        type="button"
                        className="preview-thumb-remove"
                        onClick={() => handleRemoveImage(i)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-accent btn-lg"
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={submitting || uploadingImage}
            >
              {submitting ? 'Publishing Auction...' : 'Publish Campus Auction'}
            </button>
          </form>

          {/* Right Column: Live Card Preview */}
          <div>
            <div style={{ position: 'sticky', top: 'calc(var(--header-height) + 1.5rem)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '0.75rem' }}>
                Live Marketplace Preview
              </div>
              <div className="card auction-card" style={{ maxWidth: '340px' }}>
                <div className="auction-card-media">
                  {images[0] ? (
                    <img
                      src={images[0]}
                      alt="Preview"
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '200px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--color-bg-alt, #f8fafc)',
                      color: 'var(--color-text-light, #94a3b8)',
                      gap: '0.5rem'
                    }}>
                      <Upload size={28} opacity={0.5} />
                      <span style={{ fontSize: '0.8rem' }}>Upload photo to preview</span>
                    </div>
                  )}
                  <div className="auction-card-badges">
                    <span className="badge badge-category">{category}</span>
                    <span className="badge badge-condition">{condition}</span>
                  </div>
                  <div className="auction-countdown-pill">
                    <Clock size={12} />
                    <span>Countdown Starts on Publish</span>
                  </div>
                </div>

                <div className="auction-card-content">
                  <h3 className="auction-card-title">
                    {title || 'Your Item Title Will Appear Here'}
                  </h3>
                  <div className="auction-card-location">
                    <MapPin size={13} />
                    <span>{location || 'Campus Hostel'}</span>
                  </div>
                  <div className="auction-card-footer">
                    <div>
                      <div className="price-subtext">Starting Price</div>
                      <div className="current-price-val">
                        {startingPriceRupees ? formatINR(toPaise(parseFloat(startingPriceRupees))) : '₹0'}
                      </div>
                    </div>
                    <div className="bid-count-badge">
                      <span>Min +₹{minIncrementRupees || 50}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

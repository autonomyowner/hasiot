import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import ImageCarousel from "../components/ImageCarousel";
import Navbar from "../components/Navbar";
import "./ListingDetailPage.css";

const AMENITIES = [
  { icon: "pool", label: "Swimming Pool" },
  { icon: "wifi", label: "Free WiFi" },
  { icon: "local_parking", label: "Free Parking" },
  { icon: "restaurant", label: "Restaurant" },
  { icon: "ac_unit", label: "Air Conditioning" },
  { icon: "directions_car", label: "Airport Transfer" },
];

const AIDA_CAROUSEL = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCxMYFVCmhwmNLaE7gi0aqViFuGsWlf4fN4Ii7210y3jAiltY-R_QecYHXOQe8YpMiuoNVbNBGi-XOkoQYBkrsQPqVGC3sBm9fQIc6kzEiD9fm1eslDbqf3SpUzg05JzLIByguKv4Cee3CcmYvcw2I_IraE8OkmR7rLN62KPYiQ_6wZMiM4Sc0qLatbRoUnGUyh7cRkxIEi28c3d1h0XnicKiBR7z15xpZL9G3lYVSQisXiLjXCvq6XOldD8_E0h_bilvXQagbFRIXJ',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDv6K-vD39HypBO9ow7Y72JPaovtZFDzYQ_O2KZBOPFwPQwrm09SiOM1EErnaT72HnOZWsgpsD97nPl6L9v35lleCg4VV2ao3UzL2UTeEsCwGHruEvcAqbnNKi0XyMXxP1P8qZjiF9dQ6N28HPmQCBCvhjcePC9-Kbkr4rEWEAjsN1Qvo2ZY2lERg5cu6iNhfdecsU6cjWTL2EFKuRJ8XU-xbUyRjJADWeidKKVLC0iuFQ6NRMGFhCaaCkxXQSVrwY7AGlR3wNf0QXT',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDVljfa0f2pS99l9rQwVCrsJKqYJUWIUTa6UOlIGoWUJjEk_JGKTU792dsUMnlZf5TpsZL91nauwHqB9JjCSViKUsaeiit6JPv0B06ZdcKH_MbcLjkEb6r2qw3YC6rWV3q02BCB2Jvsy64L2BSPKJr36ttXMhpLzK7iMayDRWq-NeFlzKrlrTsErs66va5c5n_PuUyxWAF5eFz75F5o2zhz8lsUwoHols8xWy5URp6g0pB7N3uK-WMNewWzMV4gHv4UXVKlw0iG8DHr',
];

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [guests, setGuests] = useState(2);
  const [showBooking, setShowBooking] = useState(false);

  // Use the single-item getListing query for efficiency
  const listing = useQuery(
    api.listings.queries.getListing,
    id ? { listingId: id } : "skip"
  );

  // Load similar listings (same type) — only when we have the listing type
  const similar = useQuery(
    api.listings.queries.listListings,
    listing ? { type: listing.type, limit: 6 } : "skip"
  );

  const similarFiltered = similar
    ?.filter((l) => l._id !== id)
    .slice(0, 3) ?? [];

  // Scroll to top when the ID changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // loading — getListing returns undefined while in-flight, null when not found
  if (listing === undefined) {
    return (
      <div className="detail-page">
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "80px 32px",
            textAlign: "center",
            color: "var(--color-text-muted)",
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="detail-page">
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "80px 32px",
            textAlign: "center",
          }}
        >
          <h2 style={{ marginBottom: 16 }}>Listing not found</h2>
          <Link to="/listings" style={{ color: "var(--color-primary)" }}>
            ← Back to listings
          </Link>
        </div>
      </div>
    );
  }

  const price = listing.price ?? listing.priceRange ?? null;
  const nights = 3;
  const serviceFee = price ? Math.round(price * 0.1) : 0;
  const total = price ? price * nights + serviceFee : 0;

  return (
    <div className="detail-page">
      <Navbar />
      {/* Breadcrumb */}
      <nav className="detail-breadcrumb">
        <Link to="/home">Home</Link>
        <span>›</span>
        <Link to="/listings">Listings</Link>
        <span>›</span>
        <span>{listing.name}</span>
      </nav>

      {/* Hero carousel */}
      <div className="detail-hero">
        <div className="detail-hero-carousel">
          <ImageCarousel
            images={listing.images?.length > 0 ? listing.images : AIDA_CAROUSEL}
            height="100%"
            borderRadius="0"
          />
        </div>
      </div>

      {/* Main layout */}
      <div className="detail-layout">
        {/* Left column */}
        <div className="detail-left">
          {/* Title row */}
          <div className="detail-title-row detail-section">
            <h1>{listing.name}</h1>
            <div className="detail-meta">
              <span className="detail-type-badge">{listing.type}</span>
              {listing.city && <span><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>location_on</span> {listing.city}</span>}
              <span className="detail-rating"><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', color: '#D4AF37', fontVariationSettings: "'FILL' 1" }}>star</span> 4.8 · 32 reviews</span>
              <span className="detail-badge">Verified</span>
            </div>
          </div>

          {/* About */}
          <div className="detail-section">
            <h2>About this place</h2>
            <p className="detail-description">
              {listing.description ||
                "Experience the best of Al-Ahsa with this carefully curated listing."}
            </p>
          </div>

          {/* Amenities */}
          <div className="detail-section">
            <h2>Amenities</h2>
            <div className="amenities-grid">
              {AMENITIES.map((a, i) => (
                <div key={i} className="amenity-item">
                  <span className="material-symbols-outlined amenity-icon">{a.icon}</span>
                  <span>{a.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="detail-section">
            <h2>Location</h2>
            <div className="location-map-placeholder">
              🗺️ {listing.city || "Al-Ahsa"}, Eastern Province, Saudi Arabia
            </div>
          </div>
        </div>

        {/* Booking widget */}
        <aside>
          <div className="booking-widget">
            {price ? (
              <>
                <div className="booking-widget-price">
                  SAR {price} <span>/ night</span>
                </div>
                <div className="booking-widget-rating"><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', color: '#D4AF37', fontVariationSettings: "'FILL' 1" }}>star</span> 4.8 · 32 reviews</div>
              </>
            ) : (
              <div className="booking-widget-price">Contact for pricing</div>
            )}

            <select
              className="booking-guests"
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} guest{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>

            <button
              className="book-now-btn"
              onClick={() => setShowBooking(!showBooking)}
            >
              {showBooking ? "Hide Booking Form" : "Book Now"}
            </button>

            {price && (
              <div className="booking-breakdown">
                <div className="breakdown-row">
                  <span>
                    SAR {price} × {nights} nights
                  </span>
                  <span>SAR {price * nights}</span>
                </div>
                <div className="breakdown-row">
                  <span>Service fee</span>
                  <span>SAR {serviceFee}</span>
                </div>
                <div className="breakdown-row total">
                  <span>Total</span>
                  <span>SAR {total}</span>
                </div>
              </div>
            )}

            {showBooking && (
              <div className="booking-form-wrapper">
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                    padding: "16px 0",
                  }}
                >
                  Booking form available after sign-in.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Similar listings */}
      {similarFiltered.length > 0 && (
        <section className="similar-section">
          <h2>Similar Places</h2>
          <div className="similar-grid">
            {similarFiltered.map((s) => (
              <div
                key={s._id}
                className="similar-card"
                onClick={() => navigate(`/listings/${s._id}`)}
              >
                <div className="similar-card-img">
                  <img
                    src={s.images?.[0] || AIDA_CAROUSEL[0]}
                    alt={s.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div className="similar-card-body">
                  <h4>{s.name}</h4>
                  <p>
                    <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: 'middle' }}>location_on</span> {s.city}
                    {s.price ? ` · SAR ${s.price}/night` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="detail-footer-spacer" />
    </div>
  );
}

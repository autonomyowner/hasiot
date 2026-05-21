import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import ImageCarousel from "../components/ImageCarousel";
import Navbar from "../components/Navbar";
import SaveToTripModal from "../components/trips/SaveToTripModal";
import { useCurrentUser } from "../hooks/useCurrentUser";
import "./ListingDetailPage.css";

const AMENITY_MAP = {
  wifi:             { icon: "wifi",                  en: "Free WiFi",        ar: "واي فاي مجاني" },
  parking:          { icon: "local_parking",          en: "Free Parking",     ar: "مواقف مجانية" },
  pool:             { icon: "pool",                   en: "Swimming Pool",    ar: "مسبح" },
  restaurant:       { icon: "restaurant",             en: "Restaurant",       ar: "مطعم" },
  ac:               { icon: "ac_unit",                en: "Air Conditioning", ar: "تكييف هواء" },
  airport_transfer: { icon: "directions_car",         en: "Airport Transfer", ar: "نقل من المطار" },
  breakfast:        { icon: "free_breakfast",         en: "Breakfast",        ar: "إفطار مجاني" },
  gym:              { icon: "fitness_center",         en: "Gym",              ar: "صالة رياضية" },
  spa:              { icon: "spa",                    en: "Spa",              ar: "سبا" },
  laundry:          { icon: "local_laundry_service",  en: "Laundry",          ar: "خدمة غسيل" },
  room_service:     { icon: "room_service",           en: "Room Service",     ar: "خدمة الغرف" },
  pet_friendly:     { icon: "pets",                   en: "Pet Friendly",     ar: "مناسب للحيوانات" },
};

const AIDA_CAROUSEL = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCxMYFVCmhwmNLaE7gi0aqViFuGsWlf4fN4Ii7210y3jAiltY-R_QecYHXOQe8YpMiuoNVbNBGi-XOkoQYBkrsQPqVGC3sBm9fQIc6kzEiD9fm1eslDbqf3SpUzg05JzLIByguKv4Cee3CcmYvcw2I_IraE8OkmR7rLN62KPYiQ_6wZMiM4Sc0qLatbRoUnGUyh7cRkxIEi28c3d1h0XnicKiBR7z15xpZL9G3lYVSQisXiLjXCvq6XOldD8_E0h_bilvXQagbFRIXJ",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDv6K-vD39HypBO9ow7Y72JPaovtZFDzYQ_O2KZBOPFwPQwrm09SiOM1EErnaT72HnOZWsgpsD97nPl6L9v35lleCg4VV2ao3UzL2UTeEsCwGHruEvcAqbnNKi0XyMXxP1P8qZjiF9dQ6N28HPmQCBCvhjcePC9-Kbkr4rEWEAjsN1Qvo2ZY2lERg5cu6iNhfdecsU6cjWTL2EFKuRJ8XU-xbUyRjJADWeidKKVLC0iuFQ6NRMGFhCaaCkxXQSVrwY7AGlR3wNf0QXT",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDVljfa0f2pS99l9rQwVCrsJKqYJUWIUTa6UOlIGoWUJjEk_JGKTU792dsUMnlZf5TpsZL91nauwHqB9JjCSViKUsaeiit6JPv0B06ZdcKH_MbcLjkEb6r2qw3YC6rWV3q02BCB2Jvsy64L2BSPKJr36ttXMhpLzK7iMayDRWq-NeFlzKrlrTsErs66va5c5n_PuUyxWAF5eFz75F5o2zhz8lsUwoHols8xWy5URp6g0pB7N3uK-WMNewWzMV4gHv4UXVKlw0iG8DHr",
];

const translations = {
  ar: {
    home: "الرئيسية",
    listings: "الوجهات",
    about: "عن هذا المكان",
    amenities: "المرافق",
    location: "الموقع",
    reviews: "التقييمات",
    similar: "أماكن مشابهة",
    noReviews: "لا توجد تقييمات بعد",
    bookNow: "احجز الآن",
    signInToBook: "تسجيل الدخول للحجز",
    bookingSuccess: "تم الحجز بنجاح!",
    bookingSuccessSub: "سنؤكد حجزك قريباً.",
    date: "التاريخ",
    time: "الوقت",
    guests: "الضيوف",
    notes: "ملاحظات (اختياري)",
    notesPlaceholder: "أضف أي طلبات خاصة...",
    priceRange: "نطاق السعر",
    saveToTrip: "حفظ في رحلة",
    verified: "معتمد",
    reviewsCount: (n) => `${n} تقييم`,
    contact: "معلومات التواصل",
    langSwitch: "EN",
    viewOnMap: "عرض على الخريطة الكاملة",
    bookTypes: {
      hotel: "احجز إقامة",
      restaurant: "احجز طاولة",
      attraction: "احجز زيارة",
      tour: "احجز جولة",
      event: "احصل على تذكرة",
    },
    anonymous: "مجهول",
    guestSingular: "ضيف",
    guestPlural: "ضيوف",
  },
  en: {
    home: "Home",
    listings: "Listings",
    about: "About this place",
    amenities: "Amenities",
    location: "Location",
    reviews: "Reviews",
    similar: "Similar Places",
    noReviews: "No reviews yet",
    bookNow: "Book Now",
    signInToBook: "Sign in to Book",
    bookingSuccess: "Booking confirmed!",
    bookingSuccessSub: "We'll confirm your booking shortly.",
    date: "Date",
    time: "Time",
    guests: "Guests",
    notes: "Notes (optional)",
    notesPlaceholder: "Add any special requests...",
    priceRange: "Price Range",
    saveToTrip: "Save to Trip",
    verified: "Verified",
    reviewsCount: (n) => `${n} review${n !== 1 ? "s" : ""}`,
    contact: "Contact",
    langSwitch: "عربي",
    viewOnMap: "View on full map",
    bookTypes: {
      hotel: "Book Stay",
      restaurant: "Reserve Table",
      attraction: "Book Visit",
      tour: "Book Tour",
      event: "Get Ticket",
    },
    anonymous: "Anonymous",
    guestSingular: "guest",
    guestPlural: "guests",
  },
};

const BOOKING_TYPE_MAP = {
  hotel: "reservation",
  restaurant: "reservation",
  attraction: "tour_booking",
  tour: "tour_booking",
  event: "event_ticket",
};

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lang, setLang] = useState(() => localStorage.getItem("hasio_lang") || "ar");
  const isRtl = lang === "ar";
  const t = translations[lang];

  const [guests, setGuests] = useState(2);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("09:00");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);

  const { isAuthenticated } = useCurrentUser();

  const listing = useQuery(api.listings.queries.getListing, id ? { listingId: id } : "skip");
  const similar = useQuery(
    api.listings.queries.listListings,
    listing ? { type: listing.type, limit: 6 } : "skip"
  );
  const reviews = useQuery(
    api.listings.queries.getListingReviews,
    id ? { listingId: id, limit: 8 } : "skip"
  );
  const isFav = useQuery(
    api.users.queries.isFavorite,
    isAuthenticated && id ? { listingId: id } : "skip"
  );
  const toggleFav = useMutation(api.users.mutations.toggleFavorite);
  const createBooking = useMutation(api.bookings.mutations.createBooking);

  const similarFiltered = similar?.filter((l) => l._id !== id).slice(0, 3) ?? [];

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  const toggleLang = () => {
    const next = lang === "ar" ? "en" : "ar";
    setLang(next);
    localStorage.setItem("hasio_lang", next);
  };

  const handleToggleFav = async () => {
    if (!isAuthenticated) { navigate("/sign-in"); return; }
    try { await toggleFav({ listingId: id }); } catch (_) {}
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!bookingDate) {
      setBookingError(lang === "ar" ? "اختر تاريخاً" : "Please select a date");
      return;
    }
    setBookingLoading(true);
    setBookingError("");
    try {
      await createBooking({
        listingId: id,
        date: bookingDate,
        time: bookingTime,
        type: BOOKING_TYPE_MAP[listing.type] || "reservation",
        partySize: guests,
        notes: bookingNotes || undefined,
      });
      setBookingSuccess(true);
    } catch (err) {
      setBookingError(err.message || (lang === "ar" ? "حدث خطأ، حاول مجدداً" : "Something went wrong. Please try again."));
    } finally {
      setBookingLoading(false);
    }
  };

  if (listing === undefined) {
    return (
      <div className="detail-page">
        <div className="detail-loading">Loading…</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="detail-page">
        <div className="detail-not-found">
          <h2>Listing not found</h2>
          <Link to="/listings" style={{ color: "var(--color-primary)" }}>← Back to listings</Link>
        </div>
      </div>
    );
  }

  const name = lang === "ar" ? (listing.name_ar || listing.name_en) : listing.name_en;
  const description = lang === "ar" ? (listing.description_ar || listing.description_en) : listing.description_en;
  const rating = listing.rating || 0;
  const reviewCount = listing.reviewCount || 0;
  const amenities = listing.amenities || [];
  const bookBtnLabel = (t.bookTypes)[listing.type] || t.bookNow;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div
      className="detail-page"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Cairo', sans-serif" : "'Outfit', sans-serif" }}
    >
      <Navbar lang={lang} onLangToggle={toggleLang} />

      {/* Breadcrumb */}
      <nav className="detail-breadcrumb">
        <Link to="/">{t.home}</Link>
        <span>›</span>
        <Link to="/listings">{t.listings}</Link>
        <span>›</span>
        <span>{name}</span>
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
            <div className="detail-title-top">
              <h1>{name}</h1>
              <div className="detail-title-actions">
                <button
                  className={`detail-fav-btn${isFav ? " active" : ""}`}
                  onClick={handleToggleFav}
                  aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    favorite
                  </span>
                </button>
                {isAuthenticated && (
                  <button className="detail-trip-btn" onClick={() => setShowTripModal(true)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bookmark_add</span>
                    {t.saveToTrip}
                  </button>
                )}
              </div>
            </div>
            <div className="detail-meta">
              <span className="detail-type-badge">{listing.type}</span>
              {listing.city && (
                <span>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>location_on</span>{" "}
                  {listing.city}
                </span>
              )}
              {rating > 0 && (
                <span className="detail-rating">
                  <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", color: "#D4AF37", fontVariationSettings: "'FILL' 1" }}>star</span>
                  {rating.toFixed(1)} · {t.reviewsCount(reviewCount)}
                </span>
              )}
              {listing.isVerified && <span className="detail-badge">{t.verified}</span>}
            </div>
          </div>

          {/* About */}
          <div className="detail-section">
            <h2>{t.about}</h2>
            <p className="detail-description">
              {description || (lang === "ar"
                ? "اكتشف أجمل ما تقدمه الأحساء مع هذا الخيار المميز."
                : "Experience the best of Al-Ahsa with this carefully curated listing.")}
            </p>
          </div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <div className="detail-section">
              <h2>{t.amenities}</h2>
              <div className="amenities-grid">
                {amenities.map((key, i) => {
                  const a = AMENITY_MAP[key];
                  return (
                    <div key={i} className="amenity-item">
                      <span className="material-symbols-outlined amenity-icon">
                        {a ? a.icon : "check_circle"}
                      </span>
                      <span>{a ? (lang === "ar" ? a.ar : a.en) : key}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Location map */}
          <div className="detail-section">
            <h2>{t.location}</h2>
            <p className="detail-address">
              <span className="material-symbols-outlined" style={{ fontSize: 15, verticalAlign: "middle" }}>location_on</span>{" "}
              {listing.address}, {listing.city}
            </p>
            <div className="listing-map">
              <iframe
                title="listing-location"
                width="100%"
                height="300"
                frameBorder="0"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.coordinates.lng - 0.015},${listing.coordinates.lat - 0.015},${listing.coordinates.lng + 0.015},${listing.coordinates.lat + 0.015}&layer=mapnik&marker=${listing.coordinates.lat},${listing.coordinates.lng}`}
              />
            </div>
            <a
              href={`https://www.openstreetmap.org/?mlat=${listing.coordinates.lat}&mlon=${listing.coordinates.lng}#map=16/${listing.coordinates.lat}/${listing.coordinates.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-map-link"
            >
              {t.viewOnMap}{" "}
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>open_in_new</span>
            </a>
          </div>

          {/* Contact info */}
          {(listing.phone || listing.email || listing.website) && (
            <div className="detail-section">
              <h2>{t.contact}</h2>
              <div className="contact-info">
                {listing.phone && (
                  <a href={`tel:${listing.phone}`} className="contact-row">
                    <span className="material-symbols-outlined">phone</span>
                    <span>{listing.phone}</span>
                  </a>
                )}
                {listing.email && (
                  <a href={`mailto:${listing.email}`} className="contact-row">
                    <span className="material-symbols-outlined">email</span>
                    <span>{listing.email}</span>
                  </a>
                )}
                {listing.website && (
                  <a href={listing.website} target="_blank" rel="noopener noreferrer" className="contact-row">
                    <span className="material-symbols-outlined">language</span>
                    <span>{listing.website}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="detail-section">
            <h2>
              {t.reviews}
              {reviewCount > 0 && (
                <span className="reviews-count-badge">{reviewCount}</span>
              )}
            </h2>
            {reviews === undefined ? (
              <p className="detail-description">Loading…</p>
            ) : reviews.length === 0 ? (
              <p className="detail-description">{t.noReviews}</p>
            ) : (
              <div className="reviews-list">
                {reviews.map((r) => {
                  const initials = r.isAnonymous
                    ? "?"
                    : ((r.user?.firstName?.[0] || "") + (r.user?.lastName?.[0] || "")) || "?";
                  const authorName = r.isAnonymous
                    ? t.anonymous
                    : r.user
                      ? `${r.user.firstName || ""} ${r.user.lastName || ""}`.trim() || "User"
                      : "User";
                  return (
                    <div key={r._id} className="review-card">
                      <div className="review-header">
                        <div className="review-avatar">{initials.toUpperCase()}</div>
                        <div>
                          <div className="review-author">{authorName}</div>
                          <div className="review-stars">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span
                                key={s}
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: 14,
                                  color: s <= r.rating ? "#D4AF37" : "#DDD",
                                  fontVariationSettings: s <= r.rating ? "'FILL' 1" : "'FILL' 0",
                                }}
                              >
                                star
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {r.content && <p className="review-content">{r.content}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Booking widget */}
        <aside>
          <div className="booking-widget">
            {listing.priceRange && (
              <div className="booking-widget-price">
                {listing.priceRange}
                <span className="booking-price-label">{" "}{t.priceRange}</span>
              </div>
            )}
            {rating > 0 && (
              <div className="booking-widget-rating">
                <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", color: "#D4AF37", fontVariationSettings: "'FILL' 1" }}>star</span>
                {rating.toFixed(1)} · {t.reviewsCount(reviewCount)}
              </div>
            )}

            <div className="booking-widget-divider" />

            {!isAuthenticated ? (
              <Link to="/sign-in" className="book-now-btn" style={{ textDecoration: "none", textAlign: "center", display: "block" }}>
                {t.signInToBook}
              </Link>
            ) : bookingSuccess ? (
              <div className="booking-success">
                <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--color-primary)" }}>check_circle</span>
                <p className="booking-success-title">{t.bookingSuccess}</p>
                <p className="booking-success-sub">{t.bookingSuccessSub}</p>
              </div>
            ) : (
              <form onSubmit={handleBook} className="booking-form">
                <label className="booking-label">
                  <span>{t.date}</span>
                  <input
                    type="date"
                    className="booking-input"
                    value={bookingDate}
                    min={today}
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                  />
                </label>
                <label className="booking-label">
                  <span>{t.time}</span>
                  <input
                    type="time"
                    className="booking-input"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                  />
                </label>
                <label className="booking-label">
                  <span>{t.guests}</span>
                  <select
                    className="booking-input"
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? t.guestSingular : t.guestPlural}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="booking-label">
                  <span>{t.notes}</span>
                  <textarea
                    className="booking-input booking-textarea"
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder={t.notesPlaceholder}
                    rows={2}
                  />
                </label>
                {bookingError && <p className="booking-error">{bookingError}</p>}
                <button type="submit" className="book-now-btn" disabled={bookingLoading}>
                  {bookingLoading ? "…" : bookBtnLabel}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>

      {/* Similar listings */}
      {similarFiltered.length > 0 && (
        <section className="similar-section">
          <h2>{t.similar}</h2>
          <div className="similar-grid">
            {similarFiltered.map((s) => {
              const sName = lang === "ar" ? (s.name_ar || s.name_en) : s.name_en;
              return (
                <div
                  key={s._id}
                  className="similar-card"
                  onClick={() => navigate(`/listings/${s._id}`)}
                >
                  <div className="similar-card-img">
                    <img
                      src={s.images?.[0] || AIDA_CAROUSEL[0]}
                      alt={sName}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div className="similar-card-body">
                    <h4>{sName}</h4>
                    <p>
                      <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: "middle" }}>location_on</span>{" "}
                      {s.city}
                      {s.priceRange ? ` · ${s.priceRange}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="detail-footer-spacer" />

      <SaveToTripModal
        listingId={id}
        listingName={name}
        lang={lang}
        isOpen={showTripModal}
        onClose={() => setShowTripModal(false)}
      />
    </div>
  );
}

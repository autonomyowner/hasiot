import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import ChatWidget from './components/chat/ChatWidget'
import SaveToTripModal from './components/trips/SaveToTripModal'

// Translations for the map page
const mapTranslations = {
  ar: {
    title: 'استكشف السعودية',
    backHome: 'الرئيسية',
    searchPlaceholder: 'ابحث عن فندق، مطعم، أو معلم...',
    addNew: 'إضافة موقع جديد',
    filters: {
      all: 'الكل',
      hotels: 'الفنادق',
      restaurants: 'المطاعم',
      attractions: 'المعالم'
    },
    form: {
      title: 'إضافة موقع جديد',
      type: 'النوع',
      hotel: 'فندق',
      restaurant: 'مطعم',
      attraction: 'معلم سياحي',
      name: 'الاسم',
      namePlaceholder: 'اسم الفندق، المطعم أو المعلم',
      category: 'التصنيف',
      categoryPlaceholder: 'مثال: فاخر، مأكولات شعبية، تاريخي...',
      address: 'العنوان',
      addressPlaceholder: 'العنوان الكامل',
      searchLocation: 'البحث عن موقع',
      searchPlaceholder: 'ابحث عن عنوان أو مكان...',
      city: 'المدينة',
      cityPlaceholder: 'مثال: الرياض',
      phone: 'الهاتف',
      phonePlaceholder: '05XX XXX XXXX',
      hours: 'ساعات العمل',
      hoursPlaceholder: '08:00 - 22:00',
      clickMap: 'تحديد الموقع على الخريطة',
      selectOnMap: 'انقر على الخريطة',
      orSearchAbove: 'أو ابحث عن موقع أعلاه',
      selectedLocation: 'الموقع المحدد',
      searching: 'جاري البحث...',
      noResults: 'لا توجد نتائج',
      selectingMode: 'انقر على الخريطة لتحديد الموقع...',
      cancelSelection: 'إلغاء التحديد',
      submit: 'إضافة',
      cancel: 'إلغاء'
    },
    popup: {
      category: 'التصنيف',
      address: 'العنوان',
      phone: 'الهاتف',
      hours: 'ساعات العمل',
      getDirections: 'الاتجاهات',
      book: 'احجز الآن',
      saveToTrip: 'حفظ في رحلة'
    },
    stats: {
      total: 'إجمالي المواقع',
      hotels: 'فندق',
      restaurants: 'مطعم',
      attractions: 'معلم'
    }
  },
  en: {
    title: 'Explore Saudi Arabia',
    backHome: 'Home',
    searchPlaceholder: 'Search for a hotel, restaurant, or attraction...',
    addNew: 'Add New Location',
    filters: {
      all: 'All',
      hotels: 'Hotels',
      restaurants: 'Restaurants',
      attractions: 'Attractions'
    },
    form: {
      title: 'Add New Location',
      type: 'Type',
      hotel: 'Hotel',
      restaurant: 'Restaurant',
      attraction: 'Attraction',
      name: 'Name',
      namePlaceholder: 'Hotel, restaurant or attraction name',
      category: 'Category',
      categoryPlaceholder: 'e.g. Luxury, Street Food, Historical...',
      address: 'Address',
      addressPlaceholder: 'Full address',
      searchLocation: 'Search Location',
      searchPlaceholder: 'Search for an address or place...',
      city: 'City',
      cityPlaceholder: 'e.g. Riyadh',
      phone: 'Phone',
      phonePlaceholder: '05XX XXX XXXX',
      hours: 'Working Hours',
      hoursPlaceholder: '08:00 - 22:00',
      clickMap: 'Select location on map',
      selectOnMap: 'Click on map',
      orSearchAbove: 'or search for a location above',
      selectedLocation: 'Selected location',
      searching: 'Searching...',
      noResults: 'No results found',
      selectingMode: 'Click on the map to select location...',
      cancelSelection: 'Cancel selection',
      submit: 'Add',
      cancel: 'Cancel'
    },
    popup: {
      category: 'Category',
      address: 'Address',
      phone: 'Phone',
      hours: 'Hours',
      getDirections: 'Directions',
      book: 'Book Now',
      saveToTrip: 'Save to Trip'
    },
    stats: {
      total: 'Total Locations',
      hotels: 'Hotels',
      restaurants: 'Restaurants',
      attractions: 'Attractions'
    }
  }
}

// Transform Convex listing data to map format
const transformListingToLocation = (listing) => ({
  id: listing._id,
  type: listing.type,
  name: listing.name_en,
  nameAr: listing.name_ar,
  category: listing.category,
  categoryAr: listing.category_ar || listing.category,
  address: listing.address,
  addressAr: listing.address,
  phone: listing.phone || '',
  hours: listing.workingHours ? formatWorkingHours(listing.workingHours) : '',
  coordinates: [listing.coordinates.lng, listing.coordinates.lat] // Mapbox uses [lng, lat]
})

const formatWorkingHours = (hours) => {
  if (!hours || hours.length === 0) return ''
  const firstDay = hours.find(h => !h.isClosed)
  return firstDay ? `${firstDay.open} - ${firstDay.close}` : ''
}

function MapPage() {
  const [lang, setLang] = useState('ar')

  // Fetch public config (Mapbox token)
  const config = useQuery(api.config.queries.getPublicConfig, {})

  // Fetch listings from Convex
  const listingsFromDb = useQuery(api.listings.queries.listListings, {})
  const createListing = useMutation(api.listings.mutations.createListing)

  // Transform to map format
  const locations = listingsFromDb ? listingsFromDb.map(transformListingToLocation) : []
  const isLoading = listingsFromDb === undefined
  const [filter, setFilter] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [newLocation, setNewLocation] = useState({
    type: 'hotel',
    name: '',
    nameAr: '',
    category: '',
    categoryAr: '',
    address: '',
    addressAr: '',
    city: '',
    phone: '',
    hours: '',
    coordinates: null
  })
  const [locationSearch, setLocationSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSelectingOnMap, setIsSelectingOnMap] = useState(false)
  const [saveToTripListing, setSaveToTripListing] = useState(null)

  const mapContainer = useRef(null)
  const map = useRef(null)
  const markers = useRef([])
  const [mapLoaded, setMapLoaded] = useState(false)

  const t = mapTranslations[lang]
  const isRTL = lang === 'ar'


  // Initialize map
  useEffect(() => {
    if (map.current || !config?.mapboxToken) return

    mapboxgl.accessToken = config.mapboxToken

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [46.6753, 24.7136], // Center on Riyadh
      zoom: 5
    })

    map.current.on('load', () => {
      // Add Al-Ahsa (الأحساء) region highlight
      map.current.addSource('al-ahsa-region', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { name: 'الأحساء', nameEn: 'Al-Ahsa' },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [49.15, 25.75],
              [49.45, 25.82],
              [49.72, 25.78],
              [49.95, 25.65],
              [50.05, 25.48],
              [50.08, 25.25],
              [50.02, 25.05],
              [49.88, 24.88],
              [49.68, 24.78],
              [49.42, 24.75],
              [49.20, 24.82],
              [49.05, 24.98],
              [48.98, 25.18],
              [49.00, 25.40],
              [49.05, 25.58],
              [49.15, 25.75]
            ]]
          }
        }
      })

      // Green gradient fill
      map.current.addLayer({
        id: 'al-ahsa-fill',
        type: 'fill',
        source: 'al-ahsa-region',
        paint: {
          'fill-color': '#0D7A5F',
          'fill-opacity': 0.12
        }
      })

      // Subtle border
      map.current.addLayer({
        id: 'al-ahsa-border',
        type: 'line',
        source: 'al-ahsa-region',
        paint: {
          'line-color': '#0D7A5F',
          'line-width': 1.5,
          'line-opacity': 0.3
        }
      })

      // Region label
      map.current.addLayer({
        id: 'al-ahsa-label',
        type: 'symbol',
        source: 'al-ahsa-region',
        layout: {
          'text-field': 'الأحساء\nAl-Ahsa',
          'text-size': 14,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-anchor': 'center'
        },
        paint: {
          'text-color': '#065F46',
          'text-opacity': 0.6,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1
        }
      })

      setMapLoaded(true)
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.current.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true
    }))

    return () => {
      map.current?.remove()
      map.current = null
      setMapLoaded(false)
    }
  }, [config?.mapboxToken])

  // Update map click handler when isSelectingOnMap changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const handleClick = (e) => {
      if (isSelectingOnMap) {
        setNewLocation(prev => ({
          ...prev,
          coordinates: [e.lngLat.lng, e.lngLat.lat]
        }))
        setIsSelectingOnMap(false)
        setShowAddForm(true)
      }
    }

    map.current.on('click', handleClick)

    return () => {
      map.current?.off('click', handleClick)
    }
  }, [isSelectingOnMap, mapLoaded])

  // Update markers when locations or filter changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Clear existing markers
    markers.current.forEach(marker => marker.remove())
    markers.current = []

    // Filter locations
    let filteredLocations = locations.filter(loc => {
      if (filter === 'hotels') return loc.type === 'hotel'
      if (filter === 'restaurants') return loc.type === 'restaurant'
      if (filter === 'attractions') return loc.type === 'attraction'
      return true
    })

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredLocations = filteredLocations.filter(loc =>
        loc.name.toLowerCase().includes(query) ||
        loc.nameAr.includes(query) ||
        loc.category.toLowerCase().includes(query) ||
        loc.categoryAr.includes(query) ||
        loc.address.toLowerCase().includes(query) ||
        loc.addressAr.includes(query)
      )
    }

    // Add markers
    filteredLocations.forEach(location => {
      const el = document.createElement('div')
      el.className = `map-marker ${location.type}`
      el.innerHTML = `<div class="marker-dot"></div>`

      const marker = new mapboxgl.Marker(el)
        .setLngLat(location.coordinates)
        .addTo(map.current)

      el.addEventListener('click', () => {
        setSelectedLocation(location)
        map.current.flyTo({
          center: location.coordinates,
          zoom: 14
        })
      })

      markers.current.push(marker)
    })
  }, [locations, filter, searchQuery, mapLoaded])

  // Show temporary marker for new location
  useEffect(() => {
    if (!map.current || !mapLoaded || !newLocation.coordinates) return

    const el = document.createElement('div')
    el.className = 'map-marker new-marker'
    el.innerHTML = '<div class="marker-dot"></div>'

    const tempMarker = new mapboxgl.Marker(el)
      .setLngLat(newLocation.coordinates)
      .addTo(map.current)

    return () => tempMarker.remove()
  }, [newLocation.coordinates, mapLoaded])

  // Geocoding search with debounce
  useEffect(() => {
    if (!locationSearch || locationSearch.length < 3) {
      setSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationSearch)}.json?` +
          `access_token=${mapboxgl.accessToken}&country=sa&types=address,place,locality,neighborhood,poi&limit=5`
        )
        const data = await response.json()
        setSearchResults(data.features || [])
      } catch (error) {
        console.error('Geocoding error:', error)
        setSearchResults([])
      }
      setIsSearching(false)
    }, 400)

    return () => clearTimeout(timeoutId)
  }, [locationSearch])

  // Select a geocoding result
  const selectSearchResult = (result) => {
    const [lng, lat] = result.center

    // Parse the address components from the result
    const context = result.context || []
    let city = ''

    // Parse context for address components
    context.forEach(item => {
      if (item.id.startsWith('place') || item.id.startsWith('locality') || item.id.startsWith('region')) {
        if (!city) city = item.text
      }
    })

    // Build full address string
    const fullAddress = result.place_name || ''

    setNewLocation(prev => ({
      ...prev,
      coordinates: [lng, lat],
      city: city || prev.city,
      address: fullAddress,
      addressAr: fullAddress
    }))

    setLocationSearch('')
    setSearchResults([])

    // Fly to the location on the map
    map.current?.flyTo({
      center: [lng, lat],
      zoom: 16
    })
  }

  const toggleLang = () => {
    setLang(prev => prev === 'ar' ? 'en' : 'ar')
  }

  const handleAddLocation = async (e) => {
    e.preventDefault()
    if (!newLocation.coordinates) return

    // Build full address if not already set
    let fullAddress = newLocation.address
    if (!fullAddress && newLocation.city) {
      fullAddress = newLocation.city
    }

    // Save to Convex database
    try {
      await createListing({
        type: newLocation.type,
        name_en: newLocation.name,
        name_ar: newLocation.nameAr || newLocation.name,
        category: newLocation.category,
        address: fullAddress,
        city: newLocation.city || 'Unknown',
        coordinates: {
          lat: newLocation.coordinates[1],
          lng: newLocation.coordinates[0]
        },
        phone: newLocation.phone || undefined
      })
    } catch (error) {
      console.error('Failed to add location:', error)
    }

    setNewLocation({
      type: 'hotel',
      name: '',
      nameAr: '',
      category: '',
      categoryAr: '',
      address: '',
      addressAr: '',
      city: '',
      phone: '',
      hours: '',
      coordinates: null
    })
    setLocationSearch('')
    setSearchResults([])
    setIsSelectingOnMap(false)
    setShowAddForm(false)
  }

  const hotelCount = locations.filter(l => l.type === 'hotel').length
  const restaurantCount = locations.filter(l => l.type === 'restaurant').length
  const attractionCount = locations.filter(l => l.type === 'attraction').length

  // Helper to get localized type label
  const getTypeLabel = (type) => {
    if (type === 'hotel') return t.form.hotel
    if (type === 'restaurant') return t.form.restaurant
    if (type === 'attraction') return t.form.attraction
    return type
  }

  return (
    <div className={`map-page ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="map-header">
        <div className="map-header-inner">
          <Link to="/home" className="back-link">
            {t.backHome}
          </Link>
          <h1 className="map-title">{t.title}</h1>
          <button onClick={toggleLang} className="btn btn-lang">
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="map-content">
        {/* Sidebar */}
        <aside className="map-sidebar">
          {/* Search */}
          <div className="search-box">
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              {t.filters.all}
            </button>
            <button
              className={`filter-tab ${filter === 'hotels' ? 'active' : ''}`}
              onClick={() => setFilter('hotels')}
            >
              {t.filters.hotels}
            </button>
            <button
              className={`filter-tab ${filter === 'restaurants' ? 'active' : ''}`}
              onClick={() => setFilter('restaurants')}
            >
              {t.filters.restaurants}
            </button>
            <button
              className={`filter-tab ${filter === 'attractions' ? 'active' : ''}`}
              onClick={() => setFilter('attractions')}
            >
              {t.filters.attractions}
            </button>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="loading-indicator" style={{ padding: '10px', textAlign: 'center', color: '#666' }}>
              Loading listings...
            </div>
          )}

          {/* Stats */}
          <div className="map-stats">
            <div className="stat">
              <span className="stat-number">{isLoading ? '...' : locations.length}</span>
              <span className="stat-label">{t.stats.total}</span>
            </div>
            <div className="stat">
              <span className="stat-number">{isLoading ? '...' : hotelCount}</span>
              <span className="stat-label">{t.stats.hotels}</span>
            </div>
            <div className="stat">
              <span className="stat-number">{isLoading ? '...' : restaurantCount}</span>
              <span className="stat-label">{t.stats.restaurants}</span>
            </div>
            <div className="stat">
              <span className="stat-number">{isLoading ? '...' : attractionCount}</span>
              <span className="stat-label">{t.stats.attractions}</span>
            </div>
          </div>

          {/* Add New Button */}
          <button
            className="btn btn-primary add-btn"
            onClick={() => setShowAddForm(true)}
          >
            {t.addNew}
          </button>

          {/* Location List */}
          <div className="location-list">
            {locations
              .filter(loc => {
                if (filter === 'hotels') return loc.type === 'hotel'
                if (filter === 'restaurants') return loc.type === 'restaurant'
                if (filter === 'attractions') return loc.type === 'attraction'
                return true
              })
              .filter(loc => {
                if (!searchQuery) return true
                const query = searchQuery.toLowerCase()
                return loc.name.toLowerCase().includes(query) ||
                  loc.nameAr.includes(query) ||
                  loc.category.toLowerCase().includes(query) ||
                  loc.categoryAr.includes(query)
              })
              .map(location => (
                <motion.div
                  key={location.id}
                  className={`location-card ${selectedLocation?.id === location.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedLocation(location)
                    map.current?.flyTo({
                      center: location.coordinates,
                      zoom: 14
                    })
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`location-type-badge ${location.type}`}>
                    {getTypeLabel(location.type)}
                  </div>
                  <h3>{isRTL ? location.nameAr : location.name}</h3>
                  <p className="location-specialty">
                    {isRTL ? location.categoryAr : location.category}
                  </p>
                  <p className="location-address">
                    {isRTL ? location.addressAr : location.address}
                  </p>
                </motion.div>
              ))}
          </div>
        </aside>

        {/* Map */}
        <div className="map-container" ref={mapContainer}></div>

        {/* Map Selection Mode Indicator */}
        {isSelectingOnMap && (
          <div className="map-selection-mode">
            <div className="selection-message">
              <span>{t.form.selectingMode}</span>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsSelectingOnMap(false)
                  setShowAddForm(true)
                }}
              >
                {t.form.cancelSelection}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Location Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowAddForm(false)
              setIsSelectingOnMap(false)
            }}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{t.form.title}</h2>
              <form onSubmit={handleAddLocation}>
                {/* Type Selection */}
                <div className="form-group">
                  <label>{t.form.type}</label>
                  <div className="type-selector">
                    <button
                      type="button"
                      className={`type-btn ${newLocation.type === 'hotel' ? 'active' : ''}`}
                      onClick={() => setNewLocation(prev => ({ ...prev, type: 'hotel' }))}
                    >
                      {t.form.hotel}
                    </button>
                    <button
                      type="button"
                      className={`type-btn ${newLocation.type === 'restaurant' ? 'active' : ''}`}
                      onClick={() => setNewLocation(prev => ({ ...prev, type: 'restaurant' }))}
                    >
                      {t.form.restaurant}
                    </button>
                    <button
                      type="button"
                      className={`type-btn ${newLocation.type === 'attraction' ? 'active' : ''}`}
                      onClick={() => setNewLocation(prev => ({ ...prev, type: 'attraction' }))}
                    >
                      {t.form.attraction}
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div className="form-group">
                  <label>{t.form.name}</label>
                  <input
                    type="text"
                    placeholder={t.form.namePlaceholder}
                    value={newLocation.name}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                {/* Category */}
                <div className="form-group">
                  <label>{t.form.category}</label>
                  <input
                    type="text"
                    placeholder={t.form.categoryPlaceholder}
                    value={newLocation.category}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, category: e.target.value }))}
                    required
                  />
                </div>

                {/* Location Search */}
                <div className="form-group location-search-group">
                  <label>{t.form.searchLocation}</label>
                  <div className="search-input-wrapper">
                    <input
                      type="text"
                      placeholder={t.form.searchPlaceholder}
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                    />
                    {isSearching && <span className="search-loading">{t.form.searching}</span>}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="search-results-dropdown">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          className="search-result-item"
                          onClick={() => selectSearchResult(result)}
                        >
                          <span className="result-name">{result.text}</span>
                          <span className="result-address">{result.place_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {locationSearch.length >= 3 && !isSearching && searchResults.length === 0 && (
                    <div className="no-results-message">{t.form.noResults}</div>
                  )}
                </div>

                {/* City */}
                <div className="form-group">
                  <label>{t.form.city}</label>
                  <input
                    type="text"
                    placeholder={t.form.cityPlaceholder}
                    value={newLocation.city}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>

                {/* Phone */}
                <div className="form-group">
                  <label>{t.form.phone}</label>
                  <input
                    type="tel"
                    placeholder={t.form.phonePlaceholder}
                    value={newLocation.phone}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                {/* Hours */}
                <div className="form-group">
                  <label>{t.form.hours}</label>
                  <input
                    type="text"
                    placeholder={t.form.hoursPlaceholder}
                    value={newLocation.hours}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, hours: e.target.value }))}
                  />
                </div>

                {/* Map Location Picker */}
                <div className="form-group location-picker">
                  <label>{t.form.clickMap}</label>
                  <div className={`map-picker-box ${newLocation.coordinates ? 'has-location' : ''}`}>
                    {newLocation.coordinates ? (
                      <div className="selected-coords">
                        <span className="coords-label">{t.form.selectedLocation}:</span>
                        <span className="coords-value">{newLocation.coordinates[1].toFixed(4)}, {newLocation.coordinates[0].toFixed(4)}</span>
                        <button
                          type="button"
                          className="clear-coords-btn"
                          onClick={() => setNewLocation(prev => ({ ...prev, coordinates: null }))}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="no-coords">
                        <button
                          type="button"
                          className="select-on-map-btn"
                          onClick={() => {
                            setShowAddForm(false)
                            setIsSelectingOnMap(true)
                          }}
                        >
                          {t.form.selectOnMap}
                        </button>
                        <span className="or-search-hint">{t.form.orSearchAbove}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowAddForm(false)
                    setIsSelectingOnMap(false)
                  }}>
                    {t.form.cancel}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={!newLocation.coordinates}>
                    {t.form.submit}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Detail Popup */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            className="location-popup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <button className="close-popup" onClick={() => setSelectedLocation(null)}>
              &times;
            </button>
            <div className={`popup-type-badge ${selectedLocation.type}`}>
              {getTypeLabel(selectedLocation.type)}
            </div>
            <h3>{isRTL ? selectedLocation.nameAr : selectedLocation.name}</h3>

            <div className="popup-details">
              <div className="popup-row">
                <span className="popup-label">{t.popup.category}:</span>
                <span>{isRTL ? selectedLocation.categoryAr : selectedLocation.category}</span>
              </div>
              <div className="popup-row">
                <span className="popup-label">{t.popup.address}:</span>
                <span>{isRTL ? selectedLocation.addressAr : selectedLocation.address}</span>
              </div>
              {selectedLocation.phone && (
                <div className="popup-row">
                  <span className="popup-label">{t.popup.phone}:</span>
                  <span dir="ltr">{selectedLocation.phone}</span>
                </div>
              )}
              {selectedLocation.hours && (
                <div className="popup-row">
                  <span className="popup-label">{t.popup.hours}:</span>
                  <span dir="ltr">{selectedLocation.hours}</span>
                </div>
              )}
            </div>

            <div className="popup-actions">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.coordinates[1]},${selectedLocation.coordinates[0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                {t.popup.getDirections}
              </a>
              <button
                className="btn btn-secondary"
                onClick={() => setSaveToTripListing(selectedLocation)}
              >
                {t.popup.saveToTrip}
              </button>
              <button className="btn btn-primary">
                {t.popup.book}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save to Trip Modal */}
      {saveToTripListing && (
        <SaveToTripModal
          listingId={saveToTripListing.id}
          listingName={isRTL ? saveToTripListing.nameAr : saveToTripListing.name}
          lang={lang}
          isOpen={!!saveToTripListing}
          onClose={() => setSaveToTripListing(null)}
        />
      )}

      {/* Floating Chat Widget */}
      <ChatWidget lang={lang} />
    </div>
  )
}

export default MapPage

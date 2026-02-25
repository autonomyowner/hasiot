# Hasio - Play Store Listing Information

Use this document to fill out your Google Play Console listing.

---

## App Details

### App Name (30 characters max)
```
Hasio - Al-Ahsa Oasis Guide
```

### Short Description (80 characters max)
```
Discover Al-Ahsa Oasis - UNESCO World Heritage Site. AI voice guide included.
```

### Full Description (4000 characters max)
```
Discover Al-Ahsa Oasis - the world's largest natural oasis and UNESCO World Heritage Site!

Hasio is your personal travel companion for exploring Al-Ahsa, Saudi Arabia. Whether you're planning your first visit or looking to discover hidden gems, Hasio helps you experience the best of this incredible destination.

KEY FEATURES:

AI Voice Assistant
Talk to Hasio! Our intelligent voice assistant speaks both English and Arabic. Ask about the best restaurants, find hotels, get directions to attractions, or plan your perfect day in the oasis.

Discover Lodging
Find the perfect place to stay - from luxury hotels like Al-Ahsa InterContinental to authentic desert camps and traditional homestays. Filter by type, price, and amenities.

Explore Local Cuisine
Taste the authentic flavors of Al-Ahsa! Discover traditional restaurants serving Hasawi rice, home kitchens run by local families, famous date shops, and cozy coffee houses serving qahwa with fresh Khalas dates.

Events & Activities
Never miss what's happening! Find festivals like the famous Al-Ahsa Date Festival, cultural exhibitions at Ibrahim Palace, outdoor adventures at Jabal Al-Qara caves, and more.

Trip Planner
Plan your perfect itinerary with our AI assistant. Get personalized recommendations based on your interests and save your plans for offline access.

Capture Moments
Save your travel memories! Take photos, add notes, and create a personal travel journal of your Al-Ahsa adventure.

EXPLORE AL-AHSA'S TREASURES:
- Jabal Al-Qara - Natural caves that stay cool year-round
- Ibrahim Palace - Historic Ottoman fortress and museum
- Al-Qaisariya Souk - 400-year-old traditional market
- Yellow Lake - Arabia's largest natural lake
- Al-Uqair Beach - Historic port with beautiful coastline
- Date Palm Groves - 2.5 million palm trees

BILINGUAL SUPPORT
Full support for English and Arabic with RTL layout. Switch languages anytime in settings.

FOR BUSINESSES & SERVICE PROVIDERS
Are you a hotel owner, restaurant, or tour guide in Al-Ahsa? Register as a business or service provider to list your offerings and reach visitors from around the world.

Download Hasio today and start your Al-Ahsa adventure!

---
Keywords: Al-Ahsa, Ahsa, travel, Saudi Arabia, tourism, UNESCO, oasis, dates, hotels, restaurants, voice assistant, trip planner, Eastern Province
```

---

## Categorization

### Category
```
Travel & Local
```

### Content Rating
```
Everyone (PEGI 3 / ESRB Everyone)
```

### Target Audience
```
18 and over (primarily adult travelers)
```

---

## Contact Details

### Developer Name
```
[YOUR NAME OR COMPANY NAME]
```

### Email
```
support@hasio.app
```

### Website (optional)
```
https://hasio.app
```

### Privacy Policy URL (REQUIRED)
```
https://hasio.xyz/privacy-policy.html
```

### Terms of Service URL
```
https://hasio.xyz/terms-of-service.html
```

---

## Graphics Requirements

### App Icon
- Already created: `assets/IconKitchen-Output1/android/play_store_512.png`
- Size: 512 x 512 px, PNG, 32-bit

### Feature Graphic (REQUIRED)
- Size: 1024 x 500 px
- Create using: Canva, Figma, or similar
- Suggested content: Al-Ahsa oasis landscape with app name overlay

### Screenshots (REQUIRED - minimum 2, recommended 8)
- Phone: 16:9 aspect ratio (e.g., 1080 x 1920 px)
- Take screenshots of:
  1. Home screen with featured destinations
  2. Lodging list with filters
  3. Restaurant/food discovery
  4. Voice assistant in action
  5. Events calendar
  6. Trip planner
  7. Moments/gallery
  8. Settings with language toggle

### Promotional Video (optional but recommended)
- YouTube URL
- 30 seconds to 2 minutes
- Show key features and Al-Ahsa beauty

---

## Data Safety Form Answers

### Data Collection

| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Name | Yes | No | Account functionality |
| Email | Yes | No | Account functionality |
| Photos | Yes | No | App functionality (moments) |
| Audio/Voice | Yes | Yes* | Voice assistant feature |
| App activity | Yes | No | Analytics, app functionality |

*Voice data is shared with speech processing services (Groq, ElevenLabs)

### Security Practices
- Data encrypted in transit: **Yes** (HTTPS/TLS)
- Data encrypted at rest: **Yes** (Supabase encryption)
- User can request data deletion: **Yes**

### Data Handling Purposes
- App functionality
- Personalization
- Account management

---

## Content Rating Questionnaire Answers

| Question | Answer |
|----------|--------|
| Violence | None |
| Sexual content | None |
| Profanity | None |
| Drugs | None |
| Gambling | None |
| User-generated content | Yes (photos, reviews) |
| Location sharing | Optional |
| Data sharing with third parties | Yes (for voice processing) |

---

## Required Store Assets Checklist

- [ ] App icon (512x512) - READY
- [ ] Feature graphic (1024x500) - NEED TO CREATE
- [ ] Phone screenshots (min 2) - NEED TO CAPTURE
- [ ] Tablet screenshots (optional)
- [ ] Short description - READY (above)
- [ ] Full description - READY (above)
- [ ] Privacy policy URL - NEED TO HOST
- [ ] Contact email - NEED TO SET UP

---

## Pre-Launch Checklist

### Before Building
- [ ] Set up EAS account: `eas login`
- [ ] Configure environment variables in EAS secrets
- [ ] Test app thoroughly on physical devices

### Building
```bash
# Build for Play Store (AAB format)
eas build --platform android --profile production
```

### After Building
- [ ] Download AAB from EAS
- [ ] Upload to Play Console
- [ ] Complete store listing
- [ ] Fill out Data Safety form
- [ ] Complete Content Rating questionnaire
- [ ] Set up pricing (Free)
- [ ] Select countries for distribution
- [ ] Submit for review

---

## Hosting Privacy Policy & Terms

Option 1: GitHub Pages (Free)
1. Create a repository
2. Enable GitHub Pages
3. Upload HTML files
4. URL: `https://[username].github.io/hasio-legal/privacy-policy.html`

Option 2: Your own domain
1. Host on any web server
2. URL: `https://hasio.app/privacy-policy`

Option 3: Supabase Storage (since you already use it)
1. Upload HTML to public bucket
2. Get public URL

---

## Notes for Review

- App uses microphone for voice assistant feature (permission explained)
- App uses camera/photos for saving travel moments (permission explained)
- No in-app purchases
- No ads
- Free to download
- Target audience: Adult travelers interested in Saudi Arabia tourism

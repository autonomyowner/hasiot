# Hasio - Complete Play Store Submission Guide

Follow these steps exactly to submit your app to Google Play Store.

---

## PHASE 1: Before You Start

### Prerequisites Checklist
- [ ] Google Play Developer Account ($25 one-time fee) - You said you have this
- [ ] Expo account (free) - https://expo.dev/signup
- [ ] EAS CLI installed - `npm install -g eas-cli`
- [ ] Node.js 18+ installed

---

## PHASE 2: Privacy Policy & Terms of Service (DONE)

**Already set up on your website hasio.xyz**

Your legal pages are in the `public/` folder and will be live at:
- **Privacy Policy:** https://hasio.xyz/privacy-policy.html
- **Terms of Service:** https://hasio.xyz/terms-of-service.html

After you deploy your website, verify these URLs work before submitting to Play Store.

---

## PHASE 3: Set Up EAS and Build

### Step 1: Login to Expo
```bash
eas login
```
Enter your Expo account credentials.

### Step 2: Configure EAS Secrets
Set your API keys securely in EAS (never in code):
```bash
eas secret:create --name EXPO_PUBLIC_GROQ_API_KEY --value "your-groq-key"
eas secret:create --name EXPO_PUBLIC_ELEVENLABS_API_KEY --value "your-elevenlabs-key"
```

### Step 3: Build the Production AAB
```bash
eas build --platform android --profile production
```

This will:
- Create a release keystore (EAS manages this for you)
- Build an Android App Bundle (.aab)
- Upload to Expo servers
- Give you a download link when complete

**Wait for build to complete (usually 15-30 minutes)**

### Step 4: Download the AAB File
After build completes, download from the link provided or:
```bash
eas build:list
# Copy the build ID, then:
eas build:download --id [BUILD_ID]
```

---

## PHASE 4: Google Play Console Setup

### Step 1: Create New App
1. Go to https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - **App name:** Hasio - Al-Ahsa Oasis Guide
   - **Default language:** English (US)
   - **App or game:** App
   - **Free or paid:** Free
4. Accept declarations and click "Create app"

### Step 2: Complete Dashboard Tasks

You'll see a checklist. Complete each item:

#### 2.1 App Access
- Select: "All functionality is available without special access"
- (Your app doesn't require login to browse)

#### 2.2 Ads
- Select: "No, my app doesn't contain ads"

#### 2.3 Content Rating
- Click "Start questionnaire"
- Answer questions (use DATA_SAFETY_ANSWERS.md for reference)
- Select "Travel & Local" category
- Answer "No" to violence, sexual content, drugs, gambling
- Answer "Yes" to user-generated content (photos)
- Complete and save

#### 2.4 Target Audience
- Select: "18 and over"
- This is NOT a kids app

#### 2.5 News App
- Select: "No"

#### 2.6 COVID-19 Contact Tracing
- Select: "No"

#### 2.7 Data Safety
- Use the answers from `docs/DATA_SAFETY_ANSWERS.md`
- Fill each section carefully
- This is CRITICAL - be accurate

#### 2.8 Government Apps
- Select: "No"

#### 2.9 Financial Features
- Select: "No"

---

## PHASE 5: Store Listing

### Main Store Listing

#### App Details
Copy from `docs/PLAY_STORE_LISTING.md`:

**App name (30 chars):**
```
Hasio - Al-Ahsa Oasis Guide
```

**Short description (80 chars):**
```
Discover Al-Ahsa Oasis - UNESCO World Heritage Site. AI voice guide included.
```

**Full description:**
Copy the full description from PLAY_STORE_LISTING.md

#### Graphics

**App Icon:** Already uploaded during AAB upload

**Feature Graphic (1024 x 500 px):**
- Create using Canva or Figma
- Show Al-Ahsa landscape with app name
- Save as PNG or JPEG

**Screenshots (minimum 2, recommend 8):**

Take screenshots from your phone or emulator:
1. Open the app
2. Navigate to each screen
3. Take screenshot (16:9 ratio recommended)
4. Upload to Play Console

Recommended screenshots:
1. Home screen
2. Lodging list
3. Food/restaurants
4. Voice assistant active
5. Events
6. Trip planner
7. Moments gallery
8. Settings

#### Contact Details
- **Email:** support@hasio.app (create this)
- **Phone:** Optional
- **Website:** Optional

#### Privacy Policy
- Enter your hosted URL (from Phase 2)
- Example: `https://[username].github.io/hasio-legal/privacy-policy.html`

---

## PHASE 6: Release Setup

### Step 1: Create Production Release
1. Go to "Production" in left menu
2. Click "Create new release"

### Step 2: Upload AAB
- Drag and drop your `.aab` file
- Or click "Upload" and select it
- Wait for processing

### Step 3: Release Notes
Enter what's new (first release):
```
Initial Release of Hasio - Al-Ahsa Oasis Guide

Features:
- Discover lodging, restaurants, and events in Al-Ahsa
- AI voice assistant for trip planning (English & Arabic)
- Save your travel moments with photos
- Bilingual support (English/Arabic)
- Trip planner and itinerary builder

Explore the world's largest oasis!
```

### Step 4: Review and Rollout
1. Click "Review release"
2. Check for any errors or warnings
3. Fix any issues shown
4. Click "Start rollout to Production"

---

## PHASE 7: Country Availability

### Select Countries
1. Go to "Countries/regions"
2. For initial launch, recommend:
   - Saudi Arabia (primary market)
   - UAE
   - Bahrain
   - Kuwait
   - Qatar
   - Oman
   - (Add more later)

---

## PHASE 8: Submit for Review

1. Make sure all sections show green checkmarks
2. Review everything once more
3. Click "Submit for review"

### Review Timeline
- First review: 3-7 days (sometimes longer for new accounts)
- Subsequent updates: 1-3 days

---

## COMMON ISSUES & FIXES

### Issue: "Privacy Policy URL not accessible"
- Make sure GitHub Pages is enabled
- Wait 10 minutes for GitHub Pages to deploy
- Test URL in incognito browser

### Issue: "Missing screenshots"
- Need minimum 2 screenshots
- Use 16:9 ratio (1080x1920 or 1242x2208)

### Issue: "Data safety form incomplete"
- All sections must be filled
- Voice data MUST be declared as shared

### Issue: "Build failed"
- Check EAS build logs
- Make sure secrets are configured
- Try: `eas build --clear-cache --platform android`

### Issue: "App rejected"
Common reasons:
- Broken features - test everything before submitting
- Privacy policy doesn't match data collection
- Misleading description
- Crashes on review device

---

## POST-SUBMISSION

### While Waiting for Review
- Set up your support email
- Prepare for user feedback
- Test the app thoroughly

### After Approval
- Monitor crash reports in Play Console
- Respond to user reviews
- Plan your first update

---

## QUICK COMMAND REFERENCE

```bash
# Login to EAS
eas login

# Set secrets
eas secret:create --name EXPO_PUBLIC_GROQ_API_KEY --value "your-key"
eas secret:create --name EXPO_PUBLIC_ELEVENLABS_API_KEY --value "your-key"

# Build production AAB
eas build --platform android --profile production

# List builds
eas build:list

# Download build
eas build:download --id [BUILD_ID]

# Check project status
eas project:info
```

---

## CHECKLIST BEFORE SUBMITTING

### Code & Build
- [ ] API keys in EAS secrets (not in code)
- [ ] Production build successful
- [ ] AAB file downloaded

### Legal
- [ ] Privacy policy hosted and accessible
- [ ] Terms of service hosted and accessible

### Play Console
- [ ] App created
- [ ] All dashboard items completed (green)
- [ ] Data safety form filled accurately
- [ ] Content rating completed
- [ ] Store listing complete
- [ ] Screenshots uploaded (min 2)
- [ ] Feature graphic uploaded
- [ ] AAB uploaded
- [ ] Release notes written
- [ ] Countries selected

### Final
- [ ] Test app thoroughly
- [ ] All features working
- [ ] No crashes
- [ ] Ready for review!

---

Good luck with your submission!

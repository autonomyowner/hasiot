# Data Safety Form - Complete Answers for Google Play

Use these exact answers when filling out the Data Safety form in Google Play Console.

---

## Section 1: Data Collection and Security

### Does your app collect or share any of the required user data types?
**Answer: Yes**

### Is all of the user data collected by your app encrypted in transit?
**Answer: Yes**
- All API calls use HTTPS
- Convex connections are encrypted
- Clerk authentication uses TLS
- Voice data transmitted over TLS

### Do you provide a way for users to request that their data is deleted?
**Answer: Yes**
- Users can delete their account in Settings > Delete Account
- This permanently removes:
  - Profile information
  - All uploaded photos/moments
  - Day plans and saved items
  - Favorites and chat history
- Note: Data previously shared with third parties (Groq, ElevenLabs) is subject to their retention policies

---

## Section 2: Data Types

### Personal Info

#### Name
- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required:** No (optional during registration)
- **Purpose:** Account management

#### Email address
- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required:** Yes (for account creation)
- **Purpose:** Account management, App functionality

#### User IDs
- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required:** Yes (internal use)
- **Purpose:** App functionality

---

### Photos and Videos

#### Photos
- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required:** No (optional - Moments feature)
- **Purpose:** App functionality (saving travel moments)

---

### Audio

#### Voice or sound recordings
- **Collected:** Yes
- **Shared:** Yes (with third-party speech services)
- **Ephemeral:** Yes (not stored permanently by Hasio)
- **Required:** No (optional - voice assistant)
- **Purpose:** App functionality (voice assistant)

**User Consent:**
- Users must explicitly accept voice data processing before first use
- A consent modal explains that data is sent to third-party services
- Users can decline and use text chat instead

**Third parties receiving audio data:**
- Groq (speech-to-text processing) - see their privacy policy for data retention
- ElevenLabs (text-to-speech generation) - see their privacy policy for data retention

**Third parties managing user data:**
- Clerk (authentication and user management) - https://clerk.com/legal/privacy
- Convex (database and real-time data storage) - https://www.convex.dev/privacy

**Important Note:** While Hasio does not permanently store voice recordings, third-party services may have their own data retention policies. Users are advised to review the privacy policies of Groq, ElevenLabs, Clerk, and Convex.

---

### App Activity

#### App interactions
- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required:** Yes
- **Purpose:** Analytics, App functionality

#### In-app search history
- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required:** No
- **Purpose:** App functionality (search history)

---

### Device or other IDs

#### Device or other IDs
- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required:** Yes
- **Purpose:** App functionality, Analytics

---

## Section 3: Data NOT Collected

The following data types are NOT collected by Hasio:

- Financial info (no payments in app)
- Health info
- Messages
- Contacts
- Calendar
- Browsing history
- Precise location (only general location tags added manually by user)
- Files and docs
- Race and ethnicity
- Political or religious beliefs
- Sexual orientation
- Other personal information

---

## Section 4: Data Usage and Handling

### Purpose Declarations

#### Account management
- Email address
- Name
- User IDs

#### App functionality
- Email address
- Photos
- Voice recordings
- App interactions
- Device IDs

#### Analytics
- App interactions
- Device IDs

---

## Section 5: Data Sharing

### User data is shared with the following third-party services:

**Clerk (Authentication Service)**
- Purpose: User authentication and account management
- Data: Email address, name, user IDs, authentication credentials
- Their privacy policy: https://clerk.com/legal/privacy
- Why necessary: Provides secure OAuth authentication (Google, Apple) and account management

**Convex (Database Service)**
- Purpose: Database storage and real-time data synchronization
- Data: All user-generated content (moments, favorites, day plans, chat messages, profile information)
- Their privacy policy: https://www.convex.dev/privacy
- Why necessary: Provides cloud database infrastructure and real-time data sync across devices

**Groq Inc. (AI Service)**
- Purpose: Speech-to-text transcription and AI chat responses
- Data: Voice recordings (ephemeral), text chat messages
- Their privacy policy: https://groq.com/privacy-policy/
- Why necessary: Powers the AI travel assistant feature

**ElevenLabs (AI Voice Service)**
- Purpose: Text-to-speech generation
- Data: Text content for voice synthesis
- Their privacy policy: https://elevenlabs.io/privacy
- Why necessary: Converts AI responses to natural speech for voice assistant

### Why sharing is necessary:
The app relies on specialized third-party services for authentication, data storage, and AI-powered features. This is standard practice for modern cloud-based mobile applications.

---

## Section 6: Security Practices Summary

| Practice | Status |
|----------|--------|
| Data encrypted in transit | Yes (TLS/HTTPS) |
| Data encrypted at rest | Yes (Convex) |
| Users can request deletion | Yes |
| Security review | Convex and Clerk manage infrastructure security |

---

## Quick Reference Table for Form

| Data Type | Collected | Shared | Ephemeral | Optional | Purpose |
|-----------|-----------|--------|-----------|----------|---------|
| Email | Yes | No | No | No | Account |
| Name | Yes | No | No | Yes | Account |
| User ID | Yes | No | No | No | Functionality |
| Photos | Yes | No | No | Yes | Functionality |
| Voice | Yes | Yes* | Yes | Yes | Functionality |
| App activity | Yes | No | No | No | Analytics |
| Device ID | Yes | No | No | No | Functionality |

*Shared with Groq and ElevenLabs for processing

---

## Important Notes for Form Completion

1. **Be honest** - Google verifies this information
2. **Backend services** - We use Clerk (auth) and Convex (database), NOT Supabase
3. **Voice data sharing** - Must declare because we send audio to third parties (Groq, ElevenLabs)
4. **Database sharing** - User data is shared with Convex for storage (required for app functionality)
5. **Authentication sharing** - User credentials are shared with Clerk (required for secure login)
6. **Photos** - User controls when to save, but we do store them in Convex
7. **Ephemeral data** - Voice is ephemeral in our app (processed but not stored by Hasio), but third parties may have different retention policies
8. **Optional data** - Name, photos, voice are optional features
9. **User consent** - Voice data consent is explicitly obtained before first use
10. **Account deletion** - Fully implemented in Settings > Delete Account

---

## After Completing the Form

Google will display a Data Safety section on your app listing showing:
- What data is collected
- Whether data is encrypted
- Whether users can request deletion
- What data is shared and with whom

This transparency builds user trust.

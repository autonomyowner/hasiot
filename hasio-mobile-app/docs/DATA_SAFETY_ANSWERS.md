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
- Better-Auth authentication uses TLS

### Do you provide a way for users to request that their data is deleted?
**Answer: Yes**
- Users can delete their account in Settings > Delete Account
- This permanently removes:
  - Profile information
  - All uploaded photos (listing, service, and verification images)
  - Day plans and saved items
  - Favorites and chat history
- Travel moments are not covered because they are never collected: they live only
  in local storage on the user's device and are removed by deleting the app
- Note: Data previously shared with third parties (Convex, OpenRouter) is subject to their retention policies

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
- **Required:** No (optional - business listing images)
- **Purpose:** App functionality (business listings, freelancer services, and verification documents)
- **Note:** Travel moment photos are NOT collected — they are written to local
  device storage only and never uploaded to our servers

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
- Audio (no voice/microphone features)
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
- App interactions
- Device IDs

#### Analytics
- App interactions
- Device IDs

---

## Section 5: Data Sharing

### User data is shared with the following third-party services:

**Better-Auth (Authentication Service)**
- Purpose: User authentication and session management
- Data: Email address, name, user IDs, authentication credentials
- Their website: https://www.better-auth.com
- Why necessary: Provides secure email/password authentication and session management (runs on Convex backend)

**Convex (Database Service)**
- Purpose: Database storage and real-time data synchronization
- Data: All user-generated content (favorites, trips, chat messages, profile information, photos)
- Their privacy policy: https://www.convex.dev/privacy
- Why necessary: Provides cloud database infrastructure and real-time data sync across devices

**OpenRouter (AI Service)**
- Purpose: AI-powered travel planning and recommendations
- Data: Text chat messages for travel planning queries
- Their privacy policy: https://openrouter.ai/privacy
- Why necessary: Powers the AI travel planner feature (text-based only)

### Why sharing is necessary:
The app relies on specialized third-party services for authentication, data storage, and AI-powered features. This is standard practice for modern cloud-based mobile applications.

---

## Section 6: Security Practices Summary

| Practice | Status |
|----------|--------|
| Data encrypted in transit | Yes (TLS/HTTPS) |
| Data encrypted at rest | Yes (Convex) |
| Users can request deletion | Yes |
| Security review | Convex and Better-Auth manage infrastructure security |

---

## Quick Reference Table for Form

| Data Type | Collected | Shared | Ephemeral | Optional | Purpose |
|-----------|-----------|--------|-----------|----------|---------|
| Email | Yes | No | No | No | Account |
| Name | Yes | No | No | Yes | Account |
| User ID | Yes | No | No | No | Functionality |
| Photos | Yes | No | No | Yes | Functionality |
| App activity | Yes | No | No | No | Analytics |
| Device ID | Yes | No | No | No | Functionality |

---

## Important Notes for Form Completion

1. **Be honest** - Google verifies this information
2. **Backend services** - We use Better-Auth (auth) and Convex (database)
3. **No audio/voice data** - App does not collect any audio or voice data
4. **Database sharing** - User data is shared with Convex for storage (required for app functionality)
5. **Authentication sharing** - User credentials are managed by Better-Auth running on the Convex backend (no separate third-party auth service)
6. **Photos** - Listing, service, and verification images are stored in Convex. Travel moment photos never leave the device.
7. **Optional data** - Name and photos are optional features
8. **Account deletion** - Fully implemented in Settings > Delete Account

---

## After Completing the Form

Google will display a Data Safety section on your app listing showing:
- What data is collected
- Whether data is encrypted
- Whether users can request deletion
- What data is shared and with whom

This transparency builds user trust.

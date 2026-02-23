# Patient Dashboard, Booking System & Health Card — Design

## Summary

Build a unified patient dashboard (`/dashboard`) with four sections: Appointments, Health Card, Profile, and Symptom History. Enhance the existing doctor dashboard with appointment management and availability scheduling.

## Patient Dashboard (`/dashboard`)

### Route & Layout
- Protected route — redirects to `/sign-in` if unauthenticated
- Sidebar nav (desktop) / bottom tabs (mobile) with 4 sections
- Bilingual AR/EN, RTL support, red primary color
- Fonts: Instrument Serif headings, Outfit body, Cairo for Arabic

### Section 1: Appointments (المواعيد)
- **Upcoming appointments** — cards with doctor name, specialty, date/time, status badge (pending/confirmed)
- Actions: cancel, reschedule
- **"Book New Appointment" button** — reuses existing `BookingForm` in a modal
- **Past appointments** — collapsible section (completed/cancelled)
- Empty state with CTA to book first appointment

### Section 2: Health Card (البطاقة الصحية)
- **Visual card** with glass/gradient styling:
  - Card number (TBR-XXX-XXX) + copy button
  - Patient name, blood type badge
  - Allergies & chronic conditions as tag chips
  - Current medications (name + dosage)
  - Emergency contact (name, phone, relationship)
  - Emergency PIN display/reset
- **Edit Card** button opens edit modal
- **Create Card** flow if none exists (form with all fields)
- **Medical Records** below card:
  - Filter tabs: All | Prescriptions | Lab Results | Diagnoses | Vaccinations | Surgeries
  - Record cards: title, date, doctor name, type icon
  - Expandable details (prescription meds, lab values with normal/abnormal)
  - "Add Record" button → form (type, title, description, date, doctor)
  - Delete per record

### Section 3: Profile (الملف الشخصي)
- Edit: name, phone, wilaya, language preference
- Uses existing `updateProfile` mutation

### Section 4: Symptom History (تحليل الأعراض)
- List of past AI analyses from `symptomAnalyses` table
- Cards: date, symptoms summary, severity
- Click to view full analysis result

## Doctor Dashboard (Enhanced)

### Layout
- Same sidebar/tab pattern as patient dashboard
- CV upload + approval flow remains as-is (shown when not approved)
- Management tabs unlock only after `isApproved === true`

### Tab 1: Appointments (المواعيد)
- **Today's appointments** — highlighted section
- **Upcoming list** — cards with patient name, date/time, type, status
- Actions: Confirm, Complete (with notes modal), Cancel
- Stats bar: upcoming count, confirmed today, completed this week

### Tab 2: Availability Schedule (جدول العمل)
- Weekly grid: rows for Sat-Fri (Algerian work week)
- Per day: toggle on/off, start time, end time
- Slot duration selector: 15/20/30/60 min (default 30)
- "Block specific dates" — date picker for days off
- Save persists to `availabilitySchedules` table

### Tab 3: Profile (الملف الشخصي)
- Edit: name, specialty, phone, wilaya, bio
- CV status display

## Backend Changes Needed

### New Convex Functions
- `doctors/queries.ts` — `getDoctorAppointments(doctorId, status?)` for doctor-side view
- `doctors/mutations.ts` — `setAvailabilitySchedule(doctorId, schedule)` for weekly schedule
- `symptoms/queries.ts` — `getMyAnalyses` already exists (verify)
- `users/queries.ts` — `getCurrentUser` already exists (verify)

### Schema Changes
- `availabilitySchedules` may need a `weeklySchedule` field for recurring patterns (vs per-date slots)
- Or: new `doctorSchedules` table with `{ doctorId, dayOfWeek, startTime, endTime, slotDuration, isWorking }`

## New Files
- `src/pages/PatientDashboard.jsx` — main dashboard page
- `src/components/dashboard/AppointmentsSection.jsx`
- `src/components/dashboard/HealthCardSection.jsx`
- `src/components/dashboard/ProfileSection.jsx`
- `src/components/dashboard/SymptomHistorySection.jsx`
- Update `src/pages/DoctorDashboard.jsx` with new tabs
- `src/components/doctor/DoctorAppointments.jsx`
- `src/components/doctor/AvailabilitySchedule.jsx`

## Implementation Order
1. Backend: Add any missing queries/mutations, schema changes
2. Patient Dashboard shell (route + layout + nav)
3. Appointments section (reuse BookingForm)
4. Health Card section (create + view + edit + records)
5. Profile section
6. Symptom History section
7. Doctor Dashboard: Appointments management
8. Doctor Dashboard: Availability schedule editor

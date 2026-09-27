import { describe, expect, it, vi } from 'vitest'
import { BOOKING_ERRORS } from '../../convex/bookings/logic'
import { SERVICE_ERRORS } from '../../convex/services/logic'
import { CONTACT_PHONE_ERRORS } from '../../convex/users/contactPhone'
import { bookingErrorText, phoneErrorText, refusalKind } from './errors'

// The server's own strings, so a change of wording there fails here.
const refusal = (text) => ({ data: text })
const DAILY_BOOKINGS =
  'لقد وصلت إلى الحد اليومي للحجوزات. يرجى المحاولة غدًا. / You\'ve reached today\'s booking limit. Please try again tomorrow.'
const betterAuth = (message) => ({ error: { message, status: 400 } })

describe('bookingErrorText for a stay', () => {
  const cases = [
    [BOOKING_ERRORS.PHONE_REQUIRED, 'Verify your phone number to book.', 'وثّق رقم جوالك لإتمام الحجز.'],
    [BOOKING_ERRORS.OWN_LISTING, 'You cannot book your own listing.', 'لا يمكنك حجز مكانك الخاص.'],
    [BOOKING_ERRORS.NO_AVAILABILITY, 'No rooms available for those dates', 'لا توجد وحدات متاحة لهذه التواريخ'],
    [BOOKING_ERRORS.DUPLICATE, 'You already have a booking for those dates.', 'لديك حجز قائم لهذه التواريخ.'],
    [BOOKING_ERRORS.TOO_MANY_GUESTS, 'That is more guests than this place takes.', 'عدد الضيوف أكبر مما يستقبله هذا المكان.'],
    [BOOKING_ERRORS.INVALID_GUESTS, 'That is more guests than this place takes.', 'عدد الضيوف أكبر مما يستقبله هذا المكان.'],
    [BOOKING_ERRORS.CHECKOUT_BEFORE_CHECKIN, 'Choose valid dates.', 'اختر تواريخ صحيحة.'],
    [BOOKING_ERRORS.PAST_CHECK_IN, 'Choose valid dates.', 'اختر تواريخ صحيحة.'],
    [BOOKING_ERRORS.INVALID_DATES, 'Choose valid dates.', 'اختر تواريخ صحيحة.'],
    [BOOKING_ERRORS.TOO_MANY_NIGHTS, 'Choose valid dates.', 'اختر تواريخ صحيحة.'],
    [BOOKING_ERRORS.NOT_BOOKABLE, 'This place is not taking bookings right now.', 'هذا المكان لا يستقبل الحجوزات حاليًا.'],
    [BOOKING_ERRORS.LISTING_UNAVAILABLE, 'This place is not taking bookings right now.', 'هذا المكان لا يستقبل الحجوزات حاليًا.'],
    [BOOKING_ERRORS.NO_PRICE, 'This place is not taking bookings right now.', 'هذا المكان لا يستقبل الحجوزات حاليًا.'],
    [BOOKING_ERRORS.NOT_PENDING, 'This booking is already closed.', 'هذا الحجز مغلق بالفعل.'],
    [BOOKING_ERRORS.ALREADY_CLOSED, 'This booking is already closed.', 'هذا الحجز مغلق بالفعل.'],
    [BOOKING_ERRORS.STAY_STARTED, 'A stay cannot be cancelled after it starts. Contact the host.', 'لا يمكن الإلغاء بعد بدء الإقامة. تواصل مع المضيف.'],
    [DAILY_BOOKINGS, "You've reached today's booking limit.", 'وصلت إلى الحد اليومي للحجوزات.'],
  ]
  it.each(cases)('maps %s', (server, en, ar) => {
    expect(bookingErrorText(refusal(server), 'en')).toBe(en)
    expect(bookingErrorText(refusal(server), 'ar')).toBe(ar)
  })

  it('says the session ended for either sign-in refusal', () => {
    expect(bookingErrorText(refusal('Not authenticated'), 'en')).toBe('Your session expired. Please sign in again.')
    expect(bookingErrorText(new Error('Not authenticated'), 'ar')).toBe('انتهت جلستك. الرجاء تسجيل الدخول مرة أخرى.')
  })
})

describe('bookingErrorText for a service', () => {
  const cases = [
    [SERVICE_ERRORS.OWN_SERVICE, "You can't book your own service.", 'لا يمكنك حجز خدمتك الخاصة.'],
    [SERVICE_ERRORS.DUPLICATE, 'You already have a request for this service that day.', 'لديك طلب قائم لهذه الخدمة في ذلك اليوم.'],
    [SERVICE_ERRORS.TOO_MANY_PEOPLE, "That's more people than this service takes.", 'هذا العدد أكبر مما تسمح به الخدمة.'],
    [SERVICE_ERRORS.INVALID_HOURS, 'Choose a valid number of hours or days.', 'اختر عددًا صحيحًا من الساعات أو الأيام.'],
    [SERVICE_ERRORS.INVALID_DAYS, 'Choose a valid number of hours or days.', 'اختر عددًا صحيحًا من الساعات أو الأيام.'],
    [SERVICE_ERRORS.PAST_TIME, 'That time has passed. Pick a later time.', 'هذا الوقت مضى. اختر وقتًا لاحقًا.'],
    [SERVICE_ERRORS.PAST_DATE, 'That time has passed. Pick a later time.', 'هذا الوقت مضى. اختر وقتًا لاحقًا.'],
    [SERVICE_ERRORS.INVALID_DATE, 'Pick a day first', 'اختر اليوم أولًا'],
    [SERVICE_ERRORS.INVALID_TIME, 'Pick a start time', 'اختر وقت البدء'],
    [SERVICE_ERRORS.SERVICE_UNAVAILABLE, "This service isn't available right now.", 'هذه الخدمة غير متاحة حاليًا.'],
    [SERVICE_ERRORS.NOT_BOOKABLE, "This service isn't available right now.", 'هذه الخدمة غير متاحة حاليًا.'],
    [SERVICE_ERRORS.NO_PRICE, "This service isn't available right now.", 'هذه الخدمة غير متاحة حاليًا.'],
    [SERVICE_ERRORS.SERVICE_STARTED, "A service can't be cancelled after it starts. Contact the provider.", 'لا يمكن الإلغاء بعد بدء الخدمة. تواصل مع مقدم الخدمة.'],
    [BOOKING_ERRORS.PHONE_REQUIRED, 'Verify your phone number to book.', 'وثّق رقم جوالك لإتمام الحجز.'],
    [DAILY_BOOKINGS, "You've reached today's booking limit.", 'وصلت إلى الحد اليومي للحجوزات.'],
  ]
  it.each(cases)('maps %s', (server, en, ar) => {
    expect(bookingErrorText(refusal(server), 'en', 'service')).toBe(en)
    expect(bookingErrorText(refusal(server), 'ar', 'service')).toBe(ar)
  })
})

describe('what nobody mapped', () => {
  it("shows the server's own half of a bilingual refusal", () => {
    expect(bookingErrorText(refusal(SERVICE_ERRORS.INVALID_PARTY), 'en', 'service')).toBe('Invalid number of people.')
    expect(bookingErrorText(refusal(SERVICE_ERRORS.INVALID_PARTY), 'ar', 'service')).toBe('عدد الأشخاص غير صحيح.')
  })

  it('treats a refused id as a bad link, not a bug: generic text, nothing logged', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const refused = new Error(
      '[CONVEX Q(bookings/queries:quoteStay)] Server Error\nArgumentValidationError: Value does not match validator.'
    )
    expect(bookingErrorText(refused, 'en')).toBe('Please try again later')
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('never shows a person an internal error', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(bookingErrorText(new Error('[CONVEX M(bookings/mutations:createStayBooking)] Server Error'), 'en')).toBe(
      'Please try again later'
    )
    expect(bookingErrorText(new TypeError('Failed to fetch'), 'ar')).toBe('يرجى المحاولة لاحقاً')
    expect(bookingErrorText(undefined, 'en')).toBe('Please try again later')
    // convexQuery's own words for a failed request are not for a person either.
    expect(bookingErrorText(new Error('Convex query bookings/queries:quoteService failed: HTTP 429'), 'en')).toBe(
      'Please try again later'
    )
    expect(bookingErrorText(new Error('VITE_CONVEX_URL is not set'), 'en')).toBe('Please try again later')
    errors.mockRestore()
  })
})

describe('phoneErrorText', () => {
  it('explains a wrong, lapsed or overused code', () => {
    expect(phoneErrorText(betterAuth('Invalid OTP'), 'en')).toBe("That code isn't right. Check the text message and try again.")
    expect(phoneErrorText(betterAuth('Invalid OTP'), 'ar')).toBe('الرمز غير صحيح. تحقق من الرسالة النصية وحاول مرة أخرى.')
    expect(phoneErrorText(betterAuth('OTP expired'), 'en')).toBe('This code has expired. Press “Resend code” to get a new one.')
    expect(phoneErrorText(betterAuth('OTP not found'), 'en')).toBe('This code has expired. Press “Resend code” to get a new one.')
    expect(phoneErrorText(betterAuth('Too many attempts'), 'ar')).toBe(
      'أدخلت رموزًا خاطئة كثيرة. اضغط «إعادة إرسال الرمز» للحصول على رمز جديد.'
    )
  })

  it('says when a number belongs to someone else, and that its bookings are there', () => {
    // On the web the traveller may be signed in with Google while their
    // bookings live on the phone account: say how to reach them.
    expect(phoneErrorText(betterAuth('Phone number already exists'), 'en')).toBe(
      'This number already belongs to another Hasio account. Sign in with that number instead, or use a different one.'
    )
    expect(phoneErrorText(betterAuth('Phone number already exists'), 'ar')).toBe(
      'هذا الرقم مرتبط بحساب آخر في Hasio. سجّل الدخول بهذا الرقم بدلًا من ذلك، أو استخدم رقمًا مختلفًا.'
    )
  })

  it('maps the contact-number refusals and its daily limit', () => {
    expect(phoneErrorText(refusal(CONTACT_PHONE_ERRORS.INVALID_SAUDI_MOBILE), 'en')).toBe(
      'Enter a valid Saudi mobile number (05XXXXXXXX)'
    )
    expect(phoneErrorText(refusal(CONTACT_PHONE_ERRORS.SMS_IS_LIVE), 'ar')).toBe(
      'أرقام السعودية تُوثَّق برمز SMS الآن. أرسل رمزًا إلى رقمك.'
    )
    expect(
      phoneErrorText(refusal('لقد تجاوزت الحد المسموح لهذا اليوم. يرجى المحاولة غدًا. / Daily limit reached. Please try again tomorrow.'), 'en')
    ).toBe("You've changed your number too many times today. Try again tomorrow.")
  })

  it('reads a malformed number and a wrong email password', () => {
    expect(phoneErrorText(betterAuth('Invalid phone number'), 'en')).toBe('Enter a valid mobile number.')
    expect(phoneErrorText(betterAuth('Invalid email or password'), 'ar')).toBe('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
  })

  it("passes the SMS spend guard's own words through in the page's language", () => {
    const limit = betterAuth('طلبت رموزًا كثيرة اليوم. حاول لاحقًا. / Too many codes requested today. Please try again later.')
    expect(phoneErrorText(limit, 'en')).toBe('Too many codes requested today. Please try again later.')
    expect(phoneErrorText(limit, 'ar')).toBe('طلبت رموزًا كثيرة اليوم. حاول لاحقًا.')
  })
})

describe('refusalKind', () => {
  it('names what the page should offer next', () => {
    expect(refusalKind(refusal(BOOKING_ERRORS.DUPLICATE))).toBe('duplicate')
    expect(refusalKind(refusal(SERVICE_ERRORS.DUPLICATE))).toBe('duplicate')
    expect(refusalKind(refusal(BOOKING_ERRORS.NO_AVAILABILITY))).toBe('dates')
    expect(refusalKind(refusal(BOOKING_ERRORS.TOO_MANY_NIGHTS))).toBe('dates')
    expect(refusalKind(refusal(BOOKING_ERRORS.TOO_MANY_GUESTS))).toBe('dates')
    expect(refusalKind(refusal(SERVICE_ERRORS.PAST_TIME))).toBe('dates')
    expect(refusalKind(refusal(SERVICE_ERRORS.TOO_MANY_PEOPLE))).toBe('dates')
    expect(refusalKind(refusal(BOOKING_ERRORS.NOT_BOOKABLE))).toBe('unavailable')
    expect(refusalKind(refusal(SERVICE_ERRORS.SERVICE_UNAVAILABLE))).toBe('unavailable')
    expect(refusalKind(refusal(BOOKING_ERRORS.PHONE_REQUIRED))).toBe('phone')
    expect(refusalKind(refusal('Not authenticated'))).toBe('auth')
    expect(refusalKind(refusal(BOOKING_ERRORS.OWN_LISTING))).toBe('own')
    expect(refusalKind(refusal(SERVICE_ERRORS.OWN_SERVICE))).toBe('own')
    expect(refusalKind(refusal(DAILY_BOOKINGS))).toBe('limit')
    expect(refusalKind(refusal(BOOKING_ERRORS.ALREADY_CLOSED))).toBe('closed')
    expect(refusalKind(refusal(BOOKING_ERRORS.STAY_STARTED))).toBe('started')
    expect(refusalKind(new Error('Failed to fetch'))).toBeNull()
  })
})

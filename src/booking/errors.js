/**
 * What a traveller reads when the server says no.
 *
 * The server writes one string, Arabic then English ("عربي / English"),
 * because it cannot know the reader's language. Like the app
 * (lib/bookingError.ts, lib/serviceBookingError.ts), the site matches the
 * English half — which makes that wording an API — and shows the app's own
 * sentence for it, in both languages, word for word from
 * hasio-mobile-app/constants/translations.ts. A refusal nobody mapped shows
 * the server's half in the page's language; anything internal (a stack, the
 * redacted "Server Error", a network failure) shows the generic line and goes
 * to the console.
 */

const T = {
  phoneRequired: ['Verify your phone number to book.', 'وثّق رقم جوالك لإتمام الحجز.'],
  ownListing: ['You cannot book your own listing.', 'لا يمكنك حجز مكانك الخاص.'],
  noAvailability: ['No rooms available for those dates', 'لا توجد وحدات متاحة لهذه التواريخ'],
  duplicateStay: ['You already have a booking for those dates.', 'لديك حجز قائم لهذه التواريخ.'],
  maxGuests: ['That is more guests than this place takes.', 'عدد الضيوف أكبر مما يستقبله هذا المكان.'],
  invalidDates: ['Choose valid dates.', 'اختر تواريخ صحيحة.'],
  listingUnavailable: ['This place is not taking bookings right now.', 'هذا المكان لا يستقبل الحجوزات حاليًا.'],
  closed: ['This booking is already closed.', 'هذا الحجز مغلق بالفعل.'],
  stayStarted: ['A stay cannot be cancelled after it starts. Contact the host.', 'لا يمكن الإلغاء بعد بدء الإقامة. تواصل مع المضيف.'],
  dailyLimit: ["You've reached today's booking limit.", 'وصلت إلى الحد اليومي للحجوزات.'],
  session: ['Your session expired. Please sign in again.', 'انتهت جلستك. الرجاء تسجيل الدخول مرة أخرى.'],
  generic: ['Please try again later', 'يرجى المحاولة لاحقاً'],
  ownService: ["You can't book your own service.", 'لا يمكنك حجز خدمتك الخاصة.'],
  duplicateService: ['You already have a request for this service that day.', 'لديك طلب قائم لهذه الخدمة في ذلك اليوم.'],
  tooManyPeople: ["That's more people than this service takes.", 'هذا العدد أكبر مما تسمح به الخدمة.'],
  invalidQuantity: ['Choose a valid number of hours or days.', 'اختر عددًا صحيحًا من الساعات أو الأيام.'],
  pastTime: ['That time has passed. Pick a later time.', 'هذا الوقت مضى. اختر وقتًا لاحقًا.'],
  pickDay: ['Pick a day first', 'اختر اليوم أولًا'],
  pickTime: ['Pick a start time', 'اختر وقت البدء'],
  serviceUnavailable: ["This service isn't available right now.", 'هذه الخدمة غير متاحة حاليًا.'],
  serviceStarted: ["A service can't be cancelled after it starts. Contact the provider.", 'لا يمكن الإلغاء بعد بدء الخدمة. تواصل مع مقدم الخدمة.'],
  codeWrong: ["That code isn't right. Check the text message and try again.", 'الرمز غير صحيح. تحقق من الرسالة النصية وحاول مرة أخرى.'],
  codeExpired: ['This code has expired. Press “Resend code” to get a new one.', 'انتهت صلاحية هذا الرمز. اضغط «إعادة إرسال الرمز» للحصول على رمز جديد.'],
  tooManyAttempts: ['Too many wrong codes. Press “Resend code” to get a new one.', 'أدخلت رموزًا خاطئة كثيرة. اضغط «إعادة إرسال الرمز» للحصول على رمز جديد.'],
  phoneTaken: ['This number already belongs to another Hasio account. Use a different number.', 'هذا الرقم مرتبط بحساب آخر في Hasio. استخدم رقمًا مختلفًا.'],
  invalidSaudi: ['Enter a valid Saudi mobile number (05XXXXXXXX)', 'أدخل رقم جوال سعودي صحيح (05XXXXXXXX)'],
  smsLive: ['Saudi numbers are confirmed by SMS code now. Please send yourself a code.', 'أرقام السعودية تُوثَّق برمز SMS الآن. أرسل رمزًا إلى رقمك.'],
  changesLimit: ["You've changed your number too many times today. Try again tomorrow.", 'غيّرت رقمك مرات كثيرة اليوم. حاول مرة أخرى غدًا.'],
  invalidPhone: ['Enter a valid mobile number.', 'أدخل رقم جوال صحيحًا.'],
  badPassword: ['Invalid email or password.', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'],
}

// Order matters: the first match wins, as in the app.
const STAY_RULES = [
  [/verified phone/i, 'phoneRequired'],
  [/own listing/i, 'ownListing'],
  [/No availability/i, 'noAvailability'],
  [/already have an active booking/i, 'duplicateStay'],
  [/Too many guests|Invalid number of guests/i, 'maxGuests'],
  [/Check-out must be after|cannot be in the past|Choose valid dates|Maximum stay/i, 'invalidDates'],
  [/not available for booking|not available right now|has not set a nightly price/i, 'listingUnavailable'],
  [/no longer pending|already closed/i, 'closed'],
  [/after it starts/i, 'stayStarted'],
  [/booking limit/i, 'dailyLimit'],
  [/Not authenticated|signed in/i, 'session'],
]

const SERVICE_RULES = [
  [/verified phone/i, 'phoneRequired'],
  [/own service/i, 'ownService'],
  [/active request for this service/i, 'duplicateService'],
  [/Too many people/i, 'tooManyPeople'],
  [/Hours must be between|Days must be between/i, 'invalidQuantity'],
  [/start time has already passed|date cannot be in the past/i, 'pastTime'],
  [/Choose a valid date/i, 'pickDay'],
  [/Choose a valid start time/i, 'pickTime'],
  [/not available right now|not available for booking|has not set a price|Service not found/i, 'serviceUnavailable'],
  [/after it starts/i, 'serviceStarted'],
  [/no longer pending|already closed/i, 'closed'],
  [/booking limit/i, 'dailyLimit'],
  [/Not authenticated|signed in/i, 'session'],
]

const PHONE_RULES = [
  [/Invalid OTP/i, 'codeWrong'],
  [/OTP expired|OTP not found/i, 'codeExpired'],
  [/Too many attempts/i, 'tooManyAttempts'],
  [/Phone number already exists/i, 'phoneTaken'],
  [/valid Saudi mobile/i, 'invalidSaudi'],
  [/confirmed by SMS code now/i, 'smsLive'],
  // The contact number is the only daily limit this step can meet.
  [/Daily limit reached/i, 'changesLimit'],
  [/Invalid phone number(?! or)/i, 'invalidPhone'],
  [/Invalid email or password/i, 'badPassword'],
  [/Not authenticated|signed in/i, 'session'],
]

const ARABIC = /[؀-ۿ]/
const INTERNAL = /\[CONVEX|Server Error|Uncaught|at [\w$.]+ \(|could not find public function|Failed to fetch|NetworkError|Load failed/i

/** The text the server (or Better Auth) actually sent, wherever it put it. */
export function serverText(err) {
  if (!err) return ''
  if (typeof err === 'string') return err
  const data = err.data
  if (typeof data === 'string') return data
  if (typeof data?.message === 'string') return data.message
  if (typeof err.error?.message === 'string') return err.error.message
  if (typeof err.message === 'string') return err.message
  return ''
}

const pick = (key, lang) => T[key][lang === 'ar' ? 1 : 0]

function fallback(err, text, lang) {
  if (!text || INTERNAL.test(text)) {
    if (err) console.error('[booking] unexpected error:', err)
    return pick('generic', lang)
  }
  const parts = text.split(' / ')
  if (parts.length >= 2 && ARABIC.test(parts[0])) {
    return lang === 'ar' ? parts[0].trim() : parts.slice(1).join(' / ').trim()
  }
  if (ARABIC.test(text) === (lang === 'ar')) return text
  return pick('generic', lang)
}

function mapped(err, lang, rules) {
  const text = serverText(err).trim()
  for (const [pattern, key] of rules) if (pattern.test(text)) return pick(key, lang)
  return fallback(err, text, lang)
}

/** A refusal of a booking, its quote or a cancellation, in the page's language. */
export function bookingErrorText(err, lang, kind = 'stay') {
  return mapped(err, lang, kind === 'service' ? SERVICE_RULES : STAY_RULES)
}

/** A refusal from the sign-in and phone steps (Better Auth and setContactPhone). */
export function phoneErrorText(err, lang) {
  return mapped(err, lang, PHONE_RULES)
}

const KINDS = [
  [/already have an active booking|active request for this service/i, 'duplicate'],
  [/No availability|Too many guests|Invalid number of guests|Check-out must be after|cannot be in the past|Choose valid dates|Maximum stay|start time has already passed|Too many people|Hours must be between|Days must be between|Choose a valid (date|start time)|Invalid number of people/i, 'dates'],
  [/not available for booking|not available right now|has not set a (nightly )?price|Service not found/i, 'unavailable'],
  [/verified phone/i, 'phone'],
  [/Not authenticated|signed in/i, 'auth'],
  [/own listing|own service/i, 'own'],
  [/booking limit/i, 'limit'],
  [/no longer pending|already closed/i, 'closed'],
  [/after it starts/i, 'started'],
]

/**
 * What a page should offer after a refusal: a link to My trips for a
 * duplicate, "Change dates" when the choice is the problem, the phone or
 * sign-in step again. Null when there is nothing better than the text.
 */
export function refusalKind(err) {
  const text = serverText(err)
  for (const [pattern, kind] of KINDS) if (pattern.test(text)) return kind
  return null
}

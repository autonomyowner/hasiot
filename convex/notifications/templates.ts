/**
 * Notification and email copy, rendered in both languages at write time.
 *
 * Both languages are stored on the row rather than rendered on read for two
 * reasons: the recipient can switch language after the fact, and re-rendering
 * an old notification would need the booking it describes to still exist and
 * still say the same thing. A notification is a record of what happened, so it
 * should not change when the underlying booking does.
 */

export const NOTIFICATION_EVENTS = [
  "booking.requested",
  "booking.confirmed",
  "booking.declined",
  "booking.expired",
  "booking.cancelled",
  "booking.cancelled_admin",
  "booking.reminder",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type TemplateInput = {
  listingName_en: string;
  listingName_ar: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  guests?: number;
  totalAmount?: number;
  currency?: string;
  confirmationCode?: string;
  guestName?: string;
  reason?: string;
  checkInTime?: string;
  address?: string;
};

export type RenderedNotification = {
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
};

const money = (amount?: number, currency = "SAR") =>
  amount === undefined ? "" : `${currency} ${amount.toLocaleString("en-US")}`;

const dateRangeEn = (i: TemplateInput) =>
  i.checkIn && i.checkOut ? `${i.checkIn} to ${i.checkOut}` : "";

const dateRangeAr = (i: TemplateInput) =>
  i.checkIn && i.checkOut ? `${i.checkIn} إلى ${i.checkOut}` : "";

const nightsEn = (n?: number) => (n === 1 ? "1 night" : `${n} nights`);
// Arabic pluralises by count: 1 ليلة, 2 ليلتان, 3-10 ليالٍ, 11+ ليلة.
const nightsAr = (n?: number) => {
  if (n === undefined) return "";
  if (n === 1) return "ليلة واحدة";
  if (n === 2) return "ليلتان";
  if (n <= 10) return `${n} ليالٍ`;
  return `${n} ليلة`;
};

const guestsEn = (n?: number) => (n === 1 ? "1 guest" : `${n} guests`);
const guestsAr = (n?: number) => {
  if (n === undefined) return "";
  if (n === 1) return "ضيف واحد";
  if (n === 2) return "ضيفان";
  if (n <= 10) return `${n} ضيوف`;
  return `${n} ضيفًا`;
};

const codeEn = (code?: string) => (code ? ` Code ${code}.` : "");
const codeAr = (code?: string) => (code ? ` رمز التأكيد ${code}.` : "");

const reasonEn = (reason?: string) => (reason ? ` Reason: ${reason}` : "");
const reasonAr = (reason?: string) => (reason ? ` السبب: ${reason}` : "");

export function renderNotification(
  event: NotificationEvent,
  i: TemplateInput
): RenderedNotification {
  const guest = i.guestName?.trim() || "A guest";
  const guestAr = i.guestName?.trim() || "ضيف";
  const total = money(i.totalAmount, i.currency);

  switch (event) {
    case "booking.requested":
      return {
        title_en: "New booking request",
        title_ar: "طلب حجز جديد",
        body_en:
          `${guest} requested ${nightsEn(i.nights)} at ${i.listingName_en}, ` +
          `${dateRangeEn(i)}, ${guestsEn(i.guests)}. Total ${total}.${codeEn(i.confirmationCode)}`,
        body_ar:
          `${guestAr} طلب ${nightsAr(i.nights)} في ${i.listingName_ar}، ` +
          `${dateRangeAr(i)}، ${guestsAr(i.guests)}. الإجمالي ${total}.${codeAr(i.confirmationCode)}`,
      };

    case "booking.confirmed":
      return {
        title_en: "Booking confirmed",
        title_ar: "تم تأكيد حجزك",
        body_en:
          `${i.listingName_en} confirmed your stay, ${dateRangeEn(i)}.` +
          (i.checkInTime ? ` Check-in from ${i.checkInTime}.` : "") +
          codeEn(i.confirmationCode),
        body_ar:
          `أكد ${i.listingName_ar} إقامتك، ${dateRangeAr(i)}.` +
          (i.checkInTime ? ` تسجيل الوصول من ${i.checkInTime}.` : "") +
          codeAr(i.confirmationCode),
      };

    case "booking.declined":
      return {
        title_en: "Request declined",
        title_ar: "تم رفض طلب الحجز",
        body_en:
          `${i.listingName_en} could not take your booking for ${dateRangeEn(i)}.` +
          `${reasonEn(i.reason)} You have not been charged.`,
        body_ar:
          `تعذّر على ${i.listingName_ar} قبول حجزك في ${dateRangeAr(i)}.` +
          `${reasonAr(i.reason)} لم يتم خصم أي مبلغ.`,
      };

    case "booking.expired":
      return {
        title_en: "Request expired",
        title_ar: "انتهت صلاحية الطلب",
        body_en:
          `${i.listingName_en} did not respond within 48 hours, so your request for ` +
          `${dateRangeEn(i)} was closed. Try other dates or another place.`,
        body_ar:
          `لم يرد ${i.listingName_ar} خلال 48 ساعة، لذا أُغلق طلبك في ` +
          `${dateRangeAr(i)}. جرّب تواريخ أخرى أو مكانًا آخر.`,
      };

    case "booking.cancelled":
      return {
        title_en: "Booking cancelled",
        title_ar: "تم إلغاء حجز",
        body_en:
          `${guest} cancelled their stay at ${i.listingName_en}, ${dateRangeEn(i)}.` +
          codeEn(i.confirmationCode),
        body_ar:
          `ألغى ${guestAr} إقامته في ${i.listingName_ar}، ${dateRangeAr(i)}.` +
          codeAr(i.confirmationCode),
      };

    case "booking.cancelled_admin":
      return {
        title_en: "Booking cancelled",
        title_ar: "تم إلغاء حجزك",
        body_en:
          `Hasio support cancelled your booking at ${i.listingName_en}, ${dateRangeEn(i)}.` +
          `${reasonEn(i.reason)}`,
        body_ar:
          `ألغى فريق هاسيو حجزك في ${i.listingName_ar}، ${dateRangeAr(i)}.` +
          `${reasonAr(i.reason)}`,
      };

    case "booking.reminder":
      return {
        title_en: "Your stay is tomorrow",
        title_ar: "إقامتك غدًا",
        body_en:
          `${i.listingName_en}, check-in ${i.checkIn}` +
          (i.checkInTime ? ` from ${i.checkInTime}` : "") +
          `.${codeEn(i.confirmationCode)}` +
          (i.address ? ` ${i.address}` : ""),
        body_ar:
          `${i.listingName_ar}، تسجيل الوصول ${i.checkIn}` +
          (i.checkInTime ? ` من ${i.checkInTime}` : "") +
          `.${codeAr(i.confirmationCode)}` +
          (i.address ? ` ${i.address}` : ""),
      };
  }
}

export type RenderedEmail = { subject: string; html: string; text: string };

/** Escape for HTML text nodes and attribute values. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The email body for a booking event.
 *
 * Styling is inline and the layout is a table because that is what survives
 * Gmail, Outlook and Apple Mail — none of them can be relied on for a
 * stylesheet, and several strip <style> blocks outright.
 */
export function renderEmail(
  event: NotificationEvent,
  input: TemplateInput,
  locale: "ar" | "en"
): RenderedEmail {
  const rendered = renderNotification(event, input);
  const isArabic = locale === "ar";
  const title = isArabic ? rendered.title_ar : rendered.title_en;
  const body = isArabic ? rendered.body_ar : rendered.body_en;
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";

  const rows: Array<[string, string | undefined]> = isArabic
    ? [
        ["المكان", input.listingName_ar],
        ["الوصول", input.checkIn],
        ["المغادرة", input.checkOut],
        ["الضيوف", input.guests === undefined ? undefined : guestsAr(input.guests)],
        ["الإجمالي", input.totalAmount === undefined ? undefined : money(input.totalAmount, input.currency)],
        ["رمز التأكيد", input.confirmationCode],
      ]
    : [
        ["Place", input.listingName_en],
        ["Check-in", input.checkIn],
        ["Check-out", input.checkOut],
        ["Guests", input.guests === undefined ? undefined : guestsEn(input.guests)],
        ["Total", input.totalAmount === undefined ? undefined : money(input.totalAmount, input.currency)],
        ["Confirmation code", input.confirmationCode],
      ];

  const detailRows = rows
    .filter((row): row is [string, string] => typeof row[1] === "string" && row[1].length > 0)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;color:#6B6257;font-size:14px">${esc(label)}</td>` +
        `<td style="padding:6px 0;color:#1C1917;font-size:14px;font-weight:600">${esc(value)}</td></tr>`
    )
    .join("");

  const payNote = isArabic
    ? "الدفع يتم مباشرة في مكان الإقامة."
    : "Payment is made directly at the property.";

  const html = `<div dir="${dir}" style="margin:0;padding:24px;background:#FAF7F2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:24px;text-align:${align}">
    <div style="color:#0D7A5F;font-size:18px;font-weight:700;margin-bottom:4px">Hasio</div>
    <h1 style="margin:12px 0 8px;font-size:20px;color:#1C1917">${esc(title)}</h1>
    <p style="margin:0 0 16px;color:#44403C;font-size:15px;line-height:1.6">${esc(body)}</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #E7E2DA;margin-top:8px">${detailRows}</table>
    <p style="margin:16px 0 0;color:#8A8178;font-size:13px">${esc(payNote)}</p>
  </div>
</div>`;

  const text = [
    title,
    "",
    body,
    "",
    ...rows
      .filter((row): row is [string, string] => typeof row[1] === "string" && row[1].length > 0)
      .map(([label, value]) => `${label}: ${value}`),
    "",
    payNote,
  ].join("\n");

  return { subject: `Hasio — ${title}`, html, text };
}

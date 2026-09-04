import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EVENTS,
  renderEmail,
  renderNotification,
  type TemplateInput,
} from "./templates";

const INPUT: TemplateInput = {
  listingName_en: "Al Koot Heritage Hotel",
  listingName_ar: "فندق القوت التراثي",
  checkIn: "2026-09-10",
  checkOut: "2026-09-13",
  nights: 3,
  guests: 2,
  totalAmount: 1950,
  currency: "SAR",
  confirmationCode: "HSO-7K3M2",
  guestName: "Sara Al Qahtani",
  checkInTime: "15:00",
  address: "King Fahd Road, Hofuf",
};

describe("renderNotification", () => {
  it("covers every event in both languages", () => {
    for (const event of NOTIFICATION_EVENTS) {
      const r = renderNotification(event, INPUT);
      for (const value of [r.title_en, r.title_ar, r.body_en, r.body_ar]) {
        expect(value.length).toBeGreaterThan(0);
        // A missing field must never reach a guest as "undefined".
        expect(value).not.toContain("undefined");
        expect(value).not.toContain("NaN");
      }
      // The Arabic copy must actually be Arabic, not the English string reused.
      expect(r.title_ar).toMatch(/[؀-ۿ]/);
      expect(r.body_ar).toMatch(/[؀-ۿ]/);
    }
  });

  it("tells the host who wants what", () => {
    const r = renderNotification("booking.requested", INPUT);
    expect(r.title_en).toBe("New booking request");
    expect(r.body_en).toBe(
      "Sara Al Qahtani requested 3 nights at Al Koot Heritage Hotel, 2026-09-10 to 2026-09-13, 2 guests. Total SAR 1,950. Code HSO-7K3M2."
    );
  });

  it("gives the guest the code and the check-in time", () => {
    const r = renderNotification("booking.confirmed", INPUT);
    expect(r.body_en).toContain("HSO-7K3M2");
    expect(r.body_en).toContain("Check-in from 15:00");
    expect(r.body_ar).toContain("15:00");
  });

  it("passes the host's reason through when declining", () => {
    const r = renderNotification("booking.declined", { ...INPUT, reason: "Closed for renovation" });
    expect(r.body_en).toContain("Closed for renovation");
    expect(r.body_ar).toContain("Closed for renovation");
    // No payment is taken in this phase, and a declined guest should be told so.
    expect(r.body_en).toContain("not been charged");
  });

  it("reads correctly with no reason given", () => {
    const r = renderNotification("booking.declined", INPUT);
    expect(r.body_en).not.toContain("Reason:");
    expect(r.body_ar).not.toContain("السبب:");
  });

  it("falls back to a generic name when the guest has none", () => {
    // Phone sign-ups have no name until they set one.
    const r = renderNotification("booking.requested", { ...INPUT, guestName: undefined });
    expect(r.body_en).toContain("A guest requested");
    expect(r.body_ar).toContain("ضيف");
  });

  it("pluralises Arabic by count, not by adding an s", () => {
    const nights = (n: number) =>
      renderNotification("booking.requested", { ...INPUT, nights: n }).body_ar;

    expect(nights(1)).toContain("ليلة واحدة");
    expect(nights(2)).toContain("ليلتان");
    expect(nights(3)).toContain("3 ليالٍ");
    expect(nights(15)).toContain("15 ليلة");
  });

  it("pluralises English too", () => {
    const body = (n: number) =>
      renderNotification("booking.requested", { ...INPUT, nights: n }).body_en;
    expect(body(1)).toContain("1 night at");
    expect(body(3)).toContain("3 nights at");
  });

  it("formats money with a thousands separator", () => {
    const r = renderNotification("booking.requested", { ...INPUT, totalAmount: 12500 });
    expect(r.body_en).toContain("SAR 12,500");
  });
});

describe("renderEmail", () => {
  it("builds a subject, HTML and a plain-text alternative", () => {
    const email = renderEmail("booking.confirmed", INPUT, "en");

    expect(email.subject).toBe("Hasio — Booking confirmed");
    expect(email.html).toContain("Al Koot Heritage Hotel");
    expect(email.html).toContain("HSO-7K3M2");
    expect(email.html).toContain("SAR 1,950");
    // Inline styles and a table, because that is what Gmail and Outlook render.
    expect(email.html).toContain("style=");
    expect(email.html).not.toContain("<style");
    expect(email.text).toContain("HSO-7K3M2");
    expect(email.text).not.toContain("<");
  });

  it("lays the Arabic version out right-to-left", () => {
    const email = renderEmail("booking.confirmed", INPUT, "ar");
    expect(email.html).toContain('dir="rtl"');
    expect(email.html).toContain("text-align:right");
    expect(email.subject).toMatch(/[؀-ۿ]/);
  });

  it("says payment happens at the property", () => {
    // No money moves through the app in this phase, and a guest reading a
    // confirmation will want to know whether they have already paid.
    expect(renderEmail("booking.confirmed", INPUT, "en").text).toContain(
      "Payment is made directly at the property."
    );
    expect(renderEmail("booking.confirmed", INPUT, "ar").text).toContain("الدفع يتم مباشرة");
  });

  it("escapes HTML so a listing name cannot inject markup", () => {
    const email = renderEmail(
      "booking.confirmed",
      { ...INPUT, listingName_en: '<script>alert("x")</script>' },
      "en"
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("omits rows for fields the booking does not have", () => {
    const email = renderEmail(
      "booking.expired",
      { listingName_en: "Somewhere", listingName_ar: "مكان ما" },
      "en"
    );
    expect(email.html).not.toContain("Check-in</td>");
    expect(email.html).not.toContain("undefined");
    expect(email.text).not.toContain("undefined");
  });
});

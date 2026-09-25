import { describe, expect, it } from "vitest";
import { translations } from "@/constants/translations";
import { formatPrice } from "./currency";
import { formatDateRange, formatISODate } from "./dates";
import {
  bookingActionErrorKey,
  countLabel,
  displayTotalSar,
  guestCanCancel,
  hostActionsFor,
  minuteNow,
  nightsLabel,
  partitionGuestBookings,
  partitionHostBookings,
  partitionProviderBookings,
  pluralForm,
  providerActionsFor,
  quoteFooterState,
  riyadhMoment,
  serviceAmountLabel,
  serviceDays,
  serviceWhen,
  shownStatus,
  telUrl,
  totalShownFor,
  type CountKey,
} from "./bookingDisplay";

// The real copy, not an identity translator: what is under test is that the
// words a count is shown in are the right ones, in both languages.
const en = (key: CountKey) => translations.en[key];
const ar = (key: CountKey) => translations.ar[key];

describe("pluralForm", () => {
  it("follows the forms Arabic counts in", () => {
    expect(pluralForm(1)).toBe("One");
    expect(pluralForm(2)).toBe("Two");
    for (const n of [3, 7, 10]) expect(pluralForm(n)).toBe("Few");
    for (const n of [0, 11, 30, 100]) expect(pluralForm(n)).toBe("Many");
  });
});

describe("countLabel", () => {
  it("counts in English", () => {
    expect(countLabel(1, "nights", en)).toBe("1 night");
    expect(countLabel(2, "nights", en)).toBe("2 nights");
    expect(countLabel(11, "nights", en)).toBe("11 nights");
    expect(countLabel(1, "guests", en)).toBe("1 guest");
    expect(countLabel(4, "guests", en)).toBe("4 guests");
    expect(countLabel(1, "reviews", en)).toBe("1 review");
    expect(countLabel(12, "reviews", en)).toBe("12 reviews");
    expect(countLabel(1, "stars", en)).toBe("1 star");
    expect(countLabel(5, "stars", en)).toBe("5 stars");
  });

  it("takes the singular, dual, plural and counted-singular forms in Arabic", () => {
    // "2 guests" used to read "2 الضيوف" — "2 the guests" — and every stay was
    // "ليالٍ", the 3–10 plural, even for one night.
    expect(countLabel(1, "nights", ar)).toBe("ليلة واحدة");
    expect(countLabel(2, "nights", ar)).toBe("ليلتان");
    expect(countLabel(3, "nights", ar)).toBe("3 ليالٍ");
    expect(countLabel(10, "nights", ar)).toBe("10 ليالٍ");
    expect(countLabel(11, "nights", ar)).toBe("11 ليلة");
    expect(countLabel(30, "nights", ar)).toBe("30 ليلة");

    expect(countLabel(1, "guests", ar)).toBe("ضيف واحد");
    expect(countLabel(2, "guests", ar)).toBe("ضيفان");
    expect(countLabel(3, "guests", ar)).toBe("3 ضيوف");
    expect(countLabel(11, "guests", ar)).toBe("11 ضيفًا");

    expect(countLabel(1, "reviews", ar)).toBe("تقييم واحد");
    expect(countLabel(2, "reviews", ar)).toBe("تقييمان");
    expect(countLabel(7, "reviews", ar)).toBe("7 تقييمات");
    expect(countLabel(12, "reviews", ar)).toBe("12 تقييمًا");

    expect(countLabel(1, "stars", ar)).toBe("نجمة واحدة");
    expect(countLabel(2, "stars", ar)).toBe("نجمتان");
    expect(countLabel(5, "stars", ar)).toBe("5 نجوم");
  });

  it("keeps Latin digits in Arabic, like every other number in the app", () => {
    expect(countLabel(4, "guests", ar)).not.toMatch(/[٠-٩]/);
    expect(countLabel(14, "nights", ar)).toBe("14 ليلة");
  });
});

describe("nightsLabel", () => {
  it("appends guests when given", () => {
    expect(nightsLabel(2, en, 4)).toBe("2 nights · 4 guests");
    expect(nightsLabel(1, ar, 2)).toBe("ليلة واحدة · ضيفان");
  });
  it("omits guests when zero or undefined", () => {
    expect(nightsLabel(3, en, 0)).toBe("3 nights");
    expect(nightsLabel(3, en, undefined)).toBe("3 nights");
  });
});

describe("telUrl", () => {
  it("keeps only what a dialer reads", () => {
    expect(telUrl("+966 50 123 4567")).toBe("tel:+966501234567");
    expect(telUrl("050-123-4567")).toBe("tel:0501234567");
    expect(telUrl("(013) 587 1234")).toBe("tel:0135871234");
  });

  it("reads a number typed on an Arabic keypad", () => {
    expect(telUrl("٠٥٠١٢٣٤٥٦٧")).toBe("tel:0501234567");
  });
});

describe("displayTotalSar", () => {
  const unit = { sar: "SAR", usd: "USD" };
  const quote = { nights: 3, pricePerNight: 475, totalAmount: 1425 };

  it("leaves a riyal total exactly as stored", () => {
    expect(displayTotalSar(quote, "SAR")).toBe(1425);
    expect(formatPrice(displayTotalSar(quote, "SAR"), "SAR", unit)).toBe("1,425 SAR");
  });

  it("makes a dollar total agree with nights × the dollar rate shown", () => {
    // 1,425 SAR is $380 on its own, but the rate shows as $127 and the
    // footer reads "3 × $127" — so the total has to be $381.
    expect(formatPrice(quote.pricePerNight, "USD", unit)).toBe("$127");
    expect(formatPrice(displayTotalSar(quote, "USD"), "USD", unit)).toBe("$381");
  });

  it("falls back to the stored total when the rate is not known", () => {
    expect(displayTotalSar({ totalAmount: 1425 }, "USD")).toBe(1425);
    expect(displayTotalSar({ totalAmount: 1425, nights: 3 }, "USD")).toBe(1425);
  });
});

describe("quoteFooterState", () => {
  it("is idle before both dates are chosen", () => {
    expect(quoteFooterState({ checkIn: null, checkOut: null, quote: undefined, lastGood: null })).toEqual({
      kind: "idle",
    });
  });
  it("is loading while the first quote is in flight", () => {
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote: undefined, lastGood: null })
    ).toEqual({ kind: "loading" });
  });
  it("keeps showing the last good total while a refetch is in flight", () => {
    const lastGood = { nights: 2, pricePerNight: 400, totalAmount: 800 };
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote: undefined, lastGood })
    ).toEqual({ kind: "total", stale: true, ...lastGood });
  });
  it("shows the total when the quote is available", () => {
    const quote = { ok: true as const, available: true, quote: { nights: 2, pricePerNight: 400, totalAmount: 800 } };
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote, lastGood: null })
    ).toEqual({ kind: "total", stale: false, nights: 2, pricePerNight: 400, totalAmount: 800 });
  });
  it("reports no availability", () => {
    const quote = { ok: true as const, available: false, quote: { nights: 2, pricePerNight: 400, totalAmount: 800 } };
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote, lastGood: null })
    ).toEqual({ kind: "unavailable" });
  });
  it("surfaces a server error message", () => {
    const quote = { ok: false as const, error: "Maximum stay is 30 nights" };
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote, lastGood: null })
    ).toEqual({ kind: "error", message: "Maximum stay is 30 nights" });
  });
});

// A stay booking as the lists see it.
const stay = (id: string, status: string, checkIn: string, checkOut: string) => ({
  _id: id,
  status,
  date: checkIn,
  checkIn,
  checkOut,
});
const ids = (rows: { _id: string }[]) => rows.map((row) => row._id);

// A service booking as the lists see it: one day, a start time on the Riyadh
// clock, and checkIn / checkOut mirrored the way the server writes them.
const service = (
  id: string,
  status: string,
  date: string,
  time: string,
  extra: { checkOut?: string; expiresAt?: number } = {}
) => ({
  _id: id,
  kind: "service",
  status,
  date,
  time,
  checkIn: date,
  checkOut: extra.checkOut ?? nextDay(date),
  expiresAt: extra.expiresAt,
});
const nextDay = (iso: string) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

// 10 September 2026, 12:00 in Riyadh (09:00 UTC).
const NOON_10_SEP = Date.UTC(2026, 8, 10, 9, 0);

describe("minuteNow", () => {
  it("floors the clock to the minute, so a value read on every render stays put", () => {
    expect(minuteNow(Date.UTC(2026, 8, 10, 9, 0, 59, 999))).toBe(Date.UTC(2026, 8, 10, 9, 0));
    expect(minuteNow(Date.UTC(2026, 8, 10, 9, 1))).toBe(Date.UTC(2026, 8, 10, 9, 1));
  });
});

describe("riyadhMoment", () => {
  it("reads a day and a start time on the Riyadh clock, whatever the phone's zone", () => {
    // Riyadh is UTC+3 with no daylight saving: 19:00 there is 16:00 UTC.
    expect(riyadhMoment("2026-09-10", "19:00")).toBe(Date.UTC(2026, 8, 10, 16, 0));
    // An early start is still the previous day in UTC.
    expect(riyadhMoment("2026-09-10", "01:30")).toBe(Date.UTC(2026, 8, 9, 22, 30));
  });

  it("is NaN for anything that is not a day and an HH:MM time", () => {
    expect(riyadhMoment("2026-9-10", "19:00")).toBeNaN();
    expect(riyadhMoment("2026-09-10", "7pm")).toBeNaN();
    expect(riyadhMoment("2026-09-10", "24:00")).toBeNaN();
  });
});

describe("partitionGuestBookings", () => {
  it("lists open stays not yet checked out of under upcoming, soonest first", () => {
    const { upcoming, past } = partitionGuestBookings(
      [
        stay("next-year", "confirmed", "2027-01-05", "2027-01-08"),
        stay("tomorrow", "pending", "2026-09-11", "2026-09-13"),
        stay("mid-stay", "confirmed", "2026-09-09", "2026-09-11"),
      ],
      NOON_10_SEP
    );
    expect(ids(upcoming)).toEqual(["mid-stay", "tomorrow", "next-year"]);
    expect(past).toEqual([]);
  });

  it("lists finished, cancelled and declined stays under past, most recent first", () => {
    const { upcoming, past } = partitionGuestBookings(
      [
        stay("may", "completed", "2026-05-01", "2026-05-03"),
        stay("cancelled", "cancelled", "2026-10-01", "2026-10-02"),
        stay("august", "completed", "2026-08-20", "2026-08-22"),
      ],
      NOON_10_SEP
    );
    expect(upcoming).toEqual([]);
    expect(ids(past)).toEqual(["cancelled", "august", "may"]);
  });

  it("keeps a service under upcoming until its start time, not its day", () => {
    const { upcoming, past } = partitionGuestBookings(
      [
        service("this-evening", "confirmed", "2026-09-10", "19:00"),
        service("this-morning", "confirmed", "2026-09-10", "10:00"),
        service("tomorrow", "pending", "2026-09-11", "06:00"),
      ],
      NOON_10_SEP
    );
    expect(ids(upcoming)).toEqual(["this-evening", "tomorrow"]);
    // Started two hours ago: it is under way, and can no longer be cancelled.
    expect(ids(past)).toEqual(["this-morning"]);
  });

  it("moves a service to past the minute it starts", () => {
    const start = Date.UTC(2026, 8, 10, 16, 0); // 19:00 in Riyadh
    const booking = service("s", "confirmed", "2026-09-10", "19:00");
    expect(ids(partitionGuestBookings([booking], start - 60_000).upcoming)).toEqual(["s"]);
    expect(ids(partitionGuestBookings([booking], start).past)).toEqual(["s"]);
  });

  it("files a request nobody answered before it started under past", () => {
    const { upcoming, past } = partitionGuestBookings(
      [service("unanswered", "pending", "2026-09-10", "11:00")],
      NOON_10_SEP
    );
    expect(upcoming).toEqual([]);
    expect(ids(past)).toEqual(["unanswered"]);
  });

  it("files a stay request the host let expire under past, before the hourly job marks it", () => {
    const { upcoming, past } = partitionGuestBookings(
      [
        { ...stay("lapsed", "pending", "2026-10-01", "2026-10-03"), expiresAt: NOON_10_SEP - 60_000 },
        { ...stay("waiting", "pending", "2026-10-05", "2026-10-06"), expiresAt: NOON_10_SEP + 60_000 },
      ],
      NOON_10_SEP
    );
    expect(ids(upcoming)).toEqual(["waiting"]);
    expect(ids(past)).toEqual(["lapsed"]);
  });

  it("never shows a closed service as upcoming", () => {
    for (const status of ["cancelled", "declined", "expired", "completed", "no_show"]) {
      const { upcoming } = partitionGuestBookings(
        [service("s", status, "2026-09-20", "10:00")],
        NOON_10_SEP
      );
      expect(upcoming).toEqual([]);
    }
  });

  it("orders stays and services together by when they begin", () => {
    const { upcoming, past } = partitionGuestBookings(
      [
        { ...stay("stay-15th", "confirmed", "2026-09-15", "2026-09-17"), time: "15:00" },
        service("tour-15th-morning", "pending", "2026-09-15", "09:00"),
        service("driver-12th", "confirmed", "2026-09-12", "18:30"),
        { ...stay("stay-may", "completed", "2026-05-01", "2026-05-03"), time: "15:00" },
        service("guide-august", "completed", "2026-08-20", "10:00"),
      ],
      NOON_10_SEP
    );
    expect(ids(upcoming)).toEqual(["driver-12th", "tour-15th-morning", "stay-15th"]);
    expect(ids(past)).toEqual(["guide-august", "stay-may"]);
  });
});

describe("guestCanCancel", () => {
  it("lets a stay be cancelled until its check-in day", () => {
    expect(guestCanCancel(stay("s", "confirmed", "2026-09-11", "2026-09-13"), NOON_10_SEP)).toBe(
      true
    );
    // The day has come: the room was held, and the night may be owed.
    expect(guestCanCancel(stay("s", "pending", "2026-09-10", "2026-09-12"), NOON_10_SEP)).toBe(
      false
    );
  });

  it("lets a service be cancelled until its start time, not its day", () => {
    const evening = service("s", "confirmed", "2026-09-10", "19:00");
    const start = Date.UTC(2026, 8, 10, 16, 0);
    expect(guestCanCancel(evening, NOON_10_SEP)).toBe(true);
    expect(guestCanCancel(evening, start - 60_000)).toBe(true);
    // From the start the server refuses (SERVICE_STARTED): the provider is
    // at the meeting point, and it is a conversation with them.
    expect(guestCanCancel(evening, start)).toBe(false);
    expect(guestCanCancel(service("s", "pending", "2026-09-10", "19:00"), start)).toBe(false);
  });

  it("offers nothing on a closed booking", () => {
    for (const status of ["completed", "cancelled", "declined", "expired", "no_show"]) {
      expect(guestCanCancel(service("s", status, "2026-09-20", "10:00"), NOON_10_SEP)).toBe(false);
      expect(guestCanCancel(stay("s", status, "2026-09-20", "2026-09-21"), NOON_10_SEP)).toBe(
        false
      );
    }
  });

  it("offers nothing on a request past its expiry, which its chip already calls expired", () => {
    const lapsed = { ...stay("s", "pending", "2026-10-01", "2026-10-03"), expiresAt: NOON_10_SEP - 1 };
    expect(guestCanCancel(lapsed, NOON_10_SEP)).toBe(false);
  });
});

describe("partitionProviderBookings", () => {
  it("lists live requests soonest first, and files a request past its expiry under past", () => {
    const { requests, past } = partitionProviderBookings(
      [
        service("next-month", "pending", "2026-10-10", "10:00", { expiresAt: NOON_10_SEP + 3_600_000 }),
        service("tomorrow", "pending", "2026-09-11", "08:00", { expiresAt: NOON_10_SEP + 60_000 }),
        // Its start time passed at 11:00: the request closed with it, and the
        // hourly job has simply not marked it yet.
        service("dead", "pending", "2026-09-10", "11:00", {
          expiresAt: Date.UTC(2026, 8, 10, 8, 0),
        }),
      ],
      NOON_10_SEP
    );
    expect(ids(requests)).toEqual(["tomorrow", "next-month"]);
    expect(ids(past)).toEqual(["dead"]);
  });

  it("keeps confirmed work under upcoming until the morning after it", () => {
    const { upcoming, past } = partitionProviderBookings(
      [
        service("later", "confirmed", "2026-09-20", "09:00"),
        // Started this morning; the 04:00 job completes it tomorrow.
        service("today", "confirmed", "2026-09-10", "08:00"),
        // Three days from the 8th: checkOut is the 11th.
        service("three-days", "confirmed", "2026-09-08", "07:00", { checkOut: "2026-09-11" }),
        service("yesterday", "confirmed", "2026-09-08", "10:00", { checkOut: "2026-09-09" }),
      ],
      NOON_10_SEP
    );
    expect(ids(upcoming)).toEqual(["three-days", "today", "later"]);
    expect(ids(past)).toEqual(["yesterday"]);
  });

  it("puts everything closed under past, most recent start first", () => {
    const { requests, upcoming, past } = partitionProviderBookings(
      [
        service("may", "completed", "2026-05-01", "10:00"),
        service("declined", "declined", "2026-09-20", "10:00"),
        service("no-show", "no_show", "2026-09-09", "18:00"),
        service("morning", "completed", "2026-09-09", "09:00"),
      ],
      NOON_10_SEP
    );
    expect(requests).toEqual([]);
    expect(upcoming).toEqual([]);
    expect(ids(past)).toEqual(["declined", "no-show", "morning", "may"]);
  });
});

describe("shownStatus", () => {
  it("shows a request past its expiry as expired, before the hourly job marks it", () => {
    // The server already refuses to confirm it and the lists file it under
    // past; a chip still saying "Awaiting provider" asked for a wait that can
    // no longer end in a yes.
    expect(shownStatus({ status: "pending", expiresAt: NOON_10_SEP - 1 }, NOON_10_SEP)).toBe("expired");
    expect(shownStatus({ status: "pending", expiresAt: NOON_10_SEP }, NOON_10_SEP)).toBe("expired");
  });

  it("leaves a live request, or one with no expiry, pending", () => {
    expect(shownStatus({ status: "pending", expiresAt: NOON_10_SEP + 1 }, NOON_10_SEP)).toBe("pending");
    // Restaurant slot bookings from 1.0.x carry no expiry.
    expect(shownStatus({ status: "pending" }, NOON_10_SEP)).toBe("pending");
  });

  it("shows every other status as the server wrote it", () => {
    for (const status of ["confirmed", "completed", "cancelled", "declined", "expired", "no_show"]) {
      expect(shownStatus({ status, expiresAt: NOON_10_SEP - 1 }, NOON_10_SEP)).toBe(status);
    }
  });
});

describe("providerActionsFor", () => {
  it("offers confirm / decline on a request that is still alive", () => {
    expect(
      providerActionsFor(
        service("s", "pending", "2026-09-12", "10:00", { expiresAt: NOON_10_SEP + 1 }),
        NOON_10_SEP
      )
    ).toBe("decide");
  });

  it("offers nothing on a request past its expiry, which the server would refuse to confirm", () => {
    expect(
      providerActionsFor(
        service("s", "pending", "2026-09-12", "10:00", { expiresAt: NOON_10_SEP }),
        NOON_10_SEP
      )
    ).toBe("none");
  });

  it("offers no-show / completed from the start time, not from the start of the day", () => {
    const booking = service("s", "confirmed", "2026-09-10", "19:00");
    expect(providerActionsFor(booking, NOON_10_SEP)).toBe("none");
    expect(providerActionsFor(booking, Date.UTC(2026, 8, 10, 16, 0))).toBe("close");
    expect(providerActionsFor(booking, Date.UTC(2026, 8, 12, 9, 0))).toBe("close");
  });

  it("offers nothing on a closed booking", () => {
    for (const status of ["completed", "cancelled", "declined", "expired", "no_show"]) {
      expect(providerActionsFor(service("s", status, "2026-09-01", "10:00"), NOON_10_SEP)).toBe(
        "none"
      );
    }
  });

  it("offers completion only on a confirmed booking whose start has passed", () => {
    // The server refuses anything else (SERVICE_NOT_STARTED): a request is
    // answered first, and a confirmed service cannot be done before it began.
    // "close" is the only set that carries the completed button.
    const startedAt = Date.UTC(2026, 8, 10, 7, 0); // 10:00 in Riyadh
    const request = service("r", "pending", "2026-09-10", "10:00", {
      expiresAt: NOON_10_SEP + 1,
    });
    expect(providerActionsFor(request, NOON_10_SEP)).not.toBe("close");
    const confirmed = service("c", "confirmed", "2026-09-10", "10:00");
    expect(providerActionsFor(confirmed, startedAt - 60_000)).not.toBe("close");
    expect(providerActionsFor(confirmed, startedAt)).toBe("close");
  });
});

describe("service booking words", () => {
  it("counts hours, days and people in English", () => {
    expect(countLabel(1, "hours", en)).toBe("1 hour");
    expect(countLabel(2, "hours", en)).toBe("2 hours");
    expect(countLabel(3, "hours", en)).toBe("3 hours");
    expect(countLabel(11, "hours", en)).toBe("11 hours");
    expect(countLabel(1, "days", en)).toBe("1 day");
    expect(countLabel(14, "days", en)).toBe("14 days");
    expect(countLabel(1, "people", en)).toBe("1 person");
    expect(countLabel(2, "people", en)).toBe("2 people");
    expect(countLabel(20, "people", en)).toBe("20 people");
  });

  it("takes the singular, dual, plural and counted-singular forms in Arabic", () => {
    expect(countLabel(1, "hours", ar)).toBe("ساعة واحدة");
    expect(countLabel(2, "hours", ar)).toBe("ساعتان");
    expect(countLabel(3, "hours", ar)).toBe("3 ساعات");
    expect(countLabel(11, "hours", ar)).toBe("11 ساعة");
    expect(countLabel(1, "days", ar)).toBe("يوم واحد");
    expect(countLabel(2, "days", ar)).toBe("يومان");
    expect(countLabel(3, "days", ar)).toBe("3 أيام");
    expect(countLabel(11, "days", ar)).toBe("11 يومًا");
    expect(countLabel(1, "people", ar)).toBe("شخص واحد");
    expect(countLabel(2, "people", ar)).toBe("شخصان");
    expect(countLabel(3, "people", ar)).toBe("3 أشخاص");
    expect(countLabel(11, "people", ar)).toBe("11 شخصًا");
  });

  it("names the hours or days only when the service is priced by them", () => {
    const hourly = { priceUnit: "per_hour", quantity: 3, partySize: 4 };
    expect(serviceAmountLabel(hourly, en)).toBe("3 hours · 4 people");
    expect(serviceAmountLabel(hourly, ar)).toBe("3 ساعات · 4 أشخاص");
    expect(serviceAmountLabel({ priceUnit: "per_day", quantity: 2, partySize: 1 }, en)).toBe(
      "2 days · 1 person"
    );
    // A tour at a fixed price, or a price per event, is booked once: the
    // quantity the server stores is 1 and says nothing.
    expect(serviceAmountLabel({ priceUnit: "per_event", quantity: 1, partySize: 2 }, en)).toBe(
      "2 people"
    );
    expect(serviceAmountLabel({ priceUnit: "fixed", quantity: 1, partySize: 2 }, ar)).toBe("شخصان");
  });

  it("falls back to the guest count, and is empty when there is nothing to say", () => {
    expect(serviceAmountLabel({ priceUnit: "per_hour", quantity: 2, guests: 3 }, en)).toBe(
      "2 hours · 3 people"
    );
    expect(serviceAmountLabel({ priceUnit: "fixed" }, en)).toBe("");
  });

  it("says the day and the start time, with the time exactly as stored", () => {
    const t = (language: "en" | "ar") => (key: "dateAtTime") => translations[language][key];
    expect(serviceWhen("2026-09-10", "19:00", "en", t("en"))).toBe(
      `${formatISODate("2026-09-10", "en")} at 19:00`
    );
    expect(serviceWhen("2026-09-10", "06:30", "ar", t("ar"))).toBe(
      `${formatISODate("2026-09-10", "ar")} الساعة 06:30`
    );
  });

  it("gives a booking of several days its last day, counted in", () => {
    const t = (language: "en" | "ar") => (key: "dateAtTime") => translations[language][key];
    // Three days from the 10th are the 10th, 11th and 12th — the server's
    // checkOut, the 13th, is exclusive, and a driver reading it would turn up
    // a day too many.
    expect(serviceWhen("2026-09-10", "09:00", "en", t("en"), 3)).toBe(
      `${formatDateRange("2026-09-10", "2026-09-12", "en")} at 09:00`
    );
    expect(serviceWhen("2026-09-10", "09:00", "ar", t("ar"), 2)).toBe(
      `${formatDateRange("2026-09-10", "2026-09-11", "ar")} الساعة 09:00`
    );
    expect(serviceWhen("2026-09-10", "09:00", "en", t("en"), 1)).toBe(
      `${formatISODate("2026-09-10", "en")} at 09:00`
    );
  });

  it("counts days only for a service priced by the day", () => {
    expect(serviceDays({ priceUnit: "per_day", quantity: 3 })).toBe(3);
    expect(serviceDays({ priceUnit: "per_day" })).toBe(1);
    // Hours are within the one day.
    expect(serviceDays({ priceUnit: "per_hour", quantity: 5 })).toBe(1);
    expect(serviceDays({ priceUnit: "fixed", quantity: 1 })).toBe(1);
  });
});

describe("totalShownFor", () => {
  const unit = { sar: "SAR", usd: "USD" };

  it("passes a stay's nights and nightly rate through", () => {
    expect(
      totalShownFor({ kind: "stay", totalAmount: 1425, nights: 3, pricePerNight: 475 })
    ).toEqual({ totalAmount: 1425, nights: 3, pricePerNight: 475 });
  });

  it("makes a service total agree with hours × the hourly rate as shown", () => {
    const booking = { kind: "service", totalAmount: 375, quantity: 3, unitPrice: 125 };
    // SAR 125 an hour is $33 as shown; three of those are $99, not the $100
    // that 375 SAR converts to on its own.
    expect(formatPrice(displayTotalSar(totalShownFor(booking), "USD"), "USD", unit)).toBe("$99");
    expect(formatPrice(displayTotalSar(totalShownFor(booking), "SAR"), "SAR", unit)).toBe(
      "375 SAR"
    );
  });
});

describe("bookingActionErrorKey", () => {
  it("reads both sign-in refusals as an expired session", () => {
    expect(bookingActionErrorKey({ data: "Not authenticated" })).toBe("errorSessionExpired");
    expect(
      bookingActionErrorKey({ data: "يجب تسجيل الدخول أولاً. / You need to be signed in." })
    ).toBe("errorSessionExpired");
  });

  it("says a started service in the provider's words, not the host's", () => {
    const started = {
      data: "لا يمكن الإلغاء بعد بدء الخدمة. تواصل مع مقدم الخدمة. / A service cannot be cancelled after it starts. Contact the provider.",
    };
    expect(bookingActionErrorKey(started, "service")).toBe("errorServiceStarted");
    expect(
      bookingActionErrorKey(
        { data: "لا يمكن الإلغاء بعد بدء الإقامة. تواصل مع المضيف. / A stay cannot be cancelled after it starts. Contact the host." },
        "stay"
      )
    ).toBe("errorStayStarted");
  });

  it("says why a service cannot be completed yet", () => {
    expect(
      bookingActionErrorKey(
        {
          data: "لا يمكن إتمام خدمة إلا بعد تأكيدها وبدء موعدها. / A service can only be completed once it is confirmed and has started.",
        },
        "service"
      )
    ).toBe("errorServiceNotStarted");
  });

  it("keeps the booking mapping for everything else", () => {
    expect(
      bookingActionErrorKey({ data: "لم يعد هذا الطلب قيد الانتظار. / This request is no longer pending." }, "service")
    ).toBe("errorBookingClosed");
    expect(bookingActionErrorKey(new Error("[CONVEX M(x)] Server Error"), "service")).toBe(
      "pleaseTryAgain"
    );
  });
});

describe("partitionHostBookings", () => {
  // 10 September in Riyadh.
  const now = NOON_10_SEP;

  it("puts the nearest arrival first in requests and upcoming", () => {
    const { requests, upcoming } = partitionHostBookings(
      [
        stay("spring", "pending", "2027-03-01", "2027-03-03"),
        stay("tomorrow", "pending", "2026-09-11", "2026-09-12"),
        stay("later", "confirmed", "2026-10-01", "2026-10-04"),
        stay("soon", "confirmed", "2026-09-15", "2026-09-16"),
      ],
      now
    );
    expect(ids(requests)).toEqual(["tomorrow", "spring"]);
    expect(ids(upcoming)).toEqual(["soon", "later"]);
  });

  it("keeps a stay under upcoming until the guest checks out", () => {
    const { upcoming } = partitionHostBookings(
      [stay("checking-out-today", "confirmed", "2026-09-08", "2026-09-10")],
      now
    );
    expect(ids(upcoming)).toEqual(["checking-out-today"]);
  });

  it("puts everything closed or over under past, most recent first", () => {
    const { requests, upcoming, past } = partitionHostBookings(
      [
        stay("old", "completed", "2026-05-01", "2026-05-02"),
        stay("over", "confirmed", "2026-09-01", "2026-09-03"),
        stay("declined", "declined", "2026-09-20", "2026-09-21"),
      ],
      now
    );
    expect(requests).toEqual([]);
    expect(upcoming).toEqual([]);
    expect(ids(past)).toEqual(["declined", "over", "old"]);
  });

  it("files a request past its expiry under past, as the provider inbox does", () => {
    // The server refuses to confirm it from its expiry (contract rule 11); in
    // Requests it offered a Confirm that could only fail.
    const { requests, past } = partitionHostBookings(
      [
        { ...stay("lapsed", "pending", "2026-10-01", "2026-10-03"), expiresAt: now - 60_000 },
        { ...stay("live", "pending", "2026-10-05", "2026-10-06"), expiresAt: now + 60_000 },
      ],
      now
    );
    expect(ids(requests)).toEqual(["live"]);
    expect(ids(past)).toEqual(["lapsed"]);
  });
});

describe("hostActionsFor", () => {
  // 10 September in Riyadh.
  const now = NOON_10_SEP;
  it("pending → confirm / decline", () => {
    expect(hostActionsFor({ status: "pending", checkIn: "2026-09-20" }, now)).toBe("decide");
  });
  it("confirmed and not yet arrived → nothing", () => {
    expect(hostActionsFor({ status: "confirmed", checkIn: "2026-09-20" }, now)).toBe("none");
  });
  it("confirmed and arrival day reached → no-show / complete", () => {
    expect(hostActionsFor({ status: "confirmed", checkIn: "2026-09-10" }, now)).toBe("close");
    expect(hostActionsFor({ status: "confirmed", checkIn: "2026-09-01" }, now)).toBe("close");
  });
  it("falls back to date for slot bookings", () => {
    expect(hostActionsFor({ status: "confirmed", date: "2026-09-09" }, now)).toBe("close");
  });
  it("terminal statuses → nothing", () => {
    for (const status of ["completed", "cancelled", "declined", "expired", "no_show"]) {
      expect(hostActionsFor({ status, checkIn: "2026-09-01" }, now)).toBe("none");
    }
  });
  it("a request past its expiry → nothing: the server would refuse the confirm", () => {
    const request = { status: "pending", checkIn: "2026-09-20" };
    expect(hostActionsFor({ ...request, expiresAt: now }, now)).toBe("none");
    expect(hostActionsFor({ ...request, expiresAt: now + 1 }, now)).toBe("decide");
  });
});

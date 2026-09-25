import { describe, expect, it } from "vitest";
import {
  makeT,
  seedHotel,
  seedService,
  seedServiceBooking,
  seedSlot,
  seedStay,
  seedUser,
} from "../test.utils";
import type { TestT } from "../test.utils";
import type { Id } from "../_generated/dataModel";
import { listBookingsPage, phoneSearchKey, searchBookingsForAdmin } from "./views";

async function world(t: TestT) {
  const host = await seedUser(t, { role: "business_owner", isApproved: true, firstName: "Hotel", lastName: "Host" });
  const provider = await seedUser(t, {
    role: "service_provider",
    isApproved: true,
    firstName: "Guide",
    lastName: "Pro",
    phone: "+966500000001",
  });
  const guest = await seedUser(t, {
    firstName: "Sara",
    lastName: "Q",
    phone: "+966501234567",
    phoneVerified: true,
  });
  const listingId = await seedHotel(t, { ownerId: host, name_en: "Oasis Inn" });
  const serviceId = await seedService(t, { ownerId: provider, title_en: "Oasis tour", title_ar: "جولة الواحة" });
  return { host, provider, guest, listingId, serviceId };
}

const firstPage = { numItems: 10, cursor: null };

describe("listBookingsPage", () => {
  it("filters by kind before paging, so a page is never empty while matches remain", async () => {
    // Five service bookings, then 25 newer stays. Filtering after .paginate()
    // answered the first page of 10 (all stays) with nothing.
    const t = makeT();
    const w = await world(t);
    const services: Id<"bookings">[] = [];
    for (let i = 0; i < 5; i++) {
      services.push(
        await seedServiceBooking(t, {
          userId: w.guest,
          serviceId: w.serviceId,
          ownerId: w.provider,
          date: `2026-09-1${i}`,
        })
      );
    }
    for (let i = 0; i < 25; i++) {
      await seedStay(t, {
        userId: w.guest,
        listingId: w.listingId,
        ownerId: w.host,
        checkIn: "2026-10-01",
        checkOut: "2026-10-02",
      });
    }

    const page = await t.run((ctx) => listBookingsPage(ctx, { paginationOpts: firstPage, kind: "service" }));

    expect(page.page.map((b) => b._id).sort()).toEqual([...services].sort());
    expect(page.isDone).toBe(true);
  });

  it("tells a stay, a service booking and a legacy slot apart", async () => {
    const t = makeT();
    const w = await world(t);
    const stay = await seedStay(t, {
      userId: w.guest,
      listingId: w.listingId,
      ownerId: w.host,
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      status: "confirmed",
    });
    const service = await seedServiceBooking(t, {
      userId: w.guest,
      serviceId: w.serviceId,
      ownerId: w.provider,
      date: "2026-10-05",
    });
    const slot = await seedSlot(t, { userId: w.guest, listingId: w.listingId, date: "2026-10-06" });
    const markedSlot = await seedSlot(t, { userId: w.guest, listingId: w.listingId, date: "2026-10-07" });
    await t.run((ctx) => ctx.db.patch(markedSlot, { kind: "slot" }));

    const ids = async (kind: "stay" | "service" | "slot", status?: string) =>
      (await t.run((ctx) => listBookingsPage(ctx, { paginationOpts: firstPage, kind, status }))).page.map(
        (b) => b._id
      );

    expect(await ids("stay")).toEqual([stay]);
    expect(await ids("service")).toEqual([service]);
    expect((await ids("slot")).sort()).toEqual([slot, markedSlot].sort());
    expect(await ids("stay", "pending")).toEqual([]);
    expect(await ids("stay", "confirmed")).toEqual([stay]);
  });

  it("carries what was booked, who booked it and who has to honour it", async () => {
    const t = makeT();
    const w = await world(t);
    await seedStay(t, {
      userId: w.guest,
      listingId: w.listingId,
      ownerId: w.host,
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
    });
    await seedServiceBooking(t, { userId: w.guest, serviceId: w.serviceId, ownerId: w.provider, date: "2026-10-05" });

    const { page } = await t.run((ctx) => listBookingsPage(ctx, { paginationOpts: firstPage }));
    const service = page.find((b) => b.kind === "service")!;
    const stay = page.find((b) => b.kind === "stay")!;

    expect(service).toMatchObject({
      listing: null,
      service: { _id: w.serviceId, title_en: "Oasis tour", title_ar: "جولة الواحة" },
      guest: { _id: w.guest, name: "Sara Q", phone: "+966501234567", phoneVerified: true },
      owner: { _id: w.provider, name: "Guide Pro" },
    });
    expect(stay).toMatchObject({
      listing: { _id: w.listingId, name_en: "Oasis Inn", name_ar: "فندق تجريبي" },
      service: null,
      owner: { _id: w.host, name: "Hotel Host" },
    });
  });
});

describe("searchBookingsForAdmin", () => {
  it("finds a booking by its confirmation code, however it was typed", async () => {
    const t = makeT();
    const w = await world(t);
    const id = await seedStay(t, {
      userId: w.guest,
      listingId: w.listingId,
      checkIn: "2026-10-01",
      checkOut: "2026-10-02",
      confirmationCode: "HSO-7K3M2",
    });

    for (const typed of ["HSO-7K3M2", "hso-7k3m2", " 7k3m2 "]) {
      const found = await t.run((ctx) => searchBookingsForAdmin(ctx, { search: typed }));
      expect(found.map((b) => b._id), typed).toEqual([id]);
    }
    expect(await t.run((ctx) => searchBookingsForAdmin(ctx, { search: "HSO-AAAAA" }))).toEqual([]);
  });

  it("finds a guest's bookings by their phone number, local or international", async () => {
    const t = makeT();
    const w = await world(t);
    const stay = await seedStay(t, {
      userId: w.guest,
      listingId: w.listingId,
      checkIn: "2026-10-01",
      checkOut: "2026-10-02",
    });
    const service = await seedServiceBooking(t, {
      userId: w.guest,
      serviceId: w.serviceId,
      ownerId: w.provider,
      date: "2026-10-05",
    });

    for (const typed of ["+966501234567", "0501234567", "966 50 123 4567", "٠٥٠١٢٣٤٥٦٧"]) {
      const found = await t.run((ctx) => searchBookingsForAdmin(ctx, { search: typed }));
      expect(found.map((b) => b._id).sort(), typed).toEqual([stay, service].sort());
      expect(found[0].guest).toMatchObject({ _id: w.guest });
    }
  });

  it("answers an empty list for anything else", async () => {
    const t = makeT();
    await world(t);
    for (const typed of ["", "   ", "Sara", "+966599999999"]) {
      expect(await t.run((ctx) => searchBookingsForAdmin(ctx, { search: typed })), typed).toEqual([]);
    }
  });
});

describe("phoneSearchKey", () => {
  it("normalises what an operator pastes to the stored E.164 form", () => {
    expect(phoneSearchKey("+966501234567")).toBe("+966501234567");
    expect(phoneSearchKey("0501234567")).toBe("+966501234567");
    expect(phoneSearchKey("501234567")).toBe("+966501234567");
    expect(phoneSearchKey("00966501234567")).toBe("+966501234567");
    expect(phoneSearchKey("+966 50-123-4567")).toBe("+966501234567");
    expect(phoneSearchKey("٠٥٠١٢٣٤٥٦٧")).toBe("+966501234567");
    expect(phoneSearchKey("HSO-7K3M2")).toBeNull();
    expect(phoneSearchKey("12345")).toBeNull();
  });
});

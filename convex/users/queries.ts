import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthenticatedAppUser(ctx);
  },
});

// Get user's favorite doctors
export const getFavorites = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || !user.favoriteDoctorIds || user.favoriteDoctorIds.length === 0) {
      return [];
    }

    // Fetch all favorite doctors
    const doctors = await Promise.all(
      user.favoriteDoctorIds.map((id) => ctx.db.get(id))
    );

    return doctors.filter(Boolean);
  },
});

// Check if a doctor is in favorites
export const isFavorite = query({
  args: { doctorId: v.id("doctors") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || !user.favoriteDoctorIds) {
      return false;
    }

    return user.favoriteDoctorIds.includes(args.doctorId);
  },
});

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BackButton,
  Button,
  FilterChip,
  SkeletonFade,
  SkeletonOwnerList,
} from "@/components/ui";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { useConvexUser } from "@/hooks/useConvexUser";
import { appAlert } from "@/stores/dialogStore";
import { OwnerStatusBadge, ReviewNote } from "@/components/hosting/OwnerStatus";
import { ownerStatusOf } from "@/lib/listingForm";
import type { Id } from "../../../convex/_generated/dataModel";
import { cityLabel } from "@/constants/cities";
import { colors, type AppFonts } from "@/constants/colors";
import { enterFade } from "@/constants/motion";
import type { TranslationKey } from "@/constants/translations";
import { useThemedStyles } from "@/hooks/useAppFonts";

// What each kind of listing is called on its card. A tour used to be
// labelled "Event", being the last branch of a chain of ternaries.
const TYPE_LABEL: Record<string, TranslationKey> = {
  hotel: "lodging",
  restaurant: "food",
  attraction: "destination",
  event: "event",
  tour: "cat_tour",
};

export default function MyListingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const router = useRouter();
  const { isApproved } = useConvexUser();
  const deleteMyListing = useMutation(api.listings.mutations.deleteMyListing);
  // The card being deleted, dimmed and inert until the server answers.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // The host's bookings, to know which places a guest still holds a stay
  // at. The server deletes a listing whatever is booked on it, which would
  // leave those guests holding a booking for a place that no longer exists.
  const hostBookings = useQuery(api.bookings.queries.getBusinessBookings, {});
  const openBookingListingIds = new Set(
    (hostBookings ?? [])
      .filter((booking) => booking.status === "pending" || booking.status === "confirmed")
      .map((booking) => booking.listingId as string)
  );

  // Which form owns a listing. Only these two exist, so anything else has no
  // editor to send the owner to and simply shows no button.
  const editorFor = (type: string) =>
    type === "hotel"
      ? "/business/post-lodging"
      : type === "attraction"
        ? "/business/post-destination"
        : null;
  const [filter, setFilter] = useState<"all" | string>("all");

  // A live query, so there is nothing for a pull-to-refresh to fetch: the
  // one here spun for a fixed second and changed nothing. Removed.
  const allListings = useQuery(api.listings.queries.getMyListings, {});
  const isLoading = allListings === undefined;

  // Filtered on the normalised status: a listing with none is live, and used
  // to fall out of every filter but "All".
  const filteredListings = filter === "all"
    ? (allListings ?? [])
    : (allListings ?? []).filter((l) => ownerStatusOf(l.status) === filter);

  // Suspended is rare, so it is offered only when there is something under
  // it (or it is the filter already chosen).
  const hasSuspended = (allListings ?? []).some((l) => l.status === "suspended");
  const filters = ["all", "pending", "approved", "rejected"];
  if (hasSuspended || filter === "suspended") filters.push("suspended");
  const hasAny = (allListings ?? []).length > 0;

  const remove = async (listingId: string) => {
    setDeletingId(listingId);
    try {
      await deleteMyListing({ listingId: listingId as Id<"listings"> });
    } catch {
      appAlert(t("error"), t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };
  const confirmDelete = (listingId: string) => {
    // Unknown until the bookings load; a second's wait beats a guess.
    if (hostBookings === undefined) return;
    if (openBookingListingIds.has(listingId)) {
      appAlert(t("deleteBlockedTitle"), t("deleteBlockedOpenBookings"));
      return;
    }
    appAlert(t("deleteListingTitle"), t("deleteForGoodMessage"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => void remove(listingId) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header. The entrances are the app's short staggered fade — these
            took most of a second to settle on a screen of cards. */}
        <Animated.View
          entering={enterFade(0)}
          style={[styles.header, isRTL && styles.headerRTL]}
        >
          <BackButton />
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t("myListings")}
          </Text>
        </Animated.View>

        {/* Filters — the same ink-when-chosen chips as everywhere else in the
            app (these were lime), wrapping rather than scrolling so the row
            starts on the right in Arabic instead of scrolling from the left.
            Kept while loading, so the cards do not arrive under a row that
            then pushes them down; dropped when there is nothing to filter. */}
        {(isLoading || hasAny) && (
          <Animated.View
            entering={enterFade(1)}
            style={[styles.filterRow, isRTL && styles.rowRTL]}
          >
            {filters.map((status) => (
              <FilterChip
                key={status}
                label={
                  status === "all"
                    ? t("all")
                    : t(`status${status.charAt(0).toUpperCase() + status.slice(1)}` as any)
                }
                selected={filter === status}
                onPress={() => setFilter(status)}
              />
            ))}
          </Animated.View>
        )}

        {/* Listings — cross-faded in from a skeleton of the same cards. */}
        <SkeletonFade
          loading={isLoading}
          skeleton={<SkeletonOwnerList isRTL={isRTL} />}
        >
        {filteredListings.length > 0 ? (
          <View style={styles.listingsContainer}>
            {filteredListings.map((listing: any) => (
              <View
                key={listing._id}
                style={[styles.listingCard, deletingId === listing._id && styles.cardBusy]}
                pointerEvents={deletingId === listing._id ? "none" : "auto"}
              >
                {/* Always the picture's height, photo or not, so a card
                    without one does not jump from the skeleton's shape. */}
                {listing.images?.[0] ? (
                  <Image
                    source={{ uri: listing.images[0] }}
                    style={styles.listingImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[styles.listingImage, styles.imagePlaceholder]}>
                    <Feather name="image" size={28} color={colors.onSurface.muted} />
                  </View>
                )}
                <View style={styles.listingInfo}>
                  <Text style={[styles.listingName, isRTL && styles.textRTL]} numberOfLines={2}>
                    {language === "ar" ? (listing.name_ar || listing.name_en || "—") : (listing.name_en || "—")}
                  </Text>
                  {/* The city in the reader's language: an Arabic card used to
                      print "Hofuf" in Latin letters. */}
                  <Text style={[styles.listingType, isRTL && styles.textRTL]}>
                    {t(TYPE_LABEL[listing.type] ?? "event")} • {cityLabel(listing.city ?? "", language)}
                  </Text>
                  <ReviewNote
                    status={ownerStatusOf(listing.status)}
                    reason={
                      listing.status === "suspended"
                        ? listing.suspendedReason
                        : listing.rejectionReason
                    }
                    canEdit={editorFor(listing.type) !== null}
                  />
                  <View style={[styles.cardFoot, isRTL && styles.rowRTL]}>
                    <OwnerStatusBadge status={ownerStatusOf(listing.status)} />

                    <View style={[styles.actions, isRTL && styles.rowRTL]}>
                      {/* Editable in every state, approved included: a price
                          or a phone number that has gone stale is worse live
                          than it is in the queue. The server sends it back
                          for review. */}
                      {editorFor(listing.type) && (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: editorFor(listing.type) as never,
                              params: { id: listing._id },
                            })
                          }
                          style={({ pressed }) => [
                            styles.editButton,
                            isRTL && styles.rowRTL,
                            pressed && styles.pressed,
                          ]}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={t("editListing")}
                        >
                          <Feather name="edit-2" size={13} color={colors.ink} />
                          <Text style={styles.editText}>{t("edit")}</Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => confirmDelete(listing._id)}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          isRTL && styles.rowRTL,
                          pressed && styles.pressed,
                        ]}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("deleteListingTitle")}
                      >
                        <Feather name="trash-2" size={13} color={colors.signOut} />
                        <Text style={styles.deleteText}>{t("delete")}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : hasAny ? (
          /* Listings exist, just none under this filter. */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{t("filterNoMatch")}</Text>
            <Button
              title={t("seeAll")}
              variant="outline"
              size="sm"
              onPress={() => setFilter("all")}
              style={styles.emptyButton}
            />
          </View>
        ) : (
          /* Nothing posted yet: say what to do, and offer it — the screen
             used to be a single grey "No listings yet". */
          <View style={styles.emptyContainer}>
            <Feather name="home" size={30} color={colors.onSurface.muted} />
            <Text style={styles.emptyTitle}>{t("noListingsYet")}</Text>
            <Text style={styles.emptyBody}>{t("startAddingPlaces")}</Text>
            {isApproved ? (
              <View style={[styles.emptyActions, isRTL && styles.rowRTL]}>
                <Button
                  title={t("postLodging")}
                  size="sm"
                  onPress={() => router.push("/business/post-lodging")}
                />
                <Button
                  title={t("postDestination")}
                  variant="outline"
                  size="sm"
                  onPress={() => router.push("/business/post-destination")}
                />
              </View>
            ) : (
              <Text style={styles.emptyBody}>{t("verificationLocked")}</Text>
            )}
          </View>
        )}
        </SkeletonFade>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRTL: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  textRTL: {
    textAlign: "right",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  listingsContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  listingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardBusy: {
    opacity: 0.5,
  },
  listingImage: {
    width: "100%",
    height: 140,
  },
  imagePlaceholder: {
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  listingInfo: {
    padding: 16,
  },
  listingName: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
    marginBottom: 4,
  },
  listingType: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginBottom: 8,
  },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.primary.DEFAULT,
  },
  editText: {
    fontSize: 12.5,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  // Outlined rather than filled: it is the action nobody should hit by
  // accident, so it does not compete with Edit.
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(176, 73, 63, 0.35)",
  },
  deleteText: {
    fontSize: 12.5,
    fontFamily: fonts.semibold,
    color: colors.signOut,
  },
  pressed: {
    opacity: 0.7,
  },
  emptyContainer: {
    paddingHorizontal: 32,
    paddingTop: 40,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.ink,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  emptyButton: {
    marginTop: 8,
  },
  bottomSpacing: {
    height: 32,
  },
});

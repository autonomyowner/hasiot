import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton, SkeletonFade, SkeletonOwnerList } from "@/components/ui";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { appAlert } from "@/stores/dialogStore";
import { OwnerStatusBadge, ReviewNote } from "@/components/hosting/OwnerStatus";
import { ownerStatusOf } from "@/lib/listingForm";
import type { Id } from "../../../convex/_generated/dataModel";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

export default function MyListingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const router = useRouter();
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
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4F5E10"
            colors={["#4F5E10"]}
          />
        }
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.header, isRTL && styles.headerRTL]}
        >
          <BackButton />
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t("myListings")}
          </Text>
        </Animated.View>

        {/* Filters */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.filterContainer}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.filterScroll,
              isRTL && styles.filterScrollRTL,
            ]}
          >
            {filters.map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.filterButton,
                  filter === status && styles.filterButtonActive,
                ]}
                onPress={() => setFilter(status)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === status && styles.filterTextActive,
                  ]}
                >
                  {status === "all" ? t("all") : t(`status${status.charAt(0).toUpperCase() + status.slice(1)}` as any)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

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
                {listing.images && listing.images.length > 0 && (
                  <Image
                    source={{ uri: listing.images[0] }}
                    style={styles.listingImage}
                  />
                )}
                <View style={styles.listingInfo}>
                  <Text style={[styles.listingName, isRTL && styles.textRTL]}>
                    {language === "ar" ? (listing.name_ar || listing.name_en || "—") : (listing.name_en || "—")}
                  </Text>
                  <Text style={[styles.listingType, isRTL && styles.textRTL]}>
                    {listing.type === "hotel" ? t("lodging") : listing.type === "restaurant" ? t("food") : listing.type === "attraction" ? t("destination") : t("event")} • {listing.city}
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
        ) : (
          /* Empty State */
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
              {t("noListingsYet" as any)}
            </Text>
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
  filterContainer: {
    paddingVertical: 16,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterScrollRTL: {
    flexDirection: "row-reverse",
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  filterButtonActive: {
    backgroundColor: "#CCE745",
    borderColor: "#CCE745",
  },
  filterText: {
    fontSize: 14,
    color: "#737373",
    fontFamily: fonts.medium,
  },
  filterTextActive: {
    color: "#1F1D17",
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
  listingImage: {
    width: "100%",
    height: 140,
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
    color: "#737373",
    marginBottom: 8,
    textTransform: "capitalize",
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
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  cardBusy: {
    opacity: 0.5,
  },
  emptyContainer: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#737373",
    textAlign: "center",
  },
  bottomSpacing: {
    height: 32,
  },
});

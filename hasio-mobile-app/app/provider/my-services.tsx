import React, { useMemo, useState } from "react";
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
import { ownerStatusOf, serviceTypeLabelKey } from "@/lib/listingForm";
import { getSubmitErrorKey } from "@/lib/submitError";
import type { Id } from "../../../convex/_generated/dataModel";
import { colors, type AppFonts } from "@/constants/colors";
import { enterFade } from "@/constants/motion";
import type { TranslationKey } from "@/constants/translations";
import { useThemedStyles } from "@/hooks/useAppFonts";

const FILTERS = ["all", "pending", "approved", "rejected"] as const;

const STATUS_LABEL: Record<string, TranslationKey> = {
  pending: "statusPending",
  approved: "statusApproved",
  rejected: "statusRejected",
  suspended: "statusSuspended",
};

export default function MyServicesScreen() {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const router = useRouter();
  const { isApproved } = useConvexUser();
  const deleteMyService = useMutation(api.services.mutations.deleteMyService);
  // The card being deleted, dimmed and inert until the server answers.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | string>("all");

  // A live query: nothing for a pull-to-refresh to fetch, so the one that
  // spun for a fixed second is gone.
  const myServices = useQuery(api.services.queries.getMyServices, {});
  const isLoading = myServices === undefined;

  // The services a traveller still holds a request or a booking for, which
  // the server will not delete (HAS_OPEN_BOOKINGS) — known here, so the
  // provider hears it before being asked to confirm a delete that cannot
  // happen. The same subscription the provider's inbox holds.
  const providerBookings = useQuery(api.bookings.queries.getProviderBookings, {});
  const openBookingServiceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const booking of providerBookings ?? []) {
      const open = booking.status === "pending" || booking.status === "confirmed";
      if (open && booking.serviceId) ids.add(booking.serviceId);
    }
    return ids;
  }, [providerBookings]);

  const services = myServices ?? [];
  const hasAny = services.length > 0;

  const filteredServices = filter === "all"
    ? services
    : services.filter((s) => ownerStatusOf(s.status) === filter);

  // Suspended is rare, so it is offered only when there is something under
  // it (or it is the filter already chosen) — as on My Listings.
  const hasSuspended = services.some((s) => s.status === "suspended");
  const filters: string[] = [...FILTERS];
  if (hasSuspended || filter === "suspended") filters.push("suspended");

  // My Services used to be read-only: a provider could post a service but
  // never change or remove it. Delete is permanent, so it asks first.
  const remove = async (serviceId: string) => {
    setDeletingId(serviceId);
    try {
      await deleteMyService({ serviceId: serviceId as Id<"services"> });
    } catch (error) {
      // The server's reason, now that it arrives (ConvexError): a service
      // with open bookings cannot go, and every failure used to read as
      // "couldn't delete it, try again" — which would never work.
      const key = getSubmitErrorKey(error);
      if (key === "errorServiceOpenBookings") {
        appAlert(t("deleteBlockedTitle"), t("errorServiceOpenBookings"));
      } else {
        appAlert(t("error"), t(key === "pleaseTryAgain" ? "deleteFailed" : key));
      }
    } finally {
      setDeletingId(null);
    }
  };
  const confirmDelete = (serviceId: string) => {
    if (openBookingServiceIds.has(serviceId)) {
      appAlert(t("deleteBlockedTitle"), t("errorServiceOpenBookings"));
      return;
    }
    // While the bookings are still loading this asks as usual; the server
    // refuses with the same words if there are any.
    appAlert(t("deleteServiceTitle"), t("deleteForGoodMessage"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => void remove(serviceId) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header — the short staggered entrance, as on My Listings. */}
        <Animated.View
          entering={enterFade(0)}
          style={[styles.header, isRTL && styles.headerRTL]}
        >
          <BackButton />
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t("myServices")}
          </Text>
        </Animated.View>

        {/* Filters: the app's ink chips, wrapping and mirrored in Arabic. */}
        {(isLoading || hasAny) && (
          <Animated.View
            entering={enterFade(1)}
            style={[styles.filterRow, isRTL && styles.rowRTL]}
          >
            {filters.map((status) => (
              <FilterChip
                key={status}
                label={status === "all" ? t("all") : t(STATUS_LABEL[status] ?? "statusPending")}
                selected={filter === status}
                onPress={() => setFilter(status)}
              />
            ))}
          </Animated.View>
        )}

        {/* Services List — cross-faded in from a skeleton of the same cards. */}
        <SkeletonFade
          loading={isLoading}
          skeleton={<SkeletonOwnerList isRTL={isRTL} />}
        >
        {filteredServices.length > 0 ? (
          <View style={styles.listingsContainer}>
            {filteredServices.map((service) => {
              const status = ownerStatusOf(service.status);
              return (
              <View
                key={service._id}
                style={[styles.listingCard, deletingId === service._id && styles.cardBusy]}
                pointerEvents={deletingId === service._id ? "none" : "auto"}
              >
                {/* The picture's height, photo or not — see My Listings. */}
                {service.images?.[0] ? (
                  <Image
                    source={{ uri: service.images[0] }}
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
                    {language === "ar" ? (service.title_ar || service.title_en || "—") : (service.title_en || "—")}
                  </Text>
                  <Text style={[styles.listingType, isRTL && styles.textRTL]}>
                    {t(serviceTypeLabelKey(service.serviceType))}
                  </Text>
                  {/* A suspended service shows the reason the admin gave,
                      and not "edit and save to send it back for review": the
                      server keeps a suspended service suspended whatever is
                      edited, so that hint would promise what cannot happen. */}
                  <ReviewNote
                    status={status}
                    reason={status === "suspended" ? service.suspendedReason : service.rejectionReason}
                    canEdit={status !== "suspended"}
                  />
                  <View style={[styles.cardFoot, isRTL && styles.rowRTL]}>
                    <OwnerStatusBadge status={status} />
                    <View style={[styles.actions, isRTL && styles.rowRTL]}>
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/provider/post-service",
                            params: { id: service._id },
                          })
                        }
                        style={({ pressed }) => [
                          styles.editButton,
                          isRTL && styles.rowRTL,
                          pressed && styles.pressed,
                        ]}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("editService")}
                      >
                        <Feather name="edit-2" size={13} color={colors.ink} />
                        <Text style={styles.editText}>{t("edit")}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmDelete(service._id)}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          isRTL && styles.rowRTL,
                          pressed && styles.pressed,
                        ]}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("deleteServiceTitle")}
                      >
                        <Feather name="trash-2" size={13} color={colors.signOut} />
                        <Text style={styles.deleteText}>{t("delete")}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
              );
            })}
          </View>
        ) : hasAny ? (
          /* Services exist, just none under this filter. */
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
          /* Nothing posted yet. It said "No listings yet" here — the
             listings screen's words on the services screen. */
          <View style={styles.emptyContainer}>
            <Feather name="briefcase" size={30} color={colors.onSurface.muted} />
            <Text style={styles.emptyTitle}>{t("noServicesYet")}</Text>
            <Text style={styles.emptyBody}>{t("startAddingServices")}</Text>
            {isApproved ? (
              <Button
                title={t("addFirstService")}
                size="sm"
                onPress={() => router.push("/provider/post-service")}
                style={styles.emptyButton}
              />
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
  emptyButton: {
    marginTop: 8,
  },
  bottomSpacing: {
    height: 32,
  },
});

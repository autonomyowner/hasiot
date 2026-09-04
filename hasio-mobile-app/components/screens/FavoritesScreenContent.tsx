import React, { useMemo, useState } from "react";
import type { TranslationKey } from "@/constants/translations";
import { useCurrency } from "@/hooks/useCurrency";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { categoryColors, colors, type AppFonts } from "@/constants/colors";
import { ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useFavorites } from "@/hooks/useConvexData";
import { SkeletonFade, SkeletonList } from "@/components/ui";
import { LodgingCard } from "@/components/lodging/LodgingCard";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { Lodging, ListingDetails } from "@/types";

type FavoriteListing = Doc<"listings">;

/**
 * Copies of the adapters in hooks/useConvexData.ts. They are private there and
 * that file belongs to another change in flight, so this screen carries its own
 * copy rather than widening that module's surface.
 */
function toDetails(l: FavoriteListing): ListingDetails {
  return {
    address: l.address || undefined,
    phone: l.phone || undefined,
    email: l.email || undefined,
    website: l.website || undefined,
    coordinates: l.coordinates,
    workingHours: l.workingHours?.length ? l.workingHours : undefined,
  };
}

// The raw listing type rides along: the card is stay-shaped and the mapper
// has to coerce every listing into a stay type, so this is the only way to
// know afterwards that a favourite is really a restaurant or an attraction.
type FavoriteItem = Lodging & { listingType: string };

function toLodging(l: FavoriteListing): FavoriteItem {
  return {
    listingType: l.type,
    id: l._id,
    name: l.name_en,
    nameAr: l.name_ar,
    type: (l.category === "luxury_hotel" ||
    l.category === "budget_hotel" ||
    l.category === "boutique_hotel"
      ? "hotel"
      : l.category === "serviced_apartment"
        ? "apartment"
        : l.category === "desert_camp"
          ? "camp"
          : l.category === "homestay"
            ? "homestay"
            : "hotel") as Lodging["type"],
    city: l.city,
    cityAr: l.city,
    neighborhood: l.region || l.city,
    neighborhoodAr: l.region || l.city,
    priceRange: l.priceRange || "",
    // Carried through undefined rather than defaulted: the Book button keys off
    // its absence, so a 0 here would offer a free night.
    pricePerNight: l.pricePerNight,
    currency: l.currency,
    maxGuests: l.maxGuests,
    rating: l.rating || 0,
    images: l.images || [],
    amenities: l.amenities || [],
    amenitiesAr: l.amenities || [],
    description: l.description_en || "",
    descriptionAr: l.description_ar || "",
    owner_id: l.ownerId || null,
    status: l.status as Lodging["status"],
    details: toDetails(l),
  };
}

export function FavoritesScreenContent() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const bottomClearance = useTabBarClearance();
  const { t, language, isRTL } = useLanguage();
  const { format } = useCurrency();

  // Signed-out guests get an empty array from the hook (the Convex query is
  // skipped), so they fall straight through to the empty state below.
  const { favorites, isLoading } = useFavorites();

  const items = useMemo(
    () =>
      (favorites as (FavoriteListing | null)[])
        .filter((l): l is FavoriteListing => l != null)
        .map(toLodging),
    [favorites]
  );

  const [selected, setSelected] = useState<DetailItem | null>(null);

  // Same mapping as the lodging screen — copied rather than imported, because
  // there it is a component-local function.
  const toDetailItem = (item: Lodging): DetailItem => ({
    id: item.id,
    title: getLocalizedText(item.name, item.nameAr, language),
    subtitle: getLocalizedText(item.city, item.cityAr, language),
    badge: t(`cat_${item.type}` as const),
    badgeColor: categoryColors[item.type],
    rating: item.rating,
    priceLine: item.pricePerNight
      ? `${format(item.pricePerNight)} ${t("perNight")}`
      : item.priceRange
        ? `${item.priceRange} ${t("perNight")}`
        : undefined,
    bookable: item.pricePerNight != null,
    maxGuests: item.maxGuests,
    images: item.images,
    description: getLocalizedText(item.description, item.descriptionAr, language),
    amenities: language === "ar" ? item.amenitiesAr : item.amenities,
    details: item.details,
    ownerId: item.owner_id,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenGradient />

      <Animated.View
        entering={FadeInDown.delay(100).duration(600)}
        style={[styles.header, isRTL && styles.headerRTL]}
      >
        <Text style={[styles.eyebrow, isRTL && styles.textRTL]}>
          {t("favorites")}
        </Text>
        <Text style={[styles.title, isRTL && styles.textRTL]}>
          {t("myFavorites")}
        </Text>
      </Animated.View>

      <SkeletonFade
        fill
        loading={isLoading}
        skeleton={<SkeletonList variant="lodging" isRTL={isRTL} />}
      >
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LodgingCard
              lodging={item}
              language={language}
              isRTL={isRTL}
              perNightText={t("perNight")}
              // Only a stay is priced by the night. A favourited restaurant or
              // attraction keeps its own badge and shows no nightly price.
              badge={
                item.listingType === "hotel"
                  ? undefined
                  : t(`cat_${item.listingType}` as TranslationKey)
              }
              showPrice={item.listingType === "hotel"}
              onPress={() => setSelected(toDetailItem(item))}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomClearance },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="heart" size={26} color={colors.onSurface.variant} />
              </View>
              <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
                {t("noFavorites")}
              </Text>
              <Text style={[styles.emptyMessage, isRTL && styles.textRTL]}>
                {t("noFavoritesHint")}
              </Text>
            </View>
          }
        />
      </SkeletonFade>

      <ListingDetailSheet item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 12,
    },
    headerRTL: {
      alignItems: "flex-end",
    },
    eyebrow: {
      fontSize: 11,
      fontFamily: fonts.semibold,
      color: colors.primary.deep,
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    title: {
      fontSize: 34,
      fontFamily: fonts.serif,
      color: colors.ink,
      letterSpacing: -0.5,
    },
    textRTL: {
      textAlign: "right",
    },
    listContent: {
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface.DEFAULT,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: fonts.semibold,
      color: colors.ink,
      marginBottom: 8,
    },
    emptyMessage: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.onSurface.variant,
      textAlign: "center",
      paddingHorizontal: 24,
    },
  });

import React, { memo, useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { colors, type AppFonts } from "@/constants/colors";
import { translations, type TranslationKey } from "@/constants/translations";
import { ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { toLodging, useFavorites } from "@/hooks/useConvexData";
import { Button, SkeletonFade, SkeletonList } from "@/components/ui";
import { LodgingCard } from "@/components/lodging/LodgingCard";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import { listingDetailItem, type DetailLabels } from "@/lib/listingDetail";
import type { Language, Lodging } from "@/types";
import type { TabKey } from "@/app/(tabs)/_layout";

// The card is shaped for stays, and `toLodging` has to file every listing under
// a stay kind to fill it. The listing's real type rides along, because without
// it a favourited restaurant is indistinguishable from a hotel.
type FavoriteItem = Lodging & { listingType: string };

// Unhearting a card here takes it off the list. It used to vanish on the spot
// and the cards below jumped up a whole card height in one frame; now it fades
// while the rest slide into its place.
const CARD_EXIT = FadeOut.duration(200);
const LIST_REFLOW = LinearTransition.duration(260);

const keyOf = (item: FavoriteItem) => item.id;

interface FavoritesScreenContentProps {
  /** Supplied by the tab shell; the empty state's "Explore stays" uses it. */
  onNavigateToTab?: (key: TabKey) => void;
}

export function FavoritesScreenContent({ onNavigateToTab }: FavoritesScreenContentProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const bottomClearance = useTabBarClearance();
  const router = useRouter();
  const { t, language, isRTL } = useLanguage();
  const { format } = useCurrency();
  const { isAuthenticated } = useConvexAuth();

  // A guest's hearts as well as an account's, newest first. This screen used to
  // show a guest "No favorites yet" under a row of red hearts, because the hook
  // skipped the query for anyone signed out; it now resolves the device's list
  // against the public listings.
  const { favorites, isLoading } = useFavorites();

  const items = useMemo<FavoriteItem[]>(
    () => favorites.map((listing) => ({ ...toLodging(listing), listingType: listing.type })),
    [favorites]
  );

  const typeLabel = useCallback(
    (type: string) => {
      const key = `cat_${type}`;
      // A type with no label is shown without a chip rather than as "cat_…".
      return key in translations.en ? t(key as TranslationKey) : "";
    },
    [t]
  );

  const labels = useMemo<DetailLabels>(
    () => ({ language, typeLabel, perNight: t("perNight"), formatPrice: format }),
    [language, typeLabel, t, format]
  );

  const [selected, setSelected] = useState<DetailItem | null>(null);
  const openItem = useCallback(
    (item: FavoriteItem) => setSelected(listingDetailItem(item, item.listingType, labels)),
    [labels]
  );
  const closeSheet = useCallback(() => setSelected(null), []);

  const perNightText = t("perNight");
  const renderItem = useCallback(
    ({ item }: { item: FavoriteItem }) => (
      <FavoriteRow
        item={item}
        language={language}
        isRTL={isRTL}
        perNightText={perNightText}
        // Only a stay is priced by the night. A restaurant or an attraction
        // keeps its own badge and shows no nightly price.
        badge={item.listingType === "hotel" ? undefined : typeLabel(item.listingType) || undefined}
        onOpen={openItem}
      />
    ),
    [language, isRTL, perNightText, typeLabel, openItem]
  );

  const exploreStays = onNavigateToTab ? () => onNavigateToTab("lodging") : undefined;

  const emptyState = (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name="heart" size={26} color={colors.onSurface.variant} />
      </View>
      <Text style={styles.emptyTitle}>{t("noFavorites")}</Text>
      <Text style={styles.emptyMessage}>{t("noFavoritesHint")}</Text>

      {/* Somewhere to go from here. A guest can heart places without an
          account, so exploring comes first and signing in second — it is
          what keeps the hearts on every device, not what unlocks them. */}
      <View style={styles.emptyActions}>
        {exploreStays && (
          <Button title={t("favoritesExploreStays")} onPress={exploreStays} fullWidth />
        )}
        {!isAuthenticated && (
          <>
            <Button
              title={t("signIn")}
              variant={exploreStays ? "outline" : "primary"}
              onPress={() => router.push("/auth")}
              fullWidth
            />
            <Text style={styles.emptyNote}>{t("favoritesGuestHint")}</Text>
          </>
        )}
      </View>
    </View>
  );

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
        <Animated.FlatList
          data={items}
          keyExtractor={keyOf}
          renderItem={renderItem}
          itemLayoutAnimation={LIST_REFLOW}
          // The list cross-fades in from its skeleton as one piece; its rows
          // must not also play their exit when the whole list goes (sign-in
          // swaps the device's list for the account's).
          skipEnteringExitingAnimations
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomClearance },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={emptyState}
        />
      </SkeletonFade>

      <ListingDetailSheet item={selected} onClose={closeSheet} />
    </View>
  );
}

interface FavoriteRowProps {
  item: FavoriteItem;
  language: Language;
  isRTL: boolean;
  perNightText: string;
  badge?: string;
  onOpen: (item: FavoriteItem) => void;
}

// Memoised with a stable `onOpen`, so a heart tapped on one card re-renders
// that card rather than the whole list.
const FavoriteRow = memo(function FavoriteRow({
  item,
  language,
  isRTL,
  perNightText,
  badge,
  onOpen,
}: FavoriteRowProps) {
  const handlePress = useCallback(() => onOpen(item), [item, onOpen]);
  return (
    <Animated.View exiting={CARD_EXIT}>
      <LodgingCard
        lodging={item}
        language={language}
        isRTL={isRTL}
        perNightText={perNightText}
        badge={badge}
        showPrice={item.listingType === "hotel"}
        onPress={handlePress}
      />
    </Animated.View>
  );
});

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
    // Centred, so it reads the same in both languages without a mirror.
    emptyState: {
      alignItems: "center",
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
      textAlign: "center",
    },
    emptyMessage: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: fonts.regular,
      color: colors.onSurface.variant,
      textAlign: "center",
      paddingHorizontal: 24,
    },
    emptyActions: {
      alignSelf: "stretch",
      paddingHorizontal: 32,
      marginTop: 24,
      gap: 10,
    },
    emptyNote: {
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: fonts.regular,
      color: colors.onSurface.muted,
      textAlign: "center",
      marginTop: 2,
    },
  });

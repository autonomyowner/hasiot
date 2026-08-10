import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@/constants/colors";
import {
  HOME_CARD_GAP,
  HOME_CARD_WIDTH,
  HOME_CONTAINER_PADDING,
  LIST_CONTAINER_PADDING,
  MOMENT_CARD_WIDTH,
} from "@/constants/layout";
import { Skeleton, SkeletonLine, sweepPhase } from "./Skeleton";

/**
 * Screen-shaped skeletons.
 *
 * Every measurement here is copied from the component the skeleton stands in
 * for, and the source is named in a comment beside it. That is the whole job:
 * a placeholder that is a few points off its content announces itself the
 * instant the two swap. Where a number is shared with the real layout it comes
 * from `constants/layout` instead of being written twice.
 *
 * Text bars are sized from the line box of the text they replace — see
 * `SkeletonLine` — so a card of placeholders is as tall as the card of content
 * that lands in its place. They mirror the RTL alignment of the real screens
 * too: Arabic pushes card text to the right, and a bar that stayed left would
 * slide across the card as the two cross-fade.
 */

type ListingVariant = "lodging" | "food" | "event";

// LodgingCard / FoodCard / EventCard `imageContainer`.
const IMAGE_HEIGHT: Record<ListingVariant, number> = {
  lodging: 180,
  food: 160,
  event: 180,
};

interface SkeletonListingCardProps {
  variant: ListingVariant;
  isRTL?: boolean;
  /** Position in the list — seeds the stagger so cards ripple. */
  index?: number;
}

export function SkeletonListingCard({
  variant,
  isRTL = false,
  index = 0,
}: SkeletonListingCardProps) {
  const seed = index * 3;

  return (
    <View style={styles.listingCard}>
      <Skeleton
        radius={18}
        phase={sweepPhase(seed)}
        style={[styles.listingImage, { height: IMAGE_HEIGHT[variant] }]}
      />

      <View style={styles.listingContent}>
        {variant === "event" ? (
          <>
            {/* EventCard title: two lines at an explicit lineHeight of 22. */}
            <SkeletonLine
              width="88%"
              box={22}
              isRTL={isRTL}
              phase={sweepPhase(seed + 1)}
            />
            <SkeletonLine
              width="58%"
              box={22}
              isRTL={isRTL}
              phase={sweepPhase(seed + 2)}
              style={styles.gap6}
            />
            {/* Time, then location. */}
            <SkeletonLine
              width="28%"
              box={16}
              isRTL={isRTL}
              phase={sweepPhase(seed + 3)}
              style={styles.gap4}
            />
            <SkeletonLine
              width="46%"
              box={16}
              isRTL={isRTL}
              phase={sweepPhase(seed + 4)}
            />
          </>
        ) : (
          <>
            {/* Type / category badge: radius 11, ~26 tall with its padding. */}
            <Skeleton
              radius={11}
              phase={sweepPhase(seed + 1)}
              style={[styles.listingBadge, isRTL && styles.alignEnd]}
            />
            <SkeletonLine
              width={variant === "food" ? "70%" : "68%"}
              box={21}
              isRTL={isRTL}
              phase={sweepPhase(seed + 2)}
              style={styles.gap4}
            />
            <SkeletonLine
              width={variant === "food" ? "45%" : "42%"}
              box={16}
              isRTL={isRTL}
              phase={sweepPhase(seed + 3)}
              style={variant === "food" ? styles.gap4 : styles.gap8}
            />
            {/* FoodCard carries an extra line — cuisine *and* opening hours. */}
            {variant === "food" && (
              <SkeletonLine
                width="38%"
                box={16}
                isRTL={isRTL}
                phase={sweepPhase(seed + 4)}
                style={styles.gap8}
              />
            )}
            <SkeletonLine
              width={variant === "food" ? "34%" : "36%"}
              box={20}
              isRTL={isRTL}
              phase={sweepPhase(seed + 5)}
            />
          </>
        )}
      </View>
    </View>
  );
}

interface SkeletonListProps {
  variant: ListingVariant;
  isRTL?: boolean;
  count?: number;
}

/** Stands in for the FlatList on the lodging, food and events screens. */
export function SkeletonList({
  variant,
  isRTL = false,
  count = 3,
}: SkeletonListProps) {
  return (
    <View style={styles.listContent}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonListingCard
          key={index}
          variant={variant}
          isRTL={isRTL}
          index={index}
        />
      ))}
    </View>
  );
}

function SkeletonSectionHeader({
  seed,
  isRTL,
}: {
  seed: number;
  isRTL: boolean;
}) {
  return (
    <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
      {/* Section title, then the "See all" link. */}
      <SkeletonLine width={150} box={22} bar={16} phase={sweepPhase(seed)} />
      <SkeletonLine width={48} box={16} bar={12} phase={sweepPhase(seed + 1)} />
    </View>
  );
}

function SkeletonDestinationGrid({
  heights,
  seed,
  isRTL,
}: {
  heights: number[];
  seed: number;
  isRTL: boolean;
}) {
  return (
    <View style={[styles.grid, isRTL && styles.rowReverse]}>
      {heights.map((height, index) => (
        <Skeleton
          key={index}
          radius={24}
          phase={sweepPhase(seed + index)}
          style={[styles.gridCard, { height }]}
        />
      ))}
    </View>
  );
}

/**
 * The home screen below its header and search bar: the category rail, then the
 * two destination grids. `DestinationGridCard` alternates a tall card in on
 * every third position, which is why the heights below are uneven.
 */
export function SkeletonHomeSections({ isRTL = false }: { isRTL?: boolean }) {
  return (
    <View>
      <View style={styles.section}>
        <View style={[styles.categoryRail, isRTL && styles.rowReverse]}>
          {[0, 1].map((index) => (
            <Skeleton
              key={index}
              radius={18}
              phase={sweepPhase(index)}
              style={styles.categoryCard}
            />
          ))}
        </View>
      </View>

      {/* Featured destinations — tall card at index % 3 === 0. */}
      <View style={styles.section}>
        <SkeletonSectionHeader seed={2} isRTL={isRTL} />
        <SkeletonDestinationGrid
          heights={[260, 210, 210, 260]}
          seed={4}
          isRTL={isRTL}
        />
      </View>

      {/* More destinations — tall card at index % 3 === 1. */}
      <View style={styles.section}>
        <SkeletonSectionHeader seed={8} isRTL={isRTL} />
        <SkeletonDestinationGrid heights={[210, 260]} seed={10} isRTL={isRTL} />
      </View>
    </View>
  );
}

/**
 * Stands in for the owner's own listings and services (`business/my-listings`,
 * `provider/my-services`) — the same card in both.
 *
 * Note the status badge stays left in Arabic while the text moves right: those
 * screens give the badge a plain `alignSelf: "flex-start"` with no RTL variant,
 * and a placeholder that "fixed" that would be the thing out of place.
 */
export function SkeletonOwnerList({
  isRTL = false,
  count = 3,
}: {
  isRTL?: boolean;
  count?: number;
}) {
  return (
    <View style={styles.ownerList}>
      {Array.from({ length: count }).map((_, index) => {
        const seed = index * 3;
        return (
          <View key={index} style={styles.ownerCard}>
            <Skeleton phase={sweepPhase(seed)} style={styles.ownerImage} />
            <View style={styles.ownerInfo}>
              <SkeletonLine
                width="72%"
                box={21}
                isRTL={isRTL}
                phase={sweepPhase(seed + 1)}
                style={styles.gap4}
              />
              <SkeletonLine
                width="50%"
                box={16}
                isRTL={isRTL}
                phase={sweepPhase(seed + 2)}
                style={styles.gap8}
              />
              <Skeleton
                radius={12}
                phase={sweepPhase(seed + 3)}
                style={styles.ownerBadge}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Stands in for the 2-column moments grid. */
export function SkeletonMomentsGrid({
  isRTL = false,
  count = 4,
}: {
  isRTL?: boolean;
  count?: number;
}) {
  return (
    <View style={styles.momentsGrid}>
      {Array.from({ length: count }).map((_, index) => {
        const seed = index * 3;
        return (
          <View key={index} style={styles.momentCard}>
            <Skeleton phase={sweepPhase(seed)} style={styles.momentImage} />
            <View style={styles.momentNote}>
              <SkeletonLine
                width="85%"
                box={20}
                isRTL={isRTL}
                phase={sweepPhase(seed + 1)}
              />
            </View>
            <View style={styles.momentLocation}>
              <SkeletonLine
                width="55%"
                box={15}
                isRTL={isRTL}
                phase={sweepPhase(seed + 2)}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // --- Listing screens (LodgingCard / FoodCard / EventCard) ---
  // Matches `listContent` on the lodging, food and events screens.
  listContent: {
    paddingHorizontal: LIST_CONTAINER_PADDING,
    paddingTop: 8,
  },
  listingCard: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 24,
    padding: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 16,
  },
  listingImage: {
    width: "100%",
  },
  listingContent: {
    padding: 14,
    paddingBottom: 6,
  },
  listingBadge: {
    width: 76,
    height: 26,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  alignEnd: {
    alignSelf: "flex-end",
  },
  // The real text carries these margins; the placeholders inherit them so the
  // vertical rhythm of a card survives the swap.
  gap4: {
    marginBottom: 4,
  },
  gap6: {
    marginBottom: 6,
  },
  gap8: {
    marginBottom: 8,
  },

  // --- Home screen ---
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: HOME_CONTAINER_PADDING,
    marginBottom: 12,
  },
  categoryRail: {
    flexDirection: "row",
    paddingHorizontal: HOME_CONTAINER_PADDING,
  },
  // CategoryCard.
  categoryCard: {
    width: 280,
    height: 160,
    marginRight: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: HOME_CONTAINER_PADDING,
    gap: HOME_CARD_GAP,
  },
  gridCard: {
    width: HOME_CARD_WIDTH,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  // The home screen flips these three rows in Arabic rather than relying on
  // I18nManager, which the app deliberately leaves off.
  rowReverse: {
    flexDirection: "row-reverse",
  },

  // --- Owner dashboards (my-listings / my-services) ---
  ownerList: {
    paddingHorizontal: LIST_CONTAINER_PADDING,
    gap: 12,
  },
  ownerCard: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ownerImage: {
    width: "100%",
    height: 140,
  },
  ownerInfo: {
    padding: 16,
  },
  ownerBadge: {
    width: 78,
    height: 23,
    alignSelf: "flex-start",
  },

  // --- Moments screen ---
  momentsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: LIST_CONTAINER_PADDING,
  },
  momentCard: {
    width: MOMENT_CARD_WIDTH,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 12,
  },
  momentImage: {
    width: "100%",
    height: MOMENT_CARD_WIDTH,
  },
  momentNote: {
    padding: 12,
    paddingBottom: 8,
  },
  momentLocation: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});

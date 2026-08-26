import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@/constants/colors";
import {
  CATEGORY_CARD_HEIGHT,
  CATEGORY_CARD_WIDTH,
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

// LodgingCard / FoodCard / EventCard image (the image *is* the card now).
const IMAGE_HEIGHT: Record<ListingVariant, number> = {
  lodging: 240,
  food: 220,
  event: 240,
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
        radius={24}
        phase={sweepPhase(seed)}
        style={[styles.listingImage, { height: IMAGE_HEIGHT[variant] }]}
      />

      {/* The floating white info pill the real cards render over the image. */}
      <View style={styles.listingPill}>
        <View style={[styles.listingPillRow, isRTL && styles.rowReverse]}>
          <SkeletonLine
            width="52%"
            box={20}
            isRTL={isRTL}
            phase={sweepPhase(seed + 1)}
          />
          <Skeleton
            radius={999}
            phase={sweepPhase(seed + 2)}
            style={styles.listingPillChip}
          />
        </View>
        <SkeletonLine
          width="68%"
          box={17}
          isRTL={isRTL}
          phase={sweepPhase(seed + 3)}
          style={styles.gapTop4}
        />
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
      <SkeletonLine width={150} box={22} bar={16} phase={sweepPhase(seed)} />
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
              radius={24}
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
    marginBottom: 20,
  },
  listingImage: {
    width: "100%",
  },
  // Mirrors the real cards' floating info pill (inset 10, radius 18).
  listingPill: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  listingPillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  listingPillChip: {
    width: 64,
    height: 22,
  },
  gapTop4: {
    marginTop: 4,
  },
  // Used by the owner-list skeleton, whose card layout is unchanged.
  gap4: {
    marginBottom: 4,
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
    width: CATEGORY_CARD_WIDTH,
    height: CATEGORY_CARD_HEIGHT,
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
    borderRadius: 22,
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

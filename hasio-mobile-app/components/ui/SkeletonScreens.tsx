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
import { Skeleton, SkeletonLine, SkeletonPill, sweepPhase } from "./Skeleton";

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

// Kept as a union rather than inlined: the height has to match the real card
// this stands in for, so a new listing screen adds a variant here instead of
// guessing.
type ListingVariant = "lodging";

// LodgingCard image (the image *is* the card now).
const IMAGE_HEIGHT: Record<ListingVariant, number> = {
  lodging: 240,
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

      {/* The caption the real cards lay on the photograph: type chip, title,
          then the place-and-price line. */}
      <View style={[styles.listingCaption, isRTL && styles.listingCaptionRTL]}>
        <Skeleton
          radius={999}
          phase={sweepPhase(seed + 1)}
          style={styles.listingCaptionChip}
        />
        <SkeletonLine
          width="62%"
          box={28}
          isRTL={isRTL}
          phase={sweepPhase(seed + 2)}
          style={[styles.captionLine, styles.gapTop8]}
        />
        <SkeletonLine
          width="45%"
          box={17}
          isRTL={isRTL}
          phase={sweepPhase(seed + 3)}
          style={[styles.captionLine, styles.gapTop6]}
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

/** Stands in for the FlatList on the lodging screen. */
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
  // --- Listing screens (LodgingCard) ---
  // Matches `listContent` on the lodging screen.
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
  // Mirrors the real cards' caption block (inset 16, chip then title then
  // meta). No panel: the placeholder sits on the image the same way the text
  // does, so the cross-fade between them does not shift anything.
  listingCaption: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: "flex-start",
  },
  listingCaptionRTL: {
    alignItems: "flex-end",
  },
  listingCaptionChip: {
    width: 64,
    height: 22,
  },
  // The chip sizes to itself, so the two lines under it have to be stretched
  // back to full width or their percentage widths resolve against nothing.
  captionLine: {
    alignSelf: "stretch",
  },
  gapTop8: {
    marginTop: 8,
  },
  gapTop6: {
    marginTop: 6,
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

/**
 * Mirrors the row in app/bookings/index.tsx: 84px thumb, name, two meta
 * lines, chip + amount on the last line. Same paddings as the real list so
 * the cross-fade to content is a fade and not a shuffle.
 */
export function SkeletonBookingList({
  isRTL = false,
  count = 3,
}: {
  isRTL?: boolean;
  count?: number;
}) {
  return (
    <View style={bookingStyles.list}>
      {Array.from({ length: count }).map((_, index) => {
        const seed = index * 5;
        return (
          <View key={index} style={[bookingStyles.row, isRTL && bookingStyles.rowRTL]}>
            <Skeleton radius={12} phase={sweepPhase(seed)} style={bookingStyles.thumb} />
            <View style={bookingStyles.body}>
              <SkeletonLine width="70%" box={22} isRTL={isRTL} phase={sweepPhase(seed + 1)} />
              <SkeletonLine width="55%" box={18} isRTL={isRTL} phase={sweepPhase(seed + 2)} />
              <SkeletonLine width="40%" box={18} isRTL={isRTL} phase={sweepPhase(seed + 3)} />
              <View style={[bookingStyles.footer, isRTL && bookingStyles.rowRTL]}>
                <SkeletonPill width={76} height={22} phase={sweepPhase(seed + 4)} />
                <Skeleton radius={4} phase={sweepPhase(seed + 4)} style={bookingStyles.amount} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Mirrors app/bookings/[id].tsx: status card, listing card with hero, facts card. */
export function SkeletonBookingDetail({ isRTL = false }: { isRTL?: boolean }) {
  const edge = isRTL ? bookingStyles.selfEnd : undefined;
  return (
    <View style={bookingStyles.detail}>
      <View style={bookingStyles.card}>
        <SkeletonPill width={88} height={22} phase={sweepPhase(0)} style={edge} />
        <SkeletonLine width={110} box={18} isRTL={isRTL} phase={sweepPhase(1)} style={bookingStyles.gap8} />
        <SkeletonLine width={160} box={32} bar={26} isRTL={isRTL} phase={sweepPhase(2)} />
      </View>
      <View style={bookingStyles.card}>
        <Skeleton radius={12} phase={sweepPhase(3)} style={bookingStyles.hero} />
        <SkeletonLine width="65%" box={23} isRTL={isRTL} phase={sweepPhase(4)} style={bookingStyles.gap8} />
        <SkeletonLine width="45%" box={19} isRTL={isRTL} phase={sweepPhase(5)} />
      </View>
      <View style={bookingStyles.card}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[bookingStyles.factRow, isRTL && bookingStyles.rowRTL]}>
            <Skeleton radius={4} phase={sweepPhase(6 + i)} style={bookingStyles.factLabel} />
            <Skeleton radius={4} phase={sweepPhase(6 + i)} style={bookingStyles.factValue} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Separate sheet from `styles` above: these mirror the booking screens'
// numbers, and keeping them together makes a drift easy to spot.
const bookingStyles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 12 },
  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 16,
    padding: 12,
  },
  rowRTL: { flexDirection: "row-reverse" },
  thumb: { width: 84, height: 84 },
  body: { flex: 1, justifyContent: "space-between" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  amount: { width: 64, height: 16 },
  detail: { paddingHorizontal: 20, gap: 12 },
  card: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  selfEnd: { alignSelf: "flex-end" },
  gap8: { marginTop: 8 },
  hero: { width: "100%", height: 140 },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  factLabel: { width: 70, height: 13 },
  factValue: { width: 90, height: 15 },
});

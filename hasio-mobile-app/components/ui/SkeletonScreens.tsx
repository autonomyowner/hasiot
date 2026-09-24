import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, type AppFonts } from "@/constants/colors";
import { Feather } from "@expo/vector-icons";
import { useConvexConnectionState } from "convex/react";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import {
  CHIP_GAP,
  chipHeight,
  HOME_CHIP_ROW_MARGIN_TOP,
  HOME_GRID_CARD_HEIGHT,
  HOME_GRID_CARD_TALL_HEIGHT,
  HOME_SECTION_EYEBROW,
  HOME_SECTION_MARGIN_BOTTOM,
  HOME_SECTION_MARGIN_TOP,
  HOME_SECTION_TITLE,
  LODGING_CARD_CHIP_PADDING_VERTICAL,
  LODGING_CARD_CHIP_TEXT,
  LODGING_CARD_HEIGHT,
  LODGING_CARD_LOCATION_TEXT,
  LODGING_CARD_NAME_TEXT,
  LODGING_CARD_PRICE_TEXT,
  lineHeightFor,
  HOME_CARD_GAP,
  HOME_CARD_WIDTH,
  HOME_CONTAINER_PADDING,
  HOME_RAIL_CARD_HEIGHT,
  HOME_RAIL_CARD_WIDTH,
  HOME_RAIL_GAP,
  HOME_STAY_BANNER_HEIGHT,
  LIST_CONTAINER_PADDING,
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
  lodging: LODGING_CARD_HEIGHT,
};

/**
 * The caption's three lines as LodgingCard sets them, in the script being
 * shown. The caption is pinned to the card's bottom edge, so every point a
 * line is short of its Arabic height moved the lines above it down: the chip
 * and the title bar sat 4–6pt low and jumped up as the cards faded in.
 */
function lodgingCaptionBoxes(arabic: boolean) {
  return {
    chip:
      LODGING_CARD_CHIP_PADDING_VERTICAL * 2 +
      lineHeightFor(LODGING_CARD_CHIP_TEXT, arabic),
    name: lineHeightFor(LODGING_CARD_NAME_TEXT, arabic),
    // The meta row is as tall as the taller of its two lines.
    meta: Math.max(
      lineHeightFor(LODGING_CARD_LOCATION_TEXT, arabic),
      lineHeightFor(LODGING_CARD_PRICE_TEXT, arabic)
    ),
  };
}

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
  // In this app a right-to-left layout is always the Arabic one.
  const boxes = lodgingCaptionBoxes(isRTL);

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
          style={[styles.listingCaptionChip, { height: boxes.chip }]}
        />
        <SkeletonLine
          width="62%"
          box={boxes.name}
          isRTL={isRTL}
          phase={sweepPhase(seed + 2)}
          style={[styles.captionLine, styles.gapTop8]}
        />
        <SkeletonLine
          width="45%"
          box={boxes.meta}
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
  const stalled = useStalledConnection();
  if (stalled) return <StalledNotice />;

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
  eyebrow = false,
}: {
  seed: number;
  isRTL: boolean;
  /** Featured opens with a small uppercase line above its title. */
  eyebrow?: boolean;
}) {
  // A column, not a row: the eyebrow stacks over the title. SkeletonLine
  // aligns its own bar, so the block needs no RTL variant of its own.
  //
  // The boxes are the line heights the Home heads are set in, raised for
  // Arabic the way the heads themselves are (an RTL layout is always the
  // Arabic one here). They used to be 12 and 26 — short of the real lines even
  // in English, and ~30pt short in Arabic, so the page jumped as data landed.
  return (
    <View style={styles.sectionHeader}>
      {eyebrow && (
        <SkeletonLine
          width={110}
          box={lineHeightFor(HOME_SECTION_EYEBROW, isRTL)}
          isRTL={isRTL}
          phase={sweepPhase(seed)}
        />
      )}
      <SkeletonLine
        width={210}
        box={lineHeightFor(HOME_SECTION_TITLE, isRTL)}
        isRTL={isRTL}
        phase={sweepPhase(seed + 1)}
      />
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
        <View key={index} style={[styles.gridCard, { height }]}>
          <Skeleton radius={24} phase={sweepPhase(seed + index)} style={styles.cardFill} />
        </View>
      ))}
    </View>
  );
}

/**
 * The home screen below its search bar: the kind chips, the featured rail, the
 * stay banner, then the "more" grid. The grid's first row is a short card
 * beside a tall one — see `isTallGridCard` on the Home screen — which is why
 * the heights below are uneven.
 */
export function SkeletonHomeSections({ isRTL = false }: { isRTL?: boolean }) {
  const stalled = useStalledConnection();
  if (stalled) return <StalledNotice />;

  return (
    <View>
      {/* Kind chips — "All" plus whichever kinds the data holds. As tall as
          a FilterChip in the language being shown: the label's line height is
          raised in Arabic, and the pills used to stay at the English 36pt. */}
      <View style={[styles.chipRow, isRTL && styles.rowReverse]}>
        {[56, 72, 64, 68].map((width, index) => (
          <SkeletonPill
            key={index}
            width={width}
            height={chipHeight(isRTL)}
            phase={sweepPhase(index)}
          />
        ))}
      </View>

      {/* Featured — eyebrow over a serif title, then the snapping rail. */}
      <SkeletonSectionHeader seed={4} isRTL={isRTL} eyebrow />
      <View style={[styles.rail, isRTL && styles.rowReverse]}>
        {[0, 1].map((index) => (
          <View key={index} style={styles.railCard}>
            <Skeleton
              radius={28}
              phase={sweepPhase(6 + index)}
              style={styles.cardFill}
            />
          </View>
        ))}
      </View>

      {/* The stay banner. */}
      <View style={styles.banner}>
        <Skeleton radius={24} phase={sweepPhase(8)} style={styles.cardFill} />
      </View>

      {/* More destinations — the first row of the two columns. */}
      <SkeletonSectionHeader seed={9} isRTL={isRTL} />
      <SkeletonDestinationGrid
        heights={[HOME_GRID_CARD_HEIGHT, HOME_GRID_CARD_TALL_HEIGHT]}
        seed={11}
        isRTL={isRTL}
      />
    </View>
  );
}

/** How long a placeholder may shimmer with the connection down before it says so. */
const STALLED_AFTER_MS = 6000;

/**
 * True once this placeholder has been up for `STALLED_AFTER_MS` while the
 * connection to the backend is down.
 *
 * A skeleton promises "a moment". Offline — flight mode, a dead zone on the
 * road between cities — the shimmer used to run for as long as anyone
 * watched, with nothing to say it never would finish. The clock starts when
 * the skeleton mounts, which is when the loading started, and the answer
 * follows the connection: once it is back the shimmer returns until the data
 * lands, and Convex resubscribes by itself, so there is nothing to retry.
 */
function useStalledConnection(): boolean {
  const { isWebSocketConnected } = useConvexConnectionState();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), STALLED_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return waited && !isWebSocketConnected;
}

/**
 * Stands in for a skeleton that has been waiting on a connection that is not
 * there. Centred, so it reads the same in either language; TalkBack announces
 * it when it appears (the live region is Android's alone).
 */
function StalledNotice() {
  const noticeStyles = useThemedStyles(makeNoticeStyles);
  const { t } = useLanguage();
  return (
    <View style={noticeStyles.notice} accessibilityLiveRegion="polite">
      <Feather name="wifi-off" size={28} color={colors.onSurface.muted} />
      <Text style={noticeStyles.title}>{t("loadStalledTitle")}</Text>
      <Text style={noticeStyles.message}>{t("loadStalledMessage")}</Text>
    </View>
  );
}

const makeNoticeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    notice: {
      alignItems: "center",
      paddingHorizontal: 32,
      paddingTop: 48,
      paddingBottom: 24,
      gap: 8,
    },
    title: {
      fontFamily: fonts.semibold,
      fontSize: 17,
      color: colors.ink,
      textAlign: "center",
      marginTop: 4,
    },
    message: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.onSurface.variant,
      textAlign: "center",
    },
  });

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
  // Its height comes from `lodgingCaptionBoxes`, per language.
  listingCaptionChip: {
    width: 64,
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
  // The chip rail, at the gutter and stride the real FilterChip row uses.
  chipRow: {
    flexDirection: "row",
    gap: CHIP_GAP,
    paddingHorizontal: HOME_CONTAINER_PADDING,
    marginTop: HOME_CHIP_ROW_MARGIN_TOP,
  },
  sectionHeader: {
    paddingHorizontal: HOME_CONTAINER_PADDING,
    marginTop: HOME_SECTION_MARGIN_TOP,
    marginBottom: HOME_SECTION_MARGIN_BOTTOM,
  },
  rail: {
    flexDirection: "row",
    gap: HOME_RAIL_GAP,
    paddingHorizontal: HOME_CONTAINER_PADDING,
    // The rail scrolls in the real screen; here the second card is only ever
    // half seen, and without this it widens the whole scroll view.
    overflow: "hidden",
  },
  // Same wrapper/shadow split as the grid cards below.
  railCard: {
    width: HOME_RAIL_CARD_WIDTH,
    height: HOME_RAIL_CARD_HEIGHT,
    borderRadius: 28,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  banner: {
    height: HOME_STAY_BANNER_HEIGHT,
    marginHorizontal: HOME_CONTAINER_PADDING,
    marginTop: 20,
    borderRadius: 24,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: HOME_CONTAINER_PADDING,
    gap: HOME_CARD_GAP,
  },
  // Mirrors the real card's wrapper: shadow on a non-clipping view, the
  // rounded skeleton inside it. Same weight as the content, so the shadow
  // neither appears nor changes when the two cross-fade.
  gridCard: {
    width: HOME_CARD_WIDTH,
    borderRadius: 24,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardFill: {
    width: "100%",
    height: "100%",
  },
  // In Arabic these three rows start at the right edge, as the real ones do:
  // the chips and the rail are inverted FlatLists there, and the grid's first
  // column is the right-hand one. (The app leaves I18nManager off, so nothing
  // mirrors by itself.)
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
});

/**
 * Mirrors BookingRow on app/bookings/index.tsx: rows on the page divided by a
 * hairline, an 84pt thumb with the 14 radius, the name, two meta lines, then
 * the status chip beside the amount. It still drew the white inset cards the
 * rows were before they were flattened into the page, so the list shifted
 * when the real rows replaced it.
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
            <Skeleton radius={14} phase={sweepPhase(seed)} style={bookingStyles.thumb} />
            <View style={bookingStyles.body}>
              <SkeletonLine width="70%" box={21} isRTL={isRTL} phase={sweepPhase(seed + 1)} />
              <SkeletonLine width="55%" box={19} isRTL={isRTL} phase={sweepPhase(seed + 2)} />
              <SkeletonLine width="40%" box={19} isRTL={isRTL} phase={sweepPhase(seed + 3)} />
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

/**
 * Mirrors HostBookingCard on business/bookings.tsx, as the Requests tab it
 * opens on shows it: a raised card (24 radius, 16 padding, 12 gap) holding the
 * 72pt thumb and its lines, the guest row with its 44pt call button, then the
 * two 50pt action buttons. The host inbox used to borrow the guests' list
 * skeleton, a different card, so everything jumped when the real one landed.
 */
export function SkeletonHostBookingList({
  isRTL = false,
  count = 3,
}: {
  isRTL?: boolean;
  count?: number;
}) {
  return (
    <View style={bookingStyles.hostList}>
      {Array.from({ length: count }).map((_, index) => {
        const seed = index * 6;
        return (
          <View key={index} style={bookingStyles.hostCard}>
            <View style={[bookingStyles.hostTop, isRTL && bookingStyles.rowRTL]}>
              <Skeleton radius={14} phase={sweepPhase(seed)} style={bookingStyles.hostThumb} />
              <View style={bookingStyles.hostBody}>
                <SkeletonLine width="70%" box={21} isRTL={isRTL} phase={sweepPhase(seed + 1)} />
                <SkeletonLine width="55%" box={19} isRTL={isRTL} phase={sweepPhase(seed + 2)} />
                <View style={[bookingStyles.footer, isRTL && bookingStyles.rowRTL]}>
                  <SkeletonPill width={76} height={22} phase={sweepPhase(seed + 3)} />
                  <Skeleton radius={4} phase={sweepPhase(seed + 3)} style={bookingStyles.amount} />
                </View>
              </View>
            </View>
            <View style={[bookingStyles.hostGuestRow, isRTL && bookingStyles.rowRTL]}>
              <View style={bookingStyles.hostBody}>
                <SkeletonLine width="45%" box={20} isRTL={isRTL} phase={sweepPhase(seed + 4)} />
                <SkeletonLine width="35%" box={19} isRTL={isRTL} phase={sweepPhase(seed + 4)} />
              </View>
              <SkeletonPill width={44} height={44} phase={sweepPhase(seed + 5)} />
            </View>
            <View style={[bookingStyles.hostActions, isRTL && bookingStyles.rowRTL]}>
              <Skeleton radius={14} phase={sweepPhase(seed + 5)} style={bookingStyles.hostAction} />
              <Skeleton radius={14} phase={sweepPhase(seed + 5)} style={bookingStyles.hostAction} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Mirrors app/bookings/[id].tsx: the one raised card (status chip, code
 * label, the code), then the listing — hero, name, address, the two action
 * pills — and the facts, as content on the page divided by hairlines. It drew
 * three white cards, the screen's look before it was flattened, so the page
 * jumped when the booking arrived.
 */
export function SkeletonBookingDetail({ isRTL = false }: { isRTL?: boolean }) {
  const edge = isRTL ? bookingStyles.selfEnd : undefined;
  return (
    <View style={bookingStyles.detail}>
      <View style={bookingStyles.summary}>
        <SkeletonPill width={88} height={22} phase={sweepPhase(0)} style={edge} />
        <SkeletonLine width={130} box={17} isRTL={isRTL} phase={sweepPhase(1)} style={bookingStyles.gap4} />
        <SkeletonLine width={160} box={36} bar={28} isRTL={isRTL} phase={sweepPhase(2)} />
      </View>
      <View style={bookingStyles.section}>
        <Skeleton radius={20} phase={sweepPhase(3)} style={bookingStyles.hero} />
        <SkeletonLine width="65%" box={26} isRTL={isRTL} phase={sweepPhase(4)} />
        <SkeletonLine width="45%" box={19} isRTL={isRTL} phase={sweepPhase(5)} />
        <View style={[bookingStyles.pills, isRTL && bookingStyles.rowRTL]}>
          <SkeletonPill width={96} height={44} phase={sweepPhase(6)} />
          <SkeletonPill width={128} height={44} phase={sweepPhase(7)} />
        </View>
      </View>
      <View style={bookingStyles.section}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[bookingStyles.factRow, isRTL && bookingStyles.rowRTL]}>
            <Skeleton radius={4} phase={sweepPhase(8 + i)} style={bookingStyles.factLabel} />
            <Skeleton radius={4} phase={sweepPhase(8 + i)} style={bookingStyles.factValue} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Separate sheet from `styles` above: these mirror the booking screens'
// numbers, and keeping them together makes a drift easy to spot.
const bookingStyles = StyleSheet.create({
  // BookingRow: content on the page, one hairline under each row.
  list: { paddingHorizontal: 20 },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
  // HostBookingCard.
  hostList: { paddingHorizontal: 20, gap: 12 },
  hostCard: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  hostTop: { flexDirection: "row", gap: 12 },
  hostThumb: { width: 72, height: 72 },
  hostBody: { flex: 1 },
  hostGuestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  hostActions: { flexDirection: "row", gap: 10 },
  hostAction: { flex: 1, height: 50 },
  // The booking detail: one raised summary card, then hairline sections.
  detail: { paddingHorizontal: 20 },
  summary: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 24,
    padding: 18,
    gap: 8,
    marginBottom: 4,
  },
  section: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
  },
  selfEnd: { alignSelf: "flex-end" },
  gap4: { marginTop: 4 },
  hero: { width: "100%", height: 160 },
  pills: { flexDirection: "row", gap: 10, marginTop: 4 },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  factLabel: { width: 70, height: 13 },
  factValue: { width: 90, height: 15 },
});

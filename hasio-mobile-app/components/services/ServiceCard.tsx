import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { colors, type AppFonts } from "@/constants/colors";
import { cityLabel } from "@/constants/cities";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useCurrency } from "@/hooks/useCurrency";
import { useLanguage } from "@/hooks/useLanguage";
import type { ServiceItem } from "@/hooks/useConvexData";
import {
  formatServicePrice,
  pickLanguage,
  serviceTypeLabelKey,
  type ServiceType,
} from "@/lib/serviceDisplay";

// One monochrome glyph per kind of service, drawn on the sand where a provider
// has not added a photo — a service is a person's work, and many providers
// have none to show. Feather has no car; the van reads as "gets you there".
const TYPE_ICONS: Record<ServiceType, keyof typeof Feather.glyphMap> = {
  tour_guide: "map",
  photographer: "camera",
  driver: "truck",
  translator: "globe",
  event_planner: "calendar",
  catering: "coffee",
  equipment_rental: "package",
  other: "briefcase",
};

export function serviceTypeIcon(serviceType: string): keyof typeof Feather.glyphMap {
  return TYPE_ICONS[serviceType as ServiceType] ?? "briefcase";
}

/** A tile's width in Home's row, which snaps a tile at a time. */
export const SERVICE_TILE_WIDTH = 200;

interface ServiceCardProps {
  service: ServiceItem;
  /**
   * Handed the card's own service, so a list passes one stable callback for
   * every row and a card whose service has not changed can skip a render.
   */
  onPress: (service: ServiceItem) => void;
  /** A row in the Book tab's list, or a tile in Home's "Local services". */
  variant?: "row" | "tile";
}

/**
 * One service: its photo (or the sand and its type's glyph), its title, what
 * it is and where, and its price line. The star only once someone has rated
 * it — an unrated provider is a new one, not a bad one.
 *
 * Memoised on the service object, which the adapters keep stable until the
 * data changes.
 */
export const ServiceCard = React.memo(function ServiceCard({
  service,
  onPress,
  variant = "row",
}: ServiceCardProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const { currency } = useCurrency();

  const title = pickLanguage(service.title, service.titleAr, language);
  const typeLabel = t(serviceTypeLabelKey(service.serviceType));
  const city = service.city ? cityLabel(service.city, language) : "";
  const meta = [typeLabel, city].filter(Boolean).join(" · ");
  const price = formatServicePrice(service, language, currency);
  const rated = service.rating > 0;
  const image = service.images[0];

  const accessibilityLabel = [
    title,
    typeLabel,
    city,
    price,
    rated ? `${t("rating")} ${service.rating.toFixed(1)}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const photo = (
    <>
      {/* The sand shows through until the photo lands, and stays with the
          type's glyph when there is none — never `{ uri: "" }`. */}
      {image ? (
        <Image
          source={{ uri: image }}
          style={styles.fill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Feather
          name={serviceTypeIcon(service.serviceType)}
          size={variant === "tile" ? 30 : 26}
          color={colors.onSurface.muted}
        />
      )}
    </>
  );

  if (variant === "tile") {
    return (
      // The shadow lives on a wrapper that does not clip: iOS drops a shadow
      // drawn on the same view as `overflow: "hidden"`.
      <View style={styles.tileWrap}>
        <PressableScale
          style={styles.tile}
          onPress={() => onPress(service)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <View style={styles.tileImage}>
            {photo}
            {rated && (
              <View style={[styles.tileRating, isRTL && styles.tileRatingRTL]}>
                <Feather name="star" size={11} color={colors.warm} />
                <Text style={styles.ratingText}>{service.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
          <View style={styles.tileBody}>
            {/* Two lines reserved, so every tile in the row is one height. */}
            <Text style={[styles.tileTitle, isRTL && styles.textRTL]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[styles.meta, isRTL && styles.textRTL]} numberOfLines={1}>
              {meta}
            </Text>
            <Text
              style={[styles.price, !service.bookable && styles.priceQuiet, isRTL && styles.textRTL]}
              numberOfLines={1}
            >
              {price}
            </Text>
          </View>
        </PressableScale>
      </View>
    );
  }

  return (
    <PressableScale
      style={[styles.row, isRTL && styles.rowRTL]}
      onPress={() => onPress(service)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.thumb}>{photo}</View>
      <View style={styles.body}>
        <Text style={[styles.title, isRTL && styles.textRTL]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.meta, isRTL && styles.textRTL]} numberOfLines={1}>
          {meta}
        </Text>
        <View style={[styles.footRow, isRTL && styles.rowRTL]}>
          {/* Shrinks rather than pushing the star out of the card. */}
          <Text
            style={[styles.price, styles.priceInRow, !service.bookable && styles.priceQuiet]}
            numberOfLines={1}
          >
            {price}
          </Text>
          {rated && (
            <View style={[styles.rating, isRTL && styles.rowRTL]}>
              <Feather name="star" size={12} color={colors.warm} />
              <Text style={styles.ratingText}>{service.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </PressableScale>
  );
});

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    fill: {
      ...StyleSheet.absoluteFill,
    },
    // A hairline rather than a shadow, like Home's result rows: a list is a
    // stack of these, and a dozen shadows on the cream read as fog.
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      marginBottom: 12,
      borderRadius: 20,
      backgroundColor: colors.surface.DEFAULT,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rowRTL: {
      flexDirection: "row-reverse",
    },
    thumb: {
      width: 88,
      height: 88,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: colors.sand,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      flex: 1,
      gap: 4,
    },
    textRTL: {
      textAlign: "right",
    },
    title: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 22,
      color: colors.ink,
    },
    meta: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.onSurface.variant,
    },
    footRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 2,
    },
    // The dark lime: the lime itself is a fill and reads 1.3:1 as text.
    price: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: colors.primary.deep,
    },
    priceInRow: {
      flexShrink: 1,
    },
    // "Price on request" is information, not a price to act on.
    priceQuiet: {
      fontFamily: fonts.medium,
      color: colors.onSurface.variant,
    },
    rating: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    ratingText: {
      fontFamily: fonts.semibold,
      fontSize: 12.5,
      color: colors.ink,
    },
    tileWrap: {
      width: SERVICE_TILE_WIDTH,
      borderRadius: 20,
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    tile: {
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: colors.surface.DEFAULT,
    },
    tileImage: {
      height: 132,
      backgroundColor: colors.sand,
      alignItems: "center",
      justifyContent: "center",
    },
    // The white pill the photo cards use for a rating, top corner.
    tileRating: {
      position: "absolute",
      top: 10,
      left: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.92)",
    },
    tileRatingRTL: {
      left: undefined,
      right: 10,
      flexDirection: "row-reverse",
    },
    tileBody: {
      padding: 12,
      gap: 3,
    },
    // 1.4× the size, so Arabic keeps the same box (useThemedStyles raises
    // anything tighter) and the two reserved lines are one height in both.
    tileTitle: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 21,
      minHeight: 42,
      color: colors.ink,
    },
  });

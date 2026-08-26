import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { Event, Language } from "@/types";
import { Feather } from "@expo/vector-icons";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { colors, fonts } from "@/constants/colors";
import { ReportSheet } from "@/components/ReportSheet";
import { PressableScale } from "@/components/ui";
import type { Id } from "../../../convex/_generated/dataModel";

interface EventCardProps {
  event: Event;
  language: Language;
  isRTL: boolean;
  onPress?: () => void;
}

export function EventCard({
  event,
  language,
  isRTL,
  onPress,
}: EventCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const { t } = useLanguage();

  const title = getLocalizedText(event.title, event.titleAr, language);
  const location = getLocalizedText(event.location, event.locationAr, language);
  const categoryLabel = t(`cat_${event.category}` as const);

  return (
    // Shadow lives on a wrapper that doesn't clip; iOS drops the shadow if the
    // same view has overflow: hidden.
    <View style={styles.shadowWrap}>
      <PressableScale
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${categoryLabel}, ${location}, ${event.date}`}
      >
        <Image
          source={event.images?.[0] ? { uri: event.images[0] } : undefined}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />

        {/* Date Badge */}
        <View style={[styles.dateBadge, isRTL && styles.dateBadgeRTL]}>
          <Text style={styles.dateText}>{event.date}</Text>
        </View>

        {/* More actions */}
        <Pressable
          style={[styles.moreButton, isRTL && styles.moreButtonRTL]}
          onPress={() => setReportOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("reportTitle")}
        >
          <Text style={styles.moreText}>⋯</Text>
        </Pressable>

        {/* Floating info pill */}
        <View style={styles.pill}>
          <View style={[styles.pillTopRow, isRTL && styles.rowRTL]}>
            <Text
              style={[styles.title, isRTL && styles.textRTL]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <View style={styles.typeChip}>
              <Text style={styles.typeText}>{categoryLabel}</Text>
            </View>
          </View>
          <View style={[styles.pillBottomRow, isRTL && styles.rowRTL]}>
            <View style={[styles.locationGroup, isRTL && styles.rowRTL]}>
              <Feather name="map-pin" size={12} color={colors.onSurface.muted} />
              <Text
                style={[styles.location, isRTL && styles.textRTL]}
                numberOfLines={1}
              >
                {location}
              </Text>
            </View>
            <Text style={styles.time}>{event.time}</Text>
          </View>
        </View>
      </PressableScale>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="listing"
        targetId={event.id}
        ownerId={event.owner_id ? (event.owner_id as Id<"users">) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginBottom: 20,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderRadius: 24,
  },
  card: {
    height: 240,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.sand,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  dateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dateBadgeRTL: {
    left: undefined,
    right: 12,
  },
  dateText: {
    color: colors.ink,
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  moreButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  moreButtonRTL: {
    right: undefined,
    left: 12,
  },
  moreText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    lineHeight: 18,
  },
  pill: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pillTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pillBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 5,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  title: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: fonts.semibold,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  typeChip: {
    backgroundColor: colors.mint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeText: {
    color: colors.primary.DEFAULT,
    fontSize: 11,
    fontFamily: fonts.semibold,
  },
  locationGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  time: {
    fontSize: 12.5,
    fontFamily: fonts.semibold,
    color: colors.primary.DEFAULT,
  },
  textRTL: {
    textAlign: "right",
  },
});

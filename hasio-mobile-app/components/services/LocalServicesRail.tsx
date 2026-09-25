import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import { colors, type AppFonts } from "@/constants/colors";
import {
  HOME_CONTAINER_PADDING,
  HOME_RAIL_GAP,
  HOME_SECTION_MARGIN_BOTTOM,
  HOME_SECTION_MARGIN_TOP,
  HOME_SECTION_TITLE,
} from "@/constants/layout";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import type { ServiceItem } from "@/hooks/useConvexData";
import { SERVICE_TILE_WIDTH, ServiceCard } from "./ServiceCard";
import { ServiceDetailSheet } from "./ServiceDetailSheet";

const serviceKey = (service: ServiceItem) => service.id;

interface LocalServicesRailProps {
  /** At most ten, what can be booked first — useLocalServices. */
  services: ServiceItem[];
  /** "See all": the Book tab, on Services. */
  onSeeAll: () => void;
}

/**
 * Home's "Local services" row: guides, drivers, photographers and the rest,
 * a tile each, with "See all" to the Book tab's Services.
 *
 * The row goes when there is nothing in it, but the service sheet it opens
 * stays mounted either way: if the last service went while its sheet was up
 * (suspended, or its provider blocked), taking the sheet down with the row
 * would pull a Modal off the screen under the traveller — on iOS, possibly
 * one still presenting the booking sheet, which strands a screen that takes
 * no touches.
 */
export function LocalServicesRail({ services, onSeeAll }: LocalServicesRailProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const [selected, setSelected] = useState<ServiceItem | null>(null);

  // Stable, so a tile whose service has not changed sits out the renders.
  const openService = useCallback((service: ServiceItem) => setSelected(service), []);
  const closeService = useCallback(() => setSelected(null), []);

  const renderTile = useCallback<ListRenderItem<ServiceItem>>(
    ({ item }) => <ServiceCard service={item} onPress={openService} variant="tile" />,
    [openService]
  );

  return (
    <>
      {services.length > 0 && (
        <View>
          <View style={[styles.head, isRTL && styles.headRTL]}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>{t("localServices")}</Text>
            <Pressable
              onPress={onSeeAll}
              hitSlop={10}
              style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("seeAllServices")}
            >
              <Text style={styles.seeAllText}>{t("seeAll")}</Text>
            </Pressable>
          </View>

          {/* `inverted` in Arabic mirrors the order, the starting edge, the
              scroll and the snapping in one place, like Home's other rows. A
              row that fits has nothing to scroll, and a swipe there should
              change tabs on iOS instead. */}
          <FlatList
            horizontal
            inverted={isRTL}
            data={services}
            keyExtractor={serviceKey}
            renderItem={renderTile}
            showsHorizontalScrollIndicator={false}
            alwaysBounceHorizontal={false}
            keyboardShouldPersistTaps="handled"
            snapToInterval={SERVICE_TILE_WIDTH + HOME_RAIL_GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.rail}
          />
        </View>
      )}

      <ServiceDetailSheet service={selected} onClose={closeService} />
    </>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    // Home's section head — the serif title at the same size and spacing —
    // with "See all" at the far end of the line.
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: HOME_CONTAINER_PADDING,
      marginTop: HOME_SECTION_MARGIN_TOP,
      marginBottom: HOME_SECTION_MARGIN_BOTTOM,
    },
    headRTL: {
      flexDirection: "row-reverse",
    },
    title: {
      flexShrink: 1,
      fontSize: HOME_SECTION_TITLE.fontSize,
      lineHeight: HOME_SECTION_TITLE.lineHeight,
      fontFamily: fonts.serif,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    textRTL: {
      textAlign: "right",
    },
    seeAll: {
      minHeight: 44,
      justifyContent: "center",
    },
    // "Lime as text" is the dark lime tone: the fill itself is 1.3:1 on paper.
    seeAllText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: colors.primary.deep,
    },
    pressed: {
      opacity: 0.7,
    },
    // Room below for the tiles' shadow, which a row clips at its own edge.
    rail: {
      paddingHorizontal: HOME_CONTAINER_PADDING,
      paddingBottom: 12,
      gap: HOME_RAIL_GAP,
    },
  });

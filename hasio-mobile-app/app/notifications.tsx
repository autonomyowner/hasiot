import React from "react";
import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { BackButton } from "@/components/ui/BackButton";
import { SkeletonList } from "@/components/ui/SkeletonScreens";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useLanguage } from "@/hooks/useLanguage";
import { relativeTime } from "@/lib/dates";
import { routeForNotificationData } from "@/lib/bookingDisplay";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { ScreenGradient } from "@/components/ui/Gradients";

/**
 * The in-app notification inbox.
 *
 * This is the channel that always works: push needs a native build and a
 * granted permission, email needs a real address, but a row written in the
 * same transaction as the booking change is visible the moment the app is
 * open. Everything else is a way of getting someone to open it.
 */
export default function NotificationsScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const { isBusinessOwner } = useConvexUser();

  const notifications = useQuery(api.notifications.queries.listMine, {});
  const markRead = useMutation(api.notifications.mutations.markRead);
  const markAllRead = useMutation(api.notifications.mutations.markAllRead);

  const hasUnread = (notifications ?? []).some((n) => !n.readAt);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScreenGradient />
      <View style={[styles.header, isRTL && styles.rowRTL]}>
        <BackButton />
        <Text style={styles.title}>{t("notifications")}</Text>
        {hasUnread ? (
          <Pressable
            onPress={() => markAllRead({}).catch(() => {})}
            style={styles.markAll}
            accessibilityRole="button"
            accessibilityLabel={t("markAllRead")}
          >
            <Text style={styles.markAllText}>{t("markAllRead")}</Text>
          </Pressable>
        ) : null}
      </View>

      {notifications === undefined ? (
        <SkeletonList variant="lodging" isRTL={isRTL} count={4} />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="bell" size={40} color={colors.onSurface.muted} />
          <Text style={styles.emptyTitle}>{t("noNotifications")}</Text>
          <Text style={styles.emptyHint}>{t("notificationsSubtitle")}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n._id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          renderItem={({ item }) => {
            const unread = !item.readAt;
            return (
              <Pressable
                onPress={() => {
                  if (unread) markRead({ notificationId: item._id }).catch(() => {});
                  router.push(routeForNotificationData(item.data, isBusinessOwner) as never);
                }}
                style={[styles.row, unread && styles.rowUnread, isRTL && styles.rowRTL]}
                accessibilityRole="button"
              >
                <View style={[styles.dot, !unread && styles.dotRead]} />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, isRTL && styles.textRTL]}>
                    {language === "ar" ? item.title_ar : item.title_en}
                  </Text>
                  <Text style={[styles.rowBodyText, isRTL && styles.textRTL]}>
                    {language === "ar" ? item.body_ar : item.body_en}
                  </Text>
                  <Text style={[styles.time, isRTL && styles.textRTL]}>
                    {relativeTime(item.createdAt, language)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontFamily: fonts.serif,
    color: colors.ink,
  },
  markAll: {
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
  },
  list: {
    paddingHorizontal: 20,
  },
  // Rows are content on the page, divided by a hairline. The negative margin
  // cancels the list's padding so an unread row's tint runs edge to edge as a
  // band rather than reading as a card sitting on the cream.
  row: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowUnread: {
    backgroundColor: colors.mint,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.DEFAULT,
    marginTop: 6,
  },
  dotRead: {
    backgroundColor: "transparent",
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  rowBodyText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginTop: 3,
  },
  time: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    marginTop: 6,
  },
  textRTL: {
    textAlign: "right",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: fonts.serif,
    color: colors.ink,
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    textAlign: "center",
  },
});

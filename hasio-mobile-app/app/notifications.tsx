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
import { type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

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
          <Feather name="bell" size={40} color="#C4C0BA" />
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
    backgroundColor: "#FAF7F2",
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
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
  },
  markAll: {
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: "#0D7A5F",
  },
  list: {
    paddingHorizontal: 20,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
  },
  rowUnread: {
    backgroundColor: "#F4FBF8",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0D7A5F",
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
    color: "#1A1A1A",
  },
  rowBodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4B4B4B",
    marginTop: 3,
  },
  time: {
    fontSize: 12,
    color: "#8A8178",
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
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: "#737373",
    textAlign: "center",
  },
});

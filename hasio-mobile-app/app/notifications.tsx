import React from "react";
import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { BackButton } from "@/components/ui/BackButton";
import { SkeletonGroup, SkeletonLine, sweepPhase } from "@/components/ui/Skeleton";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useLanguage } from "@/hooks/useLanguage";
import { relativeTime } from "@/lib/dates";
import { routeForNotification } from "@/lib/notificationRoute";
import { appAlert } from "@/stores/dialogStore";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { ScreenGradient } from "@/components/ui/Gradients";

const SKELETON_ROWS = 5;

/**
 * The in-app notification inbox.
 *
 * This is the channel that always works: push needs a native build and a
 * granted permission, email needs a real address, but a row written in the
 * same transaction as the booking change is visible the moment the app is
 * open. Everything else is a way of getting someone to open it.
 *
 * A row opens the same place its push notice does (lib/notificationRoute.ts):
 * the server says where, and only a verification notice needs the account's
 * role. Rows with nowhere better to go are simply marked read.
 */
export default function NotificationsScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const { user } = useConvexUser();

  const notifications = useQuery(api.notifications.queries.listMine, {});
  const markRead = useMutation(api.notifications.mutations.markRead);
  const markAllRead = useMutation(api.notifications.mutations.markAllRead);

  const hasUnread = (notifications ?? []).some((n) => !n.readAt);

  // A failed mark-read used to be swallowed, so the row stayed bold with no
  // word why. The dialog comes from the root host, wherever the row led.
  const reportUpdateFailed = () => appAlert(t("markReadFailed"));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScreenGradient />
      <View style={[styles.header, isRTL && styles.rowRTL]}>
        <BackButton />
        {/* Right-aligned in Arabic, so it stays beside Back (which the row
            moves to the right) instead of drifting to the far side. */}
        <Text style={[styles.title, isRTL && styles.textRTL]}>{t("notifications")}</Text>
        {hasUnread ? (
          <Pressable
            onPress={() => markAllRead({}).catch(reportUpdateFailed)}
            hitSlop={{ left: 8, right: 8 }}
            style={({ pressed }) => [styles.markAll, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("markAllRead")}
          >
            <Text style={styles.markAllText}>{t("markAllRead")}</Text>
          </Pressable>
        ) : null}
      </View>

      {notifications === undefined ? (
        <NotificationsSkeleton isRTL={isRTL} />
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
                  if (unread) markRead({ notificationId: item._id }).catch(reportUpdateFailed);
                  const route = routeForNotification(item.data, user?.role);
                  if (route) router.push(route as never);
                }}
                style={({ pressed }) => [
                  styles.row,
                  unread && styles.rowUnread,
                  isRTL && styles.rowRTL,
                  pressed && styles.pressed,
                ]}
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

/**
 * The inbox's own rows, in outline. It used to borrow the Stay tab's
 * photo-card skeleton, so the page showed tall picture cards and then
 * swapped them for thin text rows.
 */
function NotificationsSkeleton({ isRTL }: { isRTL: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();

  return (
    <SkeletonGroup>
      <View
        style={styles.list}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("loading")}
      >
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <View key={i} style={[styles.row, isRTL && styles.rowRTL]}>
            <View style={[styles.dot, styles.dotRead]} />
            <View style={styles.rowBody}>
              <SkeletonLine width="55%" box={20} isRTL={isRTL} phase={sweepPhase(i)} />
              <SkeletonLine
                width="88%"
                box={20}
                isRTL={isRTL}
                phase={sweepPhase(i)}
                style={styles.skeletonBody}
              />
              <SkeletonLine
                width="16%"
                box={16}
                isRTL={isRTL}
                phase={sweepPhase(i)}
                style={styles.skeletonTime}
              />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
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
  // 44pt tall: the text link it replaces was a 31pt target.
  markAll: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  markAllText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
  },
  pressed: {
    opacity: 0.7,
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
  // The dark lime. The lime fill it used to be is 1.23:1 on the mint band
  // behind an unread row — the one mark that says "unread" was near invisible.
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.deep,
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
  skeletonBody: {
    marginTop: 3,
  },
  skeletonTime: {
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

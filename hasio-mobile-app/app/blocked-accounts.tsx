import { appAlert } from "@/stores/dialogStore";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/backend";
import { colors, type AppFonts } from "@/constants/colors";
import { ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { useConvexUser } from "@/hooks/useConvexUser";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Lets a user review and undo the blocks they created from the report sheet.
 * Required alongside blocking itself so the action is reversible.
 */
export default function BlockedAccountsScreen() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { isSignedIn } = useConvexUser();

  const blocked = useQuery(
    api.moderation.queries.getMyBlockedUsers,
    isSignedIn ? {} : "skip"
  );
  const unblockUser = useMutation(api.moderation.mutations.unblockUser);

  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleUnblock = (blockedUserId: Id<"users">) => {
    appAlert(t("unblockConfirmTitle"), t("unblockConfirmMessage"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("unblock"),
        onPress: async () => {
          setPendingId(blockedUserId);
          try {
            await unblockUser({ blockedUserId });
          } catch (error) {
            appAlert(t("error"), t("unblockFailed"));
          } finally {
            setPendingId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, isRTL && styles.alignEndSelf]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? "رجوع" : "Go back"}
          >
            <Feather
              name={isRTL ? "arrow-right" : "arrow-left"}
              size={22}
              color={colors.ink}
            />
          </Pressable>

          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t("blockedAccounts")}
          </Text>
          <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
            {t("blockedAccountsSubtitle")}
          </Text>
        </Animated.View>

        {blocked === undefined ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary.deep} />
          </View>
        ) : blocked.length === 0 ? (
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
            style={styles.emptyCard}
          >
            <Feather name="shield" size={28} color={colors.onSurface.muted} />
            <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
              {t("blockedAccountsEmpty")}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
            style={styles.listCard}
          >
            {blocked.map((entry) => {
              const name =
                [entry.firstName, entry.lastName].filter(Boolean).join(" ") ||
                t("blockedAccountFallbackName");
              const isBusy = pendingId === entry.blockedUserId;

              return (
                <View
                  key={entry.blockId}
                  style={[styles.row, isRTL && styles.rowRTL]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitial}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={[styles.rowInfo, isRTL && styles.alignEnd]}>
                    <Text
                      style={[styles.rowName, isRTL && styles.textRTL]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text style={[styles.rowMeta, isRTL && styles.textRTL]}>
                      {new Date(entry.createdAt).toLocaleDateString(
                        isRTL ? "ar-SA" : "en-GB"
                      )}
                    </Text>
                  </View>

                  <Pressable
                    style={[styles.unblockButton, isBusy && styles.unblockBusy]}
                    onPress={() => handleUnblock(entry.blockedUserId)}
                    disabled={isBusy}
                    accessibilityRole="button"
                    accessibilityLabel={`${t("unblock")} ${name}`}
                    accessibilityState={{ disabled: isBusy, busy: isBusy }}
                  >
                    {isBusy ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary.deep}
                      />
                    ) : (
                      <Text style={styles.unblockText}>{t("unblock")}</Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: 24, paddingBottom: 8 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alignEndSelf: { alignSelf: "flex-end" },
  title: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: colors.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurface.variant,
  },
  textRTL: { textAlign: "right" },

  loading: { paddingTop: 48, alignItems: "center" },

  emptyCard: {
    marginHorizontal: 24,
    marginTop: 32,
    padding: 28,
    borderRadius: 18,
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurface.variant,
    textAlign: "center",
  },

  listCard: {
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 18,
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowRTL: { flexDirection: "row-reverse" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  rowInfo: { flex: 1 },
  alignEnd: { alignItems: "flex-end" },
  rowName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  rowMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.onSurface.muted,
    marginTop: 2,
  },
  unblockButton: {
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  unblockBusy: { opacity: 0.7 },
  unblockText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary.deep,
  },
});

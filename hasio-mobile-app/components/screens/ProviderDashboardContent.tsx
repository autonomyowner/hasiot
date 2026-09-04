import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useLanguage } from "@/hooks/useLanguage";
import { useConvexUser } from "@/hooks/useConvexUser";
import { VerificationBanner } from "@/components/VerificationBanner";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ProviderDashboardContent() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { verificationStatus, isApproved } = useConvexUser();

  // NOTE: requests / views figures in the stat cards below are static
  // placeholders — no backend metrics are bound in this screen yet.

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Ink hosting header band */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.headerBand, { paddingTop: insets.top + 16 }]}
        >
          <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
            <View style={isRTL && styles.alignEnd}>
              <Text style={[styles.eyebrow, isRTL && styles.textRTL]}>
                {isRTL ? "وضع الاستضافة" : "HOSTING MODE"}
              </Text>
              <Text style={[styles.businessName, isRTL && styles.textRTL]}>
                {t("providerDashboard")}
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              style={[styles.travellingChip, isRTL && styles.travellingChipRTL]}
            >
              <Text style={styles.swapIcon}>⇄</Text>
              <Text style={styles.travellingText}>
                {isRTL ? "السفر" : "Travelling"}
              </Text>
            </Pressable>
          </View>

          {/* Stat cards over the ink band */}
          <View style={styles.statsRow}>
            <StatCard
              value="—"
              label={isRTL ? "الخدمات" : "Services"}
              delta={isRTL ? "أضف خدمتك الأولى" : "Add your first service"}
            />
            <StatCard
              value="0"
              label={isRTL ? "الطلبات" : "Requests"}
              delta={isRTL ? "تجريبي" : "demo"}
            />
            <StatCard
              value="0"
              label={isRTL ? "المشاهدات" : "Views"}
              delta={isRTL ? "تجريبي" : "demo"}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(600)}>
          <VerificationBanner
            status={verificationStatus}
            onPress={() => router.push("/provider/verification")}
            isRTL={isRTL}
          />
        </Animated.View>

        {isApproved && (
          <Animated.View
            entering={FadeInDown.delay(250).duration(600)}
            style={styles.noteContainer}
          >
            <Text style={[styles.noteText, isRTL && styles.textRTL]}>
              {t("firstListingNote")}
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
            {t("addNew")}
          </Text>
          <ActionButton
            label={t("postService")}
            onPress={() => router.push("/provider/post-service")}
            isRTL={isRTL}
            primary
            locked={!isApproved}
            lockedLabel={t("verificationLocked")}
          />
          {/* Always reachable — providers need to see the status of what they
              posted, including while the account itself is still pending. */}
          <ActionButton
            label={t("myServices")}
            onPress={() => router.push("/provider/my-services")}
            isRTL={isRTL}
          />
        </Animated.View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

function StatCard({
  value,
  label,
  delta,
}: {
  value: string;
  label: string;
  delta: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statDelta}>{delta}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  isRTL,
  primary,
  locked,
  lockedLabel,
}: {
  label: string;
  onPress: () => void;
  isRTL: boolean;
  primary?: boolean;
  locked?: boolean;
  lockedLabel?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      style={[
        styles.actionButton,
        primary && !locked && styles.actionButtonPrimary,
        locked && styles.actionButtonLocked,
        animatedStyle,
      ]}
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label} — ${lockedLabel}` : label}
      accessibilityState={{ disabled: !!locked }}
      onPressIn={() => { if (!locked) scale.value = withSpring(0.98, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { if (!locked) scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
    >
      <Text style={[styles.actionButtonText, primary && !locked && styles.actionButtonTextPrimary, isRTL && styles.textRTL]}>{label}</Text>
      {locked && lockedLabel ? (
        <Text style={styles.actionButtonLockedLabel}>{lockedLabel}</Text>
      ) : null}
    </AnimatedPressable>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  headerBand: {
    backgroundColor: colors.ink,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRowRTL: { flexDirection: "row-reverse" },
  alignEnd: { alignItems: "flex-end" },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
  },
  businessName: {
    fontFamily: fonts.serif,
    fontSize: 25,
    color: "#FFFFFF",
  },
  travellingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  travellingChipRTL: { flexDirection: "row-reverse" },
  swapIcon: { fontSize: 14, color: "#FFFFFF" },
  travellingText: { fontFamily: fonts.medium, fontSize: 13, color: "#FFFFFF" },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 14,
  },
  statValue: { fontFamily: fonts.bold, fontSize: 24, color: "#FFFFFF" },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  statDelta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.hostingAccent,
    marginTop: 6,
  },

  textRTL: { textAlign: "right" },
  noteContainer: {
    marginHorizontal: 24,
    backgroundColor: colors.mint,
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    marginBottom: 8,
  },
  noteText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary.deep,
    textAlign: "center",
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.onSurface.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionTitleRTL: { textAlign: "right" },
  actionButton: {
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.DEFAULT,
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  actionButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  actionButtonTextPrimary: { color: "#FFFFFF" },
  actionButtonLocked: {
    backgroundColor: colors.surface.variant,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtonLockedLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.onSurface.muted,
    marginTop: 4,
  },
  bottomSpacing: { height: 32 },
});

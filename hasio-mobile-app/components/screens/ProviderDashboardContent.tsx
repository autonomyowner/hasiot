import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useQuery } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { useConvexUser } from "@/hooks/useConvexUser";
import { VerificationBanner } from "@/components/VerificationBanner";
import { colors, type AppFonts } from "@/constants/colors";
import { enterFade, pressSpring, PRESS_SCALE_CARD } from "@/constants/motion";
import { ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ProviderDashboardContent() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { t, isRTL } = useLanguage();
  const { verificationStatus, isApproved, isSignedIn } = useConvexUser();

  // Real counts of the provider's own services. The cards used to show a
  // fixed "—" beside "0 · demo" requests and views: nothing counts either,
  // and a dashboard of placeholders reads as a product that does not work.
  // The same subscription My Services holds, so opening it costs nothing.
  const myServices = useQuery(api.services.queries.getMyServices, isSignedIn ? {} : "skip");
  const counts = myServices
    ? {
        total: myServices.length,
        live: myServices.filter((service) => service.status === "approved").length,
        inReview: myServices.filter((service) => service.status === "pending").length,
      }
    : null;

  return (
    <View style={styles.container}>
      <ScreenGradient />
      {/* Light icons over the ink band, only while in front — see the
          business dashboard. */}
      {isFocused && <StatusBar style="light" />}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Ink hosting header band; the short staggered entrance, as on the
            business dashboard. */}
        <Animated.View
          entering={enterFade(0)}
          style={[styles.headerBand, { paddingTop: insets.top + 16 }]}
        >
          <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
            <View style={[styles.headerText, isRTL && styles.alignEnd]}>
              <Text style={[styles.eyebrow, isRTL && styles.textRTL]}>
                {t("hostingMode")}
              </Text>
              <Text style={[styles.businessName, isRTL && styles.textRTL]}>
                {t("providerDashboard")}
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              hitSlop={6}
              style={({ pressed }) => [
                styles.travellingChip,
                isRTL && styles.travellingChipRTL,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("backToTravelling")}
            >
              <Text style={styles.swapIcon}>⇄</Text>
              <Text style={styles.travellingText}>{t("travelling")}</Text>
            </Pressable>
          </View>

          {/* Stat cards over the ink band, in reading order in Arabic too. */}
          <View style={[styles.statsRow, isRTL && styles.rowRTL]}>
            <StatCard
              value={counts ? String(counts.total) : "—"}
              label={t("statServices")}
              delta={counts && counts.total === 0 ? t("statAddFirstService") : ""}
              isRTL={isRTL}
            />
            <StatCard
              value={counts ? String(counts.live) : "—"}
              label={t("statLive")}
              delta=""
              isRTL={isRTL}
            />
            <StatCard
              value={counts ? String(counts.inReview) : "—"}
              label={t("statInReview")}
              delta=""
              isRTL={isRTL}
            />
          </View>
        </Animated.View>

        <Animated.View entering={enterFade(1)}>
          <VerificationBanner
            status={verificationStatus}
            onPress={() => router.push("/provider/verification")}
            isRTL={isRTL}
          />
        </Animated.View>

        {/* Only while nothing is posted yet — see the business dashboard. */}
        {isApproved && counts?.total === 0 && (
          <Animated.View entering={enterFade(1)} style={styles.noteContainer}>
            <Text style={[styles.noteText, isRTL && styles.textRTL]}>
              {t("postsReviewedNote")}
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={enterFade(2)}>
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

        {/* The home indicator's inset, now that the route is a plain View. */}
        <View style={{ height: 32 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

function StatCard({
  value,
  label,
  delta,
  isRTL,
}: {
  value: string;
  label: string;
  delta: string;
  isRTL: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.statCard, isRTL && styles.alignEnd]}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      {delta ? <Text style={[styles.statDelta, isRTL && styles.textRTL]}>{delta}</Text> : null}
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
      onPressIn={() => { if (!locked) scale.value = withSpring(PRESS_SCALE_CARD, pressSpring); }}
      onPressOut={() => { if (!locked) scale.value = withSpring(1, pressSpring); }}
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
    gap: 12,
  },
  headerRowRTL: { flexDirection: "row-reverse" },
  headerText: { flexShrink: 1 },
  alignEnd: { alignItems: "flex-end" },
  rowRTL: { flexDirection: "row-reverse" },
  pressed: { opacity: 0.7 },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 36,
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
  // Ink, not white: lime is a light fill and white on it is 1.39:1 — the
  // "Post Service" label on the one button that matters could not be read.
  actionButtonTextPrimary: { color: colors.ink },
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
});

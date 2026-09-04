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

export default function BusinessDashboardContent() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { verificationStatus, isApproved } = useConvexUser();

  const quickActions = [
    { key: "postLodging", route: "/business/post-lodging" },
    { key: "postDestination", route: "/business/post-destination" },
  ];

  // NOTE: views / bookings / listings figures in the stat cards below are
  // static placeholders — no backend metrics are bound in this screen yet.

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Ink hosting header band */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.headerBand, { paddingTop: insets.top + 16 }]}
        >
          <View
            style={[styles.headerRow, isRTL && styles.headerRowRTL]}
          >
            <View style={isRTL && styles.alignEnd}>
              <Text style={[styles.eyebrow, isRTL && styles.textRTL]}>
                {isRTL ? "وضع الاستضافة" : "HOSTING MODE"}
              </Text>
              <Text style={[styles.businessName, isRTL && styles.textRTL]}>
                {t("businessDashboard")}
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
              label={isRTL ? "القوائم" : "Listings"}
              delta={isRTL ? "ابدأ بإضافة قائمة" : "Add your first listing"}
              isRTL={isRTL}
            />
            <StatCard
              value="0"
              label={isRTL ? "المشاهدات" : "Views"}
              delta={isRTL ? "تجريبي" : "demo"}
              isRTL={isRTL}
            />
            <StatCard
              value="0"
              label={isRTL ? "الحجوزات" : "Bookings"}
              delta={isRTL ? "تجريبي" : "demo"}
              isRTL={isRTL}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <VerificationBanner
            status={verificationStatus}
            onPress={() => router.push("/business/verification")}
            isRTL={isRTL}
          />
        </Animated.View>

        {isApproved && (
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
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
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <ActionCard
                key={action.key}
                label={t(action.key as any)}
                onPress={() => router.push(action.route as any)}
                isRTL={isRTL}
                locked={!isApproved}
                lockedLabel={t("verificationLocked")}
              />
            ))}
          </View>
        </Animated.View>

        {/* Always reachable — owners need to see the status of what they posted,
            including while the account itself is still pending. */}
        <Animated.View entering={FadeInDown.delay(350).duration(600)}>
          <Pressable
            style={styles.secondaryAction}
            onPress={() => router.push("/business/my-listings")}
            accessibilityRole="button"
            accessibilityLabel={t("myListings")}
          >
            <Text style={[styles.secondaryActionText, isRTL && styles.textRTL]}>
              {t("myListings")}
            </Text>
          </Pressable>
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
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statDelta}>{delta}</Text>
    </View>
  );
}

function ActionCard({
  label,
  onPress,
  isRTL,
  locked,
  lockedLabel,
}: {
  label: string;
  onPress: () => void;
  isRTL: boolean;
  locked?: boolean;
  lockedLabel?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      style={[styles.actionCard, locked && styles.actionCardLocked, animatedStyle]}
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label} — ${lockedLabel}` : label}
      accessibilityState={{ disabled: !!locked }}
      onPressIn={() => { if (!locked) scale.value = withSpring(0.95, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { if (!locked) scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
    >
      <View style={styles.actionTile} />
      <Text style={[styles.actionLabel, isRTL && styles.textRTL]}>{label}</Text>
      {locked && lockedLabel ? (
        <Text style={[styles.actionLockedLabel, isRTL && styles.textRTL]}>
          {lockedLabel}
        </Text>
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
    paddingBottom: 12,
  },
  sectionTitleRTL: { textAlign: "right" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 12 },
  actionCard: {
    width: "47%",
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 96,
    gap: 12,
  },
  secondaryAction: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryActionText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  actionCardLocked: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLockedLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.onSurface.muted,
    marginTop: -6,
    textAlign: "center",
  },
  actionTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.sand,
  },
  actionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
    textAlign: "center",
  },
  bottomSpacing: { height: 32 },
});

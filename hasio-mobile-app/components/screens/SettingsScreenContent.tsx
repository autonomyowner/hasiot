import { appAlert } from "@/stores/dialogStore";
import { AppDialogHost } from "@/components/ui/AppDialog";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useMutation } from "convex/react";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { api } from "@/backend";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { useLanguage } from "@/hooks/useLanguage";
import { useAppStore } from "@/stores/appStore";
import { useConvexUser } from "@/hooks/useConvexUser";
import { signOut as authSignOut } from "@/lib/auth";
import { refreshAuth } from "@/lib/convex";
import { UserType } from "@/types";

const PRIVACY_POLICY_URL = "https://www.hasio.xyz/privacy-policy.html";
const TERMS_OF_SERVICE_URL = "https://www.hasio.xyz/terms-of-service.html";

const ANDROID_PACKAGE = "com.hasio.travel";
// Set this once the app has an App Store Connect record. Until then the
// "Rate app" row is hidden on iOS rather than linking to a dead page.
const IOS_APP_STORE_ID: string | null = null;
const CAN_RATE_APP = Platform.OS !== "ios" || IOS_APP_STORE_ID !== null;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SettingsScreenContent() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language, changeLanguage, isRTL } = useLanguage();
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);
  const clearUserData = useAppStore((state) => state.clearUserData);

  const { isSignedIn, isBusinessOwner, isServiceProvider, isAdmin, isApproved, verificationStatus, userType: convexUserType, user } = useConvexUser();
  const userType: UserType = convexUserType === "business_owner" ? "business" : convexUserType === "service_provider" ? "provider" : convexUserType === "admin" ? "admin" : "user";

  // Visual-only display values for the profile header (best-effort from the user record).
  const profileName = (user as any)?.name || (user as any)?.fullName || (user as any)?.email || t("appName");
  const profileSubtitle =
    (user as any)?.email ||
    (userType === "business"
      ? t("userTypeBusiness")
      : userType === "provider"
      ? t("userTypeProvider")
      : userType === "admin"
      ? t("admin")
      : t("userTypeUser"));
  const profileAvatarUrl = (user as any)?.image || (user as any)?.avatarUrl || null;
  const profileInitial = (profileName?.trim?.()?.[0] || "H").toUpperCase();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = () => {
    appAlert(
      t("signOutConfirmTitle"),
      t("signOutConfirmMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await authSignOut();
              refreshAuth();
              clearUserData();
              setOnboardingComplete(false);
              router.replace("/onboarding");
            } catch (error) {
              appAlert(t("error"), t("signOutFailed"));
            }
          },
        },
      ]
    );
  };

  const handleOpenPrivacyPolicy = async () => {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch (error) {
      appAlert(t("error"), t("couldNotOpenLink"));
    }
  };

  const handleOpenTermsOfService = async () => {
    try {
      await Linking.openURL(TERMS_OF_SERVICE_URL);
    } catch (error) {
      appAlert(t("error"), t("couldNotOpenLink"));
    }
  };

  const deleteMyAccount = useMutation(api.users.mutations.deleteMyAccount);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // Delete all server-side data first
      await deleteMyAccount();

      // Then sign out and clear local data
      await authSignOut();
      refreshAuth();

      // Moments are server-side now and `deleteMyAccount` removes them along
      // with their stored images, so there is no local moment cache left to
      // clear here.
      clearUserData();

      setShowDeleteModal(false);
      router.replace("/onboarding");
    } catch (error: any) {
      appAlert(t("deleteAccountError"), t("pleaseTryAgain"));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const setUserRole = useMutation(api.users.mutations.setUserRole);

  const handleUpgrade = async (newType: "business" | "provider") => {
    setIsUpgrading(true);
    try {
      await setUserRole({
        role: newType === "business" ? "business_owner" : "service_provider",
      });
      // The new role starts unapproved, so send them straight to verification —
      // otherwise posting silently fails server-side with "must be approved".
      appAlert(t("upgradeSuccess"), t("verificationUnverifiedBody"), [
        {
          text: t("done"),
          onPress: () => {
            setShowUpgradeModal(false);
            router.push(
              newType === "business"
                ? "/business/verification"
                : "/provider/verification"
            );
          },
        },
      ]);
    } catch (error: any) {
      appAlert(t("upgradeError"), t("pleaseTryAgain"));
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleRateApp = async () => {
    const playStoreUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
    const url = Platform.select({
      android: `market://details?id=${ANDROID_PACKAGE}`,
      ios: IOS_APP_STORE_ID
        ? `https://apps.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`
        : null,
      default: playStoreUrl,
    });
    if (!url) return;
    const fallbackUrl = Platform.OS === "ios" ? url : playStoreUrl;
    try {
      const supported = await Linking.canOpenURL(url);
      await Linking.openURL(supported ? url : fallbackUrl);
    } catch (error) {
    }
  };

  const handleAbout = () => {
    const version = Constants.expoConfig?.version || "1.0.0";
    const buildNumber = Platform.OS === "android"
      ? Constants.expoConfig?.android?.versionCode
      : Constants.expoConfig?.ios?.buildNumber;
    appAlert(
      "Hasio",
      `${t("appDescription")}\n\n${t("version")}: ${version}${buildNumber ? ` (${buildNumber})` : ""}`,
      [{ text: t("done") }]
    );
  };

  const getUserTypeLabel = (type?: UserType) => {
    switch (type) {
      case "business":
        return t("userTypeBusiness");
      case "provider":
        return t("userTypeProvider");
      case "admin":
        return t("admin");
      default:
        return t("userTypeUser");
    }
  };

  // Guest view — not signed in
  if (!isSignedIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(600)}
            style={[styles.header, isRTL && styles.headerRTL]}
          >
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              {t("settings")}
            </Text>
          </Animated.View>

          {/* Guest CTA Card */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
            style={styles.guestCard}
          >
            <View style={styles.guestIconContainer}>
              <Feather name="user" size={40} color="#CCE745" />
            </View>
            <Text style={[styles.guestTitle, isRTL && styles.textRTL]}>
              {t("guestProfileTitle")}
            </Text>
            <Text style={[styles.guestMessage, isRTL && styles.textRTL]}>
              {t("guestProfileMessage")}
            </Text>
            <Pressable
              style={styles.guestSignInButton}
              onPress={() => router.push("/auth")}
              accessibilityRole="button"
              accessibilityLabel={t("guestSignInButton")}
            >
              <Feather name="log-in" size={18} color="#FFFFFF" style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
              <Text style={styles.guestSignInButtonText}>
                {t("guestSignInButton")}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Preferences Section — available to guests */}
          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
              {t("preferences")}
            </Text>

            <SettingRow
              label={t("language")}
              value={language === "en" ? "English" : "العربية"}
              isRTL={isRTL}
              onPress={() => changeLanguage(language === "en" ? "ar" : "en")}
            />

          </Animated.View>

          {/* Legal Section */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)}>
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
              {t("support")}
            </Text>

            <SettingRow
              label={t("privacyPolicy")}
              subtitle={t("privacyPolicySubtitle")}
              isRTL={isRTL}
              onPress={handleOpenPrivacyPolicy}
            />

            <SettingRow
              label={t("termsOfService")}
              subtitle={t("termsOfServiceSubtitle")}
              isRTL={isRTL}
              onPress={handleOpenTermsOfService}
            />

            {CAN_RATE_APP && (
              <SettingRow
                label={t("rateApp")}
                subtitle={t("shareFeedback")}
                isRTL={isRTL}
                onPress={handleRateApp}
              />
            )}

            <SettingRow
              label={t("about")}
              subtitle={t("appVersionInfo")}
              isRTL={isRTL}
              onPress={handleAbout}
            />
          </Animated.View>

          {/* App Info */}
          <Animated.View
            entering={FadeInDown.delay(500).duration(600)}
            style={styles.appInfo}
          >
            <Text style={[styles.appName, isRTL && styles.textRTL]}>
              {t("appName")}
            </Text>
            <Text style={[styles.version, isRTL && styles.textRTL]}>
              {t("version")}
            </Text>
            <Text style={[styles.appDescription, isRTL && styles.textRTL]}>
              {t("appDescription")}
            </Text>
          </Animated.View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.profileHeader, isRTL && styles.profileHeaderRTL]}
        >
          <View style={styles.avatar}>
            {profileAvatarUrl ? (
              <Image source={{ uri: profileAvatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{profileInitial}</Text>
            )}
          </View>
          <View style={[styles.profileHeaderInfo, isRTL && styles.profileHeaderInfoRTL]}>
            <Text style={[styles.profileName, isRTL && styles.textRTL]} numberOfLines={1}>
              {profileName}
            </Text>
            <Text style={[styles.profileSubtitle, isRTL && styles.textRTL]} numberOfLines={1}>
              {profileSubtitle}
            </Text>
          </View>
        </Animated.View>

        {/* Stats Strip */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(600)}
          style={[styles.statsCard, isRTL && styles.statsCardRTL]}
        >
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>{language === "ar" ? "الرحلات" : "Trips"}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>{t("moments")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>{t("favorites")}</Text>
          </View>
        </Animated.View>

        {/* Switch to hosting promo — only for normal users */}
        {userType === "user" && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <Pressable
              style={styles.hostingCard}
              onPress={() => setShowUpgradeModal(true)}
              accessibilityRole="button"
              accessibilityLabel={t("upgradeAccount")}
            >
              <View style={[styles.hostingRow, isRTL && styles.hostingRowRTL]}>
                <View style={styles.hostingIcon}>
                  <Feather name="home" size={22} color={colors.surface.DEFAULT} />
                </View>
                <View style={[styles.hostingTextWrap, isRTL && styles.profileHeaderInfoRTL]}>
                  <Text style={[styles.hostingTitle, isRTL && styles.textRTL]}>
                    {t("upgradeAccount")}
                  </Text>
                  <Text style={[styles.hostingDesc, isRTL && styles.textRTL]} numberOfLines={2}>
                    {t("becomeBusinessOrProvider")}
                  </Text>
                </View>
              </View>
              <View style={[styles.hostingPillRow, isRTL && styles.hostingRowRTL]}>
                <View style={styles.hostingPill}>
                  <Text style={styles.hostingPillText}>{language === "ar" ? "ابدأ الآن" : "Get started"}</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Settings List */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={styles.listCard}
        >
          {/* Dashboard link for business users */}
          {isBusinessOwner && (
            <SettingRow
              icon="grid"
              label={t("businessDashboard")}
              isRTL={isRTL}
              onPress={() => router.push("/business/dashboard")}
            />
          )}

          {/* Dashboard link for provider users */}
          {isServiceProvider && (
            <SettingRow
              icon="grid"
              label={t("providerDashboard")}
              isRTL={isRTL}
              onPress={() => router.push("/provider/dashboard")}
            />
          )}

          {/* Verification status — only while approval is still outstanding */}
          {(isBusinessOwner || isServiceProvider) && !isApproved && (
            <SettingRow
              icon="shield"
              label={t("verificationTitle")}
              value={
                verificationStatus === "pending"
                  ? t("statusPending")
                  : t("verificationUnverifiedTitle")
              }
              isRTL={isRTL}
              onPress={() =>
                router.push(
                  isBusinessOwner
                    ? "/business/verification"
                    : "/provider/verification"
                )
              }
            />
          )}

          <SettingRow
            icon="heart"
            label={t("favorites")}
            isRTL={isRTL}
          />

          <SettingRow
            icon="globe"
            label={t("language")}
            value={language === "en" ? "English" : "العربية"}
            isRTL={isRTL}
            onPress={() => changeLanguage(language === "en" ? "ar" : "en")}
          />

          {/* The notifications switch lived here. The app ships no push
              notifications, so the toggle only flipped a local Zustand flag —
              a control that does nothing. Restore it with the feature; the
              `notificationsEnabled` state in appStore is kept for that. */}

          <SettingRow
            icon="slash"
            label={t("blockedAccounts")}
            isRTL={isRTL}
            onPress={() => router.push("/blocked-accounts")}
          />

          {CAN_RATE_APP && (
            <SettingRow
              icon="star"
              label={t("rateApp")}
              isRTL={isRTL}
              onPress={handleRateApp}
            />
          )}

          <SettingRow
            icon="info"
            label={t("about")}
            isRTL={isRTL}
            onPress={handleAbout}
          />

          <SettingRow
            icon="shield"
            label={t("privacyPolicy")}
            isRTL={isRTL}
            onPress={handleOpenPrivacyPolicy}
          />

          <SettingRow
            icon="file-text"
            label={t("termsOfService")}
            isRTL={isRTL}
            onPress={handleOpenTermsOfService}
            isLast
          />
        </Animated.View>

        {/* Delete account */}
        <Animated.View
          entering={FadeInDown.delay(350).duration(600)}
          style={styles.listCard}
        >
          <SettingRow
            icon="trash-2"
            label={t("deleteAccount")}
            isRTL={isRTL}
            onPress={confirmDeleteAccount}
            destructive
            isLast
          />
        </Animated.View>

        {/* Sign out */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Pressable
            style={styles.signOutButton}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel={t("signOut")}
          >
            <Text style={styles.signOutText}>{t("signOut")}</Text>
          </Pressable>
        </Animated.View>

        {/* App Info */}
        <Animated.View
          entering={FadeInDown.delay(450).duration(600)}
          style={styles.appInfo}
        >
          <Text style={[styles.appName, isRTL && styles.textRTL]}>
            {t("appName")}
          </Text>
          <Text style={[styles.version, isRTL && styles.textRTL]}>
            {t("version")}
          </Text>
        </Animated.View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Upgrade Modal */}
      <Modal
        visible={showUpgradeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
              {t("upgradeAccount")}
            </Text>
            <Text style={[styles.modalSubtitle, isRTL && styles.textRTL]}>
              {t("upgradeWarning")}
            </Text>

            <Pressable
              style={styles.upgradeOption}
              onPress={() => handleUpgrade("business")}
              disabled={isUpgrading}
              accessibilityRole="button"
              accessibilityLabel={t("userTypeBusiness")}
              accessibilityState={{ disabled: isUpgrading }}
            >
              <Text style={[styles.upgradeOptionTitle, isRTL && styles.textRTL]}>
                {t("userTypeBusiness")}
              </Text>
              <Text style={[styles.upgradeOptionDesc, isRTL && styles.textRTL]}>
                {t("userTypeBusinessDesc")}
              </Text>
            </Pressable>

            <Pressable
              style={styles.upgradeOption}
              onPress={() => handleUpgrade("provider")}
              disabled={isUpgrading}
              accessibilityRole="button"
              accessibilityLabel={t("userTypeProvider")}
              accessibilityState={{ disabled: isUpgrading }}
            >
              <Text style={[styles.upgradeOptionTitle, isRTL && styles.textRTL]}>
                {t("userTypeProvider")}
              </Text>
              <Text style={[styles.upgradeOptionDesc, isRTL && styles.textRTL]}>
                {t("userTypeProviderDesc")}
              </Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setShowUpgradeModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t("cancel")}
            >
              <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
            </Pressable>
          </View>
        </View>
        {/* Alerts fired while this modal is open render above it. */}
        <AppDialogHost />
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent
        onRequestClose={() => !isDeleting && setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={[styles.modalTitle, isRTL && styles.textRTL, styles.destructiveText]}>
              {t("deleteAccountConfirmTitle")}
            </Text>
            <Text style={[styles.modalSubtitle, isRTL && styles.textRTL]}>
              {t("deleteAccountConfirmMessage")}
            </Text>

            <Pressable
              style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
              accessibilityRole="button"
              accessibilityLabel={t("deleteAccount")}
              accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
            >
              {isDeleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteButtonText}>{t("deleteAccount")}</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              accessibilityRole="button"
              accessibilityLabel={t("cancel")}
              accessibilityState={{ disabled: isDeleting }}
            >
              <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
            </Pressable>
          </View>
        </View>
        {/* Alerts fired while this modal is open render above it. */}
        <AppDialogHost />
      </Modal>
    </View>
  );
}

interface SettingRowProps {
  label: string;
  subtitle?: string;
  value?: string;
  isRTL: boolean;
  onPress?: () => void;
  destructive?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
  isLast?: boolean;
}

function SettingRow({
  label,
  subtitle,
  value,
  isRTL,
  onPress,
  destructive,
  icon,
  isLast,
}: SettingRowProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }
  };

  const iconColor = destructive ? colors.signOut : colors.primary.DEFAULT;

  return (
    <AnimatedPressable
      style={[
        styles.settingRow,
        isRTL && styles.settingRowRTL,
        isLast && styles.settingRowLast,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
    >
      <View style={[styles.settingLeft, isRTL && styles.settingRowRTL]}>
        {icon && (
          <View style={styles.settingIcon}>
            <Feather name={icon} size={18} color={iconColor} />
          </View>
        )}
        <View style={[styles.settingInfo, isRTL && styles.settingInfoRTL]}>
          <Text
            style={[
              styles.settingLabel,
              isRTL && styles.textRTL,
              destructive && styles.destructiveText,
            ]}
          >
            {label}
          </Text>
          {subtitle && (
            <Text style={[styles.settingSubtitle, isRTL && styles.textRTL]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.settingRight, isRTL && styles.settingRowRTL]}>
        {value && (
          <Text style={[styles.settingValue, isRTL && styles.textRTL]}>
            {value}
          </Text>
        )}
        {onPress && !destructive && (
          <Feather
            name={isRTL ? "chevron-left" : "chevron-right"}
            size={18}
            color={colors.onSurface.muted}
          />
        )}
      </View>
    </AnimatedPressable>
  );
}

// SettingRowWithSwitch was removed alongside the notifications toggle — it had
// no other caller. Recover it from git history when a real switch setting lands.

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRTL: {
    alignItems: "flex-end",
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  textRTL: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.onSurface.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 4,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitleRTL: {
    textAlign: "right",
  },
  // Profile header
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 4,
  },
  profileHeaderRTL: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.surface.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.ink,
  },
  profileHeaderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileHeaderInfoRTL: {
    marginLeft: 0,
    marginRight: 16,
    alignItems: "flex-end",
  },
  profileName: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.ink,
  },
  profileSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurface.muted,
    marginTop: 2,
  },
  // Stats strip
  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 20,
    paddingVertical: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statsCardRTL: {
    flexDirection: "row-reverse",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.divider,
    marginVertical: 4,
  },
  statNumber: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.onSurface.muted,
    marginTop: 4,
  },
  // Hosting promo
  hostingCard: {
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  hostingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hostingRowRTL: {
    flexDirection: "row-reverse",
  },
  hostingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  hostingTextWrap: {
    flex: 1,
  },
  hostingTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.surface.DEFAULT,
  },
  hostingDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
    lineHeight: 18,
  },
  hostingPillRow: {
    flexDirection: "row",
    marginTop: 16,
  },
  hostingPill: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  hostingPillText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary.DEFAULT,
  },
  // Settings list card
  listCard: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 20,
    paddingHorizontal: 4,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingRowRTL: {
    flexDirection: "row-reverse",
  },
  settingLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingInfoRTL: {
    alignItems: "flex-end",
  },
  settingLabel: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  settingSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.onSurface.muted,
    marginTop: 2,
  },
  settingValue: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.onSurface.muted,
  },
  destructiveText: {
    color: colors.signOut,
  },
  // Sign out
  signOutButton: {
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 8,
  },
  signOutText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.signOut,
  },
  appInfo: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 40,
  },
  appName: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.onSurface.muted,
    marginBottom: 4,
  },
  version: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.onSurface.muted,
    marginBottom: 16,
  },
  appDescription: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurface.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  // Clears the floating tab bar.
  bottomSpacing: {
    height: TAB_BAR_CLEARANCE,
  },
  // Guest Card Styles
  guestCard: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  guestIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(13, 122, 95, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  guestTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.ink,
    marginBottom: 8,
    textAlign: "center",
  },
  guestMessage: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.onSurface.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  guestSignInButton: {
    flexDirection: "row",
    backgroundColor: "#CCE745",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#CCE745",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  guestSignInButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.surface.DEFAULT,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  modalTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.ink,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurface.muted,
    marginBottom: 24,
  },
  upgradeOption: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  upgradeOptionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 4,
  },
  upgradeOptionDesc: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurface.muted,
  },
  cancelButton: {
    marginTop: 8,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onSurface.muted,
  },
  deleteButton: {
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.surface.DEFAULT,
  },
});

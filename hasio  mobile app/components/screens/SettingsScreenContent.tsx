import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
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
import { useLanguage } from "@/hooks/useLanguage";
import { useAppStore } from "@/stores/appStore";
import { useMomentsStore } from "@/stores/momentsStore";
import { useConvexUser } from "@/hooks/useConvexUser";
import { signOut as authSignOut } from "@/lib/auth";
import { refreshAuth } from "@/lib/convex";
import { UserType } from "@/types";

const PRIVACY_POLICY_URL = "https://www.hasio.xyz/privacy-policy.html";
const TERMS_OF_SERVICE_URL = "https://www.hasio.xyz/terms-of-service.html";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SettingsScreenContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language, changeLanguage, isRTL } = useLanguage();
  const notificationsEnabled = useAppStore((state) => state.notificationsEnabled);
  const toggleNotifications = useAppStore((state) => state.toggleNotifications);
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);
  const clearUserData = useAppStore((state) => state.clearUserData);
  const clearMoments = useMomentsStore((state) => state.clearMoments);

  const { isSignedIn, isBusinessOwner, isServiceProvider, isAdmin, userType: convexUserType } = useConvexUser();
  const userType: UserType = convexUserType === "business_owner" ? "business" : convexUserType === "service_provider" ? "provider" : convexUserType === "admin" ? "admin" : "user";

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
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
              Alert.alert(t("error"), t("signOutFailed"));
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
      Alert.alert(t("error"), t("couldNotOpenLink"));
    }
  };

  const handleOpenTermsOfService = async () => {
    try {
      await Linking.openURL(TERMS_OF_SERVICE_URL);
    } catch (error) {
      Alert.alert(t("error"), t("couldNotOpenLink"));
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

      clearUserData();
      clearMoments();

      setShowDeleteModal(false);
      router.replace("/onboarding");
    } catch (error: any) {
      Alert.alert(t("deleteAccountError"), t("pleaseTryAgain"));
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
      Alert.alert(t("upgradeSuccess"), "", [
        {
          text: t("done"),
          onPress: () => {
            setShowUpgradeModal(false);
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert(t("upgradeError"), t("pleaseTryAgain"));
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleRateApp = async () => {
    const androidPackage = "com.hasio.travel";
    const url = Platform.select({
      android: `market://details?id=${androidPackage}`,
      ios: "https://apps.apple.com/app/hasio/id0000000000", // Update with real App Store ID
      default: `https://play.google.com/store/apps/details?id=${androidPackage}`,
    });
    try {
      const supported = await Linking.canOpenURL(url!);
      if (supported) {
        await Linking.openURL(url!);
      } else {
        await Linking.openURL(`https://play.google.com/store/apps/details?id=${androidPackage}`);
      }
    } catch (error) {
    }
  };

  const handleAbout = () => {
    const version = Constants.expoConfig?.version || "1.0.0";
    const buildNumber = Platform.OS === "android"
      ? Constants.expoConfig?.android?.versionCode
      : Constants.expoConfig?.ios?.buildNumber;
    Alert.alert(
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
              <Feather name="user" size={40} color="#0D7A5F" />
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

            <SettingRow
              label={t("rateApp")}
              subtitle={t("shareFeedback")}
              isRTL={isRTL}
              onPress={handleRateApp}
            />

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

        {/* Preferences Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
            {t("preferences")}
          </Text>

          <SettingRow
            label={t("language")}
            value={language === "en" ? "English" : "العربية"}
            isRTL={isRTL}
            onPress={() => changeLanguage(language === "en" ? "ar" : "en")}
          />

          <SettingRowWithSwitch
            label={t("notifications")}
            value={notificationsEnabled}
            isRTL={isRTL}
            onToggle={toggleNotifications}
          />

        </Animated.View>

        {/* Account Section */}
        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
            {t("account")}
          </Text>

          <SettingRow
            label={t("profile")}
            subtitle={t("manageProfile")}
            isRTL={isRTL}
          />

          {/* Dashboard link for business users */}
          {isBusinessOwner && (
            <SettingRow
              label={t("businessDashboard")}
              subtitle={t("manageListings")}
              isRTL={isRTL}
              onPress={() => router.push("/business/dashboard")}
            />
          )}

          {/* Dashboard link for provider users */}
          {isServiceProvider && (
            <SettingRow
              label={t("providerDashboard")}
              subtitle={t("manageServices")}
              isRTL={isRTL}
              onPress={() => router.push("/provider/dashboard")}
            />
          )}

          {/* Upgrade option for normal users */}
          {userType === "user" && (
            <SettingRow
              label={t("upgradeAccount")}
              subtitle={t("becomeBusinessOrProvider")}
              isRTL={isRTL}
              onPress={() => setShowUpgradeModal(true)}
            />
          )}

          <SettingRow
            label={t("favorites")}
            subtitle={t("savedPlaces")}
            isRTL={isRTL}
          />

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

          <SettingRow
            label={t("deleteAccount")}
            subtitle={t("deleteAccountSubtitle")}
            isRTL={isRTL}
            onPress={confirmDeleteAccount}
            destructive
          />

          <SettingRow
            label={t("signOut")}
            subtitle={t("signOutSubtitle")}
            isRTL={isRTL}
            onPress={handleSignOut}
            destructive
          />
        </Animated.View>

        {/* Support Section */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
            {t("support")}
          </Text>

          <SettingRow
            label={t("rateApp")}
            subtitle={t("shareFeedback")}
            isRTL={isRTL}
            onPress={handleRateApp}
          />

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

      {/* Upgrade Modal */}
      <Modal
        visible={showUpgradeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent
        onRequestClose={() => !isDeleting && setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
}

function SettingRow({
  label,
  subtitle,
  value,
  isRTL,
  onPress,
  destructive,
}: SettingRowProps) {
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

  return (
    <AnimatedPressable
      style={[styles.settingRow, isRTL && styles.settingRowRTL, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
    >
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
      {value && (
        <Text style={[styles.settingValue, isRTL && styles.textRTL]}>
          {value}
        </Text>
      )}
    </AnimatedPressable>
  );
}

interface SettingRowWithSwitchProps {
  label: string;
  value: boolean;
  isRTL: boolean;
  onToggle: () => void;
}

function SettingRowWithSwitch({
  label,
  value,
  isRTL,
  onToggle,
}: SettingRowWithSwitchProps) {
  return (
    <View style={[styles.settingRow, isRTL && styles.settingRowRTL]}>
      <Text style={[styles.settingLabel, isRTL && styles.textRTL]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#E8E5E0", true: "#0D7A5F" }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
        accessibilityRole="switch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
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
    fontSize: 28,
    fontWeight: "700",
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  textRTL: {
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitleRTL: {
    textAlign: "right",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDE8",
  },
  settingRowRTL: {
    flexDirection: "row-reverse",
  },
  settingInfo: {
    flex: 1,
  },
  settingInfoRTL: {
    alignItems: "flex-end",
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1A1A1A",
  },
  settingSubtitle: {
    fontSize: 13,
    color: "#737373",
    marginTop: 2,
  },
  settingValue: {
    fontSize: 15,
    color: "#0D7A5F",
    fontWeight: "500",
  },
  destructiveText: {
    color: "#DC6B5A",
  },
  appInfo: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 40,
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0D7A5F",
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: "#737373",
    marginBottom: 16,
  },
  appDescription: {
    fontSize: 14,
    color: "#737373",
    textAlign: "center",
    lineHeight: 22,
  },
  bottomSpacing: {
    height: 32,
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
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
    textAlign: "center",
  },
  guestMessage: {
    fontSize: 15,
    color: "#737373",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  guestSignInButton: {
    flexDirection: "row",
    backgroundColor: "#0D7A5F",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D7A5F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  guestSignInButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#737373",
    marginBottom: 24,
  },
  upgradeOption: {
    backgroundColor: "#FAF7F2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  upgradeOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  upgradeOptionDesc: {
    fontSize: 14,
    color: "#737373",
  },
  cancelButton: {
    marginTop: 8,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#737373",
    fontWeight: "500",
  },
  deleteButton: {
    backgroundColor: "#DC6B5A",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

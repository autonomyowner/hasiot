import { appAlert } from "@/stores/dialogStore";
import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
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
import { useMutation, useQuery } from "convex/react";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { api } from "@/backend";
import { colors, type AppFonts } from "@/constants/colors";
import { ScreenGradient } from "@/components/ui/Gradients";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EditNameSheet } from "@/components/settings/EditNameSheet";
import { formatPhoneForDisplay } from "@/lib/phone";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { LIST_CONTAINER_PADDING } from "@/constants/layout";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { useAppStore } from "@/stores/appStore";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useFavorites, useTrips } from "@/hooks/useConvexData";
import type { TabKey } from "@/app/(tabs)/_layout";
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

/**
 * The longest a flow waits for a sheet's `onDismissed` before carrying on.
 *
 * The sheet itself is gone in about a quarter of a second. This only matters
 * if that event never arrives — and then waiting for ever would leave the
 * guest on "Deleting your account…" with no way off it.
 */
const SHEET_GONE_FALLBACK_MS = 1500;

function whenSheetGone(gone: Promise<void>): Promise<void> {
  return Promise.race([
    gone,
    new Promise<void>((resolve) => setTimeout(resolve, SHEET_GONE_FALLBACK_MS)),
  ]);
}

type HostingType = "business" | "provider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SettingsScreenContentProps {
  /** Jump to a tab in the pager — the Favorites row uses it. */
  onNavigateToTab?: (key: TabKey) => void;
}

export function SettingsScreenContent({ onNavigateToTab }: SettingsScreenContentProps = {}) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // Both render paths below end in a spacer that owes the docked bar its
  // height, the fade above it and the inset under it. It was the bare constant,
  // which is why the version line ended up behind the gesture bar.
  const bottomClearance = useTabBarClearance();
  const router = useRouter();
  const { t, language, changeLanguage, isRTL } = useLanguage();
  // Display currency only — hosts still price in riyals, and the peg is fixed,
  // so this is a two-way switch rather than a picker.
  const { currency, setCurrency } = useCurrency();
  const toggleCurrency = useCallback(
    () => setCurrency(currency === "SAR" ? "USD" : "SAR"),
    [currency, setCurrency]
  );
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);
  const clearUserData = useAppStore((state) => state.clearUserData);

  // The stats band used to render three hardcoded zeros. Trips and favourites
  // come from Convex (both skip while signed out); moments are local to the
  // device, which is where the app already keeps them.
  const { trips } = useTrips();
  const { favorites } = useFavorites();

  const { isSignedIn, isBusinessOwner, isServiceProvider, isApproved, verificationStatus, userType: convexUserType, user } = useConvexUser();
  const userType: UserType = convexUserType === "business_owner" ? "business" : convexUserType === "service_provider" ? "provider" : convexUserType === "admin" ? "admin" : "user";

  // Visual-only display values for the profile header (best-effort from the user record).
  // Bookings replaced Moments in the stats: Moments no longer has a tab, and
  // a count for a screen nobody can reach is not a stat.
  const bookings = useQuery(api.bookings.queries.getUserBookings, user ? {} : "skip");
  const realName = [(user as any)?.firstName, (user as any)?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const rawEmail: string | undefined = (user as any)?.email;
  // The address a phone sign-up is given is a placeholder that accepts no
  // mail; showing it would present the person with a string they never chose.
  const realEmail = rawEmail && !rawEmail.endsWith("@phone.hasio.xyz") ? rawEmail : "";
  const phoneLabel = (user as any)?.phone ? formatPhoneForDisplay((user as any).phone) : "";
  const profileName = realName || phoneLabel || realEmail || t("appName");
  const profileSubtitle =
    (realName ? phoneLabel || realEmail : "") ||
    (userType === "business"
      ? t("userTypeBusiness")
      : userType === "provider"
      ? t("userTypeProvider")
      : userType === "admin"
      ? t("admin")
      : t("userTypeUser"));
  const profileAvatarUrl = (user as any)?.image || (user as any)?.avatarUrl || null;
  const profileInitial = (profileName?.trim?.()?.[0] || "H").toUpperCase();

  const [nameOpen, setNameOpen] = useState(false);

  // ── Upgrading to a hosting account ──────────────────────────────────────
  //
  // What froze iOS: the upgrade used to be its own transparent Modal, with the
  // success alert drawn inside it by the modal's own dialog host. Pressing
  // "Done" hid the alert and closed the modal in the same render, so UIKit was
  // asked to dismiss the alert's view controller and its parent in one pass.
  // It dismissed the child and dropped the parent's dismissal — and because
  // React Native keeps a Modal's content mounted until UIKit reports it gone,
  // that report never came: an empty, transparent, full-screen controller
  // stayed presented on top of the app and took every touch. The app looked
  // frozen until it was killed.
  //
  // Now it is a BottomSheet, and the success path only closes it. What
  // happens next — the confirmation, then the verification screen — waits for
  // the sheet's `onDismissed`, when UIKit has nothing left in flight.
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgrading, setUpgrading] = useState<HostingType | null>(null);
  // State is a render late: two taps inside one frame would both read
  // `upgrading` as null and send two mutations. The ref is the real guard.
  const upgradeBusy = useRef(false);
  // Set on success and read once the sheet is gone.
  const upgradedTo = useRef<HostingType | null>(null);

  // ── Signing out and deleting the account ────────────────────────────────
  //
  // Both take the account away while this screen is still on it. The screen
  // follows the account: the moment the server forgets the user, `isSignedIn`
  // turns false and the guest "Sign in" page replaced the one being acted on —
  // the delete sheet vanished mid-spinner into the guest view, and signing out
  // showed the guest page for the length of the navigation. While `leaving` is
  // set the screen shows only what is happening, whatever the account's state.
  const [leaving, setLeaving] = useState<"signOut" | "delete" | null>(null);
  const leavingNow = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Resolved by the delete sheet's `onDismissed`.
  const deleteSheetGone = useRef<(() => void) | null>(null);

  const signOutNow = async () => {
    if (leavingNow.current) return;
    leavingNow.current = true;
    setLeaving("signOut");
    try {
      await authSignOut();
    } catch {
      leavingNow.current = false;
      setLeaving(null);
      appAlert(t("error"), t("signOutFailed"));
      return;
    }
    refreshAuth();
    clearUserData();
    setOnboardingComplete(false);
    router.replace("/onboarding");
  };

  const handleSignOut = () => {
    appAlert(
      t("signOutConfirmTitle"),
      t("signOutConfirmMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        // The action's own name on the button, not "Confirm": the button is
        // the last thing read before the tap.
        { text: t("signOut"), style: "destructive", onPress: () => void signOutNow() },
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

  const confirmDeleteAccount = async () => {
    if (leavingNow.current) return;
    leavingNow.current = true;

    // The sheet leaves at once and the page under it becomes "Deleting your
    // account…". The server work runs alongside the sheet's exit; only the
    // navigation and any error wait for the sheet to be gone, because on iOS
    // nothing can be presented while it is still being dismissed.
    const sheetGone = new Promise<void>((resolve) => {
      deleteSheetGone.current = resolve;
    });
    setLeaving("delete");
    setDeleteOpen(false);

    try {
      await deleteMyAccount();
    } catch {
      await whenSheetGone(sheetGone);
      leavingNow.current = false;
      setLeaving(null);
      appAlert(t("deleteAccountError"), t("pleaseTryAgain"));
      return;
    }

    // The account is gone. Nothing from here on may report a failure to
    // delete it, so a local sign-out that trips is not an error.
    await authSignOut().catch(() => {});
    refreshAuth();
    // Moments are server-side now and `deleteMyAccount` removes them along
    // with their stored images, so there is no local moment cache left to
    // clear here.
    clearUserData();
    await whenSheetGone(sheetGone);
    router.replace("/onboarding");
  };

  const handleDeleteSheetDismissed = () => {
    const resolve = deleteSheetGone.current;
    deleteSheetGone.current = null;
    resolve?.();
  };

  const setUserRole = useMutation(api.users.mutations.setUserRole);

  const handleUpgrade = async (type: HostingType) => {
    if (upgradeBusy.current) return;
    upgradeBusy.current = true;
    setUpgrading(type);
    try {
      await setUserRole({
        role: type === "business" ? "business_owner" : "service_provider",
      });
      upgradedTo.current = type;
      setUpgradeOpen(false);
    } catch {
      // Raised while the sheet is up and staying up, so it draws in the
      // sheet's own dialog host, above it.
      appAlert(t("upgradeError"), t("pleaseTryAgain"));
    } finally {
      upgradeBusy.current = false;
      setUpgrading(null);
    }
  };

  // Not while the role change is in flight: closing then would leave its
  // result with nowhere to go.
  const closeUpgrade = () => {
    if (upgradeBusy.current) return;
    setUpgradeOpen(false);
  };

  const handleUpgradeDismissed = () => {
    const type = upgradedTo.current;
    if (!type) return;
    upgradedTo.current = null;
    // The new role starts unapproved, so send them straight to verification —
    // otherwise posting silently fails server-side with "must be approved".
    // The push runs from the button, which the dialog only calls once it has
    // itself gone.
    const route = type === "business" ? "/business/verification" : "/provider/verification";
    appAlert(t("upgradeSuccess"), t("verificationUnverifiedBody"), [
      { text: t("verificationUnverifiedCta"), onPress: () => router.push(route) },
    ]);
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

  // Rendered whichever page is showing, so a sheet that is open when the
  // account changes under it (an upgrade, a deletion) stays mounted and can
  // finish its exit.
  const sheets = (
    <>
      <BottomSheet
        visible={upgradeOpen}
        onClose={closeUpgrade}
        onDismissed={handleUpgradeDismissed}
        header={
          <Text style={[styles.sheetTitle, isRTL && styles.textRTL]}>
            {t("upgradeAccount")}
          </Text>
        }
      >
        <Text style={[styles.sheetSubtitle, isRTL && styles.textRTL]}>
          {t("upgradeWarning")}
        </Text>

        {(["business", "provider"] as const).map((type) => {
          const busy = upgrading === type;
          const locked = upgrading !== null;
          const title = type === "business" ? t("userTypeBusiness") : t("userTypeProvider");
          return (
            <Pressable
              key={type}
              style={({ pressed }) => [
                styles.upgradeOption,
                isRTL && styles.rowRTL,
                locked && !busy && styles.upgradeOptionIdle,
                pressed && !locked && styles.pressed,
              ]}
              onPress={() => handleUpgrade(type)}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={title}
              accessibilityState={{ disabled: locked, busy }}
            >
              <View style={[styles.upgradeOptionText, isRTL && styles.alignEnd]}>
                <Text style={[styles.upgradeOptionTitle, isRTL && styles.textRTL]}>
                  {title}
                </Text>
                <Text style={[styles.upgradeOptionDesc, isRTL && styles.textRTL]}>
                  {type === "business" ? t("userTypeBusinessDesc") : t("userTypeProviderDesc")}
                </Text>
              </View>
              {busy ? <ActivityIndicator color={colors.primary.deep} /> : null}
            </Pressable>
          );
        })}

        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          onPress={closeUpgrade}
          disabled={upgrading !== null}
          accessibilityRole="button"
          accessibilityLabel={t("cancel")}
          accessibilityState={{ disabled: upgrading !== null }}
        >
          <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
        </Pressable>
      </BottomSheet>

      <EditNameSheet
        visible={nameOpen}
        initialName={realName}
        onClose={() => setNameOpen(false)}
      />

      <BottomSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDismissed={handleDeleteSheetDismissed}
        header={
          <Text style={[styles.sheetTitle, styles.destructiveText, isRTL && styles.textRTL]}>
            {t("deleteAccountConfirmTitle")}
          </Text>
        }
      >
        <Text style={[styles.sheetSubtitle, isRTL && styles.textRTL]}>
          {t("deleteAccountConfirmMessage")}
        </Text>

        <Pressable
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          onPress={confirmDeleteAccount}
          accessibilityRole="button"
          accessibilityLabel={t("deleteAccount")}
        >
          <Text style={styles.deleteButtonText}>{t("deleteAccount")}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          onPress={() => setDeleteOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t("cancel")}
        >
          <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
        </Pressable>
      </BottomSheet>
    </>
  );

  let page: React.ReactNode;

  if (leaving) {
    page = (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenGradient />
        <View
          style={styles.leaving}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={leaving === "delete" ? t("accountDeleting") : t("accountSigningOut")}
        >
          <ActivityIndicator size="large" color={colors.primary.deep} />
          <Text style={styles.leavingText}>
            {leaving === "delete" ? t("accountDeleting") : t("accountSigningOut")}
          </Text>
        </View>
      </View>
    );
  } else if (!isSignedIn) {
    // Guest view — not signed in
    page = (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenGradient />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
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
              <Feather name="user" size={40} color={colors.primary.deep} />
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
              <Feather name="log-in" size={18} color={colors.ink} style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
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
              icon="globe"
              label={t("language")}
              value={language === "en" ? "English" : "العربية"}
              isRTL={isRTL}
              onPress={() => changeLanguage(language === "en" ? "ar" : "en")}
            />

            <SettingRow
              icon="dollar-sign"
              label={t("currency")}
              value={currency === "SAR" ? t("currencySar") : t("currencyUsd")}
              subtitle={t("currencyHint")}
              isRTL={isRTL}
              onPress={toggleCurrency}
            />

          </Animated.View>

          {/* Legal Section */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)}>
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
              {t("support")}
            </Text>

            <SettingRow
              icon="shield"
              label={t("privacyPolicy")}
              subtitle={t("privacyPolicySubtitle")}
              isRTL={isRTL}
              onPress={handleOpenPrivacyPolicy}
            />

            <SettingRow
              icon="file-text"
              label={t("termsOfService")}
              subtitle={t("termsOfServiceSubtitle")}
              isRTL={isRTL}
              onPress={handleOpenTermsOfService}
            />

            {CAN_RATE_APP && (
              <SettingRow
                icon="star"
                label={t("rateApp")}
                subtitle={t("shareFeedback")}
                isRTL={isRTL}
                onPress={handleRateApp}
              />
            )}

            <SettingRow
              icon="info"
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

          <View style={{ height: bottomClearance }} />
        </ScrollView>
      </View>
    );
  } else {
    page = (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenGradient />
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
              <Text style={styles.statNumber}>{trips.length}</Text>
              <Text style={styles.statLabel}>{language === "ar" ? "الرحلات" : "Trips"}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{(bookings ?? []).length}</Text>
              <Text style={styles.statLabel}>{t("myBookings")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{favorites.length}</Text>
              <Text style={styles.statLabel}>{t("favorites")}</Text>
            </View>
          </Animated.View>

          {/* Switch to hosting promo — only for normal users */}
          {userType === "user" && (
            <Animated.View entering={FadeInDown.delay(200).duration(600)}>
              <Pressable
                style={styles.hostingCard}
                onPress={() => setUpgradeOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("upgradeAccount")}
              >
                <View style={[styles.hostingRow, isRTL && styles.hostingRowRTL]}>
                  <View style={styles.hostingIcon}>
                    <Feather name="home" size={22} color={colors.ink} />
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

          {/* Account — only rendered when the user actually has one of these
              rows, so guests never see an empty heading. */}
          {(isBusinessOwner || isServiceProvider) && (
            <Animated.View
              entering={FadeInDown.delay(280).duration(600)}
              style={styles.listGroup}
            >
              <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
                {t("account")}
              </Text>
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

            </Animated.View>
          )}

          {/* Preferences */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(600)}
            style={styles.listGroup}
          >
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
              {t("preferences")}
            </Text>

            {/* The two screens a guest reaches only from here. Bookings first:
                it is the one someone opens on purpose, while the inbox is
                usually reached by following a notification. */}
            <SettingRow
              icon="user"
              label={t("editName")}
              value={realName || undefined}
              isRTL={isRTL}
              onPress={() => setNameOpen(true)}
            />

            <SettingRow
              icon="calendar"
              label={t("myBookings")}
              isRTL={isRTL}
              onPress={() => router.push("/bookings")}
            />

            <SettingRow
              icon="bell"
              label={t("notifications")}
              isRTL={isRTL}
              onPress={() => router.push("/notifications")}
            />

            <SettingRow
              icon="heart"
              label={t("favorites")}
              isRTL={isRTL}
              onPress={() => onNavigateToTab?.("favorites")}
            />

            <SettingRow
              icon="globe"
              label={t("language")}
              value={language === "en" ? "English" : "العربية"}
              isRTL={isRTL}
              onPress={() => changeLanguage(language === "en" ? "ar" : "en")}
            />

            <SettingRow
              icon="dollar-sign"
              label={t("currency")}
              value={currency === "SAR" ? t("currencySar") : t("currencyUsd")}
              subtitle={t("currencyHint")}
              isRTL={isRTL}
              onPress={toggleCurrency}
            />
          </Animated.View>

          {/* Support */}
          <Animated.View
            entering={FadeInDown.delay(320).duration(600)}
            style={styles.listGroup}
          >
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
              {t("support")}
            </Text>

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
            />
          </Animated.View>

          {/* Delete account — kept apart from Support by space alone, so the
              destructive row is never a mis-tap away from a legal link. */}
          <Animated.View
            entering={FadeInDown.delay(350).duration(600)}
            style={styles.listGroupSpaced}
          >
            <SettingRow
              icon="trash-2"
              label={t("deleteAccount")}
              isRTL={isRTL}
              onPress={() => setDeleteOpen(true)}
              destructive
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

          <View style={{ height: bottomClearance }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <>
      {page}
      {sheets}
    </>
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
}

function SettingRow({
  label,
  subtitle,
  value,
  isRTL,
  onPress,
  destructive,
  icon,
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

  const iconColor = destructive ? colors.signOut : colors.primary.deep;

  return (
    <AnimatedPressable
      style={[
        styles.settingRow,
        isRTL && styles.settingRowRTL,
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
  // The single gutter for this screen, in BOTH the signed-in and signed-out
  // states. The signed-out ScrollView had none at all: its header and guest
  // card hardcoded their own 24 while the rows leaned on settingRow's 16 plus
  // a white background. With the background gone, those rows sat at x=0 while
  // everything above them sat at 24. LIST_CONTAINER_PADDING is what the other
  // list screens use and what this screen was already hardcoding.
  scrollContent: {
    paddingHorizontal: LIST_CONTAINER_PADDING,
  },
  header: {
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
  rowRTL: {
    flexDirection: "row-reverse",
  },
  alignEnd: {
    alignItems: "flex-end",
  },
  pressed: {
    opacity: 0.7,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.onSurface.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitleRTL: {
    textAlign: "right",
  },
  // While signing out or deleting: the one thing happening, centred on the page.
  leaving: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: LIST_CONTAINER_PADDING,
  },
  leavingText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onSurface.variant,
    textAlign: "center",
  },
  // Profile header
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 20,
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
    paddingVertical: 18,
    marginBottom: 4,
    // Hairlines top and bottom instead of a panel: the numbers still read as
    // one band, without another white rectangle on the page.
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
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
    backgroundColor: "rgba(31, 29, 23, 0.14)",
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
    color: colors.ink,
  },
  hostingDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "rgba(31, 29, 23, 0.78)",
    marginTop: 2,
    lineHeight: 18,
  },
  hostingPillRow: {
    flexDirection: "row",
    marginTop: 16,
  },
  // A white pill on lime has almost no edge (1.4:1), so the CTA is inked.
  hostingPill: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  hostingPillText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary.DEFAULT,
  },
  // A settings group. Not a card: the page reads as one surface, and the
  // groups are told apart by their heading and the space around them. The
  // white panels that used to be here cut the page into boxes and fought the
  // screen gradient underneath.
  listGroup: {
    marginBottom: 4,
  },
  // A group with no heading still needs the space a heading would have given
  // it, or the delete row rides up against the legal links above it.
  listGroupSpaced: {
    marginTop: 20,
    marginBottom: 4,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // No inset of its own: scrollContent's 20 is the page's single gutter, and
    // every heading, row and rule on this screen starts from it. The 4 that
    // used to be here was compensating for listCard's own padding, and once
    // the cards went it pushed every label 4px past the stats rules.
    // With no divider under each row, the vertical rhythm is what separates
    // them, so it is a little more generous than the boxed version was.
    paddingVertical: 13,
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
  // Alignment box only. The mint chip that used to fill it measured 1.13:1
  // against the white row it sat on and 1.00:1 against the bottom of the page
  // gradient — it drew nothing. The icon reads better on the bare page
  // (6.7:1) than it did on the chip.
  settingIcon: {
    width: 34,
    height: 34,
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
  // The tab-bar spacer's height is `useTabBarClearance()` at each call site —
  // it needs the safe-area inset, which a module-scope style cannot see.
  // Guest Card Styles
  guestCard: {
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
    backgroundColor: "rgba(79, 94, 16, 0.10)",
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
    color: colors.ink,
  },
  // Sheets (upgrade, delete). The title sits in the sheet's drag zone, so it
  // can be grabbed as well as the handle.
  sheetTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.ink,
  },
  sheetSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface.muted,
    marginTop: 4,
    marginBottom: 20,
  },
  upgradeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // The option not being applied while the other one is.
  upgradeOptionIdle: {
    opacity: 0.5,
  },
  upgradeOptionText: {
    flex: 1,
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
    marginTop: 4,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onSurface.muted,
  },
  // The destructive red that is also the app's destructive text colour. The
  // coral `error` token it used to be put white text at 3.3:1; this is 5.4:1.
  deleteButton: {
    backgroundColor: colors.signOut,
    borderRadius: 12,
    minHeight: 50,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  deleteButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.surface.DEFAULT,
  },
});

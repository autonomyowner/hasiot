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
import { Skeleton, SkeletonGroup, SkeletonLine } from "@/components/ui/Skeleton";
import { EditNameSheet } from "@/components/settings/EditNameSheet";
import { UpgradeSheet, type HostingType } from "@/components/settings/UpgradeSheet";
import { formatPhoneForDisplay, isPlaceholderEmail, ltr } from "@/lib/phone";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { LIST_CONTAINER_PADDING } from "@/constants/layout";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { useAppStore } from "@/stores/appStore";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useFavorites } from "@/hooks/useConvexData";
import type { TabKey } from "@/app/(tabs)/_layout";
import { signOut as authSignOut } from "@/lib/auth";
import { refreshAuth } from "@/lib/convex";
import { forgetThisDeviceForPush } from "@/lib/push";
import { askForPushNow } from "@/lib/pushPrompt";
import { signOutWithPush, usePushSettingsRow } from "@/hooks/usePushRegistration";
import { UserType } from "@/types";

// hasio.net is the live site (design D2). The binaries already in the stores
// open the hasio.xyz copies, which stay up until those binaries age out.
const PRIVACY_POLICY_URL = "https://hasio.net/privacy-policy.html";
const TERMS_OF_SERVICE_URL = "https://hasio.net/terms-of-service.html";
// The one place the support address lives: it is on hasio.xyz, and may move
// with that domain (design, open decision 3).
const SUPPORT_EMAIL = "support@hasio.xyz";

const ANDROID_PACKAGE = "com.hasio.travel";
// "Hasio Travel" in App Store Connect (published under Nabil Hamici's team).
// Null hid the "Rate app" row on iPhone altogether.
const IOS_APP_STORE_ID: string | null = "6800297588";
const CAN_RATE_APP = Platform.OS !== "ios" || IOS_APP_STORE_ID !== null;

// The running version, from the manifest: an over-the-air update carries its
// own, so this is the JS actually on screen. The string used to be the
// translation "Version 1.0.0", with the number written into the copy — the
// footer said 1.0.0 whatever was installed, and About printed
// "Version 1.0.0: 1.1.0".
const APP_VERSION = Constants.expoConfig?.version ?? "";

// convex/notifications/queries.ts stops counting at 50 (MAX_UNREAD_COUNT), so
// 50 means "50 or more".
const UNREAD_BADGE_CAP = 50;

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

  // The stats band: bookings and favourites, both from Convex (both skip while
  // signed out). A trips count used to lead it, but no screen lists trips —
  // a number that opens nothing is not a stat (design D7).
  const { favorites } = useFavorites();

  const {
    isSignedIn,
    isUserLoading,
    isBusinessOwner,
    isServiceProvider,
    isApproved,
    verificationStatus,
    userType: convexUserType,
    user,
  } = useConvexUser();
  const userType: UserType = convexUserType === "business_owner" ? "business" : convexUserType === "service_provider" ? "provider" : convexUserType === "admin" ? "admin" : "user";

  // Bookings replaced Moments in the stats: Moments no longer has a tab, and
  // a count for a screen nobody can reach is not a stat. Service bookings are
  // counted too, as My bookings lists them; without the flag the server leaves
  // them out for the apps that predate services.
  const bookings = useQuery(
    api.bookings.queries.getUserBookings,
    user ? { includeServices: true } : "skip"
  );
  const unreadCount = useQuery(api.notifications.queries.unreadCount, user ? {} : "skip");
  // Hidden where push cannot arrive: a simulator, the web, a build without it.
  const pushRow = usePushSettingsRow();

  const realName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  // The address a phone sign-up is given is a placeholder that accepts no
  // mail; showing it would present the person with a string they never chose.
  const realEmail = user?.email && !isPlaceholderEmail(user.email) ? user.email : "";
  // Wrapped so Arabic shows "+966 50 123 4567", not "4567 123 50 966+".
  const phoneLabel = user?.phone ? ltr(formatPhoneForDisplay(user.phone)) : "";
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
  // A letter only from something that is a name. A phone sign-up without one
  // used to get "+" in the circle — the first character of its number.
  const avatarLetter = (realName || realEmail).trim().charAt(0).toUpperCase();

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
  // From opening until `onDismissed`. The sheet can be closed while the role
  // change is still in flight; if it has already gone when the change lands,
  // there is no dismissal left to wait for and the confirmation comes at once.
  const upgradeShown = useRef(false);

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
      // Takes this phone off the account's push list first, while the
      // session still exists — the next person to use the phone must not
      // get this account's booking notices.
      await signOutWithPush();
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

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => appAlert(t("error"), t("couldNotOpenLink")));
  };

  // The address is on the row as well, for a phone with no mail app set up.
  const contactSupport = () => openLink(`mailto:${SUPPORT_EMAIL}`);

  // Off: the app's explanation, then the system's prompt. On, or refused for
  // good: only the phone's settings can change it now, so the row goes there
  // — which is also the only way to turn notifications off. Before the
  // permission has been read (a moment after opening) a tap does nothing.
  const handlePushRow = () => {
    if (pushRow.state === null) return;
    if (pushRow.state === "off") {
      askForPushNow(isBusinessOwner || isServiceProvider ? "host" : "guest");
      return;
    }
    Linking.openSettings().catch(() => appAlert(t("error"), t("couldNotOpenLink")));
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
      // While the session can still say whose token it is. Never throws, and
      // gives up after a few seconds rather than hold the deletion.
      await forgetThisDeviceForPush();
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

  const openUpgrade = () => {
    upgradeShown.current = true;
    setUpgradeOpen(true);
  };

  // The new role starts unapproved, so send them straight to verification —
  // otherwise posting silently fails server-side with "must be approved". The
  // push runs from the button, which the dialog only calls once it has itself
  // gone.
  const announceUpgrade = (type: HostingType) => {
    const route = type === "business" ? "/business/verification" : "/provider/verification";
    appAlert(t("upgradeSuccess"), t("verificationUnverifiedBody"), [
      { text: t("verificationUnverifiedCta"), onPress: () => router.push(route) },
    ]);
  };

  const handleUpgrade = async (type: HostingType) => {
    if (upgradeBusy.current) return;
    upgradeBusy.current = true;
    setUpgrading(type);
    try {
      await setUserRole({
        role: type === "business" ? "business_owner" : "service_provider",
      });
      if (upgradeShown.current) {
        upgradedTo.current = type;
        setUpgradeOpen(false);
      } else {
        announceUpgrade(type);
      }
    } catch {
      appAlert(t("upgradeError"), t("pleaseTryAgain"));
    } finally {
      upgradeBusy.current = false;
      setUpgrading(null);
    }
  };

  const handleUpgradeDismissed = () => {
    upgradeShown.current = false;
    const type = upgradedTo.current;
    if (!type) return;
    upgradedTo.current = null;
    announceUpgrade(type);
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
    // Straight to openURL, with the web page as Android's fallback. The
    // canOpenURL check this used to make answers false for market:// on
    // Android 11+ unless the manifest declares that query, whatever is
    // installed — and it swallowed every failure without a word.
    try {
      await Linking.openURL(url);
    } catch {
      try {
        if (Platform.OS !== "android") throw new Error("No fallback");
        await Linking.openURL(playStoreUrl);
      } catch {
        appAlert(t("error"), t("couldNotOpenLink"));
      }
    }
  };

  const handleAbout = () => {
    // The binary's own build number where the platform reports it; the
    // manifest's is only what app.json said when the update was made.
    const buildNumber =
      Platform.OS === "android"
        ? Constants.platform?.android?.versionCode ?? Constants.expoConfig?.android?.versionCode
        : Constants.platform?.ios?.buildNumber ?? Constants.expoConfig?.ios?.buildNumber;
    appAlert(
      "Hasio",
      `${t("appDescription")}\n\n${t("version")} ${APP_VERSION}${buildNumber ? ` (${buildNumber})` : ""}`,
      [{ text: t("done") }]
    );
  };

  // Rendered whichever page is showing, so a sheet that is open when the
  // account changes under it (an upgrade, a deletion) stays mounted and can
  // finish its exit.
  const sheets = (
    <>
      <UpgradeSheet
        visible={upgradeOpen}
        upgrading={upgrading}
        onChoose={handleUpgrade}
        onClose={() => setUpgradeOpen(false)}
        onDismissed={handleUpgradeDismissed}
      />

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

  // The footer: the name and the version the app is actually running.
  const appInfo = (
    <>
      <Text style={[styles.appName, isRTL && styles.textRTL]}>{t("appName")}</Text>
      {APP_VERSION ? (
        <Text style={[styles.version, isRTL && styles.textRTL]}>
          {`${t("version")} ${APP_VERSION}`}
        </Text>
      ) : null}
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
  } else if (isUserLoading) {
    // Until the session is known. Rendering the guest page meanwhile showed a
    // signed-in person "Sign in or create account" for the first moment of
    // every launch. A placeholder for the profile header stands in instead:
    // neutral for a guest, and for everyone else the header's own shape.
    page = (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenGradient />
        <View
          style={styles.scrollContent}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t("loading")}
        >
          <SkeletonGroup>
            <View style={[styles.profileHeader, isRTL && styles.profileHeaderRTL]}>
              <Skeleton radius={40} style={styles.avatarSkeleton} />
              {/* Full width, with each bar aligned inside it: a percentage
                  width has nothing to resolve against in a shrunken box. */}
              <View style={styles.profileHeaderInfo}>
                <SkeletonLine width="62%" box={34} isRTL={isRTL} />
                <SkeletonLine width="40%" box={20} isRTL={isRTL} style={styles.skeletonSubtitle} />
              </View>
            </View>
          </SkeletonGroup>
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
            {/* Mirrored in Arabic with the gap between icon and label. The
                icon's margin used to switch sides instead, which in Arabic
                put the space on its outer edge and the icon against the
                text. */}
            <Pressable
              style={({ pressed }) => [
                styles.guestSignInButton,
                isRTL && styles.rowRTL,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/auth")}
              accessibilityRole="button"
              accessibilityLabel={t("guestSignInButton")}
            >
              <Feather name="log-in" size={18} color={colors.ink} />
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
              switches
            />

            <SettingRow
              icon="dollar-sign"
              label={t("currency")}
              value={currency === "SAR" ? t("currencySar") : t("currencyUsd")}
              subtitle={t("currencyHint")}
              isRTL={isRTL}
              onPress={toggleCurrency}
              switches
            />

          </Animated.View>

          {/* Legal Section */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)}>
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
              {t("support")}
            </Text>

            {/* A guest can need help too — above all one who cannot sign in. */}
            <SettingRow
              icon="mail"
              label={t("contactSupport")}
              subtitle={SUPPORT_EMAIL}
              isRTL={isRTL}
              onPress={contactSupport}
            />

            <SettingRow
              icon="shield"
              label={t("privacyPolicy")}
              subtitle={t("privacyPolicySubtitle")}
              isRTL={isRTL}
              onPress={() => openLink(PRIVACY_POLICY_URL)}
            />

            <SettingRow
              icon="file-text"
              label={t("termsOfService")}
              subtitle={t("termsOfServiceSubtitle")}
              isRTL={isRTL}
              onPress={() => openLink(TERMS_OF_SERVICE_URL)}
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
            {appInfo}
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
              {avatarLetter ? (
                <Text style={styles.avatarInitial}>{avatarLetter}</Text>
              ) : (
                <Feather name="user" size={34} color={colors.ink} />
              )}
            </View>
            <View style={[styles.profileHeaderInfo, isRTL && styles.profileHeaderInfoRTL]}>
              <Text style={[styles.profileName, isRTL && styles.textRTL]} numberOfLines={1}>
                {profileName}
              </Text>
              <Text style={[styles.profileSubtitle, isRTL && styles.textRTL]} numberOfLines={1}>
                {profileSubtitle}
              </Text>
              {/* A phone sign-up has no name, and nothing ever asked for one:
                  the host of their booking saw a bare number. The row in
                  Preferences was the only way in, labelled "Your name" with
                  nothing beside it. */}
              {!realName && (
                <Pressable
                  onPress={() => setNameOpen(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  style={({ pressed }) => [
                    styles.addName,
                    isRTL && styles.addNameRTL,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("profileAddName")}
                >
                  <Feather name="plus" size={15} color={colors.primary.deep} />
                  <Text style={styles.addNameText}>{t("profileAddName")}</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>

          {/* Stats Strip */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(600)}
            style={[styles.statsCard, isRTL && styles.statsCardRTL]}
          >
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
                style={({ pressed }) => [styles.hostingCard, pressed && styles.hostingCardPressed]}
                onPress={openUpgrade}
                accessibilityRole="button"
                accessibilityLabel={t("upgradeAccount")}
              >
                <View style={[styles.hostingRow, isRTL && styles.rowRTL]}>
                  <View style={styles.hostingIcon}>
                    <Feather name="home" size={22} color={colors.ink} />
                  </View>
                  <View style={[styles.hostingTextWrap, isRTL && styles.alignEnd]}>
                    <Text style={[styles.hostingTitle, isRTL && styles.textRTL]}>
                      {t("upgradeAccount")}
                    </Text>
                    <Text style={[styles.hostingDesc, isRTL && styles.textRTL]} numberOfLines={2}>
                      {t("becomeBusinessOrProvider")}
                    </Text>
                  </View>
                </View>
                <View style={[styles.hostingPillRow, isRTL && styles.rowRTL]}>
                  <View style={styles.hostingPill}>
                    <Text style={styles.hostingPillText}>{t("profileGetStarted")}</Text>
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
              badge={unreadCount ?? 0}
              badgeLabel={t("profileUnread").replace("{n}", String(unreadCount ?? 0))}
              isRTL={isRTL}
              onPress={() => router.push("/notifications")}
            />

            {/* Push, beside the inbox it brings people back to. */}
            {pushRow.available && (
              <SettingRow
                icon="smartphone"
                label={t("pushNotifications")}
                value={
                  pushRow.state === "on"
                    ? t("pushOn")
                    : pushRow.state
                      ? t("pushOff")
                      : undefined
                }
                subtitle={pushRow.state === "blocked" ? t("pushTurnOnInSettings") : undefined}
                isRTL={isRTL}
                onPress={handlePushRow}
              />
            )}

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
              switches
            />

            <SettingRow
              icon="dollar-sign"
              label={t("currency")}
              value={currency === "SAR" ? t("currencySar") : t("currencyUsd")}
              subtitle={t("currencyHint")}
              isRTL={isRTL}
              onPress={toggleCurrency}
              switches
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

            <SettingRow
              icon="mail"
              label={t("contactSupport")}
              subtitle={SUPPORT_EMAIL}
              isRTL={isRTL}
              onPress={contactSupport}
            />

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
              onPress={() => openLink(PRIVACY_POLICY_URL)}
            />

            <SettingRow
              icon="file-text"
              label={t("termsOfService")}
              isRTL={isRTL}
              onPress={() => openLink(TERMS_OF_SERVICE_URL)}
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

          {/* Sign out — with room between it and Delete account, which sat
              directly on top of it: the everyday action and the irreversible
              one were a thumb's slip apart. */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(600)}
            style={styles.signOutGroup}
          >
            <Pressable
              style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
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
            {appInfo}
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
  /** A count in a pill beside the chevron — unread notifications. */
  badge?: number;
  /** What the badge means, for screen readers ("3 unread"). */
  badgeLabel?: string;
  /**
   * The row changes its setting in place (language, currency) rather than
   * opening a screen, so it has no chevron: a chevron promises a page.
   */
  switches?: boolean;
  isRTL: boolean;
  onPress?: () => void;
  destructive?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
}

function SettingRow({
  label,
  subtitle,
  value,
  badge,
  badgeLabel,
  switches,
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
  const badgeText =
    badge && badge > 0
      ? badge >= UNREAD_BADGE_CAP
        ? `${UNREAD_BADGE_CAP}+`
        : String(badge)
      : null;
  const a11yLabel = [label, subtitle, value, badgeText ? badgeLabel : undefined]
    .filter(Boolean)
    .join(", ");

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
      accessibilityLabel={a11yLabel}
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
        {/* One line, and it gives way: a long value used to keep its full
            width and squeeze the label and its hint into a narrow column. */}
        {value && (
          <Text
            style={[styles.settingValue, isRTL && styles.textRTL]}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
        {badgeText ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        ) : null}
        {onPress && !destructive && !switches && (
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
  // Every row on this screen mirrors with `row-reverse` and spaces its items
  // with `gap`, which has no side. The margins that used to do the spacing
  // stayed on their original side when a row reversed, so in Arabic the gap
  // sat on the outer edge of an icon and the icon touched the text.
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
    gap: 16,
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
  avatarSkeleton: {
    width: 80,
    height: 80,
  },
  avatarInitial: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.ink,
  },
  profileHeaderInfo: {
    flex: 1,
  },
  profileHeaderInfoRTL: {
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
  skeletonSubtitle: {
    marginTop: 2,
  },
  // Its own width, not the column's: the whole row would otherwise be the
  // target, and its pressed state a band across the header.
  addName: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 8,
  },
  addNameRTL: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
  },
  addNameText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary.deep,
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
  hostingCardPressed: {
    opacity: 0.85,
  },
  hostingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  hostingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(31, 29, 23, 0.14)",
    alignItems: "center",
    justifyContent: "center",
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
    gap: 12,
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
    gap: 12,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    maxWidth: "50%",
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
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.onSurface.muted,
  },
  // Lime is a fill, so the count on it is ink.
  badge: {
    minWidth: 22,
    minHeight: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.ink,
  },
  destructiveText: {
    color: colors.signOut,
  },
  // Sign out
  signOutGroup: {
    marginTop: 16,
  },
  signOutButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingVertical: 14,
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
    gap: 8,
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
  // The delete sheet (the upgrade one is components/settings/UpgradeSheet).
  // The title sits in the sheet's drag zone, so it can be grabbed as well as
  // the handle.
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

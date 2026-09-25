const fs = require("fs");
const path = require("path");

/**
 * The app config: app.json, plus what can only be decided where a build is
 * made. Expo reads app.json first and hands its `expo` object over as
 * `config`; every field in it — sdkVersion, version, runtimeVersion, the
 * bundle id and package, every plugin — is kept as it is, apart from the
 * changes below.
 *
 * Two switches decide whether a build can receive push, and both reach the
 * app as `extra.push`, so a build that cannot receive a notification never
 * asks for permission to send one (lib/push.ts `isPushAvailable`):
 *
 * - HASIO_IOS_PUSH="off" builds iOS without the aps-environment entitlement
 *   (plugins/withoutPushEntitlement.js). It is set in eas.json, because the
 *   EAS builder evaluates this file with the build profile's env and never
 *   sees this PC's. It stays "off" until Nabil's team has the Push
 *   Notifications capability, an APNs key and a regenerated profile.
 * - Android push needs google-services.json (Firebase). A production Android
 *   build without it stops here with an error rather than ship without push
 *   by accident; HASIO_ANDROID_PUSH="off" is the deliberate way to do that.
 *
 * `eas update` evaluates this file where the update is published, with the
 * EAS environment's variables (`--environment production`), not eas.json's
 * build env. An update for a push-less binary should therefore be published
 * with the same HASIO_IOS_PUSH value; if it is not, the app still finds out
 * from the failing device-token request and does not ask
 * (lib/push.ts `confirmPushSupported`).
 */

// The splash image is the store icon, an opaque square whose corners are
// #FFFFFF (read from the PNG, 76% of its pixels). On app.json's cream
// #FAF7F2 it showed as a white square; on Android 12+, which draws the image
// inside a circle, as a white disc. The background now matches the image.
const SPLASH_BACKGROUND = "#FFFFFF";

// IconKitchen's background layer is a flat #FFFFFF (read from the PNG), so a
// colour does exactly what the image would.
const ADAPTIVE_ICON_BACKGROUND = "#FFFFFF";

// The dark lime: the notification accent is drawn as a tint and as text
// beside the small icon, where the lime fill would read at 1.3:1.
const NOTIFICATION_COLOR = "#4F5E10";

// Both languages in the one string, rather than `locales`. locales/en.json
// and locales/ar.json hold the translated text, but wiring them in adds an
// ar.lproj to the iOS bundle, which makes Arabic one of the app's own
// localizations: on an iPhone set to Arabic, UIKit then lays the app out
// right to left, and React Native turns its native RTL on too (allowRTL
// defaults to YES in RCTI18nUtil). This app keeps native layout left to right
// and mirrors each screen itself from the in-app language, so every screen
// would be mirrored twice. Wire `locales` in only together with pinning
// allowRTL(false) natively, and check it on an Arabic iPhone.
const PHOTOS_PERMISSION =
  "Hasio uses your photo library so you can attach pictures to your listings, services and verification documents.\n\n" +
  "يستخدم Hasio مكتبة الصور لتتمكن من إرفاق الصور بإعلاناتك وخدماتك ووثائق توثيق حسابك.";

/** One plugin's props merged in, keeping every other entry and the order. */
function withPluginProps(plugins, name, props) {
  return plugins.map((entry) => {
    const [pluginName, existing] = Array.isArray(entry) ? entry : [entry, undefined];
    if (pluginName !== name) return entry;
    return [pluginName, { ...(existing || {}), ...props }];
  });
}

module.exports = ({ config, projectRoot }) => {
  const root = projectRoot || process.cwd();
  const hasGoogleServices = fs.existsSync(path.join(root, "google-services.json"));
  const iosPush = process.env.HASIO_IOS_PUSH !== "off";
  const androidPushOff = process.env.HASIO_ANDROID_PUSH === "off";

  // EAS_BUILD_PROFILE and EAS_BUILD_PLATFORM exist on the EAS builder only —
  // "not available when evaluating app.config.js locally" (Expo docs) — so
  // this stops the build itself, never a command run on this PC. An iOS build
  // does not use the file and goes ahead.
  if (
    !hasGoogleServices &&
    process.env.EAS_BUILD_PROFILE === "production" &&
    process.env.EAS_BUILD_PLATFORM !== "ios" &&
    !androidPushOff
  ) {
    throw new Error(
      "google-services.json is missing — push would silently not work on Android. " +
        "Add it (see docs) or set HASIO_ANDROID_PUSH=off to build without push."
    );
  }

  // The APNs environment of the provisioning profile the build is signed
  // with: development for the simulator profiles, production (App Store,
  // TestFlight, ad hoc) for everything else.
  const profile = process.env.EAS_BUILD_PROFILE;
  const apsMode = profile === "development" || profile === "simulator" ? "development" : "production";

  let plugins = config.plugins || [];
  // No Face ID: the session is kept in SecureStore without biometrics
  // (lib/auth.ts), so the default usage string described a permission the app
  // never asks for.
  plugins = withPluginProps(plugins, "expo-secure-store", { faceIDPermission: false });
  plugins = withPluginProps(plugins, "expo-splash-screen", { backgroundColor: SPLASH_BACKGROUND });
  plugins = withPluginProps(plugins, "expo-image-picker", { photosPermission: PHOTOS_PERMISSION });

  return {
    ...config,
    // Light only, system bars included. The app is light-only, but with
    // "automatic" an Android phone in dark mode styled the status and
    // navigation bars for dark mode over the app's cream. Android applies
    // this only with expo-system-ui installed, which is why it is added below.
    userInterfaceStyle: "light",
    android: {
      ...config.android,
      userInterfaceStyle: "light",
      // The layered icon: the art on its own layer inside the safe zone, the
      // background as a colour, and a real monochrome layer for Android 13
      // themed icons. The full square icon used to be the foreground, so the
      // launcher cropped the art; IconKitchen's "monochrome" was a copy of the
      // colour foreground, which a themed icon draws as a solid square.
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon-foreground.png",
        monochromeImage: "./assets/images/adaptive-icon-monochrome.png",
        backgroundColor: ADAPTIVE_ICON_BACKGROUND,
      },
      ...(hasGoogleServices ? { googleServicesFile: "./google-services.json" } : {}),
    },
    plugins: [
      // FIRST, so it acts on the entitlements after expo-notifications (see
      // the plugin for why the order is reversed).
      "./plugins/withoutPushEntitlement",
      ...plugins,
      "expo-system-ui",
      [
        "expo-notifications",
        {
          // White on transparent: Android draws the status-bar icon from its
          // alpha alone, so the launcher icon would show as a blank square.
          icon: "./assets/images/notification-icon.png",
          color: NOTIFICATION_COLOR,
          // The channel lib/push.ts creates and the server names.
          defaultChannel: "default",
          mode: apsMode,
        },
      ],
    ],
    extra: {
      ...config.extra,
      push: {
        ios: iosPush,
        android: hasGoogleServices && !androidPushOff,
      },
    },
  };
};

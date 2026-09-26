const { withEntitlementsPlist, withInfoPlist } = require("expo/config-plugins");

/**
 * What expo-apple-authentication's own config plugin does, minus two things.
 *
 * 1. The entitlement, while HASIO_IOS_APPLE_SIGNIN is "off". Sign in with
 *    Apple needs the capability on the App ID com.hasio.travel and a
 *    provisioning profile regenerated with it — both on Nabil's Apple team,
 *    and EAS will not add either (EXPO_NO_CAPABILITY_SYNC=1). Until they
 *    exist, a binary carrying `com.apple.developer.applesignin` fails to sign.
 *    Same switch shape as plugins/withoutPushEntitlement.js, in eas.json's
 *    build env for the same reason; the app reads it as `extra.appleSignIn`
 *    and shows no Apple button on a build that cannot use it.
 *
 * 2. CFBundleAllowMixedLocalizations, always. The plugin sets it so Apple's
 *    native button can be localised, but it also makes the app take the
 *    phone's language as its own: on an iPhone set to Arabic, UIKit and React
 *    Native would lay the app out right to left natively, on top of the
 *    mirroring every screen already does itself (see app.config.js on
 *    `locales`). The app draws its own Apple button in both languages instead.
 *
 * Expo applies expo-apple-authentication's plugin by itself once the package
 * is installed, so app.config.js lists it explicitly — after this one. A mod
 * runs its own action and then hands over to mods registered before it, so
 * the plugin listed first acts last, after the Apple plugin has written.
 */
function withAppleSignInSwitch(config) {
  config = withInfoPlist(config, (config) => {
    delete config.modResults.CFBundleAllowMixedLocalizations;
    return config;
  });
  if (process.env.HASIO_IOS_APPLE_SIGNIN !== "off") return config;
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["com.apple.developer.applesignin"];
    return config;
  });
}

module.exports = withAppleSignInSwitch;

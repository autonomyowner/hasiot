const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * Builds iOS without the push entitlement while HASIO_IOS_PUSH is "off".
 *
 * Push needs the Push Notifications capability on the App ID
 * com.hasio.travel and an App Store provisioning profile regenerated with it.
 * Both belong to Nabil's Apple team, and until they exist a binary carrying
 * `aps-environment` fails to sign ("profile doesn't support Push
 * Notifications"). The switch lives in eas.json's build env, because that is
 * what reaches the EAS builder where this config is evaluated; turn it to "on"
 * once the capability, the APNs key and the new profile are in place. Android
 * is unaffected.
 *
 * This plugin must be listed FIRST in `plugins`. A config-plugin mod runs its
 * own action and then hands the result to the mods registered before it, so
 * the first plugin in the list acts last on the entitlements — after
 * expo-notifications has added `aps-environment`. Listed after it, this would
 * delete nothing, and the build would fail in Xcode.
 *
 * The app reads the same switch (app.config.js `extra.push.ios`) and does not
 * ask for notifications on a build that cannot receive them.
 */
function withoutPushEntitlement(config) {
  if (process.env.HASIO_IOS_PUSH !== "off") return config;
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    return config;
  });
}

module.exports = withoutPushEntitlement;

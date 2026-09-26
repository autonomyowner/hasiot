/**
 * The release switches in app.config.js and plugins/withoutPushEntitlement.js.
 *
 * They decide whether a store build can sign (iOS without push until Nabil's
 * team has the capability) and whether one can ship without push by accident
 * (Android without Firebase), and nothing else would notice them breaking
 * before a failed EAS build. Kept under lib/ only because that is where
 * vitest looks.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type AnyConfig = Record<string, any>;
type ConfigFn = (context: { config: AnyConfig; projectRoot: string }) => AnyConfig;
type Plugin = (config: AnyConfig, props?: unknown) => AnyConfig;

const load = createRequire(import.meta.url);
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appConfig = load("../app.config.js") as ConfigFn;
const withoutPushEntitlement = load("../plugins/withoutPushEntitlement.js") as Plugin;
const withAppleSignInSwitch = load("../plugins/withAppleSignInSwitch.js") as Plugin;
const appleAuthModule = load("expo-apple-authentication/app.plugin.js") as Plugin | { default: Plugin };
const withAppleAuth: Plugin =
  typeof appleAuthModule === "function" ? appleAuthModule : appleAuthModule.default;
// An ES module compiled to CommonJS: the plugin is its default export, which
// Expo's own plugin resolver unwraps the same way.
const notificationsModule = load("expo-notifications/app.plugin.js") as
  | Plugin
  | { default: Plugin };
const withNotifications: Plugin =
  typeof notificationsModule === "function" ? notificationsModule : notificationsModule.default;
const appJson = load("../app.json") as { expo: AnyConfig };

const ENV_KEYS = ["HASIO_IOS_APPLE_SIGNIN", "HASIO_IOS_PUSH", "HASIO_ANDROID_PUSH", "EAS_BUILD_PROFILE", "EAS_BUILD_PLATFORM"];
let savedEnv: Record<string, string | undefined> = {};
let emptyRoot: string;
let firebaseRoot: string;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hasio-config-"));
  firebaseRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hasio-config-fb-"));
  fs.writeFileSync(path.join(firebaseRoot, "google-services.json"), "{}");
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  fs.rmSync(emptyRoot, { recursive: true, force: true });
  fs.rmSync(firebaseRoot, { recursive: true, force: true });
});

/** What Expo passes: a fresh copy of app.json's `expo` object. */
function evaluate(projectRoot = emptyRoot): AnyConfig {
  return appConfig({ config: structuredClone(appJson.expo), projectRoot });
}

function pluginEntry(config: AnyConfig, name: string): [string, AnyConfig | undefined] | undefined {
  const entry = (config.plugins as unknown[]).find(
    (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === name
  );
  if (entry === undefined) return undefined;
  return Array.isArray(entry) ? [entry[0], entry[1]] : [entry as string, undefined];
}

describe("app.config.js keeps app.json as it is", () => {
  it("keeps the identity, version and update fields", () => {
    const config = evaluate();
    for (const key of ["name", "slug", "version", "sdkVersion", "runtimeVersion", "updates", "scheme", "owner"]) {
      expect(config[key]).toEqual(appJson.expo[key]);
    }
    expect(config.version).toBe("1.1.0");
    expect(config.ios).toEqual(appJson.expo.ios);
    expect(config.android.package).toBe("com.hasio.travel");
    expect(config.extra.eas.projectId).toBe("8859775e-cedf-45b7-aa94-3c7cbfb7be12");
  });

  it("keeps every plugin from app.json, in order", () => {
    const names = (config: AnyConfig) =>
      (config.plugins as unknown[]).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
    const before = names(appJson.expo);
    const after = names(evaluate());
    expect(after.filter((name) => before.includes(name))).toEqual(before);
  });

  it("keeps the other props of the plugins it changes", () => {
    const config = evaluate();
    const splash = pluginEntry(config, "expo-splash-screen")?.[1];
    expect(splash).toMatchObject({ image: "./assets/icon-ios-1024.png", imageWidth: 200 });
    const picker = pluginEntry(config, "expo-image-picker")?.[1];
    expect(picker).toMatchObject({ cameraPermission: false, microphonePermission: false });
  });
});

describe("app.config.js store-build fixes", () => {
  it("is light only, system bars included", () => {
    const config = evaluate();
    expect(config.userInterfaceStyle).toBe("light");
    expect(config.android.userInterfaceStyle).toBe("light");
    expect(config.ios.userInterfaceStyle).toBe("light");
    expect(pluginEntry(config, "expo-system-ui")).toBeDefined();
  });

  it("asks for no Face ID permission", () => {
    expect(pluginEntry(evaluate(), "expo-secure-store")?.[1]).toEqual({ faceIDPermission: false });
  });

  it("puts the splash image on its own background colour", () => {
    expect(pluginEntry(evaluate(), "expo-splash-screen")?.[1]?.backgroundColor).toBe("#FFFFFF");
  });

  it("says why it wants photos in both languages", () => {
    const text: string = pluginEntry(evaluate(), "expo-image-picker")?.[1]?.photosPermission;
    expect(text).toContain("Hasio uses your photo library");
    expect(text).toContain("يستخدم Hasio مكتبة الصور");
    expect(text).not.toContain("هاسيو");
  });

  it("points the icons and the notification icon at files that exist", () => {
    const config = evaluate();
    const icon = config.android.adaptiveIcon;
    expect(icon.backgroundColor).toBe("#FFFFFF");
    for (const file of [
      icon.foregroundImage,
      icon.monochromeImage,
      pluginEntry(config, "expo-notifications")?.[1]?.icon,
    ]) {
      expect(fs.existsSync(path.join(APP_ROOT, file))).toBe(true);
    }
  });

  it("names the channel the server sends to", () => {
    expect(pluginEntry(evaluate(), "expo-notifications")?.[1]).toMatchObject({
      defaultChannel: "default",
      color: "#4F5E10",
    });
  });
});

describe("app.config.js push switches", () => {
  it("lists the entitlement plugin first, before every other plugin", () => {
    expect(evaluate().plugins[0]).toBe("./plugins/withoutPushEntitlement");
  });

  it("tells the app which platforms this build can receive push on", () => {
    expect(evaluate().extra.push).toEqual({ ios: true, android: false });
    process.env.HASIO_IOS_PUSH = "off";
    expect(evaluate().extra.push).toEqual({ ios: false, android: false });
    delete process.env.HASIO_IOS_PUSH;
    expect(evaluate(firebaseRoot).extra.push).toEqual({ ios: true, android: true });
    process.env.HASIO_ANDROID_PUSH = "off";
    expect(evaluate(firebaseRoot).extra.push).toEqual({ ios: true, android: false });
  });

  it("uses google-services.json only when it is there", () => {
    expect(evaluate().android.googleServicesFile).toBeUndefined();
    expect(evaluate(firebaseRoot).android.googleServicesFile).toBe("./google-services.json");
  });

  it("stops a production Android build without Firebase", () => {
    process.env.EAS_BUILD_PROFILE = "production";
    expect(() => evaluate()).toThrow(/google-services\.json is missing/);
    process.env.EAS_BUILD_PLATFORM = "android";
    expect(() => evaluate()).toThrow(/HASIO_ANDROID_PUSH=off/);
  });

  it("lets it through when push is switched off on purpose, or the file is there", () => {
    process.env.EAS_BUILD_PROFILE = "production";
    expect(() => evaluate(firebaseRoot)).not.toThrow();
    process.env.HASIO_ANDROID_PUSH = "off";
    expect(() => evaluate()).not.toThrow();
  });

  it("never stops an iOS build, a test build, or a command run on this PC", () => {
    process.env.EAS_BUILD_PROFILE = "production";
    process.env.EAS_BUILD_PLATFORM = "ios";
    expect(() => evaluate()).not.toThrow();
    delete process.env.EAS_BUILD_PLATFORM;
    process.env.EAS_BUILD_PROFILE = "preview";
    expect(() => evaluate()).not.toThrow();
    delete process.env.EAS_BUILD_PROFILE;
    expect(() => evaluate()).not.toThrow();
  });

  it("signs for the APNs environment of the build's profile", () => {
    // With Firebase in place, so the production case is not stopped by the
    // Android check above.
    const mode = () => pluginEntry(evaluate(firebaseRoot), "expo-notifications")?.[1]?.mode;
    expect(mode()).toBe("production");
    process.env.EAS_BUILD_PROFILE = "development";
    expect(mode()).toBe("development");
    process.env.EAS_BUILD_PROFILE = "simulator";
    expect(mode()).toBe("development");
    process.env.EAS_BUILD_PROFILE = "production";
    expect(mode()).toBe("production");
  });
});

/**
 * Runs the iOS entitlements mods the way prebuild does, from the outermost
 * (last registered) to the innermost, and returns the entitlements.
 */
async function entitlementsAfter(plugins: [Plugin, unknown][]): Promise<AnyConfig> {
  return iosModAfter(plugins, "entitlements");
}

async function iosModAfter(
  plugins: [Plugin, unknown][],
  modName: "entitlements" | "infoPlist"
): Promise<AnyConfig> {
  let config: AnyConfig = { name: "Hasio", slug: "hasio", _internal: { projectRoot: APP_ROOT } };
  for (const [plugin, props] of plugins) config = plugin(config, props);
  const run = config.mods?.ios?.[modName];
  if (!run) return {};
  const result = await run({
    ...config,
    modResults: {},
    modRequest: {
      projectRoot: APP_ROOT,
      platformProjectRoot: path.join(APP_ROOT, "ios"),
      modName,
      platform: "ios",
      introspect: true,
    },
  });
  return result.modResults;
}

describe("plugins/withoutPushEntitlement.js", () => {
  const listed: [Plugin, unknown][] = [
    [withoutPushEntitlement, undefined],
    [withNotifications, { mode: "production" }],
  ];

  it("leaves the entitlement expo-notifications adds while push is on", async () => {
    expect(await entitlementsAfter(listed)).toEqual({ "aps-environment": "production" });
  });

  it("removes it with HASIO_IOS_PUSH=off, listed before expo-notifications", async () => {
    process.env.HASIO_IOS_PUSH = "off";
    expect(await entitlementsAfter(listed)).toEqual({});
  });

  it("would remove nothing listed after it — the reason it goes first", async () => {
    process.env.HASIO_IOS_PUSH = "off";
    const reversed: [Plugin, unknown][] = [listed[1], listed[0]];
    expect(await entitlementsAfter(reversed)).toEqual({ "aps-environment": "production" });
  });
});

describe("app.config.js Sign in with Apple switch", () => {
  it("lists the switch before expo-apple-authentication, so it acts after it", () => {
    const names = (evaluate().plugins as unknown[]).map((p) => (Array.isArray(p) ? p[0] : p));
    const at = names.indexOf("./plugins/withAppleSignInSwitch");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(names.indexOf("expo-apple-authentication"));
  });

  it("tells the app whether this build can sign in with Apple", () => {
    expect(evaluate().extra.appleSignIn).toBe(true);
    process.env.HASIO_IOS_APPLE_SIGNIN = "off";
    expect(evaluate().extra.appleSignIn).toBe(false);
  });
});

describe("plugins/withAppleSignInSwitch.js", () => {
  const listed: [Plugin, unknown][] = [
    [withAppleSignInSwitch, undefined],
    [withAppleAuth, undefined],
  ];

  it("keeps the Sign in with Apple entitlement while the switch is on", async () => {
    expect(await entitlementsAfter(listed)).toEqual({ "com.apple.developer.applesignin": ["Default"] });
  });

  it("removes it with HASIO_IOS_APPLE_SIGNIN=off, so the build signs without the capability", async () => {
    process.env.HASIO_IOS_APPLE_SIGNIN = "off";
    expect(await entitlementsAfter(listed)).toEqual({});
  });

  it("never lets the plugin mark the app as taking the phone's language", async () => {
    // CFBundleAllowMixedLocalizations would make an iPhone set to Arabic lay
    // the app out right to left natively, on top of the app's own mirroring.
    const plist = await iosModAfter(listed, "infoPlist");
    expect(plist.CFBundleAllowMixedLocalizations).toBeUndefined();
  });
});

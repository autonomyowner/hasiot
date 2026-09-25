import { describe, expect, it } from "vitest";
import {
  ASK_AGAIN_AFTER_MS,
  PROMPT_REQUEST_TTL_MS,
  isPromptRequestFresh,
  isPushUnsupportedError,
  permissionGranted,
  pushAvailableFor,
  pushRowState,
  shouldOfferPush,
  snapshotOf,
  type PermissionSnapshot,
} from "./pushDecision";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 25, 9, 0, 0);

const undetermined: PermissionSnapshot = { status: "undetermined", canAskAgain: true };
const granted: PermissionSnapshot = { status: "granted", canAskAgain: true };
const deniedOnce: PermissionSnapshot = { status: "denied", canAskAgain: true };
const deniedForGood: PermissionSnapshot = { status: "denied", canAskAgain: false };

describe("pushAvailableFor — can this build, on this device, receive push at all", () => {
  const both = { ios: true, android: true };

  it("is true on a phone whose build has push for its platform", () => {
    expect(pushAvailableFor({ os: "ios", isDevice: true, flags: both })).toBe(true);
    expect(pushAvailableFor({ os: "android", isDevice: true, flags: both })).toBe(true);
  });

  it("follows the flag of the phone's own platform only", () => {
    // An iOS build made with HASIO_IOS_PUSH=off has no aps-environment.
    expect(pushAvailableFor({ os: "ios", isDevice: true, flags: { ios: false, android: true } })).toBe(false);
    // An Android build without google-services.json has no Firebase.
    expect(pushAvailableFor({ os: "android", isDevice: true, flags: { ios: true, android: false } })).toBe(false);
  });

  it("is false when the build says nothing: never promise what may not arrive", () => {
    expect(pushAvailableFor({ os: "ios", isDevice: true, flags: undefined })).toBe(false);
    expect(pushAvailableFor({ os: "android", isDevice: true, flags: null })).toBe(false);
    expect(pushAvailableFor({ os: "ios", isDevice: true, flags: {} })).toBe(false);
    // Only a real boolean counts.
    expect(pushAvailableFor({ os: "ios", isDevice: true, flags: { ios: "true" } })).toBe(false);
    expect(pushAvailableFor({ os: "ios", isDevice: true, flags: "yes" })).toBe(false);
  });

  it("is false on simulators, emulators and the web", () => {
    expect(pushAvailableFor({ os: "ios", isDevice: false, flags: both })).toBe(false);
    expect(pushAvailableFor({ os: "android", isDevice: false, flags: both })).toBe(false);
    expect(pushAvailableFor({ os: "web", isDevice: true, flags: both })).toBe(false);
    expect(pushAvailableFor({ os: "ios", isDevice: undefined, flags: both })).toBe(false);
  });
});

describe("snapshotOf and permissionGranted", () => {
  it("keeps the status and whether the system will ask again", () => {
    expect(snapshotOf({ status: "undetermined", granted: false, canAskAgain: true })).toEqual(
      undetermined
    );
    expect(snapshotOf({ status: "denied", granted: false, canAskAgain: false })).toEqual(
      deniedForGood
    );
    expect(snapshotOf({ status: "granted", granted: true, canAskAgain: true })).toEqual(granted);
  });

  it("counts iOS provisional and ephemeral authorisation as granted", () => {
    // IosAuthorizationStatus: 2 authorized, 3 provisional, 4 ephemeral.
    expect(
      snapshotOf({ status: "undetermined", granted: false, canAskAgain: true, ios: { status: 3 } })
        .status
    ).toBe("granted");
    expect(
      snapshotOf({ status: "denied", granted: false, canAskAgain: false, ios: { status: 4 } }).status
    ).toBe("granted");
    expect(
      snapshotOf({ status: "denied", granted: false, canAskAgain: false, ios: { status: 1 } }).status
    ).toBe("denied");
  });

  it("reads anything unexpected as not decided", () => {
    expect(snapshotOf({ status: "weird", granted: false, canAskAgain: true }).status).toBe(
      "undetermined"
    );
  });

  it("permissionGranted is the granted status", () => {
    expect(permissionGranted(granted)).toBe(true);
    expect(permissionGranted(undetermined)).toBe(false);
    expect(permissionGranted(deniedOnce)).toBe(false);
  });
});

describe("shouldOfferPush — the in-context ask (design D14)", () => {
  const base = { available: true, signedIn: true, permission: undetermined, lastAskedAt: null, now: NOW };

  it("asks a signed-in person who has never been asked", () => {
    expect(shouldOfferPush(base)).toBe(true);
  });

  it("never asks when the build cannot receive push, or nobody is signed in", () => {
    expect(shouldOfferPush({ ...base, available: false })).toBe(false);
    expect(shouldOfferPush({ ...base, signedIn: false })).toBe(false);
  });

  it("never asks once the system permission is granted or refused for good", () => {
    expect(shouldOfferPush({ ...base, permission: granted })).toBe(false);
    expect(shouldOfferPush({ ...base, permission: deniedForGood })).toBe(false);
  });

  it("may ask again after an Android refusal that the system will still re-ask", () => {
    expect(shouldOfferPush({ ...base, permission: deniedOnce, lastAskedAt: NOW - 8 * DAY })).toBe(true);
  });

  it("waits seven days between asks", () => {
    expect(shouldOfferPush({ ...base, lastAskedAt: NOW - 3 * DAY })).toBe(false);
    expect(shouldOfferPush({ ...base, lastAskedAt: NOW - ASK_AGAIN_AFTER_MS + 1 })).toBe(false);
    expect(shouldOfferPush({ ...base, lastAskedAt: NOW - ASK_AGAIN_AFTER_MS })).toBe(true);
    expect(shouldOfferPush({ ...base, lastAskedAt: NOW - 30 * DAY })).toBe(true);
  });

  it("does not stall for weeks when the clock was set back past the last ask", () => {
    expect(shouldOfferPush({ ...base, lastAskedAt: NOW + 2 * DAY })).toBe(true);
  });

  it("asks at once from the Settings row, which is the person asking", () => {
    expect(shouldOfferPush({ ...base, lastAskedAt: NOW - DAY, manual: true })).toBe(true);
    // …but still not when there is nothing the prompt could do.
    expect(shouldOfferPush({ ...base, permission: granted, manual: true })).toBe(false);
    expect(shouldOfferPush({ ...base, permission: deniedForGood, manual: true })).toBe(false);
    expect(shouldOfferPush({ ...base, available: false, manual: true })).toBe(false);
  });
});

describe("pushRowState — what the Settings row says", () => {
  it("is on when granted", () => {
    expect(pushRowState(granted)).toBe("on");
  });

  it("is off while the app may still ask", () => {
    expect(pushRowState(undetermined)).toBe("off");
    expect(pushRowState(deniedOnce)).toBe("off");
  });

  it("is blocked when only the system settings can turn it on", () => {
    expect(pushRowState(deniedForGood)).toBe("blocked");
  });
});

describe("isPromptRequestFresh", () => {
  it("keeps a waiting prompt for a few minutes, then lets it go", () => {
    expect(isPromptRequestFresh(NOW - 60_000, NOW)).toBe(true);
    expect(isPromptRequestFresh(NOW - PROMPT_REQUEST_TTL_MS, NOW)).toBe(true);
    expect(isPromptRequestFresh(NOW - PROMPT_REQUEST_TTL_MS - 1, NOW)).toBe(false);
  });
});

describe("isPushUnsupportedError — failures no retry will fix", () => {
  it("recognises an iOS build without the push entitlement", () => {
    expect(
      isPushUnsupportedError(
        new Error("no valid “aps-environment” entitlement string found for application")
      )
    ).toBe(true);
    expect(isPushUnsupportedError("no valid 'aps-environment' entitlement string found")).toBe(true);
  });

  it("recognises an Android build without Firebase, and a phone without Google services", () => {
    expect(
      isPushUnsupportedError(
        new Error(
          "Default FirebaseApp is not initialized in this process com.hasio.travel. Make sure to call FirebaseApp.initializeApp(Context) first."
        )
      )
    ).toBe(true);
    expect(isPushUnsupportedError(new Error("java.io.IOException: MISSING_INSTANCEID_SERVICE"))).toBe(
      true
    );
  });

  it("leaves transient failures to the next attempt", () => {
    expect(isPushUnsupportedError(new Error("java.io.IOException: SERVICE_NOT_AVAILABLE"))).toBe(false);
    expect(isPushUnsupportedError(new Error("Network request failed"))).toBe(false);
    expect(isPushUnsupportedError(new Error("timed out"))).toBe(false);
    expect(isPushUnsupportedError(undefined)).toBe(false);
  });
});

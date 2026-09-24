import type { TranslationKey } from "@/constants/translations";

/**
 * A refused sign-in, in words the guest can act on.
 *
 * What was wrong: the mapper that lived in lib/auth.ts guessed from the English
 * message with a few regexes written for email sign-in, so every phone failure
 * landed on an email one. "Invalid OTP" matched /invalid/ and a mistyped code
 * said "Incorrect email or password"; "Phone number already exists" matched
 * /already exists/ and said "An account with this email already exists"; an
 * expired code and the attempt limit matched nothing and said "Something went
 * wrong" — under a title that also said "Something went wrong".
 *
 * Better Auth sends a machine-readable `code` with every refusal, and
 * lib/auth.ts now keeps it, with the HTTP status, on the error it throws. So the
 * code decides first, the status second, and the old message matching comes
 * last — rewritten so that even without a code a phone failure can no longer
 * fall into the email branches.
 *
 * One trap in the codes: better-call derives the wire `code` from the message
 * text (upper-cased, spaces to underscores), not from the constant's name. The
 * phone plugin's PHONE_NUMBER_EXIST ("Phone number already exists") therefore
 * arrives as PHONE_NUMBER_ALREADY_EXISTS. Both spellings are listed, so a
 * Better Auth upgrade that starts sending the constant's own name still works.
 *
 * Pure, so it is tested under plain Node (lib/authErrors.test.ts).
 */

type Copy = { title: TranslationKey; message: TranslationKey };

/**
 * The title and message for each kind of failure. Never the same string twice:
 * a dialog that says "Something went wrong" in bold and then again underneath
 * has told the guest nothing.
 */
export const AUTH_ERROR_COPY = {
  codeWrong: { title: "authCodeWrongTitle", message: "authCodeWrong" },
  codeExpired: { title: "authCodeExpiredTitle", message: "authCodeExpired" },
  tooManyAttempts: { title: "authTooManyAttemptsTitle", message: "authTooManyAttempts" },
  phoneTaken: { title: "authPhoneTakenTitle", message: "authPhoneTaken" },
  invalidPhone: { title: "authCheckNumberTitle", message: "invalidPhone" },
  rateLimited: { title: "authTooManyRequestsTitle", message: "authTooManyRequests" },
  wrongCredentials: { title: "authSignInFailedTitle", message: "wrongCredentials" },
  invalidEmail: { title: "authSignInFailedTitle", message: "invalidEmail" },
  accountNotFound: { title: "authSignInFailedTitle", message: "accountNotFound" },
  emailTaken: { title: "authSignInFailedTitle", message: "emailAlreadyExists" },
  sessionExpired: { title: "authSessionExpiredTitle", message: "errorSessionExpired" },
  network: { title: "authOfflineTitle", message: "networkError" },
  unknown: { title: "error", message: "pleaseTryAgain" },
  // `as const` keeps each value its literal key rather than widening it to
  // string; `satisfies` then checks every one is a real translation key.
} as const satisfies Record<string, Copy>;

export type AuthErrorKind = keyof typeof AUTH_ERROR_COPY;

export const AUTH_ERROR_KINDS = Object.keys(AUTH_ERROR_COPY) as AuthErrorKind[];

interface Refusal {
  status?: number;
  code?: string;
  message: string;
  /** fetch rejects with a TypeError when a request never got an answer. */
  noAnswer: boolean;
}

function read(error: unknown): Refusal {
  const e = (error ?? {}) as { status?: unknown; code?: unknown; message?: unknown };
  return {
    status: typeof e.status === "number" ? e.status : undefined,
    code: typeof e.code === "string" ? e.code.toUpperCase() : undefined,
    message:
      typeof e.message === "string" ? e.message : typeof error === "string" ? error : "",
    // No network, DNS, or lib/auth.ts's own timeout, which rejects with a
    // TypeError on purpose so it lands here.
    noAnswer: error instanceof TypeError,
  };
}

function kindFromCode(code: string | undefined, status: number | undefined): AuthErrorKind | null {
  switch (code) {
    case "INVALID_OTP":
      return "codeWrong";
    // NOT_FOUND is what a code that was already used, or already burned by
    // too many attempts, looks like: the server deleted it.
    case "OTP_EXPIRED":
    case "OTP_NOT_FOUND":
      return "codeExpired";
    case "TOO_MANY_ATTEMPTS":
      return "tooManyAttempts";
    case "PHONE_NUMBER_ALREADY_EXISTS":
    case "PHONE_NUMBER_EXIST":
      return "phoneTaken";
    case "INVALID_PHONE_NUMBER":
      return "invalidPhone";
    case "OTP_RATE_LIMITED":
    case "TOO_MANY_REQUESTS":
      return "rateLimited";
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
      return "wrongCredentials";
    case "INVALID_EMAIL":
      return "invalidEmail";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "emailTaken";
    case "SESSION_EXPIRED":
    case "NOT_SIGNED_IN":
      return "sessionExpired";
    // Attaching a number with no session behind the request answers 401
    // USER_NOT_FOUND: the account is fine, the sign-in has gone.
    case "USER_NOT_FOUND":
      return status === 401 ? "sessionExpired" : "accountNotFound";
    default:
      return null;
  }
}

/** Last resort, for an error that carries no code. Code failures first. */
function kindFromMessage(message: string): AuthErrorKind | null {
  const m = message.toLowerCase();
  const aboutTheCode = /\b(otp|code)\b/.test(m);
  if (aboutTheCode && /(invalid|incorrect|wrong)/.test(m)) return "codeWrong";
  if (aboutTheCode && /(expired|not found)/.test(m)) return "codeExpired";
  if (/too many attempts/.test(m)) return "tooManyAttempts";
  if (/phone number already exists/.test(m)) return "phoneTaken";
  if (/too many (requests|codes)/.test(m)) return "rateLimited";
  if (/network|fetch|econnrefused|timeout|timed out/.test(m)) return "network";
  if (/invalid phone/.test(m)) return "invalidPhone";
  if (/invalid email or password|invalid credentials|incorrect (email|password)/.test(m)) {
    return "wrongCredentials";
  }
  if (/no account|no user|user not found/.test(m)) return "accountNotFound";
  if (/already exists|already registered/.test(m)) return "emailTaken";
  return null;
}

/** Which failure this is: the code first, then the status, then the words. */
export function getAuthErrorKind(error: unknown): AuthErrorKind {
  const { status, code, message, noAnswer } = read(error);

  const byCode = kindFromCode(code, status);
  if (byCode) return byCode;

  // Better Auth's own limiter answers 429 with no code at all.
  if (status === 429) return "rateLimited";
  if (noAnswer) return "network";

  const byMessage = kindFromMessage(message);
  if (byMessage) return byMessage;

  // The statuses the email path has always relied on.
  if (status === 401) return "wrongCredentials";
  if (status === 404) return "accountNotFound";
  if (status === 422) return "emailTaken";

  return "unknown";
}

/**
 * The message key for a failure. Kept for the callers that only ever wanted a
 * single line (it used to live in lib/auth.ts, which still re-exports it).
 */
export function getAuthErrorKey(error: unknown): TranslationKey {
  return AUTH_ERROR_COPY[getAuthErrorKind(error)].message;
}

/**
 * The failures that belong to the code the guest just typed. The screens show
 * these under the code field, where the guest is already looking, and keep the
 * keyboard up so they can simply type again — rather than a dialog that takes
 * the keyboard away and hands it back one tap later.
 */
export function isCodeStepError(kind: AuthErrorKind): boolean {
  return kind === "codeWrong" || kind === "codeExpired" || kind === "tooManyAttempts";
}

const ARABIC_LETTER = /[؀-ۿ]/;
const LATIN_LETTER = /[A-Za-z]/;

/**
 * One language out of the server's house style: "عربي / English", Arabic first,
 * one spaced slash. The server throws both because it cannot know the reader's
 * language; the app does. Null for anything not in that shape.
 */
export function pickLanguageHalf(text: string, language: "ar" | "en"): string | null {
  const at = text.indexOf(" / ");
  if (at < 0) return null;
  const arabic = text.slice(0, at).trim();
  const english = text.slice(at + 3).trim();
  if (!ARABIC_LETTER.test(arabic) || !LATIN_LETTER.test(english) || ARABIC_LETTER.test(english)) {
    return null;
  }
  return language === "ar" ? arabic : english;
}

export interface AuthErrorDescription {
  kind: AuthErrorKind;
  title: TranslationKey;
  message: TranslationKey;
  /**
   * The server's own sentence in the reader's language, when it wrote one for
   * people — the OTP budget says so in both languages. Show it instead of
   * `message` when present.
   */
  serverText: string | null;
}

/** Everything a screen needs to explain a failure. */
export function describeAuthError(error: unknown, language: "ar" | "en"): AuthErrorDescription {
  const kind = getAuthErrorKind(error);
  const { title, message } = AUTH_ERROR_COPY[kind];
  // Only where the app's copy is generic: a known failure keeps the words
  // written for the screen it appears on.
  const serverText =
    kind === "rateLimited" || kind === "unknown"
      ? pickLanguageHalf(read(error).message, language)
      : null;
  return { kind, title, message, serverText };
}

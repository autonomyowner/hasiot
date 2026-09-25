import { appAlert } from "@/stores/dialogStore";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type AccessibilityActionEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/backend";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { matchPlaces, messageContent, type NamedListing } from "@/lib/plannerChat";
import { serverErrorText } from "@/lib/serverError";
import type { TranslationKey } from "@/constants/translations";
import type { ChatMessage, Language } from "@/types";
import { PlanCard, type PlanPlace } from "./PlanCard";

/**
 * One time formatter per language, made once.
 *
 * Every bubble used to call `toLocaleTimeString([])` on every render — with the
 * device's locale rather than the app's, so an English phone showed "10:05 AM"
 * under Arabic text — and every keystroke in the composer re-rendered every
 * bubble. Arabic keeps Latin digits (`nu-latn`), as the rest of the app does.
 */
const timeFormatters = new Map<Language, Intl.DateTimeFormat>();

function formatTime(iso: string, language: Language): string {
  let formatter = timeFormatters.get(language);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
    try {
      formatter = new Intl.DateTimeFormat(language === "ar" ? "ar-SA-u-nu-latn" : "en-GB", options);
    } catch {
      formatter = new Intl.DateTimeFormat(undefined, options);
    }
    timeFormatters.set(language, formatter);
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
}

/**
 * The server's two ways of saying "not signed in": the English-only one the
 * older functions throw, and the bilingual one the newer ones do. Either means
 * the session has lapsed, not that the report failed.
 */
function isSignInRefusal(error: unknown): boolean {
  const text = serverErrorText(error);
  return text.includes("Not authenticated") || text.includes("You need to be signed in.");
}

interface ChatBubbleProps {
  message: ChatMessage;
  isRTL: boolean;
  language: Language;
  t: (key: TranslationKey) => string;
  /** The public listings under their names, for matching a plan's places. */
  placeIndex?: ReadonlyMap<string, NamedListing>;
  onOpenPlace?: (listingId: string) => void;
  onRetry?: (messageId: string) => void;
}

/**
 * Memoised, and every callback it is handed is stable: typing in the composer
 * re-renders the screen on every keystroke, and used to re-render every bubble
 * in the conversation with it.
 */
export const ChatBubble = memo(function ChatBubble({
  message,
  isRTL,
  language,
  t,
  placeIndex,
  onOpenPlace,
  onRetry,
}: ChatBubbleProps) {
  const styles = useThemedStyles(makeStyles);
  const isUser = message.isUser;
  const [showReport, setShowReport] = useState(false);
  // A finished plan gets the full width: PlanCard is a card, not a bubble.
  const plan = !isUser ? message.plan : undefined;

  // The places the plan names that the app has a page for, in the reader's
  // language — the listing's own Arabic name, not the planner's spelling.
  const destinations = plan?.destinations;
  const places = useMemo<PlanPlace[]>(() => {
    if (!destinations || !placeIndex) return [];
    return matchPlaces(destinations, placeIndex).map((listing) => ({
      id: listing._id,
      label: language === "ar" ? listing.name_ar || listing.name_en : listing.name_en,
    }));
  }, [destinations, placeIndex, language]);

  const toggleReport = useCallback(() => setShowReport((open) => !open), []);

  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const reportContent = useMutation(api.moderation.mutations.reportContent);
  // Two taps inside one frame would both find nothing in flight in state.
  const reporting = useRef(false);

  // The report is recorded (targetType "ai_message", 1.1.0). It used to thank
  // the guest and send nothing, because the backend had no report type for a
  // planner reply. The conversation lives only on this phone, so the reply's
  // own words travel with the report — a plan's itinerary, tips and budget, as
  // the card shows them — and the thanks come only once the server has it.
  const reportedId = message.id;
  const reportedText = messageContent(message);
  const sendReport = useCallback(async () => {
    if (reporting.current) return;
    reporting.current = true;
    try {
      const result = await reportContent({
        targetType: "ai_message",
        targetId: reportedId,
        // What the confirmation asks: "…for containing inappropriate content?"
        reason: "inappropriate",
        details: reportedText,
      });
      appAlert(
        t("thankYou"),
        result.alreadyReported ? t("reportAlreadySubmitted") : t("reportReceived")
      );
    } catch (error) {
      appAlert(t("error"), t(isSignInRefusal(error) ? "errorSessionExpired" : "reportFailed"));
    } finally {
      reporting.current = false;
    }
  }, [reportContent, reportedId, reportedText, t]);

  // A report belongs to an account. A guest planning signed out is offered the
  // way in, rather than a confirmation that could only fail.
  const confirmReport = useCallback(() => {
    if (!isAuthenticated) {
      appAlert(t("reportMessage"), t("reportSignInRequired"), [
        { text: t("cancel"), style: "cancel", onPress: () => setShowReport(false) },
        {
          text: t("signIn"),
          onPress: () => {
            setShowReport(false);
            router.push("/auth");
          },
        },
      ]);
      return;
    }
    appAlert(t("reportMessage"), t("reportConfirm"), [
      { text: t("cancel"), style: "cancel", onPress: () => setShowReport(false) },
      {
        text: t("report"),
        style: "destructive",
        onPress: () => {
          setShowReport(false);
          void sendReport();
        },
      },
    ]);
  }, [isAuthenticated, router, sendReport, t]);

  // The long-press that reveals Report cannot be found with a screen reader,
  // so the same thing is offered as an action on the bubble.
  const accessibilityActions = useMemo(
    () => (isUser ? undefined : [{ name: "report", label: t("report") }]),
    [isUser, t]
  );
  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === "report") confirmReport();
    },
    [confirmReport]
  );

  const messageId = message.id;
  const handleRetry = useCallback(() => onRetry?.(messageId), [onRetry, messageId]);

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.botContainer,
        plan && styles.planContainer,
        isRTL && (isUser ? styles.userContainerRTL : styles.botContainerRTL),
      ]}
    >
      {!isUser && <BotAvatar isRTL={isRTL} />}
      <View style={styles.bubbleWrapper}>
        <Pressable
          onLongPress={isUser ? undefined : toggleReport}
          // A plan card has buttons of its own (Share, its places). Made one
          // accessible element with the card, they would be unreachable.
          accessible={!plan}
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={isUser ? undefined : handleAccessibilityAction}
          style={
            plan
              ? undefined
              : [
                  styles.bubble,
                  isUser ? styles.userBubble : styles.botBubble,
                  isRTL && (isUser ? styles.userBubbleRTL : styles.botBubbleRTL),
                  // Held to its own side, so a meta row wider than a short
                  // bubble — "Something went wrong · Retry" under "Hi" —
                  // widens the row instead of stretching the bubble.
                  isUser !== isRTL ? styles.selfEnd : styles.selfStart,
                  message.failed && styles.failedBubble,
                ]
          }
        >
          {plan ? (
            <PlanCard
              plan={plan}
              isRTL={isRTL}
              t={t}
              places={places}
              onOpenPlace={onOpenPlace}
            />
          ) : (
            <Text
              style={[
                styles.text,
                isUser ? styles.userText : styles.botText,
                isRTL && styles.textRTL,
              ]}
            >
              {message.text}
            </Text>
          )}
        </Pressable>

        {/* Under the bubble, on its outer edge — the guest's side for their own
            turns, the planner's side for its replies — in reading order. The
            row used to sit on the left whatever the language or the sender. */}
        <View
          style={[
            styles.meta,
            isRTL && styles.metaRTL,
            isUser ? styles.metaEnd : styles.metaStart,
          ]}
        >
          {message.failed ? (
            <>
              <View style={[styles.failedNote, isRTL && styles.metaRTL]}>
                <Feather name="alert-circle" size={13} color={colors.signOut} />
                <Text style={styles.failedText}>{t("somethingWentWrong")}</Text>
              </View>
              {onRetry && (
                <Pressable
                  onPress={handleRetry}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.chip,
                    isRTL && styles.metaRTL,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("retry")}
                >
                  <Feather name="rotate-cw" size={12} color={colors.ink} />
                  <Text style={styles.chipText}>{t("retry")}</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Text style={styles.timestamp}>{formatTime(message.timestamp, language)}</Text>
          )}

          {!isUser && showReport && (
            <Pressable
              onPress={confirmReport}
              hitSlop={8}
              style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("reportMessage")}
            >
              <Text style={styles.reportButtonText}>{t("report")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
});

/**
 * The planner's avatar, shared with the typing indicator: the dots used to sit
 * where the reply's text would start, so the reply jumped sideways by an
 * avatar's width when it replaced them.
 */
export function BotAvatar({ isRTL }: { isRTL: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.avatarContainer, isRTL && styles.avatarContainerRTL]}>
      <View style={styles.botAvatar}>
        <Feather name="compass" size={14} color={colors.ink} />
      </View>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    marginBottom: 10,
    maxWidth: "85%",
    flexDirection: "row",
  },
  planContainer: {
    maxWidth: "100%",
  },
  userContainer: {
    alignSelf: "flex-end",
  },
  botContainer: {
    alignSelf: "flex-start",
  },
  userContainerRTL: {
    alignSelf: "flex-start",
    flexDirection: "row-reverse",
  },
  botContainerRTL: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  avatarContainer: {
    marginRight: 8,
    marginTop: 4,
  },
  // row-reverse puts the avatar on the right, so the gap has to move with it.
  avatarContainerRTL: {
    marginRight: 0,
    marginLeft: 8,
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.DEFAULT,
    justifyContent: "center",
    alignItems: "center",
  },
  bubbleWrapper: {
    flex: 1,
  },
  bubble: {
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  // Ink rather than lime: lime is a fill for chips and the send button, and
  // white on it is unreadable anyway.
  userBubble: {
    backgroundColor: colors.ink,
    borderBottomRightRadius: 6,
  },
  userBubbleRTL: {
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 6,
  },
  botBubble: {
    backgroundColor: colors.surface.DEFAULT,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  botBubbleRTL: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 6,
  },
  selfStart: {
    alignSelf: "flex-start",
  },
  selfEnd: {
    alignSelf: "flex-end",
  },
  // Not delivered: still readable, visibly not the same as a sent turn.
  failedBubble: {
    opacity: 0.72,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.1,
    fontFamily: fonts.regular,
  },
  userText: {
    color: "#FFFFFF",
    fontFamily: fonts.medium,
  },
  botText: {
    color: colors.ink,
  },
  textRTL: {
    textAlign: "right",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  metaRTL: {
    flexDirection: "row-reverse",
  },
  // In a row-reverse row these two swap edges, which is what puts a turn's
  // meta on its own side in both languages.
  metaStart: {
    justifyContent: "flex-start",
  },
  metaEnd: {
    justifyContent: "flex-end",
  },
  timestamp: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  failedNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  failedText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.signOut,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: colors.chip,
  },
  chipText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  reportButton: {
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: 11,
    backgroundColor: colors.chip,
    borderRadius: 14,
  },
  reportButtonText: {
    fontSize: 11.5,
    color: colors.signOut,
    fontFamily: fonts.semibold,
  },
  pressed: {
    opacity: 0.7,
  },
});

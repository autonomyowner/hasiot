import { appAlert } from "@/stores/dialogStore";
import React, { memo, useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  AccessibilityInfo,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  FadeInDown,
  FadeInUp,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import {
  KEYBOARD_EASING,
  KEYBOARD_TRAVEL_MS,
  useKeyboardTransition,
} from "@/hooks/useKeyboardVisible";
import { toLodging } from "@/hooks/useConvexData";
import { useAppStore } from "@/stores/appStore";
import { BotAvatar, ChatBubble } from "@/components/planner";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import { colors, type AppFonts } from "@/constants/colors";
import { ScreenGradient, SurfaceGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { TAB_BAR_HEIGHT } from "@/constants/layout";
import { Feather } from "@expo/vector-icons";
import { translations, type TranslationKey } from "@/constants/translations";
import { listingDetailItem } from "@/lib/listingDetail";
import { historyForModel, indexPlaces, type NamedListing } from "@/lib/plannerChat";
import type { ChatMessage, ChatPlan, Language } from "@/types";
import type { TabKey } from "@/app/(tabs)/_layout";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Two per row inside the chat's 16px side padding, with a 10px gutter.
const SUGGESTION_CARD_WIDTH = (Dimensions.get("window").width - 32 - 10) / 2;

// What the input rests on once the keyboard is carrying the safe area itself.
const INPUT_KEYBOARD_GAP = 10;

// Between the resting composer and the top of the tab bar. It used to rest on
// the scroll clearance every list reserves, which keeps content out of the
// bar's 64pt fade — so the composer sat 32pt up inside that fade and was
// washed out by it. The shell now fades the fade out on this tab, and the
// composer rests on the bar itself.
const COMPOSER_REST_GAP = 8;

const IS_ANDROID = Platform.OS === "android";

// A new turn fades up on its own. It used to wait `index * 50`ms first, so in a
// long conversation the newest message sat invisible for seconds — the fortieth
// for two of them.
const MESSAGE_ENTERING = FadeInUp.duration(250);

// Where a new reply's first line lands, below the top of the chat.
const REVEAL_MARGIN = 12;

type FeatherName = React.ComponentProps<typeof Feather>["name"];

type PlannerReply = FunctionReturnType<typeof api.travelPlanner.actions.planTravel>;

// All four are sent to the planner as a message; none navigates away, so the
// first thing a new user does stays inside the conversation.
const SUGGESTIONS: { key: TranslationKey; icon: FeatherName }[] = [
  { key: "suggestItinerary", icon: "map" },
  { key: "suggestHeritage", icon: "book-open" },
  { key: "suggestFamily", icon: "users" },
  { key: "suggestFood", icon: "coffee" },
];

// A random part as well as the time: ids used to be bare `Date.now()` strings,
// the reply's nudged by a millisecond, which is unique only as long as nothing
// else is created in that millisecond — and they are React keys, and now
// outlive the session on the device.
function newMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Whether a turn is still in the conversation — New chat, or signing out, can
// clear it while its reply is on the way.
function isStillInChat(id: string): boolean {
  return useAppStore.getState().chatMessages.some((m) => m.id === id);
}

/**
 * The planner's turn, from a successful reply — or null when there is nothing
 * to show, which the screen treats as a failure rather than posting an empty
 * bubble.
 *
 * A finished plan keeps its places, its disclaimer and its id: all three used
 * to be dropped here, so the card could not open the places it was built
 * around and the server's "check opening hours" note never reached anyone.
 */
function replyFrom(result: PlannerReply, language: Language): ChatMessage | null {
  const base = { id: newMessageId(), isUser: false, timestamp: new Date().toISOString() };
  if (result.ready && result.plan) {
    const p = result.plan;
    const ar = language === "ar";
    const itinerary = p.itinerary || result.message || "";
    const tips = (ar ? p.travelTips_ar || p.travelTips : p.travelTips) || undefined;
    const budget =
      (ar ? p.estimatedBudget_ar || p.estimatedBudget : p.estimatedBudget) || undefined;
    if (!itinerary && !tips && !budget) return null;
    const plan: ChatPlan = {
      itinerary,
      tips,
      budget,
      destinations: p.suggestedDestinations.length
        ? p.suggestedDestinations.map((d) => ({ name: d.name, nameAr: d.name_ar, type: d.type }))
        : undefined,
      disclaimer: p.disclaimer || undefined,
    };
    // `text` stays empty: the card renders the parts, and the history sent
    // back to the AI is rebuilt from them (lib/plannerChat.ts).
    return { ...base, text: "", plan, planId: result.planId };
  }
  const text = ((language === "ar" ? result.message_ar : result.message) || result.message || "")
    .trim();
  return text ? { ...base, text } : null;
}

interface PlannerScreenContentProps {
  /** Unused here — the tab shell passes it to every screen. */
  onNavigateToTab?: (key: TabKey) => void;
}

export function PlannerScreenContent(_props: PlannerScreenContentProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, language, isRTL } = useLanguage();
  const { format } = useCurrency();
  const scrollViewRef = useRef<ScrollView>(null);
  const planTravel = useAction(api.travelPlanner.actions.planTravel);

  const chatMessages = useAppStore((state) => state.chatMessages);
  const addChatMessage = useAppStore((state) => state.addChatMessage);
  const setChatMessageFailed = useAppStore((state) => state.setChatMessageFailed);
  const removeFailedChatMessages = useAppStore((state) => state.removeFailedChatMessages);
  const clearChatMessages = useAppStore((state) => state.clearChatMessages);
  const ensureSessionId = useAppStore((state) => state.ensureSessionId);

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Set synchronously, so two taps in one frame cannot start two requests.
  const inFlight = useRef(false);
  const hasChat = chatMessages.length > 0;

  // The docked tab bar sits over this screen, so the composer clears it while
  // the keyboard is closed. Once the keyboard is up the tab shell walks the bar
  // off the bottom edge (see `app/(tabs)/_layout.tsx`) and this clearance gives
  // that room back — reserving the bar's height here as well is what used to
  // leave the composer stranded under the keyboard.
  //
  // On Android the composer follows the keyboard's actual height, frame by
  // frame, because that platform has no will-show event and everything driven
  // off `keyboardDidShow` starts only once the keyboard has moved.
  const {
    visible: keyboardVisible,
    beginOpen,
    height: keyboardHeight,
    trackingSeen: keyboardTrackingSeen,
  } = useKeyboardTransition();
  const [focused, setFocused] = useState(false);
  const closedClearance = TAB_BAR_HEIGHT + insets.bottom + COMPOSER_REST_GAP;

  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Android's fallback: the measured keyboard overlap, for a device where the
  // tracked height never reports. iOS: KeyboardAvoidingView below.
  const {
    ref: innerRef,
    overlap: androidKeyboardHeight,
    onLayout: keyboardOnLayout,
  } = useKeyboardOverlap(scrollToEndSoon);

  const openForKeyboard = focused || keyboardVisible;

  // `Math.max` rather than a switch, and that shape is the behaviour: the
  // composer holds its resting place until the keyboard actually reaches it,
  // then rides up on top of it — and on the way down rides it back to rest.
  // Anything else makes it dip before it rises.
  //
  // iOS uses none of the heights: `KeyboardAvoidingView` lifts the whole screen
  // there, so all this has to do is give back the departing tab bar's room.
  const inputClearanceStyle = useAnimatedStyle(() => {
    if (!IS_ANDROID) {
      return {
        paddingBottom: withTiming(
          openForKeyboard ? INPUT_KEYBOARD_GAP : closedClearance,
          { duration: KEYBOARD_TRAVEL_MS, easing: KEYBOARD_EASING }
        ),
      };
    }
    // Android, once tracking has been seen on this device: the tracked height
    // and nothing else, up and down.
    //
    // This used to take the higher of it and the React-state overlap from
    // `useKeyboardOverlap`, and that state is not a height in motion:
    // `prepare()`, called on focus, set it to the whole of the last keyboard,
    // `keyboardDidShow` set it to the whole of this one, and only
    // `keyboardDidHide` cleared it. So from the second keyboard of a session
    // on, the composer leapt to its final height the moment the field was
    // tapped, ahead of a keyboard still at the bottom of the screen; and on
    // every keyboard, the overlap held the composer up while the keyboard slid
    // away, then dropped it in one step once the hide event landed.
    //
    // The comment here used to blame two `useAnimatedKeyboard` instances
    // disagreeing. They cannot: Reanimated keeps one native keyboard model and
    // hands every listener the same numbers in one loop. What does get stuck
    // is a keyboard that vanishes without animating, which Reanimated never
    // sees go; `useKeyboardTransition` now declares that one gone itself, and
    // the tracked height drops to zero with it — no gate needed here.
    if (keyboardTrackingSeen.value) {
      return {
        paddingBottom: Math.max(closedClearance, keyboardHeight.value + INPUT_KEYBOARD_GAP),
      };
    }
    // A device where tracking has never reported: the measured overlap, which
    // lands late but lands. Closed is a state here rather than the smallest of
    // the numbers, because only the did-event clears the overlap.
    if (!openForKeyboard) return { paddingBottom: closedClearance };
    return {
      paddingBottom: Math.max(closedClearance, androidKeyboardHeight + INPUT_KEYBOARD_GAP),
    };
  });

  const handleInputFocus = useCallback(() => {
    setFocused(true);
    // iOS: the bar starts leaving on the same frame the guest taps the field.
    // Android follows the keyboard itself from its first frame, so it needs no
    // head start — and the old one, `prepare()`, was the jump.
    beginOpen();
    scrollToEndSoon();
  }, [beginOpen, scrollToEndSoon]);

  // The keyboard leaving is the authority on focus, not the cursor: Android's
  // back button dismisses the keyboard without blurring the field, and focus
  // alone would hold the composer up over nothing. Set from the event itself
  // rather than from an effect on `keyboardVisible`, which rendered the whole
  // screen a second time for every keyboard that closed.
  useEffect(() => {
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const sub = Keyboard.addListener(hideEvent, () => setFocused(false));
    return () => sub.remove();
  }, []);

  // iOS only — KeyboardAvoidingView moves the input, we just follow with a scroll.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = Keyboard.addListener("keyboardWillShow", scrollToEndSoon);
    return () => sub.remove();
  }, [scrollToEndSoon]);

  // --- Where a new reply lands --------------------------------------------
  //
  // At its first line, not at the end of it. Every reply used to be followed
  // by `scrollToEnd`, so a long plan arrived scrolled to its budget and the
  // guest had to find the top of the thing they had waited for. A short reply
  // still ends up fully in view: the target is clamped to the end of the chat.
  const pendingReveal = useRef<{ id: string; top?: number; bottom?: number } | null>(null);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const initialScrollDone = useRef(false);

  const revealPending = useCallback(() => {
    const pending = pendingReveal.current;
    if (!pending || pending.top === undefined || pending.bottom === undefined) return;
    // The row's layout and the content's new size arrive in either order;
    // scroll once the content includes the whole reply.
    if (contentHeight.current < pending.bottom) return;
    pendingReveal.current = null;
    const end = Math.max(0, contentHeight.current - viewportHeight.current);
    scrollViewRef.current?.scrollTo({
      y: Math.min(Math.max(0, pending.top - REVEAL_MARGIN), end),
      animated: true,
    });
  }, []);

  const handleRowLayout = useCallback(
    (id: string, layout: LayoutRectangle) => {
      const pending = pendingReveal.current;
      if (!pending || pending.id !== id) return;
      pending.top = layout.y;
      pending.bottom = layout.y + layout.height;
      revealPending();
    },
    [revealPending]
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.current = height;
      // A chat restored from the device opens on its latest turn, the way
      // every chat does, rather than on its first.
      if (!initialScrollDone.current) {
        initialScrollDone.current = true;
        if (useAppStore.getState().chatMessages.length > 0) {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }
      }
      revealPending();
    },
    [revealPending]
  );

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  }, []);

  // A guest who starts scrolling has taken over; do not yank the chat away.
  const cancelReveal = useCallback(() => {
    pendingReveal.current = null;
  }, []);

  // --- Sending -------------------------------------------------------------

  const requestReply = useCallback(
    async (question: ChatMessage) => {
      inFlight.current = true;
      setIsLoading(true);
      let reply: ChatMessage | null = null;
      try {
        const result = await planTravel({
          userInput: question.text,
          language,
          conversationHistory: historyForModel(
            useAppStore.getState().chatMessages,
            question.id
          ),
          sessionId: ensureSessionId(),
        });
        // `result.error` is never shown. It is English whatever the guest's
        // language, one of them names the AI vendor, and none of them says
        // anything the guest can act on.
        reply = result.success ? replyFrom(result, language) : null;
      } catch {
        // A dropped connection or a thrown action: the same to the guest.
      }
      inFlight.current = false;
      setIsLoading(false);

      // Asked in a chat that has since been cleared: the answer belongs
      // nowhere. New chat is disabled while a reply is pending, but signing
      // out clears the chat too, and a stale reply used to land in the next
      // conversation.
      if (!isStillInChat(question.id)) return;

      if (reply) {
        pendingReveal.current = { id: reply.id };
        addChatMessage(reply);
        return;
      }
      // The turn stays, marked, with a Retry under it — and its words go back
      // in the composer, unless the guest has already started on something
      // else. A failure used to post the server's raw error as a reply and
      // throw the typed question away.
      setChatMessageFailed(question.id, true);
      setInputText((current) => (current.trim() ? current : question.text));
    },
    [addChatMessage, ensureSessionId, language, planTravel, setChatMessageFailed]
  );

  // The one send path: the input and the suggestion cards both land here.
  const sendMessage = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || inFlight.current) return;
      // A failed turn whose words were put back in the composer is being sent
      // again, as written now; the old bubble goes rather than sitting beside
      // the new one, and it was never part of the conversation anyway.
      removeFailedChatMessages();
      const question: ChatMessage = {
        id: newMessageId(),
        text,
        isUser: true,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(question);
      setInputText("");
      scrollToEndSoon();
      void requestReply(question);
    },
    [addChatMessage, removeFailedChatMessages, requestReply, scrollToEndSoon]
  );

  // Sends a failed turn again, in its own bubble: no second copy of it.
  const retryMessage = useCallback(
    (id: string) => {
      if (inFlight.current) return;
      const question = useAppStore.getState().chatMessages.find((m) => m.id === id);
      if (!question) return;
      setChatMessageFailed(id, false);
      // Its words were put back in the composer when it failed; sent from
      // here, that copy has nothing left to do.
      setInputText((current) => (current.trim() === question.text ? "" : current));
      scrollToEndSoon();
      void requestReply(question);
    },
    [requestReply, scrollToEndSoon, setChatMessageFailed]
  );

  // Disabled while a reply is pending (see `requestReply`).
  const handleNewChat = useCallback(() => {
    if (inFlight.current) return;
    appAlert(t("newChat"), t("newChatConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("newChat"), style: "destructive", onPress: clearChatMessages },
    ]);
  }, [clearChatMessages, t]);

  // --- The places a plan names --------------------------------------------
  //
  // The same public listings Home already subscribes to, so this costs no
  // extra round trip — and none at all until a plan is on screen.
  const hasPlan = useMemo(() => chatMessages.some((m) => !!m.plan), [chatMessages]);
  const listings = useQuery(api.listings.queries.listListings, hasPlan ? {} : "skip");
  const placeIndex = useMemo(() => (listings ? indexPlaces(listings) : undefined), [listings]);

  const [selectedPlace, setSelectedPlace] = useState<DetailItem | null>(null);
  const openPlace = useCallback(
    (listingId: string) => {
      const listing = listings?.find((l) => l._id === listingId);
      if (!listing) return;
      // The sheet is a Modal of its own; a keyboard left up under it is one
      // the app no longer tracks.
      Keyboard.dismiss();
      setSelectedPlace(
        listingDetailItem(toLodging(listing), listing.type, {
          language,
          typeLabel: (type) => {
            const key = `cat_${type}`;
            return key in translations.en ? t(key as TranslationKey) : "";
          },
          perNight: t("perNight"),
          formatPrice: format,
        })
      );
    },
    [listings, language, t, format]
  );
  const closePlace = useCallback(() => setSelectedPlace(null), []);

  const sendDisabled = !inputText.trim() || isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <ScreenGradient />
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <View style={[styles.headerText, isRTL && styles.headerTextRTL]}>
            <View style={[styles.eyebrowRow, isRTL && styles.rowRTL]}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>{t("plannerEyebrow")}</Text>
            </View>
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              {t("plannerTitle")}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
              {t("plannerSubtitle")}
            </Text>
          </View>

          {/* Always laid out, and only shown once there is a conversation to
              clear: it used to appear with the first message and take its
              width from the title, which re-wrapped the whole header. */}
          <Pressable
            onPress={handleNewChat}
            disabled={!hasChat || isLoading}
            accessible={hasChat}
            accessibilityElementsHidden={!hasChat}
            importantForAccessibility={hasChat ? "auto" : "no-hide-descendants"}
            accessibilityRole="button"
            accessibilityLabel={t("newChat")}
            accessibilityState={{ disabled: isLoading }}
            style={({ pressed }) => [
              styles.newChatButton,
              !hasChat && styles.hidden,
              hasChat && isLoading && styles.dimmed,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="rotate-ccw" size={17} color={colors.ink} />
          </Pressable>
        </View>

        {/* Chat Area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // "interactive" does nothing on Android, and on iOS it drags the
          // keyboard with the finger while KeyboardAvoidingView only hears
          // about it once the drag ends, so the composer and the keyboard
          // came apart mid-gesture. A drag closes the keyboard, and the
          // composer rides it down.
          keyboardDismissMode="on-drag"
          onLayout={handleViewportLayout}
          onContentSizeChange={handleContentSizeChange}
          onScrollBeginDrag={cancelReveal}
        >
          {!hasChat && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(600)}
              style={styles.welcomeContainer}
            >
              <View style={[styles.welcomeCard, isRTL && styles.welcomeCardRTL]}>
                <SurfaceGradient />
                <View style={styles.welcomeIcon}>
                  <Feather name="compass" size={20} color={colors.ink} />
                </View>
                <Text style={[styles.welcomeTitle, isRTL && styles.textRTL]}>
                  {t("plannerWelcome")}
                </Text>
                <Text style={[styles.welcomeText, isRTL && styles.textRTL]}>
                  {t("plannerGreeting")}
                </Text>
              </View>

              <Text style={[styles.suggestionsTitle, isRTL && styles.textRTL]}>
                {t("quickSuggestions")}
              </Text>
              <View style={[styles.suggestionGrid, isRTL && styles.suggestionGridRTL]}>
                {SUGGESTIONS.map((suggestion, index) => (
                  <SuggestionCard
                    key={suggestion.key}
                    icon={suggestion.icon}
                    label={t(suggestion.key)}
                    isRTL={isRTL}
                    onPress={() => sendMessage(t(suggestion.key))}
                    delay={index * 70}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {/* A chat restored from the device is already there when the screen
              mounts; it appears as it is, rather than forty messages fading up
              at once. Turns added after that fade in. */}
          <LayoutAnimationConfig skipEntering>
            {chatMessages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                isRTL={isRTL}
                language={language}
                t={t}
                placeIndex={placeIndex}
                onOpenPlace={openPlace}
                onRetry={retryMessage}
                onRowLayout={handleRowLayout}
              />
            ))}
          </LayoutAnimationConfig>

          {/* The planner typing — with its avatar and on its own side, so the
              reply that replaces it lands exactly where the dots were. */}
          {isLoading && (
            <Animated.View
              entering={MESSAGE_ENTERING}
              style={[styles.typingRow, isRTL && styles.typingRowRTL]}
            >
              <BotAvatar isRTL={isRTL} />
              <View style={[styles.typingBubble, isRTL && styles.typingBubbleRTL]}>
                <TypingIndicator label={t("plannerTyping")} />
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Input Area.
            The keyboard overlap is measured on THIS view rather than on the
            screen, and that is the whole fix. Measuring the outer container
            asked "how much of the screen is covered", which inside a PagerView
            on an edge-to-edge window came back as nothing — so the composer sat
            under the keyboard while the screen believed it was clear. Measuring
            the composer asks the only question that matters: how much of the
            box the guest is typing into is hidden.

            The padding goes inside the measured view's own box, so it moves the
            row without moving the frame — which is what stops it oscillating
            between covered and clear. */}
        <View
          ref={innerRef}
          onLayout={keyboardOnLayout}
          style={styles.inputDock}
        >
        <Animated.View
          style={[styles.inputContainer, isRTL && styles.rowRTL, inputClearanceStyle]}
        >
          <View style={styles.inputPill}>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            placeholder={t("chatPlaceholder")}
            placeholderTextColor={colors.onSurface.muted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => sendMessage(inputText)}
            onFocus={handleInputFocus}
            onBlur={() => setFocused(false)}
            multiline
            maxLength={500}
            textAlign={isRTL ? "right" : "left"}
            // Stays editable while a reply is on its way. `editable={false}`
            // on a focused field blurs it, so every send used to close the
            // keyboard, and the guest had to tap back in to write the next
            // line. The send button's own disabled state and `sendMessage`'s
            // guard are what stop a second send.
          />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              sendDisabled && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={sendDisabled}
            accessibilityRole="button"
            accessibilityLabel={t("sendMessage")}
            accessibilityState={{ disabled: sendDisabled, busy: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              // arrow-up is symmetric, so no RTL mirroring is needed.
              <Feather
                name="arrow-up"
                size={22}
                color={sendDisabled ? colors.onSurface.muted : colors.ink}
              />
            )}
          </Pressable>
        </Animated.View>
        </View>

      </View>

      <ListingDetailSheet item={selectedPlace} onClose={closePlace} />
    </KeyboardAvoidingView>
  );
}

interface MessageRowProps {
  message: ChatMessage;
  isRTL: boolean;
  language: Language;
  t: (key: TranslationKey) => string;
  placeIndex?: ReadonlyMap<string, NamedListing>;
  onOpenPlace: (listingId: string) => void;
  onRetry: (messageId: string) => void;
  onRowLayout: (id: string, layout: LayoutRectangle) => void;
}

// Memoised with stable callbacks, like the bubble inside it: a keystroke in the
// composer re-renders the screen, and used to re-render every turn with it.
const MessageRow = memo(function MessageRow({
  message,
  isRTL,
  language,
  t,
  placeIndex,
  onOpenPlace,
  onRetry,
  onRowLayout,
}: MessageRowProps) {
  const id = message.id;
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onRowLayout(id, event.nativeEvent.layout),
    [id, onRowLayout]
  );
  return (
    <Animated.View entering={MESSAGE_ENTERING} onLayout={handleLayout}>
      <ChatBubble
        message={message}
        isRTL={isRTL}
        language={language}
        t={t}
        placeIndex={placeIndex}
        onOpenPlace={onOpenPlace}
        onRetry={onRetry}
      />
    </Animated.View>
  );
});

// Typing indicator component
function TypingIndicator({ label }: { label: string }) {
  const styles = useThemedStyles(makeStyles);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  // One bounce per dot, staggered by `withDelay` and started together, and all
  // three stopped on unmount. The stagger used to come from two setTimeouts
  // that nothing cleared: a reply landing inside 400ms set an endless spring
  // going on a dot that had already unmounted, and it never stopped.
  useEffect(() => {
    if (reducedMotion) return;
    const bounce = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(withSpring(1, { damping: 10 }), withSpring(0, { damping: 10 })),
          -1,
          false
        )
      );
    dot1.value = bounce(0);
    dot2.value = bounce(200);
    dot3.value = bounce(400);
    return () => {
      cancelAnimation(dot1);
      cancelAnimation(dot2);
      cancelAnimation(dot3);
    };
  }, [dot1, dot2, dot3, reducedMotion]);

  // Android reads the live region out; iOS has to be told.
  useEffect(() => {
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(label);
  }, [label]);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: -dot1.value * 5 }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: -dot2.value * 5 }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: -dot3.value * 5 }],
  }));

  return (
    <View
      style={styles.typingIndicator}
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.typingDot, dot1Style]} />
      <Animated.View style={[styles.typingDot, dot2Style]} />
      <Animated.View style={[styles.typingDot, dot3Style]} />
    </View>
  );
}

interface SuggestionCardProps {
  icon: FeatherName;
  label: string;
  isRTL: boolean;
  onPress: () => void;
  delay?: number;
}

function SuggestionCard({ icon, label, isRTL, onPress, delay = 0 }: SuggestionCardProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(delay).duration(400)}
      style={[styles.suggestionCard, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.suggestionIcon, isRTL && styles.suggestionIconRTL]}>
        <Feather name={icon} size={15} color={colors.ink} />
      </View>
      <Text style={[styles.suggestionLabel, isRTL && styles.textRTL]} numberOfLines={2}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerRTL: {
    flexDirection: "row-reverse",
  },
  headerText: {
    flex: 1,
  },
  headerTextRTL: {
    alignItems: "flex-end",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  eyebrowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.deep,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    fontFamily: fonts.serif,
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginTop: 4,
  },
  // 44pt: the smallest target a thumb finds without aiming.
  newChatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  // Keeps its space in the header while there is nothing to clear.
  hidden: {
    opacity: 0,
  },
  dimmed: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  textRTL: {
    textAlign: "right",
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  welcomeContainer: {
    marginBottom: 16,
  },
  welcomeCard: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 24,
    // Clips the lit-from-above wash to the card's corners.
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 20,
  },
  welcomeCardRTL: {
    alignItems: "flex-end",
  },
  welcomeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: {
    fontSize: 26,
    fontFamily: fonts.serif,
    color: colors.ink,
    marginTop: 14,
  },
  welcomeText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginTop: 6,
  },
  suggestionsTitle: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.onSurface.muted,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 10,
  },
  suggestionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  suggestionGridRTL: {
    flexDirection: "row-reverse",
  },
  suggestionCard: {
    width: SUGGESTION_CARD_WIDTH,
    minHeight: 96,
    borderRadius: 20,
    backgroundColor: colors.mint,
    padding: 14,
    justifyContent: "space-between",
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  suggestionIconRTL: {
    alignSelf: "flex-end",
  },
  suggestionLabel: {
    fontSize: 13.5,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  // Laid out like a reply (see ChatBubble's container): same side, same
  // spacing below, so nothing moves when the reply takes its place.
  typingRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  typingRowRTL: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
  },
  typingBubble: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // The small corner points at the avatar, which is on the right in Arabic.
  typingBubbleRTL: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 6,
  },
  typingIndicator: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.deep,
  },
  // The measured view. Opaque, because the space its padding opens up sits
  // over the chat while the keyboard is on its way in.
  inputDock: {
    backgroundColor: colors.background,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.background,
    gap: 10,
  },
  inputPill: {
    flex: 1,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 6,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.ink,
    maxHeight: 100,
  },
  inputRTL: {
    writingDirection: "rtl",
  },
  sendButton: {
    backgroundColor: colors.primary.DEFAULT,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.chip,
  },
});

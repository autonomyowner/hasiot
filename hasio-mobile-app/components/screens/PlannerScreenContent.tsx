import { appAlert } from "@/stores/dialogStore";
import React, { useState, useRef, useEffect, useCallback } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { useAction } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import {
  KEYBOARD_EASING,
  KEYBOARD_TRAVEL_MS,
  useKeyboardTransition,
} from "@/hooks/useKeyboardVisible";
import { useAppStore } from "@/stores/appStore";
import { ChatBubble } from "@/components/planner";
import { colors, type AppFonts } from "@/constants/colors";
import { ScreenGradient, SurfaceGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { Feather } from "@expo/vector-icons";
import type { TranslationKey } from "@/constants/translations";
import type { ChatMessage } from "@/types";
import type { TabKey } from "@/app/(tabs)/_layout";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Two per row inside the chat's 16px side padding, with a 10px gutter.
const SUGGESTION_CARD_WIDTH = (Dimensions.get("window").width - 32 - 10) / 2;

// What the input rests on once the keyboard is carrying the safe area itself.
const INPUT_KEYBOARD_GAP = 10;

const IS_ANDROID = Platform.OS === "android";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

// All four are sent to the planner as a message; none navigates away, so the
// first thing a new user does stays inside the conversation.
const SUGGESTIONS: { key: TranslationKey; icon: FeatherName }[] = [
  { key: "suggestItinerary", icon: "map" },
  { key: "suggestHeritage", icon: "book-open" },
  { key: "suggestFamily", icon: "users" },
  { key: "suggestFood", icon: "coffee" },
];

interface PlannerScreenContentProps {
  /** Unused here — the tab shell passes it to every screen. */
  onNavigateToTab?: (key: TabKey) => void;
}

export function PlannerScreenContent(_props: PlannerScreenContentProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, language, isRTL } = useLanguage();
  const scrollViewRef = useRef<ScrollView>(null);
  const planTravel = useAction(api.travelPlanner.actions.planTravel);

  const chatMessages = useAppStore((state) => state.chatMessages);
  const addChatMessage = useAppStore((state) => state.addChatMessage);
  const clearChatMessages = useAppStore((state) => state.clearChatMessages);
  const ensureSessionId = useAppStore((state) => state.ensureSessionId);

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // The docked tab bar sits over this screen, so the composer clears it while
  // the keyboard is closed. Once the keyboard is up the tab shell walks the bar
  // off the bottom edge (see `app/(tabs)/_layout.tsx`) and this clearance gives
  // that room back — reserving the bar's height here as well is what used to
  // leave the composer stranded under the keyboard.
  //
  // On Android the composer now follows the keyboard's actual height, frame by
  // frame, because that platform has no will-show event and everything driven
  // off `keyboardDidShow` starts only once the keyboard has finished arriving.
  // Focus still starts the transition as a head start for the fallback path.
  const {
    visible: keyboardVisible,
    beginOpen,
    height: keyboardHeight,
  } = useKeyboardTransition();
  const [focused, setFocused] = useState(false);
  const closedClearance = TAB_BAR_CLEARANCE + insets.bottom;

  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Android: pad by the measured keyboard overlap. iOS: KeyboardAvoidingView below.
  const {
    ref: innerRef,
    overlap: androidKeyboardHeight,
    onLayout: keyboardOnLayout,
    prepare: prepareForKeyboard,
  } = useKeyboardOverlap(scrollToEndSoon);

  const openForKeyboard = focused || keyboardVisible;

  // `Math.max` rather than a switch, and that shape is the behaviour: the
  // composer holds its resting place until the keyboard actually reaches it,
  // then rides up on top of it. Anything else makes it dip before it rises.
  //
  // Three sources, whichever is furthest along. On Android the tracked height
  // moves frame by frame with the keyboard; the measured overlap is the
  // fallback for a device where tracking reports nothing, and lands late but
  // lands. iOS uses neither — `KeyboardAvoidingView` lifts the whole screen
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
    return {
      paddingBottom: Math.max(
        closedClearance,
        keyboardHeight.value + INPUT_KEYBOARD_GAP,
        androidKeyboardHeight + INPUT_KEYBOARD_GAP
      ),
    };
  });

  const handleInputFocus = useCallback(() => {
    setFocused(true);
    // Both before the keyboard has moved: the bar starts leaving and the
    // composer starts rising on the same frame the guest taps the field.
    prepareForKeyboard();
    beginOpen();
    scrollToEndSoon();
  }, [beginOpen, prepareForKeyboard, scrollToEndSoon]);

  // Android's back button dismisses the keyboard without blurring the field, so
  // focus alone would hold the composer up over nothing. The keyboard leaving
  // is the authority on this, not the cursor.
  useEffect(() => {
    if (!keyboardVisible) setFocused(false);
  }, [keyboardVisible]);

  // iOS only — KeyboardAvoidingView moves the input, we just follow with a scroll.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = Keyboard.addListener("keyboardWillShow", scrollToEndSoon);
    return () => sub.remove();
  }, [scrollToEndSoon]);

  // Handle reporting AI messages (no reports table yet — local feedback only)
  const handleReportMessage = async (_messageId: string) => {
    appAlert(t("thankYou"), t("reportReceived"));
  };

  const handleNewChat = () => {
    appAlert(t("newChat"), t("newChatConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("newChat"), style: "destructive", onPress: () => clearChatMessages() },
    ]);
  };

  // The one send path: the input and the suggestion cards both land here.
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userText = text.trim();
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        text: userText,
        isUser: true,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(userMessage);
      setInputText("");
      setIsLoading(true);
      scrollToEndSoon();

      try {
        // This turn goes up as `userInput`, so it must not also appear in the
        // history sent alongside it.
        const conversationHistory = chatMessages
          .filter((m) => m.id !== userMessage.id)
          .map((m) => ({
            role: m.isUser ? "user" : "assistant",
            content: m.text,
          }));

        const result = await planTravel({
          userInput: userText,
          language,
          conversationHistory,
          sessionId: ensureSessionId(),
        });

        let responseText = "";
        let plan: ChatMessage["plan"];

        if (result.success && result.ready && result.plan) {
          const itinerary = result.plan.itinerary || result.message || "";
          const tips =
            (language === "ar"
              ? result.plan.travelTips_ar || result.plan.travelTips
              : result.plan.travelTips) || undefined;
          const budget =
            (language === "ar"
              ? result.plan.estimatedBudget_ar || result.plan.estimatedBudget
              : result.plan.estimatedBudget) || undefined;
          plan = { itinerary, tips, budget };
          // PlanCard renders the parts. The flattened copy stays on the message
          // because the conversation history sent back to the AI is plain text.
          responseText = [itinerary, tips, budget].filter(Boolean).join("\n\n");
        } else if (result.success) {
          responseText =
            (language === "ar" ? result.message_ar : result.message) || result.message || "";
        } else {
          responseText = result.error || t("somethingWentWrong");
        }

        addChatMessage({
          id: (Date.now() + 1).toString(),
          text: responseText,
          isUser: false,
          timestamp: new Date().toISOString(),
          plan,
        });
        scrollToEndSoon();
      } catch (error) {
        addChatMessage({
          id: (Date.now() + 1).toString(),
          text: t("pleaseTryAgain"),
          isUser: false,
          timestamp: new Date().toISOString(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      addChatMessage,
      chatMessages,
      ensureSessionId,
      isLoading,
      language,
      planTravel,
      scrollToEndSoon,
      t,
    ]
  );

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

          {/* Only worth showing once there is a conversation to clear. */}
          {chatMessages.length > 0 && (
            <Pressable
              onPress={handleNewChat}
              style={styles.newChatButton}
              accessibilityRole="button"
              accessibilityLabel={t("newChat")}
            >
              <Feather name="rotate-ccw" size={16} color={colors.ink} />
            </Pressable>
          )}
        </View>

        {/* Chat Area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {chatMessages.length === 0 && (
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

          {chatMessages.map((message, index) => (
            <Animated.View
              key={message.id}
              entering={FadeInUp.delay(index * 50).duration(400)}
            >
              <ChatBubble
                message={message}
                isRTL={isRTL}
                t={t}
                onReport={handleReportMessage}
              />
            </Animated.View>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <Animated.View
              entering={FadeInUp.duration(300)}
              style={[styles.loadingContainer, isRTL && styles.loadingContainerRTL]}
            >
              <View style={styles.loadingBubble}>
                <TypingIndicator />
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
        <Animated.View style={[styles.inputContainer, inputClearanceStyle]}>
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
            editable={!isLoading}
          />
          </View>
          <Pressable
            style={[styles.sendButton, sendDisabled && styles.sendButtonDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={sendDisabled}
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
    </KeyboardAvoidingView>
  );
}

// Typing indicator component
function TypingIndicator() {
  const styles = useThemedStyles(makeStyles);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    dot1.value = withRepeat(
      withSequence(
        withSpring(1, { damping: 10 }),
        withSpring(0, { damping: 10 })
      ),
      -1,
      false
    );
    setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(
          withSpring(1, { damping: 10 }),
          withSpring(0, { damping: 10 })
        ),
        -1,
        false
      );
    }, 200);
    setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(
          withSpring(1, { damping: 10 }),
          withSpring(0, { damping: 10 })
        ),
        -1,
        false
      );
    }, 400);
  }, []);

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
    <View style={styles.typingIndicator}>
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
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
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
  loadingContainer: {
    flexDirection: "row",
    marginVertical: 4,
  },
  loadingContainerRTL: {
    flexDirection: "row-reverse",
  },
  loadingBubble: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
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

import React, { useState, useRef, useEffect } from "react";
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
  Alert,
  Keyboard,
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
} from "react-native-reanimated";
import { useAction } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { useAppStore } from "@/stores/appStore";
import { ChatBubble } from "@/components/planner";
import { colors, fonts } from "@/constants/colors";
import type { ChatMessage } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PlannerScreenContentProps {
  onNavigateToTab?: (index: number) => void;
}

export function PlannerScreenContent({ onNavigateToTab }: PlannerScreenContentProps) {
  const insets = useSafeAreaInsets();
  const { t, language, isRTL } = useLanguage();
  const scrollViewRef = useRef<ScrollView>(null);
  const planTravel = useAction(api.travelPlanner.actions.planTravel);

  const chatMessages = useAppStore((state) => state.chatMessages);
  const addChatMessage = useAppStore((state) => state.addChatMessage);

  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  // On Android: manually track keyboard height since KeyboardAvoidingView
  // doesn't work reliably inside PagerView. On iOS: just scroll to bottom.
  useEffect(() => {
    const isAndroid = Platform.OS === "android";
    const showEvent = isAndroid ? "keyboardDidShow" : "keyboardWillShow";
    const hideEvent = isAndroid ? "keyboardDidHide" : "keyboardWillHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      if (isAndroid) {
        setAndroidKeyboardHeight(e.endCoordinates.height);
      }
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (isAndroid) {
        setAndroidKeyboardHeight(0);
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Handle reporting AI messages (no reports table yet — local feedback only)
  const handleReportMessage = async (_messageId: string) => {
    Alert.alert(t("thankYou"), t("reportReceived"));
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMessage);
    const userText = inputText.trim();
    setInputText("");
    setIsLoading(true);

    // Scroll to bottom to show user message
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Build conversation history from chat messages
      const conversationHistory = chatMessages
        .filter((m) => m.id !== userMessage.id) // exclude the just-added message
        .map((m) => ({
          role: m.isUser ? "user" : "assistant",
          content: m.text,
        }));

      // Call Convex AI travel planner
      const result = await planTravel({
        userInput: userText,
        language,
        conversationHistory,
      });

      let responseText = "";
      if (result.success) {
        if (result.ready && result.plan) {
          // Full plan received
          responseText = result.plan.itinerary || result.message || "";
          if (result.plan.travelTips) {
            responseText += "\n\n" + (language === "ar" ? result.plan.travelTips_ar || result.plan.travelTips : result.plan.travelTips);
          }
          if (result.plan.estimatedBudget) {
            responseText += "\n\n" + (language === "ar" ? result.plan.estimatedBudget_ar || result.plan.estimatedBudget : result.plan.estimatedBudget);
          }
        } else {
          // Follow-up question
          responseText = (language === "ar" ? result.message_ar : result.message) || result.message || "";
        }
      } else {
        responseText = result.error || t("somethingWentWrong");
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(botMessage);

      // Scroll to show bot response
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: t("pleaseTryAgain"),
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestionButtons = [
    { key: "lodging", label: t("suggestLodging"), tabIndex: 1 },
    { key: "food", label: t("suggestFood"), tabIndex: 2 },
    { key: "events", label: t("suggestEvents"), tabIndex: 3 },
    { key: "itinerary", label: t("suggestItinerary"), tabIndex: null },
  ];

  const handleSuggestion = async (tabIndex: number | null, label: string) => {
    if (tabIndex !== null) {
      onNavigateToTab?.(tabIndex);
    } else {
      // Send as a message to AI
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        text: label,
        isUser: true,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(userMessage);
      setIsLoading(true);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      try {
        const conversationHistory = chatMessages
          .map((m) => ({
            role: m.isUser ? "user" : "assistant",
            content: m.text,
          }));

        const result = await planTravel({
          userInput: label,
          language,
          conversationHistory,
        });

        let responseText = "";
        if (result.success) {
          if (result.ready && result.plan) {
            responseText = result.plan.itinerary || result.message || "";
            if (result.plan.travelTips) {
              responseText += "\n\n" + (language === "ar" ? result.plan.travelTips_ar || result.plan.travelTips : result.plan.travelTips);
            }
            if (result.plan.estimatedBudget) {
              responseText += "\n\n" + (language === "ar" ? result.plan.estimatedBudget_ar || result.plan.estimatedBudget : result.plan.estimatedBudget);
            }
          } else {
            responseText = (language === "ar" ? result.message_ar : result.message) || result.message || "";
          }
        } else {
          responseText = result.error || t("somethingWentWrong");
        }

        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: responseText,
          isUser: false,
          timestamp: new Date().toISOString(),
        };
        addChatMessage(botMessage);

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: t("pleaseTryAgain"),
          isUser: false,
          timestamp: new Date().toISOString(),
        };
        addChatMessage(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={[styles.inner, { paddingTop: insets.top, paddingBottom: androidKeyboardHeight }]}>
        {/* Header */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t("plannerAssistant")}
          </Text>
          <View style={[styles.subtitleRow, isRTL && styles.subtitleRowRTL]}>
            <Text style={styles.subtitleIcon}>✦</Text>
            <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
              {t("plannerSubtitle")}
            </Text>
          </View>
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
              <View style={[styles.welcomeBubble, isRTL && styles.welcomeBubbleRTL]}>
                <Text style={[styles.welcomeEmoji]}>👋</Text>
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
              <View style={[styles.suggestions, isRTL && styles.suggestionsRTL]}>
                {suggestionButtons.map((btn, index) => (
                  <SuggestionButton
                    key={btn.key}
                    label={btn.label}
                    onPress={() => handleSuggestion(btn.tabIndex, btn.label)}
                    delay={index * 100}
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

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={[styles.inputPill, isRTL && styles.inputPillRTL]}>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            placeholder={t("chatPlaceholder")}
            placeholderTextColor={colors.onSurface.muted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            multiline
            maxLength={500}
            textAlign={isRTL ? "right" : "left"}
            editable={!isLoading}
          />
          </View>
          <Pressable
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.sendButtonText, isRTL && { transform: [{ scaleX: -1 }] }]}>→</Text>
            )}
          </Pressable>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

// Typing indicator component
function TypingIndicator() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
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

interface SuggestionButtonProps {
  label: string;
  onPress: () => void;
  delay?: number;
}

function SuggestionButton({ label, onPress, delay = 0 }: SuggestionButtonProps) {
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
      style={[styles.suggestionButton, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Text style={styles.suggestionText}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  headerRTL: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 30,
    fontFamily: fonts.serif,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  subtitleRowRTL: {
    flexDirection: "row-reverse",
  },
  subtitleIcon: {
    fontSize: 12,
    color: colors.primary.DEFAULT,
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.primary.DEFAULT,
  },
  textRTL: {
    textAlign: "right",
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 8,
  },
  welcomeContainer: {
    marginBottom: 16,
  },
  welcomeBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeBubbleRTL: {
    alignItems: "flex-end",
  },
  welcomeEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.primary.DEFAULT,
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.onSurface.muted,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionsRTL: {
    flexDirection: "row-reverse",
  },
  suggestionButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#D9E8E1",
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.primary.DEFAULT,
  },
  loadingContainer: {
    flexDirection: "row",
    marginVertical: 4,
  },
  loadingContainerRTL: {
    flexDirection: "row-reverse",
  },
  loadingBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
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
    backgroundColor: colors.primary.DEFAULT,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.background,
    gap: 10,
  },
  inputPill: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  inputPillRTL: {},
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
    shadowColor: colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0.1,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: fonts.bold,
    fontWeight: "700",
  },
});

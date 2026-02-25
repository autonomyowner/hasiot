import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import { voiceService, VoiceState } from "../../lib/voiceService";

const VOICE_CONSENT_KEY = "hasio_voice_data_consent";
const PRIVACY_POLICY_URL = "https://hasio.xyz/privacy-policy.html";

interface VoiceAssistantProps {
  isRTL: boolean;
  translations: {
    tapToSpeak: string;
    listening: string;
    thinking: string;
    speaking: string;
    connecting: string;
    tapToStop: string;
    voiceAssistant: string;
    close: string;
    voiceDataConsentTitle: string;
    voiceDataConsentMessage: string;
    voiceDataConsentLearnMore: string;
    voiceDataConsentAccept: string;
    voiceDataConsentDecline: string;
  };
  onTranscript?: (text: string, isUser: boolean) => void;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export function VoiceAssistant({
  isRTL,
  translations,
  onTranscript,
}: VoiceAssistantProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [textInput, setTextInput] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const [hasVoiceConsent, setHasVoiceConsent] = useState<boolean | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const buttonScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);
  const waveScale1 = useSharedValue(1);
  const waveScale2 = useSharedValue(1);
  const waveScale3 = useSharedValue(1);

  // Check for existing voice consent on mount
  useEffect(() => {
    const checkConsent = async () => {
      try {
        const consent = await AsyncStorage.getItem(VOICE_CONSENT_KEY);
        setHasVoiceConsent(consent === "true");
      } catch (error) {
        console.error("Error checking voice consent:", error);
        setHasVoiceConsent(false);
      }
    };
    checkConsent();
  }, []);

  // Initialize voice service when modal opens
  useEffect(() => {
    if (isModalVisible) {
      voiceService.initialize({
        onStateChange: setVoiceState,
        onTranscript: (text, isUser) => {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              text,
              isUser,
              timestamp: new Date(),
            },
          ]);
          onTranscript?.(text, isUser);
          // Auto scroll to bottom
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        },
        onError: (err) => {
          setError(err);
          setTimeout(() => setError(null), 3000);
        },
      });

    }

    return () => {
      if (!isModalVisible) {
        voiceService.disconnect();
      }
    };
  }, [isModalVisible]);

  // Animate based on voice state
  useEffect(() => {
    if (voiceState === "listening") {
      // Pulsing animation for listening
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 800 }),
          withTiming(0.6, { duration: 800 })
        ),
        -1,
        true
      );
    } else if (voiceState === "speaking") {
      // Wave animation for speaking
      waveScale1.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
      waveScale2.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(1.6, { duration: 500 }),
          withTiming(1, { duration: 300 })
        ),
        -1,
        true
      );
      waveScale3.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 150 }),
          withTiming(1.8, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    } else if (voiceState === "processing") {
      // Slow pulse for processing
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
      pulseOpacity.value = 0.4;
    } else {
      // Reset animations
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      cancelAnimation(waveScale1);
      cancelAnimation(waveScale2);
      cancelAnimation(waveScale3);
      pulseScale.value = withTiming(1);
      pulseOpacity.value = withTiming(0.5);
      waveScale1.value = withTiming(1);
      waveScale2.value = withTiming(1);
      waveScale3.value = withTiming(1);
    }
  }, [voiceState]);

  const handleOpenModal = () => {
    // Check if user has consented to voice data processing
    if (!hasVoiceConsent) {
      setShowConsentModal(true);
      return;
    }
    openVoiceModal();
  };

  const openVoiceModal = () => {
    setIsModalVisible(true);
    setMessages([]);
    setError(null);
  };

  const handleAcceptConsent = async () => {
    try {
      await AsyncStorage.setItem(VOICE_CONSENT_KEY, "true");
      setHasVoiceConsent(true);
      setShowConsentModal(false);
      openVoiceModal();
    } catch (error) {
      console.error("Error saving voice consent:", error);
    }
  };

  const handleDeclineConsent = () => {
    setShowConsentModal(false);
  };

  const handleOpenPrivacyPolicy = async () => {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch (error) {
      console.error("Failed to open privacy policy:", error);
    }
  };

  const handleCloseModal = async () => {
    await voiceService.disconnect();
    setIsModalVisible(false);
    setVoiceState("idle");
  };

  // Hold to talk handlers
  const handlePressIn = async () => {
    if (voiceState === "speaking" || voiceState === "processing") {
      return; // Don't interrupt while speaking or processing
    }
    setIsHolding(true);
    await voiceService.startListening();
  };

  const handlePressOut = async () => {
    if (isHolding) {
      setIsHolding(false);
      await voiceService.stopListening();
    }
  };

  const handleSendText = async () => {
    if (!textInput.trim() || voiceState !== "idle") return;
    const message = textInput.trim();
    setTextInput("");
    await voiceService.sendTextMessage(message);
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ scale: waveScale1.value }],
    opacity: 0.3,
  }));

  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ scale: waveScale2.value }],
    opacity: 0.2,
  }));

  const wave3Style = useAnimatedStyle(() => ({
    transform: [{ scale: waveScale3.value }],
    opacity: 0.1,
  }));

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const getStatusText = () => {
    switch (voiceState) {
      case "connecting":
        return translations.connecting;
      case "listening":
        return translations.listening;
      case "processing":
        return translations.thinking;
      case "speaking":
        return translations.speaking;
      default:
        return "Ready";
    }
  };

  const getHintText = () => {
    switch (voiceState) {
      case "listening":
        return "Release to send";
      case "processing":
        return "Processing...";
      case "speaking":
        return "AI is speaking...";
      default:
        return "Hold to speak";
    }
  };

  const getCircleColor = () => {
    switch (voiceState) {
      case "connecting":
        return "#F59E0B";
      case "listening":
        return "#EF4444"; // Red when recording
      case "processing":
        return "#6366F1";
      case "speaking":
        return "#0D7A5F";
      default:
        return "#0D7A5F";
    }
  };

  const isActive = voiceState !== "idle";

  return (
    <>
      {/* Floating Voice Button */}
      <Animated.View style={[styles.floatingButton, buttonAnimatedStyle]}>
        <Pressable
          style={styles.floatingButtonInner}
          onPress={handleOpenModal}
          onPressIn={handleButtonPressIn}
          onPressOut={handleButtonPressOut}
        >
          <View style={styles.micIconContainer}>
            <View style={styles.micIcon}>
              <View style={styles.micHead} />
              <View style={styles.micStand} />
              <View style={styles.micBase} />
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Voice Assistant Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}>
            <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
              {translations.voiceAssistant}
            </Text>
            <Pressable onPress={handleCloseModal} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{translations.close}</Text>
            </Pressable>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Hold the button below and speak to start a conversation
                </Text>
              </View>
            )}
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubble,
                  msg.isUser ? styles.userBubble : styles.assistantBubble,
                  isRTL && styles.messageBubbleRTL,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    msg.isUser ? styles.userText : styles.assistantText,
                    isRTL && styles.textRTL,
                  ]}
                >
                  {msg.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Voice Circle */}
          <View style={styles.voiceCircleContainer}>
            {/* Animated waves for speaking */}
            {voiceState === "speaking" && (
              <>
                <Animated.View
                  style={[
                    styles.wave,
                    { backgroundColor: getCircleColor() },
                    wave3Style,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.wave,
                    { backgroundColor: getCircleColor() },
                    wave2Style,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.wave,
                    { backgroundColor: getCircleColor() },
                    wave1Style,
                  ]}
                />
              </>
            )}

            {/* Pulse for listening/processing */}
            {(voiceState === "listening" || voiceState === "processing") && (
              <Animated.View
                style={[
                  styles.pulse,
                  { backgroundColor: getCircleColor() },
                  pulseAnimatedStyle,
                ]}
              />
            )}

            {/* Main Circle Button - Hold to Talk */}
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={voiceState === "speaking" || voiceState === "processing"}
              style={[
                styles.voiceCircle,
                { backgroundColor: getCircleColor() },
                (voiceState === "speaking" || voiceState === "processing") && styles.voiceCircleDisabled,
              ]}
            >
              <View style={styles.largeMicIcon}>
                <View style={[styles.largeMicHead, { backgroundColor: "#FFFFFF" }]} />
                <View style={[styles.largeMicStand, { backgroundColor: "#FFFFFF" }]} />
                <View style={[styles.largeMicBase, { backgroundColor: "#FFFFFF" }]} />
              </View>
            </Pressable>
          </View>

          {/* Status Text */}
          <Text style={[styles.statusText, isRTL && styles.textRTL]}>
            {getStatusText()}
          </Text>
          <Text style={[styles.hintText, isRTL && styles.textRTL]}>
            {getHintText()}
          </Text>

          {/* Text Input Alternative */}
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInputField}
              placeholder="Or type a message..."
              placeholderTextColor="#A3A3A3"
              value={textInput}
              onChangeText={setTextInput}
              onSubmitEditing={handleSendText}
              editable={voiceState === "idle"}
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSendText}
              disabled={voiceState !== "idle" || !textInput.trim()}
              style={[
                styles.sendButton,
                (voiceState !== "idle" || !textInput.trim()) && styles.sendButtonDisabled,
              ]}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Voice Data Consent Modal */}
      <Modal
        visible={showConsentModal}
        animationType="fade"
        transparent
        onRequestClose={handleDeclineConsent}
      >
        <View style={styles.consentModalOverlay}>
          <View style={styles.consentModalContent}>
            <Text style={[styles.consentTitle, isRTL && styles.textRTL]}>
              {translations.voiceDataConsentTitle}
            </Text>
            <Text style={[styles.consentMessage, isRTL && styles.textRTL]}>
              {translations.voiceDataConsentMessage}
            </Text>

            <Pressable onPress={handleOpenPrivacyPolicy} style={styles.learnMoreButton}>
              <Text style={[styles.learnMoreText, isRTL && styles.textRTL]}>
                {translations.voiceDataConsentLearnMore}
              </Text>
            </Pressable>

            <Pressable
              style={styles.acceptButton}
              onPress={handleAcceptConsent}
            >
              <Text style={styles.acceptButtonText}>
                {translations.voiceDataConsentAccept}
              </Text>
            </Pressable>

            <Pressable
              style={styles.declineButton}
              onPress={handleDeclineConsent}
            >
              <Text style={styles.declineButtonText}>
                {translations.voiceDataConsentDecline}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#0D7A5F",
    shadowColor: "#0D7A5F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonInner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  micIconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  micIcon: {
    alignItems: "center",
  },
  micHead: {
    width: 14,
    height: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
  },
  micStand: {
    width: 2,
    height: 6,
    backgroundColor: "#FFFFFF",
    marginTop: 2,
  },
  micBase: {
    width: 16,
    height: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 1.5,
    marginTop: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5E0",
  },
  modalHeaderRTL: {
    flexDirection: "row-reverse",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  textRTL: {
    textAlign: "right",
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  closeButtonText: {
    fontSize: 16,
    color: "#0D7A5F",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#737373",
    textAlign: "center",
    lineHeight: 24,
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  messageBubbleRTL: {
    alignSelf: "flex-end",
  },
  userBubble: {
    backgroundColor: "#0D7A5F",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#FFFFFF",
  },
  assistantText: {
    color: "#1A1A1A",
  },
  voiceCircleContainer: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginVertical: 20,
  },
  pulse: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  wave: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  voiceCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  voiceCircleDisabled: {
    opacity: 0.7,
  },
  largeMicIcon: {
    alignItems: "center",
  },
  largeMicHead: {
    width: 28,
    height: 40,
    borderRadius: 14,
  },
  largeMicStand: {
    width: 3,
    height: 12,
    marginTop: 3,
  },
  largeMicBase: {
    width: 32,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  hintText: {
    fontSize: 14,
    color: "#737373",
    textAlign: "center",
    marginBottom: 16,
  },
  textInputContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  textInputField: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1A1A1A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButton: {
    backgroundColor: "#0D7A5F",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#A3A3A3",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // Consent Modal Styles
  consentModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  consentModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  consentTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
    textAlign: "center",
  },
  consentMessage: {
    fontSize: 15,
    color: "#525252",
    lineHeight: 22,
    marginBottom: 16,
    textAlign: "center",
  },
  learnMoreButton: {
    marginBottom: 20,
    alignItems: "center",
  },
  learnMoreText: {
    fontSize: 14,
    color: "#0D7A5F",
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  acceptButton: {
    backgroundColor: "#0D7A5F",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 12,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  declineButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  declineButtonText: {
    color: "#737373",
    fontSize: 15,
    fontWeight: "500",
  },
});

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import type { ChatMessage } from "@/types";

interface ChatBubbleProps {
  message: ChatMessage;
  isRTL: boolean;
  onReport?: (messageId: string) => void;
}

export function ChatBubble({ message, isRTL, onReport }: ChatBubbleProps) {
  const isUser = message.isUser;
  const [showReportButton, setShowReportButton] = useState(false);

  // Format timestamp
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleLongPress = () => {
    if (!isUser && onReport) {
      setShowReportButton(!showReportButton);
    }
  };

  const handleReport = () => {
    if (onReport) {
      Alert.alert(
        isRTL ? "الإبلاغ عن الرسالة" : "Report Message",
        isRTL
          ? "هل تريد الإبلاغ عن هذه الرسالة لأنها تحتوي على محتوى غير لائق؟"
          : "Would you like to report this message for containing inappropriate content?",
        [
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
            onPress: () => setShowReportButton(false),
          },
          {
            text: isRTL ? "إبلاغ" : "Report",
            style: "destructive",
            onPress: () => {
              onReport(message.id);
              setShowReportButton(false);
              Alert.alert(
                isRTL ? "شكراً" : "Thank You",
                isRTL
                  ? "شكراً للإبلاغ. سنراجع هذه الرسالة."
                  : "Thank you for reporting. We will review this message."
              );
            },
          },
        ]
      );
    }
  };

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.botContainer,
        isRTL && (isUser ? styles.userContainerRTL : styles.botContainerRTL),
      ]}
    >
      {!isUser && (
        <View style={styles.avatarContainer}>
          <View style={styles.botAvatar}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
        </View>
      )}
      <View style={styles.bubbleWrapper}>
        <Pressable
          onLongPress={handleLongPress}
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.botBubble,
          ]}
        >
          <Text
            style={[
              styles.text,
              isUser ? styles.userText : styles.botText,
              isRTL && styles.textRTL,
            ]}
          >
            {message.text}
          </Text>
        </Pressable>

        <View style={styles.bottomRow}>
          <Text
            style={[
              styles.timestamp,
              isUser ? styles.timestampUser : styles.timestampBot,
              isRTL && styles.timestampRTL,
            ]}
          >
            {formatTime(message.timestamp)}
          </Text>

          {!isUser && showReportButton && (
            <Pressable onPress={handleReport} style={styles.reportButton}>
              <Text style={styles.reportButtonText}>
                {isRTL ? "🚨 إبلاغ" : "🚨 Report"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    maxWidth: "85%",
    flexDirection: "row",
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
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0D7A5F",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  bubbleWrapper: {
    flex: 1,
  },
  bubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: "#0D7A5F",
    borderBottomRightRadius: 6,
    shadowColor: "#0D7A5F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  botBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#E8E5E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  userText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  botText: {
    color: "#1A1A1A",
  },
  textRTL: {
    textAlign: "right",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    paddingHorizontal: 4,
  },
  timestampUser: {
    color: "#9CA3AF",
    textAlign: "right",
  },
  timestampBot: {
    color: "#9CA3AF",
    textAlign: "left",
  },
  timestampRTL: {
    textAlign: "right",
  },
  reportButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DC2626",
  },
  reportButtonText: {
    fontSize: 11,
    color: "#DC2626",
    fontWeight: "600",
  },
});

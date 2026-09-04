import { appAlert } from "@/stores/dialogStore";
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import type { ChatMessage } from "@/types";

interface ChatBubbleProps {
  message: ChatMessage;
  isRTL: boolean;
  t: (key: any) => string;
  onReport?: (messageId: string) => void;
}

export function ChatBubble({ message, isRTL, t, onReport }: ChatBubbleProps) {
  const styles = useThemedStyles(makeStyles);
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
      appAlert(
        t("reportMessage"),
        t("reportConfirm"),
        [
          {
            text: t("cancel"),
            style: "cancel",
            onPress: () => setShowReportButton(false),
          },
          {
            text: t("report"),
            style: "destructive",
            onPress: () => {
              onReport(message.id);
              setShowReportButton(false);
              appAlert(t("thankYou"), t("reportReceived"));
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
                {t("report")}
              </Text>
            </Pressable>
          )}
        </View>
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.DEFAULT,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  bubbleWrapper: {
    flex: 1,
  },
  bubble: {
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  // Ink rather than green: green is reserved for prices and primary actions.
  userBubble: {
    backgroundColor: colors.ink,
    borderBottomRightRadius: 6,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  botBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    paddingHorizontal: 4,
    fontFamily: fonts.regular,
  },
  timestampUser: {
    color: colors.onSurface.muted,
    textAlign: "right",
  },
  timestampBot: {
    color: colors.onSurface.muted,
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
    fontFamily: fonts.semibold,
  },
});

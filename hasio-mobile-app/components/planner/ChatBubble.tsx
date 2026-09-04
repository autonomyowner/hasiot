import { appAlert } from "@/stores/dialogStore";
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import type { TranslationKey } from "@/constants/translations";
import type { ChatMessage } from "@/types";
import { PlanCard } from "./PlanCard";

interface ChatBubbleProps {
  message: ChatMessage;
  isRTL: boolean;
  t: (key: TranslationKey) => string;
  onReport?: (messageId: string) => void;
}

export function ChatBubble({ message, isRTL, t, onReport }: ChatBubbleProps) {
  const styles = useThemedStyles(makeStyles);
  const isUser = message.isUser;
  const [showReportButton, setShowReportButton] = useState(false);
  // A finished plan gets the full width: PlanCard is a card, not a bubble.
  const isPlan = !isUser && !!message.plan;

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
        isPlan && styles.planContainer,
        isRTL && (isUser ? styles.userContainerRTL : styles.botContainerRTL),
      ]}
    >
      {!isUser && (
        <View style={[styles.avatarContainer, isRTL && styles.avatarContainerRTL]}>
          <View style={styles.botAvatar}>
            <Feather name="compass" size={14} color={colors.ink} />
          </View>
        </View>
      )}
      <View style={styles.bubbleWrapper}>
        <Pressable
          onLongPress={handleLongPress}
          style={
            isPlan
              ? undefined
              : [styles.bubble, isUser ? styles.userBubble : styles.botBubble,
                 isRTL && (isUser ? styles.userBubbleRTL : styles.botBubbleRTL)]
          }
        >
          {message.plan && !isUser ? (
            <PlanCard plan={message.plan} isRTL={isRTL} t={t} />
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
    backgroundColor: colors.chip,
    borderRadius: 12,
  },
  reportButtonText: {
    fontSize: 11,
    color: colors.signOut,
    fontFamily: fonts.semibold,
  },
});

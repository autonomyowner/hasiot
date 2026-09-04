import { appAlert } from "@/stores/dialogStore";
import { AppDialogHost } from "@/components/ui/AppDialog";
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import type { Id } from "../../convex/_generated/dataModel";
import type { TranslationKey } from "@/constants/translations";
import { type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

type TargetType = "listing" | "service" | "review";

interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  targetType: TargetType;
  targetId: string;
  ownerId?: Id<"users"> | null;
}

const REASONS: Array<{ key: string; label: TranslationKey }> = [
  { key: "spam", label: "reportReasonSpam" },
  { key: "inappropriate", label: "reportReasonInappropriate" },
  { key: "offensive", label: "reportReasonOffensive" },
  { key: "fraud", label: "reportReasonFraud" },
  { key: "other", label: "reportReasonOther" },
];

export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  ownerId,
}: ReportSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
  } = useKeyboardOverlap();
  const { isAuthenticated } = useConvexAuth();
  const reportContent = useMutation(api.moderation.mutations.reportContent);
  const blockUser = useMutation(api.moderation.mutations.blockUser);

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedReason(null);
    setDetails("");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      appAlert(t("reportSignInRequired"));
      return;
    }
    if (!selectedReason || submitting) return;

    setSubmitting(true);
    try {
      const result = await reportContent({
        targetType,
        targetId,
        reason: selectedReason,
        details: details.trim() || undefined,
      });
      appAlert(
        result.alreadyReported ? t("reportAlreadySubmitted") : t("reportSuccess")
      );
      handleClose();
    } catch (err) {
      appAlert(t("reportFailed"));
      setSubmitting(false);
    }
  };

  const handleBlock = () => {
    if (!isAuthenticated || !ownerId) return;
    appAlert(
      t("blockProvider"),
      t("blockConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("block"),
          style: "destructive",
          onPress: async () => {
            try {
              await blockUser({ blockedUserId: ownerId });
              appAlert(t("blockSuccess"));
              handleClose();
            } catch {
              appAlert(t("blockFailed"));
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        style={styles.avoider}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
      {/* keyboardOverlap is Android-only (0 on iOS, where KeyboardAvoidingView
          handles it), so on iOS this always clears the home indicator. */}
      <View
        ref={keyboardRef}
        onLayout={keyboardOnLayout}
        style={[
          styles.sheet,
          {
            paddingBottom:
              keyboardOverlap > 0 ? keyboardOverlap + 24 : insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.handle} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={[styles.title, isRTL && styles.rtl]}>
            {t("reportTitle")}
          </Text>
          <Text style={[styles.subtitle, isRTL && styles.rtl]}>
            {t("reportSubtitle")}
          </Text>

          {REASONS.map((reason) => {
            const active = selectedReason === reason.key;
            return (
              <Pressable
                key={reason.key}
                onPress={() => setSelectedReason(reason.key)}
                style={[styles.reasonRow, active && styles.reasonRowActive]}
              >
                <View
                  style={[
                    styles.radio,
                    active && styles.radioActive,
                  ]}
                >
                  {active && <View style={styles.radioDot} />}
                </View>
                <Text
                  style={[
                    styles.reasonLabel,
                    isRTL && styles.rtl,
                    active && styles.reasonLabelActive,
                  ]}
                >
                  {t(reason.label)}
                </Text>
              </Pressable>
            );
          })}

          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder={t("reportDetailsPlaceholder")}
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            maxLength={500}
            style={[styles.detailsInput, isRTL && styles.rtl]}
          />

          <Pressable
            disabled={!selectedReason || submitting}
            onPress={handleSubmit}
            style={[
              styles.submitBtn,
              (!selectedReason || submitting) && styles.submitBtnDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitText}>{t("reportSubmit")}</Text>
            )}
          </Pressable>

          {ownerId && isAuthenticated && (
            <Pressable onPress={handleBlock} style={styles.blockBtn}>
              <Text style={styles.blockText}>{t("blockProvider")}</Text>
            </Pressable>
          )}

          <Pressable onPress={handleClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t("cancel")}</Text>
          </Pressable>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
      {/* Alerts fired while this modal is open render above it. */}
      <AppDialogHost />
    </Modal>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  avoider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    lineHeight: 20,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  reasonRowActive: {
    borderColor: "#0D7A5F",
    backgroundColor: "#F0FAF6",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: "#0D7A5F",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0D7A5F",
  },
  reasonLabel: {
    fontSize: 15,
    color: "#374151",
    flex: 1,
  },
  reasonLabelActive: {
    color: "#0D7A5F",
    fontFamily: fonts.semibold,
  },
  detailsInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    color: "#111827",
    textAlignVertical: "top",
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: "#0D7A5F",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitBtnDisabled: {
    backgroundColor: "#A7D4C4",
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  blockBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  blockText: {
    color: "#DC2626",
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    color: "#6B7280",
    fontSize: 15,
  },
  rtl: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});

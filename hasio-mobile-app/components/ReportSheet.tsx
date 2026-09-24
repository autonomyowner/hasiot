import { appAlert } from "@/stores/dialogStore";
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import type { Id } from "../../convex/_generated/dataModel";
import type { TranslationKey } from "@/constants/translations";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

type TargetType = "listing" | "service" | "review";

interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  targetType: TargetType;
  targetId: string;
  ownerId?: Id<"users"> | null;
}

const REASONS: { key: string; label: TranslationKey }[] = [
  { key: "spam", label: "reportReasonSpam" },
  { key: "inappropriate", label: "reportReasonInappropriate" },
  { key: "offensive", label: "reportReasonOffensive" },
  { key: "fraud", label: "reportReasonFraud" },
  { key: "other", label: "reportReasonOther" },
];

/**
 * Report a listing, service or review, and optionally block whoever posted it.
 *
 * The last sheet still dressed in the pre-redesign theme — cold greys, a 24px
 * radius, a bold sans title, and text with no font family at all, which in
 * Arabic fell through to the phone's system face. It now matches the rest of
 * the sheet family, and its rows mirror in Arabic.
 */
export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  ownerId,
}: ReportSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const { isAuthenticated } = useConvexAuth();
  const reportContent = useMutation(api.moderation.mutations.reportContent);
  const blockUser = useMutation(api.moderation.mutations.blockUser);

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The confirmation waits for the sheet to be gone. Shown while it was still
  // leaving, it was carried off with the sheet and reappeared underneath.
  const notice = useRef<TranslationKey | null>(null);

  const reset = () => {
    setSelectedReason(null);
    setDetails("");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const finish = (key: TranslationKey) => {
    notice.current = key;
    handleClose();
  };

  const handleDismissed = () => {
    const key = notice.current;
    if (!key) return;
    notice.current = null;
    appAlert(t(key));
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
      finish(result.alreadyReported ? "reportAlreadySubmitted" : "reportSuccess");
    } catch {
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
              finish("blockSuccess");
            } catch {
              appAlert(t("blockFailed"));
            }
          },
        },
      ]
    );
  };

  const canSubmit = !!selectedReason && !submitting;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      onDismissed={handleDismissed}
      header={
        <View style={[styles.head, isRTL && styles.rowRTL]}>
          <Text style={styles.title}>{t("reportTitle")}</Text>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
          {t("reportSubtitle")}
        </Text>

        <View accessibilityRole="radiogroup">
          {REASONS.map((reason) => {
            const active = selectedReason === reason.key;
            return (
              <Pressable
                key={reason.key}
                onPress={() => setSelectedReason(reason.key)}
                style={({ pressed }) => [
                  styles.reasonRow,
                  isRTL && styles.rowRTL,
                  active && styles.reasonRowActive,
                  pressed && !active && styles.reasonRowPressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={t(reason.label)}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
                <Text
                  style={[
                    styles.reasonLabel,
                    isRTL && styles.textRTL,
                    active && styles.reasonLabelActive,
                  ]}
                >
                  {t(reason.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ThemedTextInput
          value={details}
          onChangeText={setDetails}
          placeholder={t("reportDetailsPlaceholder")}
          multiline
          numberOfLines={3}
          maxLength={500}
          isRTL={isRTL}
          textAlign={isRTL ? "right" : "left"}
          style={styles.detailsInput}
        />

        <Pressable
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitBtn,
            !canSubmit && styles.submitBtnDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.submitText}>{t("reportSubmit")}</Text>
          )}
        </Pressable>

        {ownerId && isAuthenticated && (
          <Pressable
            onPress={handleBlock}
            style={({ pressed }) => [styles.blockBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.blockText}>{t("blockProvider")}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>{t("cancel")}</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  textRTL: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.ink,
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface.variant,
    marginBottom: 16,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  // The mint chip surface with the dark lime: lime itself is a fill and would
  // read at 1.3:1 as a border or a label.
  reasonRowActive: {
    borderColor: colors.primary.deep,
    backgroundColor: colors.mint,
  },
  reasonRowPressed: {
    backgroundColor: colors.surface.variant,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.onSurface.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.primary.deep,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.deep,
  },
  reasonLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  reasonLabelActive: {
    color: colors.primary.deep,
    fontFamily: fonts.semibold,
  },
  detailsInput: {
    marginTop: 8,
    minHeight: 88,
    backgroundColor: colors.surface.variant,
    borderRadius: 14,
    fontSize: 15,
    textAlignVertical: "top",
  },
  // Lime is a fill, so its label and spinner are ink: white on it is 1.4:1.
  submitBtn: {
    marginTop: 16,
    minHeight: 50,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  blockBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.signOut,
  },
  blockText: {
    color: colors.signOut,
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  cancelBtn: {
    marginTop: 4,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: colors.onSurface.variant,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.7,
  },
});

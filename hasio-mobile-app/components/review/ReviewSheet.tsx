import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { appAlert } from "@/stores/dialogStore";
import { getReviewErrorKey } from "@/lib/reviewError";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { ThemedTextInput } from "@/components/ui";
import { AppDialogHost } from "@/components/ui/AppDialog";
import { StarRating } from "./StarRating";

const MAX_TEXT = 500;

export interface ExistingReview {
  _id: string;
  rating: number;
  content?: string;
  isAnonymous?: boolean;
}

interface ReviewSheetProps {
  visible: boolean;
  listingId: string;
  /** Passing this links the review to a completed stay, which is what earns the
   *  verified badge. The server checks the booking really is the guest's own. */
  bookingId?: string;
  existing?: ExistingReview | null;
  onClose: () => void;
  onDone?: () => void;
}

export function ReviewSheet({
  visible,
  listingId,
  bookingId,
  existing,
  onClose,
  onDone,
}: ReviewSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [content, setContent] = useState(existing?.content ?? "");
  const [anonymous, setAnonymous] = useState(existing?.isAnonymous ?? false);
  const [saving, setSaving] = useState(false);

  const addReview = useMutation(api.reviews.mutations.addReview);
  const updateReview = useMutation(api.reviews.mutations.updateMyReview);
  const deleteReview = useMutation(api.reviews.mutations.deleteMyReview);

  // Reopening the sheet on a different listing must not show the last one's
  // text, and opening it to edit must show what is already there.
  useEffect(() => {
    if (!visible) return;
    setRating(existing?.rating ?? 0);
    setContent(existing?.content ?? "");
    setAnonymous(existing?.isAnonymous ?? false);
  }, [visible, existing]);

  const submit = async () => {
    if (saving) return;
    if (rating < 1) {
      appAlert(t("reviewNeedsStars"));
      return;
    }
    setSaving(true);
    try {
      const text = content.trim() ? content.trim() : undefined;
      if (existing) {
        await updateReview({
          reviewId: existing._id as never,
          rating,
          content: text,
          isAnonymous: anonymous,
        });
        appAlert(t("reviewUpdated"));
      } else {
        await addReview({
          listingId: listingId as never,
          rating,
          content: text,
          isAnonymous: anonymous,
          bookingId: bookingId as never,
        });
        appAlert(t("reviewSaved"));
      }
      onDone?.();
      onClose();
    } catch (error) {
      // Not the server's string: half of it is in the wrong language, and a
      // production deployment redacts anything that is not a ConvexError, so
      // showing it verbatim printed "Server Error" to the guest.
      appAlert(t("error"), t(getReviewErrorKey(error)));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await deleteReview({ reviewId: existing._id as never });
      appAlert(t("reviewDeleted"));
      onDone?.();
      onClose();
    } catch (error) {
      appAlert(t("error"), t(getReviewErrorKey(error)));
    } finally {
      setSaving(false);
    }
  };

  // Deleting a review cannot be undone and takes the written text with it, so
  // it asks first — the same two-button destructive pattern the rest of the
  // app uses for a delete.
  const remove = () => {
    if (!existing || saving) return;
    appAlert(t("reviewDelete"), t("reviewDeleteConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => void confirmRemove() },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.head, isRTL && styles.rowRTL]}>
          <Text style={styles.title}>
            {existing ? t("editYourReview") : t("rateThisPlace")}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={[styles.starsRow, isRTL && styles.starsRowRTL]}>
          <StarRating
            value={rating}
            size={34}
            onChange={setRating}
            label={t("rateThisPlace")}
          />
        </View>

        <ThemedTextInput
          value={content}
          onChangeText={(next: string) => setContent(next.slice(0, MAX_TEXT))}
          placeholder={t("reviewPlaceholder")}
          multiline
          numberOfLines={4}
          style={styles.input}
          textAlign={isRTL ? "right" : "left"}
        />
        <Text style={[styles.counter, isRTL && styles.textRTL]}>
          {content.length}/{MAX_TEXT}
        </Text>

        <Pressable
          style={[styles.anonRow, isRTL && styles.rowRTL]}
          onPress={() => setAnonymous((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: anonymous }}
        >
          <Feather
            name={anonymous ? "check-square" : "square"}
            size={19}
            color={anonymous ? colors.primary.deep : colors.onSurface.muted}
          />
          <Text style={styles.anonText}>{t("reviewAnonymous")}</Text>
        </Pressable>

        <Pressable
          style={[styles.submit, saving && styles.submitDisabled]}
          onPress={submit}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.submitText}>
              {existing ? t("reviewUpdate") : t("reviewSubmit")}
            </Text>
          )}
        </Pressable>

        {existing && (
          <Pressable
            style={styles.delete}
            onPress={remove}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.deleteText}>{t("reviewDelete")}</Text>
          </Pressable>
        )}
      </View>
      {/* Alerts fired while this modal is open render above it. Without a host
          inside the Modal every appAlert here would draw behind the sheet. */}
      <AppDialogHost />
    </Modal>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31, 29, 23, 0.35)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surface.DEFAULT,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 20,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
    starsRow: { alignItems: "center", paddingVertical: 20 },
    starsRowRTL: { alignItems: "center" },
    input: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
    counter: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.onSurface.muted,
      marginTop: 4,
      textAlign: "right",
    },
    anonRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14 },
    anonText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface.variant },
    // Lime is a fill, so its label is ink: white on it is 1.4:1.
    submit: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: colors.primary.DEFAULT,
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
    delete: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
    deleteText: { fontFamily: fonts.medium, fontSize: 15, color: colors.signOut },
  });

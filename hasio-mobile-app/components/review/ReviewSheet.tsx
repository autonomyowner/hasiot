import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { appAlert } from "@/stores/dialogStore";
import { getReviewErrorKey } from "@/lib/reviewError";
import { colors, type AppFonts } from "@/constants/colors";
import type { TranslationKey } from "@/constants/translations";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { ThemedTextInput } from "@/components/ui";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Id } from "../../../convex/_generated/dataModel";
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
  /**
   * What is being reviewed: a place, or — since 1.1.0 — a service. Pass
   * exactly one. The server refuses both or neither, and each has its own
   * duplicate rule (one review per place, one per service).
   */
  listingId?: string;
  serviceId?: string;
  /** Passing this links the review to a completed stay or service booking,
   *  which is what earns the verified badge. The server checks the booking
   *  really is the guest's own, and of this place or service. */
  bookingId?: string;
  existing?: ExistingReview | null;
  onClose: () => void;
  onDone?: () => void;
}

export function ReviewSheet({
  visible,
  listingId,
  serviceId,
  bookingId,
  existing,
  onClose,
  onDone,
}: ReviewSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  // What the sheet asks for. Editing reads the same for both; a new review
  // names what it is of — "Rate this place" over a guide read as a mistake.
  const rateLabel = serviceId ? t("rateThisService") : t("rateThisPlace");

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [content, setContent] = useState(existing?.content ?? "");
  const [anonymous, setAnonymous] = useState(existing?.isAnonymous ?? false);
  const [saving, setSaving] = useState(false);
  // What to confirm once the sheet has gone. Raised while it was still
  // leaving, the alert was carried off with it and reappeared underneath.
  const notice = useRef<TranslationKey | null>(null);

  const addReview = useMutation(api.reviews.mutations.addReview);
  const updateReview = useMutation(api.reviews.mutations.updateMyReview);
  const deleteReview = useMutation(api.reviews.mutations.deleteMyReview);

  // Reopening the sheet on a different listing must not show the last one's
  // text, and opening it to edit must show what is already there — including
  // when the guest's own review only arrives after the sheet has opened.
  const syncKey = visible ? (existing?._id ?? "new") : null;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (syncKey !== null) {
      setRating(existing?.rating ?? 0);
      setContent(existing?.content ?? "");
      setAnonymous(existing?.isAnonymous ?? false);
    }
  }

  const finish = (key: TranslationKey) => {
    notice.current = key;
    onDone?.();
    onClose();
  };

  const handleDismissed = () => {
    const key = notice.current;
    if (!key) return;
    notice.current = null;
    appAlert(t(key));
  };

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
        // An edit or a delete names the review, whatever it is of.
        await updateReview({
          reviewId: existing._id as Id<"reviews">,
          rating,
          content: text,
          isAnonymous: anonymous,
        });
        finish("reviewUpdated");
      } else {
        const target = serviceId
          ? { serviceId: serviceId as Id<"services"> }
          : listingId
            ? { listingId: listingId as Id<"listings"> }
            : {};
        await addReview({
          ...target,
          rating,
          content: text,
          isAnonymous: anonymous,
          bookingId: bookingId ? (bookingId as Id<"bookings">) : undefined,
        });
        finish("reviewSaved");
      }
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
      await deleteReview({ reviewId: existing._id as Id<"reviews"> });
      finish("reviewDeleted");
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={handleDismissed}
      header={
        <View style={[styles.head, isRTL && styles.rowRTL]}>
          <Text style={styles.title}>
            {existing ? t("editYourReview") : rateLabel}
          </Text>
          <Pressable
            onPress={onClose}
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
      <View style={styles.starsRow}>
        <StarRating
          value={rating}
          size={34}
          onChange={setRating}
          label={rateLabel}
        />
      </View>

      <ThemedTextInput
        value={content}
        onChangeText={setContent}
        // The field stops at the limit itself. Trimming in onChangeText handed
        // the input a value it had not typed, and the cursor jumped to the end.
        maxLength={MAX_TEXT}
        placeholder={t("reviewPlaceholder")}
        multiline
        numberOfLines={4}
        style={styles.input}
        textAlign={isRTL ? "right" : "left"}
      />
      {/* The counter sits at the field's trailing end: right in English,
          left in Arabic, where the typing starts on the right. */}
      <Text style={[styles.counter, isRTL && styles.counterRTL]}>
        {content.length}/{MAX_TEXT}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.anonRow,
          isRTL && styles.rowRTL,
          pressed && styles.pressed,
        ]}
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
        style={({ pressed }) => [
          styles.submit,
          saving && styles.submitDisabled,
          pressed && !saving && styles.pressed,
        ]}
        onPress={submit}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving, busy: saving }}
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
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
          onPress={remove}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.deleteText}>{t("reviewDelete")}</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    rowRTL: { flexDirection: "row-reverse" },
    title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
    starsRow: { alignItems: "center", paddingVertical: 20 },
    input: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
    counter: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.onSurface.muted,
      marginTop: 4,
      textAlign: "right",
    },
    counterRTL: { textAlign: "left" },
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
    pressed: { opacity: 0.7 },
  });

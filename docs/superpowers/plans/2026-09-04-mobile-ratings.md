# Mobile Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guest can rate and review any place, see what others said, and is asked "how was your stay?" after a booking finishes.

**Architecture:** Entirely new UI — nothing on any branch has a review screen. Written against this week's design system: `useThemedStyles(makeStyles)`, the lime palette, and the Cairo/Instrument-Serif font roles. The backend is already in place from the backend plan, and decides verification itself.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router, Convex React hooks.

**Depends on:** `docs/superpowers/plans/2026-09-04-booking-review-backend.md`, complete and pushed to dev. Task 6 also needs `app/bookings/[id].tsx` from the mobile booking plan.

**Design doc:** `docs/superpowers/specs/2026-09-04-bookings-and-ratings-design.md`

---

## Ground rules

1. **No new native modules and no new dependencies at all.** This ships over the air to binaries already in the stores; a bundle referencing a native module the binary lacks crashes on launch. Everything here uses what is already installed.
2. **Do not touch `hasio-mobile-app/app.json`.** `version` stays `1.0.2`.
3. **Never run `eas update`, `eas build`, `npx convex deploy`, or anything with `--prod`.**
4. **Every string goes into `constants/translations.ts` under BOTH `en` and `ar`,** and that file is **merged, never replaced**.
5. **Arabic must be written with the Write/Edit tools.** Bash heredocs, `sed` and `perl` corrupt Arabic on this machine.
6. Use `appAlert` from `@/stores/dialogStore`, never `Alert.alert`.
7. Styles go through `useThemedStyles(makeStyles)` where `makeStyles = (fonts: AppFonts) => StyleSheet.create({...})`. A bare `StyleSheet.create` at module scope captures the Latin font names and never updates when the language changes to Arabic.
8. Each task ends with `npx tsc --noEmit` clean, from `hasio-mobile-app/`.

---

## Two rules the UI must not undermine

**A listing with no reviews shows no star.** The backend clears fabricated ratings, and `getSummary` returns `average: null` for a place nobody has rated. Rendering `null` as `0` would put a one-star badge on every unrated hotel — worse than the invented 4.8 it replaced.

**Verified is not a client claim.** The badge renders from `review.isVerified`, which the server sets only when the cited booking belongs to that guest, at that listing, and is completed. Never compute it in the app.

---

## File structure

| File | Responsibility |
|---|---|
| `components/review/StarRating.tsx` | stars, display and interactive, RTL-aware |
| `components/review/RatingSummary.tsx` | average, count, 1–5 histogram |
| `components/review/ReviewCard.tsx` | one review, with verified badge and report |
| `components/review/ReviewSheet.tsx` | write, edit, delete your own |
| `components/review/index.ts` | barrel |
| `app/reviews/[listingId].tsx` | see-all screen |

---

### Task 1: Copy, in both languages

**Files:**
- Modify: `hasio-mobile-app/constants/translations.ts`

- [ ] **Step 1: Add these keys to the `en` object**

```ts
    reviewsTitle: "Reviews",
    reviewsNone: "No reviews yet",
    reviewsBeFirst: "Be the first to rate this place",
    reviewsSeeAll: "See all reviews",
    reviewsCountOne: "1 review",
    reviewsCountMany: "{n} reviews",
    rateThisPlace: "Rate this place",
    editYourReview: "Edit your review",
    yourReview: "Your review",
    reviewDelete: "Delete review",
    reviewDeleteConfirm: "Delete your review? This cannot be undone.",
    reviewPlaceholder: "Tell people what it was like (optional)",
    reviewAnonymous: "Post anonymously",
    reviewSubmit: "Post review",
    reviewUpdate: "Save changes",
    reviewSaved: "Thanks for your review",
    reviewUpdated: "Review updated",
    reviewDeleted: "Review deleted",
    reviewNeedsStars: "Choose a star rating first",
    reviewVerifiedStay: "Verified stay",
    reviewAnonymousAuthor: "Anonymous",
    rateYourStay: "How was your stay?",
    rateYourStayBody: "Your rating helps other travellers in Al-Ahsa.",
    reviewSignInFirst: "Sign in to leave a review",
```

- [ ] **Step 2: Add the matching keys to the `ar` object, using the Edit tool**

```ts
    reviewsTitle: "التقييمات",
    reviewsNone: "لا توجد تقييمات بعد",
    reviewsBeFirst: "كن أول من يقيّم هذا المكان",
    reviewsSeeAll: "عرض كل التقييمات",
    reviewsCountOne: "تقييم واحد",
    reviewsCountMany: "{n} تقييم",
    rateThisPlace: "قيّم هذا المكان",
    editYourReview: "تعديل تقييمك",
    yourReview: "تقييمك",
    reviewDelete: "حذف التقييم",
    reviewDeleteConfirm: "هل تريد حذف تقييمك؟ لا يمكن التراجع عن هذا.",
    reviewPlaceholder: "شاركنا تجربتك (اختياري)",
    reviewAnonymous: "النشر بدون اسم",
    reviewSubmit: "نشر التقييم",
    reviewUpdate: "حفظ التغييرات",
    reviewSaved: "شكرًا على تقييمك",
    reviewUpdated: "تم تحديث التقييم",
    reviewDeleted: "تم حذف التقييم",
    reviewNeedsStars: "اختر عدد النجوم أولاً",
    reviewVerifiedStay: "إقامة موثقة",
    reviewAnonymousAuthor: "مجهول",
    rateYourStay: "كيف كانت إقامتك؟",
    rateYourStayBody: "تقييمك يساعد المسافرين الآخرين في الأحساء.",
    reviewSignInFirst: "سجّل الدخول لكتابة تقييم",
```

- [ ] **Step 3: Prove both objects match**

Run from `hasio-mobile-app/`:
```bash
node -e "const s=require('fs').readFileSync('constants/translations.ts','utf8');const g=n=>{const i=s.indexOf(n+': {');const b=s.slice(i);let d=0,j=b.indexOf('{');for(let k=j;k<b.length;k++){if(b[k]==='{')d++;if(b[k]==='}'){d--;if(!d){j=k;break}}}return new Set([...b.slice(0,j).matchAll(/^\s{4}(\w+):/gm)].map(m=>m[1]))};const en=g('en'),ar=g('ar');console.log('en',en.size,'ar',ar.size);console.log('missing from ar:',[...en].filter(k=>!ar.has(k)));console.log('missing from en:',[...ar].filter(k=>!en.has(k)))"
```
Expected: equal sizes, both lists empty.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add hasio-mobile-app/constants/translations.ts
git commit -m "feat(mobile): review copy in both languages"
```

---

### Task 2: Stars

**Files:**
- Create: `hasio-mobile-app/components/review/StarRating.tsx`

- [ ] **Step 1: Write it**

```tsx
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

interface StarRatingProps {
  /** 0–5. A half-star renders as filled — the input only ever produces whole stars. */
  value: number;
  size?: number;
  /** Passing this makes the row interactive. Omit it for a read-only display. */
  onChange?: (value: number) => void;
  /** Accessible name for the interactive row, e.g. "Rate this place". */
  label?: string;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Five stars, read-only or tappable.
 *
 * The row mirrors in Arabic, so the first star sits on the right and tapping
 * the rightmost gives one star — the same gesture an Arabic reader expects
 * from a row that fills from where reading begins.
 */
export function StarRating({ value, size = 18, onChange, label }: StarRatingProps) {
  const styles = useThemedStyles(makeStyles);
  const { isRTL } = useLanguage();
  const interactive = !!onChange;

  return (
    <View
      style={[styles.row, isRTL && styles.rowRTL]}
      accessibilityRole={interactive ? "adjustable" : "image"}
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 5, now: value }}
    >
      {STARS.map((star) => {
        const filled = star <= Math.round(value);
        const icon = (
          <Feather
            name="star"
            size={size}
            color={filled ? colors.warm : colors.onSurface.muted}
            // Feather has no filled star, so a filled one is the outline drawn
            // at full opacity over itself — cheaper than shipping a second icon set.
            style={filled ? styles.filled : styles.empty}
          />
        );

        if (!interactive) return <View key={star}>{icon}</View>;

        return (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${star}`}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (_fonts: AppFonts) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 3 },
    rowRTL: { flexDirection: "row-reverse" },
    filled: { opacity: 1 },
    empty: { opacity: 0.35 },
  });
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add hasio-mobile-app/components/review/StarRating.tsx
git commit -m "feat(mobile): a star row that reads right-to-left in Arabic"
```

---

### Task 3: The rating summary

**Files:**
- Create: `hasio-mobile-app/components/review/RatingSummary.tsx`

- [ ] **Step 1: Write it**

```tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { StarRating } from "./StarRating";

export interface RatingSummaryValue {
  /** null when nobody has rated — never 0, which would read as one star. */
  average: number | null;
  count: number;
  /** Index 0 is one star, index 4 is five. */
  histogram: [number, number, number, number, number];
}

/**
 * Average, count and the distribution behind them.
 *
 * The bars matter more than the average: a 4.2 made of straight fours reads
 * very differently from a 4.2 made of fives and ones, and only the histogram
 * shows which one a place is.
 */
export function RatingSummary({ value }: { value: RatingSummaryValue }) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();

  if (value.count === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
          {t("reviewsNone")}
        </Text>
        <Text style={[styles.emptyBody, isRTL && styles.textRTL]}>
          {t("reviewsBeFirst")}
        </Text>
      </View>
    );
  }

  const max = Math.max(...value.histogram, 1);

  return (
    <View style={[styles.wrap, isRTL && styles.rowRTL]}>
      <View style={styles.scoreBlock}>
        <Text style={styles.score}>{value.average?.toFixed(1)}</Text>
        <StarRating value={value.average ?? 0} size={14} />
        <Text style={styles.count}>
          {value.count === 1
            ? t("reviewsCountOne")
            : t("reviewsCountMany").replace("{n}", String(value.count))}
        </Text>
      </View>

      <View style={styles.bars}>
        {[5, 4, 3, 2, 1].map((star) => {
          const n = value.histogram[star - 1];
          return (
            <View key={star} style={[styles.barRow, isRTL && styles.rowRTL]}>
              <Text style={styles.barLabel}>{star}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    // Width from the busiest bucket, not the total: with 40 of
                    // one star and 2 of another, percentages of the total leave
                    // every bar but one invisible.
                    { width: `${(n / max) * 100}%` },
                    isRTL && styles.barFillRTL,
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{n}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "center", gap: 20 },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    scoreBlock: { alignItems: "center", gap: 4 },
    score: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, color: colors.ink },
    count: { fontFamily: fonts.regular, fontSize: 12, color: colors.onSurface.muted },
    bars: { flex: 1, gap: 5 },
    barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    barLabel: {
      fontFamily: fonts.medium,
      fontSize: 11,
      color: colors.onSurface.muted,
      width: 10,
      textAlign: "center",
    },
    barTrack: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.chip,
      overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primary.DEFAULT },
    barFillRTL: { alignSelf: "flex-end" },
    barCount: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.onSurface.muted,
      width: 20,
      textAlign: "center",
    },
    empty: { paddingVertical: 8, gap: 4 },
    emptyTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
    emptyBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurface.muted },
  });
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add hasio-mobile-app/components/review/RatingSummary.tsx
git commit -m "feat(mobile): rating summary with the distribution behind the average"
```

---

### Task 4: One review

**Files:**
- Create: `hasio-mobile-app/components/review/ReviewCard.tsx`

- [ ] **Step 1: Write it**

```tsx
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { ReportSheet } from "@/components/ReportSheet";
import { StarRating } from "./StarRating";

export interface ReviewItem {
  _id: string;
  rating: number;
  content?: string;
  isAnonymous?: boolean;
  /** Set by the server when the review cites the author's own completed stay. */
  isVerified?: boolean;
  createdAt: number;
  user?: { firstName?: string; lastName?: string } | null;
}

function authorName(review: ReviewItem, anonymousLabel: string): string {
  if (review.isAnonymous || !review.user) return anonymousLabel;
  const name = [review.user.firstName, review.user.lastName].filter(Boolean).join(" ").trim();
  return name || anonymousLabel;
}

export function ReviewCard({ review }: { review: ReviewItem }) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const [reportOpen, setReportOpen] = useState(false);

  const name = authorName(review, t("reviewAnonymousAuthor"));
  const date = new Date(review.createdAt).toLocaleDateString(
    language === "ar" ? "ar-SA" : "en-GB",
    { year: "numeric", month: "short" }
  );

  return (
    <View style={styles.card}>
      <View style={[styles.head, isRTL && styles.rowRTL]}>
        <View style={[styles.who, isRTL && styles.rowRTL]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.whoText}>
            <Text style={[styles.name, isRTL && styles.textRTL]} numberOfLines={1}>
              {name}
            </Text>
            <View style={[styles.metaRow, isRTL && styles.rowRTL]}>
              <StarRating value={review.rating} size={12} />
              <Text style={styles.date}>{date}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => setReportOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("reportTitle")}
        >
          <Feather name="more-horizontal" size={18} color={colors.onSurface.muted} />
        </Pressable>
      </View>

      {/* The badge is rendered from the server's own flag. Never recompute it
          here — "this guest actually stayed" is the one claim the app cannot
          be trusted to make about itself. */}
      {review.isVerified && (
        <View style={[styles.verified, isRTL && styles.verifiedRTL]}>
          <Feather name="check-circle" size={11} color={colors.primary.deep} />
          <Text style={styles.verifiedText}>{t("reviewVerifiedStay")}</Text>
        </View>
      )}

      {!!review.content && (
        <Text style={[styles.body, isRTL && styles.textRTL]}>{review.content}</Text>
      )}

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="review"
        targetId={review._id}
      />
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    card: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: 8,
    },
    head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.sand,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: { fontFamily: fonts.serif, fontSize: 16, color: colors.ink },
    whoText: { flex: 1, gap: 3 },
    name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    date: { fontFamily: fonts.regular, fontSize: 11, color: colors.onSurface.muted },
    verified: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.mint,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    verifiedRTL: { alignSelf: "flex-end", flexDirection: "row-reverse" },
    verifiedText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.primary.deep },
    body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.onSurface.variant },
  });
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add hasio-mobile-app/components/review/ReviewCard.tsx
git commit -m "feat(mobile): a review card, with the server's verified badge"
```

---

### Task 5: Writing, editing and deleting

**Files:**
- Create: `hasio-mobile-app/components/review/ReviewSheet.tsx`, `hasio-mobile-app/components/review/index.ts`

- [ ] **Step 1: Write the sheet**

```tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { appAlert } from "@/stores/dialogStore";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { ThemedTextInput } from "@/components/ui";
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
      // Backend errors are bilingual "عربي / English" strings, already
      // readable in either language, so they surface as-is.
      appAlert(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing || saving) return;
    setSaving(true);
    try {
      await deleteReview({ reviewId: existing._id as never });
      appAlert(t("reviewDeleted"));
      onDone?.();
      onClose();
    } catch (error) {
      appAlert(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
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
```

- [ ] **Step 2: Write the barrel**

Create `hasio-mobile-app/components/review/index.ts`:

```ts
export { StarRating } from "./StarRating";
export { RatingSummary, type RatingSummaryValue } from "./RatingSummary";
export { ReviewCard, type ReviewItem } from "./ReviewCard";
export { ReviewSheet, type ExistingReview } from "./ReviewSheet";
```

- [ ] **Step 3: Check `ThemedTextInput` accepts what you passed**

Run: `grep -n "interface\|Props\|multiline\|textAlign" hasio-mobile-app/components/ui/ThemedTextInput.tsx | head`
If it does not forward `multiline`, `numberOfLines` or `textAlign` to the underlying `TextInput`, either widen its props or use a plain `TextInput` styled to match. Say which you did.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add hasio-mobile-app/components/review
git commit -m "feat(mobile): write, edit and delete your own review"
```

---

### Task 6: Reviews on the listing sheet

**Files:**
- Modify: `hasio-mobile-app/components/listing/ListingDetailSheet.tsx`

**Hand edit.** This file was rebuilt on `brand-lime` this week — amenity icons, the pinned Book bar. Do not replace it.

- [ ] **Step 1: Add the imports**

```tsx
import { useQuery } from "convex/react";
import { api } from "@/backend";
import { RatingSummary, ReviewCard, ReviewSheet } from "@/components/review";
```

- [ ] **Step 2: Add the queries and state inside the component**

```tsx
  const [reviewOpen, setReviewOpen] = useState(false);

  const summary = useQuery(
    api.reviews.queries.getSummary,
    item ? { listingId: item.id as never } : "skip"
  );
  const reviews = useQuery(
    api.reviews.queries.listForListing,
    item ? { listingId: item.id as never, limit: 3 } : "skip"
  );
  const myReview = useQuery(
    api.reviews.queries.getMine,
    item ? { listingId: item.id as never } : "skip"
  );
```

- [ ] **Step 3: Render the section**

Inside the ScrollView, after the amenities block and before the ScrollView closes, add:

```tsx
                <Section title={t("reviewsTitle")} isRTL={isRTL} styles={styles}>
                  {summary && <RatingSummary value={summary} />}

                  <Pressable
                    style={styles.rateButton}
                    onPress={() => setReviewOpen(true)}
                    accessibilityRole="button"
                  >
                    <Feather name="star" size={15} color={colors.ink} />
                    <Text style={styles.rateButtonText}>
                      {myReview ? t("editYourReview") : t("rateThisPlace")}
                    </Text>
                  </Pressable>

                  {reviews?.map((review) => (
                    <ReviewCard key={review._id} review={review as never} />
                  ))}

                  {!!summary && summary.count > 3 && (
                    <Pressable
                      onPress={() => {
                        onClose();
                        router.push(`/reviews/${item.id}` as never);
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.seeAll, isRTL && styles.textRTL]}>
                        {t("reviewsSeeAll")}
                      </Text>
                    </Pressable>
                  )}
                </Section>
```

Match `Section`'s real signature — check how the existing sections in this file call it and follow that exactly.

- [ ] **Step 4: Render the sheet beside the others**

```tsx
      {item && (
        <ReviewSheet
          visible={reviewOpen}
          listingId={item.id}
          existing={myReview as never}
          onClose={() => setReviewOpen(false)}
        />
      )}
```

- [ ] **Step 5: Add the two styles**

```tsx
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: colors.primary.DEFAULT,
  },
  rateButtonText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  seeAll: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary.deep,
    paddingVertical: 14,
  },
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add hasio-mobile-app/components/listing/ListingDetailSheet.tsx
git commit -m "feat(mobile): reviews on the listing sheet"
```

---

### Task 7: See all reviews

**Files:**
- Create: `hasio-mobile-app/app/reviews/[listingId].tsx`

- [ ] **Step 1: Write the screen**

```tsx
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/backend";
import { BackButton } from "@/components/ui/BackButton";
import { RatingSummary, ReviewCard } from "@/components/review";
import { ScreenGradient } from "@/components/ui/Gradients";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { LIST_CONTAINER_PADDING } from "@/constants/layout";

export default function ReviewsScreen() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();

  const summary = useQuery(
    api.reviews.queries.getSummary,
    listingId ? { listingId: listingId as never } : "skip"
  );
  const reviews = useQuery(
    api.reviews.queries.listForListing,
    listingId ? { listingId: listingId as never, limit: 100 } : "skip"
  );

  return (
    <View style={styles.screen}>
      <ScreenGradient />
      <View style={[styles.header, { paddingTop: insets.top + 8 }, isRTL && styles.rowRTL]}>
        <BackButton />
        <Text style={styles.title}>{t("reviewsTitle")}</Text>
      </View>

      <FlatList
        data={reviews ?? []}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <ReviewCard review={item as never} />}
        ListHeaderComponent={
          summary ? (
            <View style={styles.summaryWrap}>
              <RatingSummary value={summary} />
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.list,
          // A pushed stack route, not inside the tab pager, so it clears the
          // safe area rather than the floating tab bar.
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: LIST_CONTAINER_PADDING,
      paddingBottom: 12,
    },
    rowRTL: { flexDirection: "row-reverse" },
    title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
    list: { paddingHorizontal: LIST_CONTAINER_PADDING },
    summaryWrap: { paddingVertical: 16 },
  });
```

- [ ] **Step 2: Register the route**

In `hasio-mobile-app/app/_layout.tsx`, beside the other `<Stack.Screen>` entries:

```tsx
        <Stack.Screen name="reviews" />
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add hasio-mobile-app/app/reviews hasio-mobile-app/app/_layout.tsx
git commit -m "feat(mobile): a see-all reviews screen"
```

---

### Task 8: "How was your stay?"

**Files:**
- Modify: `hasio-mobile-app/app/bookings/[id].tsx`

This is the prompt that produces verified reviews. It passes the `bookingId`, and the server decides whether that earns the badge.

**Requires the mobile booking plan's Task 9.** If `app/bookings/[id].tsx` does not exist yet, stop and do that plan first.

- [ ] **Step 1: Add the imports**

```tsx
import { useQuery } from "convex/react";
import { ReviewSheet } from "@/components/review";
```

- [ ] **Step 2: Add state and the existing-review query**

```tsx
  const [reviewOpen, setReviewOpen] = useState(false);

  const myReview = useQuery(
    api.reviews.queries.getMine,
    booking?.listingId ? { listingId: booking.listingId } : "skip"
  );
```

- [ ] **Step 3: Render the prompt for a completed stay**

Place it above the booking's other actions:

```tsx
      {booking?.status === "completed" && !myReview && (
        <View style={styles.ratePrompt}>
          <Text style={[styles.ratePromptTitle, isRTL && styles.textRTL]}>
            {t("rateYourStay")}
          </Text>
          <Text style={[styles.ratePromptBody, isRTL && styles.textRTL]}>
            {t("rateYourStayBody")}
          </Text>
          <Pressable
            style={styles.ratePromptButton}
            onPress={() => setReviewOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.ratePromptButtonText}>{t("rateThisPlace")}</Text>
          </Pressable>
        </View>
      )}
```

- [ ] **Step 4: Render the sheet, carrying the booking id**

```tsx
      {booking && (
        <ReviewSheet
          visible={reviewOpen}
          listingId={booking.listingId}
          bookingId={booking._id}
          onClose={() => setReviewOpen(false)}
        />
      )}
```

- [ ] **Step 5: Add the styles**

```tsx
  ratePrompt: {
    backgroundColor: colors.mint,
    borderRadius: 18,
    padding: 18,
    gap: 6,
    marginBottom: 16,
  },
  ratePromptTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  ratePromptBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurface.variant,
  },
  ratePromptButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  ratePromptButtonText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary.DEFAULT },
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add "hasio-mobile-app/app/bookings/[id].tsx"
git commit -m "feat(mobile): ask how the stay was, once it is over"
```

---

### Task 9: Full verification

**Files:** none — verification only.

- [ ] **Step 1: No new dependencies**

Run: `git diff main -- hasio-mobile-app/package.json`
Expected: nothing added by *this* plan. `react-native-calendars` from the booking plan is the only new runtime dependency across both.

- [ ] **Step 2: Version untouched**

Run: `grep '"version"' hasio-mobile-app/app.json`
Expected: `"version": "1.0.2"`.

- [ ] **Step 3: No native modules anywhere**

Run: `grep -rn "expo-notifications\|expo-haptics\|expo-blur\|expo-device" hasio-mobile-app/app hasio-mobile-app/components hasio-mobile-app/hooks`
Expected: **no output**.

- [ ] **Step 4: Build**

Run from `hasio-mobile-app/`:
```bash
npx tsc --noEmit && npm test && npx expo export --platform android
```
Expected: all three exit 0.

- [ ] **Step 5: Report**

Nothing to commit if all four passed. Say so.

---

## Done when

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx expo export --platform android` | exit 0 |
| A listing nobody rated | shows "no reviews yet", **no star, no zero** |
| A review from a completed stay | carries the verified badge |
| A review from someone who never stayed | does not |
| `app.json` version | still **1.0.2** |
| New dependencies from this plan | none |

## Manual run-through, in Expo Go against dev

1. Open a listing with no reviews — the summary reads "no reviews yet" and no star appears on its card.
2. Rate it three stars with a comment. The card's star appears and reads 3.0.
3. Reopen: the button now says *edit your review*, and the sheet is pre-filled.
4. Edit to five stars, then delete it. The listing's star disappears entirely rather than falling back to a stale 3.0.
5. Complete a booking (confirm it as the host, then run the completion cron or set the status directly on dev), open the booking, and use *how was your stay?* — that review shows **verified**.
6. Switch to Arabic and check the stars fill from the right and the histogram bars mirror.

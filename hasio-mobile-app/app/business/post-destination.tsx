import { appAlert } from "@/stores/dialogStore";
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Keyboard,
  Platform,
  type TextInput,
} from "react-native";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import Animated, { FadeInDown } from "react-native-reanimated";
import { PhotoPickerField } from "@/components/hosting/PhotoPickerField";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { getSubmitErrorKey } from "@/lib/submitError";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { uploadMultipleToConvex } from "@/lib/convexUpload";
import {
  EMPTY_PLACE_FORM,
  editedPlaceLocation,
  firstError,
  isLive,
  isLocalPhoto,
  newPlaceLocation,
  ownerStatusOf,
  placeFormFromListing,
  sameValues,
  validatePlaceForm,
  withUploadedPhotos,
  type FieldErrors,
  type PlaceField,
  type PlaceFormValues,
} from "@/lib/listingForm";
import { BackButton, Button } from "@/components/ui";
import { DestinationCategory } from "@/types";
import { CITIES } from "@/constants/cities";
import type { Id } from "../../../convex/_generated/dataModel";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

const DESTINATION_CATEGORIES: { value: DestinationCategory; labelKey: string }[] = [
  { value: "historical", labelKey: "historical" },
  { value: "natural", labelKey: "natural" },
  { value: "cultural", labelKey: "cultural" },
  { value: "recreational", labelKey: "recreational" },
  { value: "religious", labelKey: "religious" },
];

/**
 * The chip a seeded place's finer category files under, for display only.
 * The stored key is kept unless the host picks a different chip — the old
 * form showed no chip lit for these, and saving kept "natural_landmark"
 * anyway, so nothing here changes what is written.
 */
const CHIP_FOR_SEEDED: Record<string, DestinationCategory> = {
  historical_site: "historical",
  natural_landmark: "natural",
  museum: "cultural",
  market: "cultural",
  entertainment: "recreational",
};

/** The fields that can be wrong, top to bottom as they appear on screen. */
const FIELD_ORDER: readonly PlaceField[] = ["name", "nameAr", "city"];

export default function PostDestinationScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const { t, isRTL, language } = useLanguage();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
    prepare: prepareKeyboard,
  } = useKeyboardOverlap();
  const submitListing = useMutation(api.listings.mutations.submitListing);
  const updateMyListing = useMutation(api.listings.mutations.updateMyListing);

  // An `id` in the route turns this screen into an editor for a listing the
  // owner already posted — see the same block in `post-lodging.tsx`.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const myListings = useQuery(
    api.listings.queries.getMyListings,
    id ? {} : "skip"
  );
  const existing = id
    ? (myListings ?? []).find((listing: any) => listing._id === id)
    : undefined;
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(false);
  // One object, and a copy of what it opened with — see post-lodging.tsx.
  const [form, setForm] = useState<PlaceFormValues>(EMPTY_PLACE_FORM);
  const [saved, setSaved] = useState<PlaceFormValues>(EMPTY_PLACE_FORM);
  // Each broken field says so under itself, and clears when it is edited.
  const [errors, setErrors] = useState<FieldErrors<PlaceField>>({});
  const set = <K extends keyof PlaceFormValues>(key: K, value: PlaceFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as PlaceField];
      return next;
    });
  };

  // Once per listing, when it lands, and during render rather than in an
  // effect: re-filling on every tick of a live query would overwrite whatever
  // is being typed.
  const [prefilledId, setPrefilledId] = useState<string | null>(null);
  if (existing && prefilledId !== existing._id) {
    const values = placeFormFromListing(existing);
    setPrefilledId(existing._id);
    setForm(values);
    setSaved(values);
  }

  // Ask before unsaved work is dropped; off once the save has gone through.
  // The reasons are spelled out in post-lodging.tsx.
  const [submitted, setSubmitted] = useState(false);
  const dirty = !sameValues(form, saved);
  useLeaveGuard(dirty && !submitted);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const attempt = useRef(0);

  // Where each field sits, for going to the first one with an error, and the
  // inputs of the return-key chain.
  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);
  const fieldY = useRef<Partial<Record<PlaceField, number>>>({});
  const nameRef = useRef<TextInput>(null);
  const nameArRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const descriptionArRef = useRef<TextInput>(null);
  const inputFor: Partial<Record<PlaceField, React.RefObject<TextInput | null>>> = {
    name: nameRef,
    nameAr: nameArRef,
  };

  const shownCategory = DESTINATION_CATEGORIES.some((item) => item.value === form.category)
    ? form.category
    : CHIP_FOR_SEEDED[form.category];

  // Wait for the listing, or say there is none — see post-lodging.tsx.
  const editorState: "ready" | "loading" | "missing" = !isEditing
    ? "ready"
    : myListings === undefined
      ? "loading"
      : existing
        ? "ready"
        : "missing";
  // Unchanged, a save would only send the place back to review; a rejected
  // or suspended one may be resubmitted as it is.
  const status = ownerStatusOf(existing?.status);
  const canResubmit = status === "rejected" || status === "suspended";
  const saveDisabled = isEditing && !dirty && !canResubmit;

  const revealField = (field: PlaceField) => {
    const y = formY.current + (fieldY.current[field] ?? 0);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    const input = inputFor[field]?.current;
    if (input) input.focus();
    else Keyboard.dismiss();
  };

  const handleSubmit = () => {
    if (isLoading) return;

    // Required, not defaulted, in lib/listingForm.ts: the label has always
    // said "City *", but a place with none chosen was filed under Al Ahsa
    // without a word, wherever it actually was — and pinned there too.
    const found = validatePlaceForm(form);
    setErrors(found);
    const first = firstError(found, FIELD_ORDER);
    if (first) {
      revealField(first);
      return;
    }

    // Any edit sends the place back to review, which hides it; a live one
    // asks first rather than going quiet without a word.
    if (isEditing && isLive(existing?.status)) {
      appAlert(t("editLiveConfirmTitle"), t("editLivePlaceMessage"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("submitForReview"), onPress: () => void save() },
      ]);
      return;
    }
    void save();
  };

  const save = async () => {
    setIsLoading(true);
    const thisAttempt = ++attempt.current;

    try {
      // Stored photos are https URLs and are not re-uploaded; local picks are
      // swapped for their uploads in place, so the cover stays the cover.
      const localPhotos = form.images.filter(isLocalPhoto);
      const uploaded =
        localPhotos.length > 0
          ? await uploadMultipleToConvex(localPhotos, {
              onProgress: (done, total) => {
                if (attempt.current === thisAttempt) setProgress({ done, total });
              },
            })
          : [];
      const images = withUploadedPhotos(form.images, uploaded);

      // A canonical key, never free text: the filter groups on this exact
      // string. The coordinate is derived from the same value so the pin and
      // the label can never disagree, and a blank address falls back to the
      // city rather than to the place's own name.
      const cityKey = form.city.trim();
      const located = { city: cityKey, address: form.address };

      if (isEditing && id) {
        await updateMyListing({
          listingId: id as Id<"listings">,
          type: "attraction",
          name_en: form.name.trim(),
          name_ar: form.nameAr.trim(),
          category: form.category,
          // The stored Arabic label of a seeded place names its old category,
          // and the cards prefer it; once the category changes it is wrong.
          category_ar: form.category !== saved.category ? "" : undefined,
          city: cityKey,
          // The pin moves only with the city: a seeded place's exact pin used
          // to be swapped for the city centre on every save.
          ...editedPlaceLocation(saved, located),
          // "" and [] rather than undefined, which the server skips — an
          // emptied description or a removed last photo was silently kept.
          description_en: form.description.trim(),
          description_ar: form.descriptionAr.trim(),
          images,
        });
      } else {
        await submitListing({
          type: "attraction",
          name_en: form.name.trim(),
          name_ar: form.nameAr.trim(),
          category: form.category,
          city: cityKey,
          ...newPlaceLocation(located),
          description_en: form.description.trim() || undefined,
          description_ar: form.descriptionAr.trim() || undefined,
          images: images.length > 0 ? images : undefined,
        });
      }

      setSubmitted(true);
      appAlert(
        t("success"),
        isEditing ? t("listingUpdated") : t("listingSubmittedForReview"),
        [
          {
            text: t("done"),
            // Only from this screen: a host who left mid-upload is elsewhere
            // by now, and back from there popped an unrelated screen.
            onPress: () => {
              if (navigation.isFocused()) router.back();
            },
          },
        ]
      );
    } catch (error) {
      appAlert(t("error"), t(getSubmitErrorKey(error)));
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Android pads by what the keyboard covers; iOS insets the scroll view
          — see post-lodging.tsx. */}
      <View
        ref={keyboardRef}
        onLayout={keyboardOnLayout}
        style={{ flex: 1, paddingBottom: keyboardOverlap }}
      >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.header, isRTL && styles.headerRTL]}
        >
          <BackButton />
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {isEditing ? t("editListing") : t("postDestination")}
          </Text>
          {isEditing && editorState === "ready" && (
            <Text style={[styles.editNotice, isRTL && styles.textRTL]}>
              {t("editReviewNotice")}
            </Text>
          )}
        </Animated.View>

        {editorState === "loading" ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary.deep} />
          </View>
        ) : editorState === "missing" ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>{t("editorNotFound")}</Text>
            <Text style={styles.stateBody}>{t("editorNotFoundHint")}</Text>
            <Button
              title={t("back")}
              variant="outline"
              onPress={() => router.back()}
              style={styles.stateButton}
            />
          </View>
        ) : (
        /* Form, locked while it submits. */
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.form}
          pointerEvents={isLoading ? "none" : "auto"}
          onLayout={(e) => {
            formY.current = e.nativeEvent.layout.y;
          }}
        >
          {/* Category Selection */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("selectCategory")} *
          </Text>
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {DESTINATION_CATEGORIES.map((item) => {
              const on = shownCategory === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={({ pressed }) => [
                    styles.typeButton,
                    on && styles.typeButtonSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (!on) set("category", item.value);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.typeButtonText, on && styles.typeButtonTextSelected]}>
                    {t(item.labelKey as any)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Name */}
          <View
            onLayout={(e) => {
              fieldY.current.name = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("listingName")} *
            </Text>
            <ThemedTextInput
              ref={nameRef}
              style={[styles.input, errors.name && styles.inputError]}
              isRTL={isRTL}
              value={form.name}
              onChangeText={(value) => set("name", value)}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => nameArRef.current?.focus()}
              placeholder={t("placeholderNameEn")}
              placeholderTextColor="#A3A3A3"
            />
            {errors.name && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>{t(errors.name)}</Text>
            )}
          </View>

          <View
            onLayout={(e) => {
              fieldY.current.nameAr = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("listingNameAr")} *
            </Text>
            <ThemedTextInput
              ref={nameArRef}
              style={[styles.input, errors.nameAr && styles.inputError]}
              isRTL={true}
              value={form.nameAr}
              onChangeText={(value) => set("nameAr", value)}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => addressRef.current?.focus()}
              placeholder={t("placeholderNameAr")}
              placeholderTextColor="#A3A3A3"
              textAlign="right"
            />
            {errors.nameAr && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>{t(errors.nameAr)}</Text>
            )}
          </View>

          {/* City. Picked, not typed — a typed city is a new city as far as the
              filter is concerned. The Arabic box beside it was never sent
              anywhere; the label now comes from the key. */}
          <View
            onLayout={(e) => {
              fieldY.current.city = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("city")} *
            </Text>
            <View style={[styles.optionGrid, isRTL && styles.optionGridRTL]}>
              {CITIES.map((option) => {
                const on = form.city === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => set("city", option.key)}
                    style={({ pressed }) => [
                      styles.optionChip,
                      on && styles.optionChipOn,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={language === "ar" ? option.ar : option.en}
                  >
                    <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>
                      {language === "ar" ? option.ar : option.en}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.city && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>{t(errors.city)}</Text>
            )}
          </View>

          {/* Address. One box: the Arabic one under it was never sent
              anywhere, so what a host typed there vanished. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("address")}
          </Text>
          <ThemedTextInput
            ref={addressRef}
            style={[styles.input]}
            isRTL={isRTL}
            value={form.address}
            onChangeText={(value) => set("address", value)}
            onFocus={prepareKeyboard}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => descriptionRef.current?.focus()}
            placeholder={t("placeholderAddressEn")}
            placeholderTextColor="#A3A3A3"
          />

          {/* Description, in each language under its own label. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingDescription")}
          </Text>
          <ThemedTextInput
            ref={descriptionRef}
            style={[styles.input, styles.textArea]}
            isRTL={isRTL}
            value={form.description}
            onChangeText={(value) => set("description", value)}
            onFocus={prepareKeyboard}
            placeholder={t("placeholderDescriptionEn")}
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingDescriptionAr")}
          </Text>
          <ThemedTextInput
            ref={descriptionArRef}
            style={[styles.input, styles.textArea]}
            isRTL={true}
            value={form.descriptionAr}
            onChangeText={(value) => set("descriptionAr", value)}
            onFocus={prepareKeyboard}
            placeholder={t("placeholderDescriptionAr")}
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
            textAlign="right"
          />

          {/* Images */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("addImages")}
          </Text>
          <PhotoPickerField
            images={form.images}
            onChange={(images) => set("images", images)}
          />

          {/* Submit: a spinner inside the button at its own size, and what
              is happening underneath it. */}
          <Button
            title={isEditing ? t("saveChanges") : t("submitForReview")}
            onPress={handleSubmit}
            fullWidth
            loading={isLoading}
            disabled={saveDisabled}
            style={styles.submitButton}
          />

          {isLoading && (
            <Text style={styles.progressText} accessibilityLiveRegion="polite">
              {progress && progress.done < progress.total
                ? t("uploadingPhotos")
                    .replace("{done}", String(progress.done))
                    .replace("{total}", String(progress.total))
                : t("saving")}
            </Text>
          )}
        </Animated.View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRTL: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  textRTL: {
    textAlign: "right",
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  // The editor's "still loading" and "nothing to edit" states.
  stateBox: {
    paddingHorizontal: 32,
    paddingTop: 56,
    alignItems: "center",
    gap: 8,
  },
  stateTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.ink,
    textAlign: "center",
  },
  stateBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    lineHeight: 20,
    textAlign: "center",
  },
  stateButton: {
    marginTop: 16,
    alignSelf: "stretch",
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
    marginBottom: 8,
    marginTop: 16,
  },
  // The destructive text token: 5.2:1 on the cream page.
  fieldError: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.signOut,
    lineHeight: 18,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  inputError: {
    borderColor: colors.signOut,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  typeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeContainerRTL: {
    flexDirection: "row-reverse",
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  typeButtonSelected: {
    backgroundColor: "#CCE745",
    borderColor: "#CCE745",
  },
  typeButtonText: {
    fontSize: 14,
    color: "#737373",
    fontFamily: fonts.medium,
  },
  typeButtonTextSelected: {
    color: "#1F1D17",
  },
  pressed: {
    opacity: 0.7,
  },
  submitButton: {
    marginTop: 24,
  },
  progressText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.onSurface.variant,
    textAlign: "center",
  },
  editNotice: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    marginTop: 6,
    lineHeight: 18,
  },
  bottomSpacing: {
    height: 32,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionGridRTL: {
    flexDirection: "row-reverse",
  },
  // Off is a white pill; on is lime, and lime is a fill, so its label is ink.
  optionChip: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  optionChipOn: {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.DEFAULT,
  },
  optionLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.onSurface.variant,
  },
  optionLabelOn: {
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
});

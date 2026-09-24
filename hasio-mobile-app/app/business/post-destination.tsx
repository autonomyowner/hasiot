import { appAlert } from "@/stores/dialogStore";
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { getSubmitErrorKey } from "@/lib/submitError";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { uploadMultipleToConvex } from "@/lib/convexUpload";
import {
  EMPTY_PLACE_FORM,
  editedPlaceLocation,
  isLocalPhoto,
  newPlaceLocation,
  placeFormFromListing,
  sameValues,
  withUploadedPhotos,
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

export default function PostDestinationScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const { t, isRTL, language } = useLanguage();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
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
  const set =<K extends keyof PlaceFormValues>(key: K, value: PlaceFormValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

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

  const shownCategory = DESTINATION_CATEGORIES.some((item) => item.value === form.category)
    ? form.category
    : CHIP_FOR_SEEDED[form.category];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      appAlert(
        t("permissionRequired"),
        t("photoPermissionMessage"),
        [
          { text: t("cancel"), style: "cancel" },
          { text: t("openSettings"), onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri);
      setForm((current) => ({
        ...current,
        images: [...current.images, ...newImages].slice(0, 5),
      }));
    }
  };

  const removeImage = (index: number) => {
    setForm((current) => ({
      ...current,
      images: current.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (isLoading) return;

    if (!form.name.trim() || !form.nameAr.trim()) {
      appAlert(t("error"), t("fillRequiredFields"));
      return;
    }
    // Required, not defaulted: the label has always said "City *", but a
    // place with none chosen was filed under Al Ahsa without a word,
    // wherever it actually was — and pinned there too.
    if (!form.city.trim()) {
      appAlert(t("error"), t("chooseCity"));
      return;
    }

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
      <View
        ref={keyboardRef}
        onLayout={keyboardOnLayout}
        style={{ flex: 1, paddingBottom: keyboardOverlap }}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
          {isEditing && (
            <Text style={[styles.editNotice, isRTL && styles.textRTL]}>
              {t("editReviewNotice")}
            </Text>
          )}
        </Animated.View>

        {/* Form, locked while it submits. */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.form}
          pointerEvents={isLoading ? "none" : "auto"}
        >
          {/* Category Selection */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("selectCategory")} *
          </Text>
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {DESTINATION_CATEGORIES.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.typeButton,
                  shownCategory === item.value && styles.typeButtonSelected,
                ]}
                onPress={() => {
                  if (item.value !== shownCategory) set("category", item.value);
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    shownCategory === item.value && styles.typeButtonTextSelected,
                  ]}
                >
                  {t(item.labelKey as any)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Name */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingName")} *
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.name}
            onChangeText={(value) => set("name", value)}
            placeholder={t("placeholderNameEn")}
            placeholderTextColor="#A3A3A3"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingNameAr")} *
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={true}
            value={form.nameAr}
            onChangeText={(value) => set("nameAr", value)}
            placeholder={t("placeholderNameAr")}
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* City. Picked, not typed — a typed city is a new city as far as the
              filter is concerned. The Arabic box beside it was never sent
              anywhere; the label now comes from the key. */}
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
                  style={[styles.optionChip, on && styles.optionChipOn]}
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

          {/* Address. One box: the Arabic one under it was never sent
              anywhere, so what a host typed there vanished. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("address")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.address}
            onChangeText={(value) => set("address", value)}
            placeholder={t("placeholderAddressEn")}
            placeholderTextColor="#A3A3A3"
          />

          {/* Description */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingDescription")}
          </Text>
          <ThemedTextInput
            style={[styles.input, styles.textArea]}
            isRTL={isRTL}
            value={form.description}
            onChangeText={(value) => set("description", value)}
            placeholder={t("placeholderDescriptionEn")}
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
          />

          <ThemedTextInput
            style={[styles.input, styles.textArea]}
            isRTL={true}
            value={form.descriptionAr}
            onChangeText={(value) => set("descriptionAr", value)}
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
          <Pressable style={styles.imagePickerButton} onPress={pickImage}>
            <Text style={styles.imagePickerText}>
              {t("selectPhoto")} ({form.images.length}/5)
            </Text>
          </Pressable>

          {form.images.length > 0 && (
            <View style={styles.imagesContainer}>
              {form.images.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <Pressable
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeImageText}>X</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Submit: a spinner inside the button at its own size, and what
              is happening underneath it. */}
          <Button
            title={isEditing ? t("saveChanges") : t("submitForReview")}
            onPress={handleSubmit}
            fullWidth
            loading={isLoading}
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

        <View style={styles.bottomSpacing} />
      </ScrollView>
      </View>
      </KeyboardAvoidingView>
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
  label: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
    marginBottom: 8,
    marginTop: 16,
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
  inputRTL: {
    textAlign: "right",
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
  imagePickerButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderStyle: "dashed",
  },
  imagePickerText: {
    fontSize: 15,
    color: "#4F5E10",
    fontFamily: fonts.medium,
  },
  imagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  imageWrapper: {
    position: "relative",
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#DC6B5A",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  removeImageText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: fonts.bold,
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

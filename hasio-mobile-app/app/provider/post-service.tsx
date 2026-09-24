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
import { useNavigation, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { getSubmitErrorKey } from "@/lib/submitError";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { uploadMultipleToConvex } from "@/lib/convexUpload";
import {
  EMPTY_SERVICE_FORM,
  isLocalPhoto,
  sameValues,
  withUploadedPhotos,
  type ServiceFormValues,
} from "@/lib/listingForm";
import { BackButton, Button } from "@/components/ui";
import { ServiceType, PriceUnit } from "@/types";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

const SERVICE_TYPES: { value: ServiceType; labelKey: string }[] = [
  { value: "tour_guide", labelKey: "tourGuide" },
  { value: "photographer", labelKey: "photographer" },
  { value: "driver", labelKey: "driver" },
  { value: "translator", labelKey: "translator" },
  { value: "event_planner", labelKey: "eventPlanner" },
  { value: "catering", labelKey: "catering" },
  { value: "equipment_rental", labelKey: "equipmentRental" },
  { value: "other", labelKey: "otherService" },
];

const PRICE_UNITS: { value: PriceUnit; labelKey: string }[] = [
  { value: "per_hour", labelKey: "pricePerHour" },
  { value: "per_day", labelKey: "pricePerDay" },
  { value: "per_event", labelKey: "pricePerEvent" },
  { value: "fixed", labelKey: "priceFixed" },
];

export default function PostServiceScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const { t, isRTL } = useLanguage();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
  } = useKeyboardOverlap();
  const submitService = useMutation(api.services.mutations.submitService);

  const [isLoading, setIsLoading] = useState(false);
  // One object, compared with what it opened with — see post-lodging.tsx.
  const [form, setForm] = useState<ServiceFormValues>(EMPTY_SERVICE_FORM);
  const [saved] = useState<ServiceFormValues>(EMPTY_SERVICE_FORM);
  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Ask before unsaved work is dropped; off once the save has gone through.
  const [submitted, setSubmitted] = useState(false);
  const dirty = !sameValues(form, saved);
  useLeaveGuard(dirty && !submitted);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const attempt = useRef(0);

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

    if (
      !form.title.trim() ||
      !form.titleAr.trim() ||
      !form.description.trim() ||
      !form.descriptionAr.trim()
    ) {
      appAlert(t("error"), t("fillRequiredFields"));
      return;
    }

    setIsLoading(true);
    const thisAttempt = ++attempt.current;

    try {
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

      await submitService({
        serviceType: form.serviceType,
        title_en: form.title.trim(),
        title_ar: form.titleAr.trim(),
        description_en: form.description.trim() || undefined,
        description_ar: form.descriptionAr.trim() || undefined,
        priceRange: form.priceRange.trim() || undefined,
        priceUnit: form.priceUnit,
        availability_en: form.availability.trim() || undefined,
        availability_ar: form.availabilityAr.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        languages: form.languages.trim()
          ? form.languages.split(",").map((l) => l.trim()).filter(Boolean)
          : undefined,
        images: images.length > 0 ? images : undefined,
      });

      setSubmitted(true);
      appAlert(t("success"), t("listingSubmittedForReview"), [
        {
          text: t("done"),
          // Only from this screen: a provider who left mid-upload is
          // elsewhere by now, and back from there popped an unrelated screen.
          onPress: () => {
            if (navigation.isFocused()) router.back();
          },
        },
      ]);
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
            {t("postService")}
          </Text>
        </Animated.View>

        {/* Form, locked while it submits. */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.form}
          pointerEvents={isLoading ? "none" : "auto"}
        >
          {/* Service Type Selection */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("selectType")} *
          </Text>
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {SERVICE_TYPES.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.typeButton,
                  form.serviceType === item.value && styles.typeButtonSelected,
                ]}
                onPress={() => set("serviceType", item.value)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    form.serviceType === item.value && styles.typeButtonTextSelected,
                  ]}
                >
                  {t(item.labelKey as any)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Title */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingName")} *
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.title}
            onChangeText={(value) => set("title", value)}
            placeholder={t("placeholderServiceTitleEn")}
            placeholderTextColor="#A3A3A3"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingNameAr")} *
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={true}
            value={form.titleAr}
            onChangeText={(value) => set("titleAr", value)}
            placeholder={t("placeholderServiceTitleAr")}
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* Description */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingDescription")} *
          </Text>
          <ThemedTextInput
            style={[styles.input, styles.textArea]}
            isRTL={isRTL}
            value={form.description}
            onChangeText={(value) => set("description", value)}
            placeholder={t("placeholderServiceDescEn")}
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
          />

          <ThemedTextInput
            style={[styles.input, styles.textArea]}
            isRTL={true}
            value={form.descriptionAr}
            onChangeText={(value) => set("descriptionAr", value)}
            placeholder={t("placeholderServiceDescAr")}
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
            textAlign="right"
          />

          {/* Price */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("priceRange")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.priceRange}
            onChangeText={(value) => set("priceRange", value)}
            placeholder={t("placeholderPriceService")}
            placeholderTextColor="#A3A3A3"
          />

          {/* Price Unit */}
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {PRICE_UNITS.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.typeButton,
                  form.priceUnit === item.value && styles.typeButtonSelected,
                ]}
                onPress={() => set("priceUnit", item.value)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    form.priceUnit === item.value && styles.typeButtonTextSelected,
                  ]}
                >
                  {t(item.labelKey as any)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Availability */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("availability")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.availability}
            onChangeText={(value) => set("availability", value)}
            placeholder={t("placeholderAvailabilityEn")}
            placeholderTextColor="#A3A3A3"
          />

          <ThemedTextInput
            style={[styles.input]}
            isRTL={true}
            value={form.availabilityAr}
            onChangeText={(value) => set("availabilityAr", value)}
            placeholder={t("placeholderAvailabilityAr")}
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* Contact Info */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("contactPhone")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.contactPhone}
            onChangeText={(value) => set("contactPhone", value)}
            placeholder={t("placeholderPhone")}
            placeholderTextColor="#A3A3A3"
            keyboardType="phone-pad"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("contactEmail")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.contactEmail}
            onChangeText={(value) => set("contactEmail", value)}
            placeholder={t("placeholderEmail")}
            placeholderTextColor="#A3A3A3"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Languages */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("languages")} (comma separated)
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.languages}
            onChangeText={(value) => set("languages", value)}
            placeholder={t("placeholderLanguages")}
            placeholderTextColor="#A3A3A3"
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
            title={t("submitForReview")}
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
    marginTop: 8,
  },
  typeContainerRTL: {
    flexDirection: "row-reverse",
  },
  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    fontSize: 13,
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
  bottomSpacing: {
    height: 32,
  },
});

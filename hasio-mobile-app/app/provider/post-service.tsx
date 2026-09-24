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
import Animated, { FadeInDown } from "react-native-reanimated";
import { PhotoPickerField } from "@/components/hosting/PhotoPickerField";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { getSubmitErrorKey } from "@/lib/submitError";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { uploadMultipleToConvex } from "@/lib/convexUpload";
import {
  EMPTY_SERVICE_FORM,
  firstError,
  isLive,
  isLocalPhoto,
  ownerStatusOf,
  sameValues,
  serviceFormFromService,
  splitList,
  validateServiceForm,
  withUploadedPhotos,
  type FieldErrors,
  type ServiceField,
  type ServiceFormValues,
} from "@/lib/listingForm";
import { toLatinDigits } from "@/lib/digits";
import { BackButton, Button } from "@/components/ui";
import { ServiceType, PriceUnit } from "@/types";
import type { Id } from "../../../convex/_generated/dataModel";
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

/** The fields that can be wrong, top to bottom as they appear on screen. */
const FIELD_ORDER: readonly ServiceField[] = [
  "title",
  "titleAr",
  "description",
  "descriptionAr",
  "contactPhone",
  "contactEmail",
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
    prepare: prepareKeyboard,
  } = useKeyboardOverlap();
  const submitService = useMutation(api.services.mutations.submitService);
  const updateMyService = useMutation(api.services.mutations.updateMyService);

  // An `id` in the route makes this the editor for one of the provider's own
  // services — My Services had no way to change or remove anything. Read
  // from `getMyServices`, which is what enforces "yours", as the listing
  // editors do with `getMyListings`.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const myServices = useQuery(api.services.queries.getMyServices, id ? {} : "skip");
  const existing = id ? (myServices ?? []).find((service) => service._id === id) : undefined;
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(false);
  // One object, compared with what it opened with — see post-lodging.tsx.
  const [form, setForm] = useState<ServiceFormValues>(EMPTY_SERVICE_FORM);
  const [saved, setSaved] = useState<ServiceFormValues>(EMPTY_SERVICE_FORM);
  // Each broken field says so under itself, and clears when it is edited.
  const [errors, setErrors] = useState<FieldErrors<ServiceField>>({});
  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as ServiceField];
      return next;
    });
  };

  // Filled once per service, during render, when it lands.
  const [prefilledId, setPrefilledId] = useState<string | null>(null);
  if (existing && prefilledId !== existing._id) {
    const values = serviceFormFromService(existing);
    setPrefilledId(existing._id);
    setForm(values);
    setSaved(values);
  }

  // Ask before unsaved work is dropped; off once the save has gone through.
  const [submitted, setSubmitted] = useState(false);
  const dirty = !sameValues(form, saved);
  useLeaveGuard(dirty && !submitted);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const attempt = useRef(0);

  // Where each field sits, for going to the first one with an error, and the
  // inputs of the return-key chain.
  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);
  const fieldY = useRef<Partial<Record<ServiceField, number>>>({});
  const titleRef = useRef<TextInput>(null);
  const titleArRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const descriptionArRef = useRef<TextInput>(null);
  const priceRangeRef = useRef<TextInput>(null);
  const availabilityRef = useRef<TextInput>(null);
  const availabilityArRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const languagesRef = useRef<TextInput>(null);
  const inputFor: Record<ServiceField, React.RefObject<TextInput | null>> = {
    title: titleRef,
    titleAr: titleArRef,
    description: descriptionRef,
    descriptionAr: descriptionArRef,
    contactPhone: phoneRef,
    contactEmail: emailRef,
  };

  // Wait for the service, or say there is none — see post-lodging.tsx.
  const editorState: "ready" | "loading" | "missing" = !isEditing
    ? "ready"
    : myServices === undefined
      ? "loading"
      : existing
        ? "ready"
        : "missing";
  // Unchanged, a save would only send the service back to review; a rejected
  // one may be resubmitted as it is.
  const canResubmit = ownerStatusOf(existing?.status) === "rejected";
  const saveDisabled = isEditing && !dirty && !canResubmit;

  const revealField = (field: ServiceField) => {
    const y = formY.current + (fieldY.current[field] ?? 0);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    const input = inputFor[field].current;
    if (input) input.focus();
    else Keyboard.dismiss();
  };

  const handleSubmit = () => {
    if (isLoading) return;

    // Both descriptions are required, and the contact details are checked
    // when given — a mistyped email used to be stored as it was, and the
    // provider never heard from the travellers it was for.
    const found = validateServiceForm(form);
    setErrors(found);
    const first = firstError(found, FIELD_ORDER);
    if (first) {
      revealField(first);
      return;
    }

    // Any edit sends the service back to review, which hides it; a live one
    // asks first.
    if (isEditing && isLive(existing?.status)) {
      appAlert(t("editLiveConfirmTitle"), t("editLiveServiceMessage"), [
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
      // Split on both commas: an Arabic keyboard types "،", which a split on
      // "," alone left inside one long "language".
      const languages = splitList(form.languages);

      if (isEditing && id) {
        // Every field, with "" and [] for an emptied one: the server skips
        // undefined, so a cleared phone number or language list would
        // otherwise be kept. It sends the service back to review.
        await updateMyService({
          serviceId: id as Id<"services">,
          serviceType: form.serviceType,
          title_en: form.title.trim(),
          title_ar: form.titleAr.trim(),
          description_en: form.description.trim(),
          description_ar: form.descriptionAr.trim(),
          priceRange: form.priceRange.trim(),
          priceUnit: form.priceUnit,
          availability_en: form.availability.trim(),
          availability_ar: form.availabilityAr.trim(),
          contactPhone: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
          languages,
          images,
        });
      } else {
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
          languages: languages.length > 0 ? languages : undefined,
          images: images.length > 0 ? images : undefined,
        });
      }

      setSubmitted(true);
      appAlert(t("success"), isEditing ? t("listingUpdated") : t("serviceSubmittedForReview"), [
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
            {isEditing ? t("editService") : t("postService")}
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
          {/* Service Type Selection */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("selectType")} *
          </Text>
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {SERVICE_TYPES.map((item) => {
              const on = form.serviceType === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={({ pressed }) => [
                    styles.typeButton,
                    on && styles.typeButtonSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => set("serviceType", item.value)}
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

          {/* Title */}
          <View
            onLayout={(e) => {
              fieldY.current.title = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("listingName")} *
            </Text>
            <ThemedTextInput
              ref={titleRef}
              style={[styles.input, errors.title && styles.inputError]}
              isRTL={isRTL}
              value={form.title}
              onChangeText={(value) => set("title", value)}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => titleArRef.current?.focus()}
              placeholder={t("placeholderServiceTitleEn")}
              placeholderTextColor="#A3A3A3"
            />
            {errors.title && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>{t(errors.title)}</Text>
            )}
          </View>

          <View
            onLayout={(e) => {
              fieldY.current.titleAr = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("listingNameAr")} *
            </Text>
            <ThemedTextInput
              ref={titleArRef}
              style={[styles.input, errors.titleAr && styles.inputError]}
              isRTL={true}
              value={form.titleAr}
              onChangeText={(value) => set("titleAr", value)}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => descriptionRef.current?.focus()}
              placeholder={t("placeholderServiceTitleAr")}
              placeholderTextColor="#A3A3A3"
              textAlign="right"
            />
            {errors.titleAr && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>{t(errors.titleAr)}</Text>
            )}
          </View>

          {/* Description — both are required, so the Arabic one has a label
              of its own and its asterisk; it used to sit under the English
              one's with neither. */}
          <View
            onLayout={(e) => {
              fieldY.current.description = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("listingDescription")} *
            </Text>
            <ThemedTextInput
              ref={descriptionRef}
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              isRTL={isRTL}
              value={form.description}
              onChangeText={(value) => set("description", value)}
              onFocus={prepareKeyboard}
              placeholder={t("placeholderServiceDescEn")}
              placeholderTextColor="#A3A3A3"
              multiline
              numberOfLines={4}
            />
            {errors.description && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>
                {t(errors.description)}
              </Text>
            )}
          </View>

          <View
            onLayout={(e) => {
              fieldY.current.descriptionAr = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("listingDescriptionAr")} *
            </Text>
            <ThemedTextInput
              ref={descriptionArRef}
              style={[styles.input, styles.textArea, errors.descriptionAr && styles.inputError]}
              isRTL={true}
              value={form.descriptionAr}
              onChangeText={(value) => set("descriptionAr", value)}
              onFocus={prepareKeyboard}
              placeholder={t("placeholderServiceDescAr")}
              placeholderTextColor="#A3A3A3"
              multiline
              numberOfLines={4}
              textAlign="right"
            />
            {errors.descriptionAr && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>
                {t(errors.descriptionAr)}
              </Text>
            )}
          </View>

          {/* Price */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("priceRange")}
          </Text>
          <ThemedTextInput
            ref={priceRangeRef}
            style={[styles.input]}
            isRTL={isRTL}
            value={form.priceRange}
            onChangeText={(value) => set("priceRange", value)}
            onFocus={prepareKeyboard}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => availabilityRef.current?.focus()}
            placeholder={t("placeholderPriceService")}
            placeholderTextColor="#A3A3A3"
          />

          {/* Price Unit */}
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {PRICE_UNITS.map((item) => {
              const on = form.priceUnit === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={({ pressed }) => [
                    styles.typeButton,
                    on && styles.typeButtonSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => set("priceUnit", item.value)}
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

          {/* Availability, each language under its own label */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("availability")}
          </Text>
          <ThemedTextInput
            ref={availabilityRef}
            style={[styles.input]}
            isRTL={isRTL}
            value={form.availability}
            onChangeText={(value) => set("availability", value)}
            onFocus={prepareKeyboard}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => availabilityArRef.current?.focus()}
            placeholder={t("placeholderAvailabilityEn")}
            placeholderTextColor="#A3A3A3"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("availabilityAr")}
          </Text>
          <ThemedTextInput
            ref={availabilityArRef}
            style={[styles.input]}
            isRTL={true}
            value={form.availabilityAr}
            onChangeText={(value) => set("availabilityAr", value)}
            onFocus={prepareKeyboard}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => phoneRef.current?.focus()}
            placeholder={t("placeholderAvailabilityAr")}
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* Contact Info */}
          <View
            onLayout={(e) => {
              fieldY.current.contactPhone = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("contactPhone")}
            </Text>
            <ThemedTextInput
              ref={phoneRef}
              style={[styles.input, errors.contactPhone && styles.inputError]}
              isRTL={isRTL}
              value={form.contactPhone}
              // Latin digits as typed, as everywhere else a number is stored.
              onChangeText={(value) => set("contactPhone", toLatinDigits(value))}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
              placeholder={t("placeholderPhone")}
              placeholderTextColor="#A3A3A3"
              keyboardType="phone-pad"
            />
            {errors.contactPhone && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>
                {t(errors.contactPhone)}
              </Text>
            )}
          </View>

          <View
            onLayout={(e) => {
              fieldY.current.contactEmail = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("contactEmail")}
            </Text>
            <ThemedTextInput
              ref={emailRef}
              style={[styles.input, errors.contactEmail && styles.inputError]}
              isRTL={isRTL}
              value={form.contactEmail}
              onChangeText={(value) => set("contactEmail", value)}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => languagesRef.current?.focus()}
              placeholder={t("placeholderEmail")}
              placeholderTextColor="#A3A3A3"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.contactEmail && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>
                {t(errors.contactEmail)}
              </Text>
            )}
          </View>

          {/* Languages. The hint used to be English glued onto the label, in
              Arabic too. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("languagesCommaSeparated")}
          </Text>
          <ThemedTextInput
            ref={languagesRef}
            style={[styles.input]}
            isRTL={isRTL}
            value={form.languages}
            onChangeText={(value) => set("languages", value)}
            onFocus={prepareKeyboard}
            returnKeyType="done"
            placeholder={t("placeholderLanguages")}
            placeholderTextColor="#A3A3A3"
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
  bottomSpacing: {
    height: 32,
  },
});

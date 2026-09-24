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
  EMPTY_STAY_FORM,
  editedStayLocation,
  isLocalPhoto,
  newStayLocation,
  sameValues,
  stayFormFromListing,
  withUploadedPhotos,
  type StayFormValues,
} from "@/lib/listingForm";
import { BackButton, Button } from "@/components/ui";
import { LodgingType } from "@/types";
import type { Id } from "../../../convex/_generated/dataModel";
import { Feather } from "@expo/vector-icons";
import { AMENITIES } from "@/constants/amenities";
import { CITIES } from "@/constants/cities";
import { colors, type AppFonts } from "@/constants/colors";
import { lodgingTypeOf } from "@/hooks/useConvexData";
import { useThemedStyles } from "@/hooks/useAppFonts";

const LODGING_TYPES: { value: LodgingType; labelKey: string }[] = [
  { value: "hotel", labelKey: "hotels" },
  { value: "apartment", labelKey: "apartments" },
  { value: "camp", labelKey: "camps" },
  { value: "homestay", labelKey: "homestays" },
];

export default function PostLodgingScreen() {
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
  // owner already posted. Read from `getMyListings` rather than a lookup of its
  // own: that query is already subscribed on the screen the guest came from,
  // and it is the one that enforces "yours".
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
  // Every field in one object: an edit needs the whole form to compare with
  // what it opened with, which a dozen separate states made impossible.
  // Amenities are canonical keys, not typed words — see
  // `constants/amenities.ts` — but a legacy free-text amenity is carried as it
  // is, so an edit never drops it.
  const [form, setForm] = useState<StayFormValues>(EMPTY_STAY_FORM);
  // What the form held when it opened: the empty form, or the listing as it is
  // stored. An edit writes the location only where the host moved away from it.
  const [saved, setSaved] = useState<StayFormValues>(EMPTY_STAY_FORM);
  const [neighborhoodAr, setNeighborhoodAr] = useState("");
  const set = <K extends keyof StayFormValues>(key: K, value: StayFormValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggleAmenity = (key: string) =>
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(key)
        ? current.amenities.filter((item) => item !== key)
        : [...current.amenities, key],
    }));

  // Fill the form when the listing lands, once per listing: re-filling on
  // every tick of a live query would overwrite whatever is being typed each
  // time anything else on the account changes. Done during render rather than
  // in an effect, so the first frame of the editor is already the listing.
  const [prefilledId, setPrefilledId] = useState<string | null>(null);
  if (existing && prefilledId !== existing._id) {
    const values = stayFormFromListing(existing);
    setPrefilledId(existing._id);
    setForm(values);
    setSaved(values);
  }

  // Leaving with unsaved work asks first — back button, Android back, iOS
  // swipe — instead of silently dropping a half-filled listing and its
  // photos. Off once the save has gone through, so the success alert's own
  // navigation is not intercepted.
  const [submitted, setSubmitted] = useState(false);
  const dirty = !sameValues(form, saved);
  useLeaveGuard(dirty && !submitted);

  // "Uploading photos 2/5" under the busy button. Stamped per attempt: a
  // failed attempt's other uploads keep finishing in the background, and
  // without the stamp they would move the count of the retry.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const attempt = useRef(0);

  // A seeded stay's finer category ("luxury_hotel") lights the chip it files
  // under; it is only rewritten if the host picks a different chip.
  const shownType = LODGING_TYPES.some((item) => item.value === form.type)
    ? form.type
    : lodgingTypeOf(form.type);

  // The server skips an undefined number and its validator rejects null, so a
  // stored nightly price, guest cap or unit count cannot be cleared from here
  // (open item: a backend change). When the host empties one, the form says
  // it will be kept rather than pretending the save removed it.
  const cannotClear = (key: "pricePerNight" | "maxGuests" | "unitCount") =>
    isEditing && saved[key] !== "" && form[key].trim() === "";

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

    // Validation
    if (!form.name.trim() || !form.nameAr.trim() || !form.city.trim()) {
      appAlert(t("error"), t("fillRequiredFields"));
      return;
    }

    // The booking fields are optional as a group, but each one that is filled
    // in has to be usable — the server rejects the rest, and finding that out
    // after an image upload is a poor trade.
    const nightly = form.pricePerNight.trim() ? Number(form.pricePerNight.trim()) : undefined;
    if (nightly !== undefined && (!Number.isInteger(nightly) || nightly <= 0 || nightly > 100000)) {
      appAlert(t("error"), t("invalidPrice"));
      return;
    }

    const guests = form.maxGuests.trim() ? Number(form.maxGuests.trim()) : undefined;
    if (guests !== undefined && (!Number.isInteger(guests) || guests < 1 || guests > 20)) {
      appAlert(t("error"), t("invalidGuestCount"));
      return;
    }

    const units = form.unitCount.trim() ? Number(form.unitCount.trim()) : undefined;
    if (units !== undefined && (!Number.isInteger(units) || units < 1 || units > 500)) {
      appAlert(t("error"), t("invalidUnitCount"));
      return;
    }

    const isHHMM = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!isHHMM(form.checkInTime.trim()) || !isHHMM(form.checkOutTime.trim())) {
      appAlert(t("error"), t("invalidTime"));
      return;
    }

    setIsLoading(true);
    const thisAttempt = ++attempt.current;

    try {
      // Anything already stored is an https URL and must not be re-uploaded;
      // only what the picker just handed us is a local file. The uploads go
      // back in the places their local files held, so the host's order — and
      // with it the cover — survives the save.
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

      const city = form.city.trim();
      // Undefined is "leave as stored" to the server, so an empty booking
      // field is simply not sent. The price cannot be cleared that way; the
      // form says so under the field instead of pretending it was.
      const pricing = {
        pricePerNight: nightly,
        currency: nightly !== undefined ? "SAR" : undefined,
        maxGuests: guests,
        unitCount: units,
        checkInTime: form.checkInTime.trim(),
        checkOutTime: form.checkOutTime.trim(),
      };

      if (isEditing && id) {
        // The server resets the listing to pending on any edit, which is why
        // the confirmation says "sent for review" rather than "saved".
        await updateMyListing({
          listingId: id as Id<"listings">,
          type: "hotel",
          name_en: form.name.trim(),
          name_ar: form.nameAr.trim(),
          category: form.type,
          // A seeded stay's stored Arabic label names its old category, and
          // the cards prefer it; once the category changes it is wrong.
          category_ar: form.type !== saved.type ? "" : undefined,
          city,
          // Only what the host changed: the stored pin and address used to
          // be replaced by a city centre and "Eastern Province" on any save.
          ...editedStayLocation(saved, form),
          // "" and [] rather than undefined: the server skips undefined, so
          // an emptied description or a removed last photo was silently kept.
          description_en: form.description.trim(),
          description_ar: form.descriptionAr.trim(),
          priceRange: form.priceRange.trim(),
          amenities: form.amenities,
          images,
          ...pricing,
        });
      } else {
        await submitListing({
          type: "hotel",
          name_en: form.name.trim(),
          name_ar: form.nameAr.trim(),
          category: form.type,
          city,
          ...newStayLocation(form),
          description_en: form.description.trim() || undefined,
          description_ar: form.descriptionAr.trim() || undefined,
          priceRange: form.priceRange.trim() || undefined,
          amenities: form.amenities.length > 0 ? form.amenities : undefined,
          images: images.length > 0 ? images : undefined,
          ...pricing,
        });
      }

      setSubmitted(true);
      appAlert(
        t("success"),
        isEditing ? t("listingUpdated") : t("listingSubmittedForReview"),
        [
          {
            text: t("done"),
            // Only from this screen. The upload can outlast it — a host who
            // left mid-upload is somewhere else by the time this appears,
            // and going back from there popped a screen that had nothing to
            // do with the form.
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
            {isEditing ? t("editListing") : t("postLodging")}
          </Text>
          {isEditing && (
            <Text style={[styles.editNotice, isRTL && styles.textRTL]}>
              {t("editReviewNotice")}
            </Text>
          )}
        </Animated.View>

        {/* Form. Locked while it submits: a chip tapped mid-upload changed
            the form under a save that had already read it. */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.form}
          pointerEvents={isLoading ? "none" : "auto"}
        >
          {/* Type Selection */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("selectType")} *
          </Text>
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {LODGING_TYPES.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.typeButton,
                  shownType === item.value && styles.typeButtonSelected,
                ]}
                // Tapping the chip that is already lit changes nothing, so a
                // seeded "luxury_hotel" is not flattened to "hotel" by a tap.
                onPress={() => {
                  if (item.value !== shownType) set("type", item.value);
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    shownType === item.value && styles.typeButtonTextSelected,
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

          {/* City. Picked, not typed: a typed city is a new city as far as the
              filter is concerned, and "Hofuf" / "hofuf" / "الهفوف" were three
              of them. The Arabic box next to it was never sent anywhere — the
              label now comes from the key. */}
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

          {/* Neighborhood */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("neighborhood")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.neighborhood}
            onChangeText={(value) => set("neighborhood", value)}
            placeholder={t("placeholderNeighborhoodEn")}
            placeholderTextColor="#A3A3A3"
          />

          <ThemedTextInput
            style={[styles.input]}
            isRTL={true}
            value={neighborhoodAr}
            onChangeText={setNeighborhoodAr}
            placeholder={t("placeholderNeighborhoodAr")}
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* Price Range */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("priceRange")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.priceRange}
            onChangeText={(value) => set("priceRange", value)}
            placeholder={t("placeholderPriceLodging")}
            placeholderTextColor="#A3A3A3"
          />

          {/* Booking & pricing. Optional as a group: a host who leaves the
              nightly price blank still gets a listing in the directory, it
              just does not show a Book button. */}
          <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
            {t("pricingSectionTitle")}
          </Text>
          <Text style={[styles.sectionHint, isRTL && styles.textRTL]}>
            {t("pricingSectionHint")}
          </Text>

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("pricePerNightLabel")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.pricePerNight}
            onChangeText={(value) => set("pricePerNight", value)}
            placeholder={t("placeholderPricePerNight")}
            placeholderTextColor="#A3A3A3"
            keyboardType="number-pad"
          />
          {cannotClear("pricePerNight") && (
            <Text style={[styles.clearNote, isRTL && styles.textRTL]}>
              {t("editCannotClear").replace("{value}", `${saved.pricePerNight} ${t("sar")}`)}
            </Text>
          )}

          <Text style={[styles.label, isRTL && styles.textRTL]}>{t("maxGuestsLabel")}</Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.maxGuests}
            onChangeText={(value) => set("maxGuests", value)}
            keyboardType="number-pad"
          />
          {cannotClear("maxGuests") && (
            <Text style={[styles.clearNote, isRTL && styles.textRTL]}>
              {t("editCannotClear").replace("{value}", saved.maxGuests)}
            </Text>
          )}

          <Text style={[styles.label, isRTL && styles.textRTL]}>{t("unitCountLabel")}</Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={form.unitCount}
            onChangeText={(value) => set("unitCount", value)}
            keyboardType="number-pad"
          />
          {cannotClear("unitCount") && (
            <Text style={[styles.clearNote, isRTL && styles.textRTL]}>
              {t("editCannotClear").replace("{value}", saved.unitCount)}
            </Text>
          )}

          {/* Times stay left-aligned in both languages: "15:00" is a fixed
              pattern, and mirroring it puts the minutes before the hour. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>{t("checkInTimeLabel")}</Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={false}
            value={form.checkInTime}
            onChangeText={(value) => set("checkInTime", value)}
            placeholder="15:00"
            placeholderTextColor="#A3A3A3"
            keyboardType="numbers-and-punctuation"
            textAlign="left"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>{t("checkOutTimeLabel")}</Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={false}
            value={form.checkOutTime}
            onChangeText={(value) => set("checkOutTime", value)}
            placeholder="12:00"
            placeholderTextColor="#A3A3A3"
            keyboardType="numbers-and-punctuation"
            textAlign="left"
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

          {/* Amenities. A closed list of toggles: what the host switches on
              here is exactly what a guest sees, icon and all, in both
              languages — which free text could never guarantee. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("amenities")}
          </Text>
          <Text style={[styles.hint, isRTL && styles.textRTL]}>
            {t("amenitiesHint")}
          </Text>
          <View style={[styles.optionGrid, isRTL && styles.optionGridRTL]}>
            {AMENITIES.map((amenity) => {
              const on = form.amenities.includes(amenity.key);
              return (
                <Pressable
                  key={amenity.key}
                  onPress={() => toggleAmenity(amenity.key)}
                  style={[
                    styles.optionChip,
                    isRTL && styles.rowRTL,
                    on && styles.optionChipOn,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={language === "ar" ? amenity.ar : amenity.en}
                >
                  <Feather
                    name={amenity.icon}
                    size={14}
                    color={on ? colors.ink : colors.onSurface.variant}
                  />
                  <Text
                    style={[styles.optionLabel, on && styles.optionLabelOn]}
                  >
                    {language === "ar" ? amenity.ar : amenity.en}
                  </Text>
                </Pressable>
              );
            })}
          </View>

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

          {/* Submit. `loading` keeps the button's size with a spinner in
              it; the old blank label over a spinner hung below read as a
              broken button. */}
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
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#737373",
    lineHeight: 19,
    marginTop: 6,
  },
  // A notice, not an error: the save still goes through.
  clearNote: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
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
  hint: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    marginTop: -4,
    marginBottom: 10,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionGridRTL: {
    flexDirection: "row-reverse",
  },
  // Off is the same white pill the filter chips use; on is lime, and lime is a
  // fill, so the label and the icon on it are ink.
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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

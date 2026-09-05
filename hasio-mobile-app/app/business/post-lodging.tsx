import { appAlert } from "@/stores/dialogStore";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { getSubmitErrorKey } from "@/lib/submitError";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { uploadMultipleToConvex } from "@/lib/convexUpload";
import { BackButton, Button } from "@/components/ui";
import { LodgingType } from "@/types";
import type { Id } from "../../../convex/_generated/dataModel";
import { Feather } from "@expo/vector-icons";
import { AMENITIES, type AmenityKey } from "@/constants/amenities";
import { CITIES, canonicalCity, cityCoordinates } from "@/constants/cities";
import { colors, type AppFonts } from "@/constants/colors";
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
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [type, setType] = useState<LodgingType>("hotel");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [neighborhoodAr, setNeighborhoodAr] = useState("");
  const [priceRange, setPriceRange] = useState("");
  // Booking fields. Without a nightly price the listing still appears in the
  // directory, it just cannot be booked — so these are optional, not required.
  const [pricePerNight, setPricePerNight] = useState("");
  const [maxGuests, setMaxGuests] = useState("2");
  const [unitCount, setUnitCount] = useState("1");
  const [checkInTime, setCheckInTime] = useState("15:00");
  const [checkOutTime, setCheckOutTime] = useState("12:00");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  // Canonical keys, not typed words — see `constants/amenities.ts`. The old
  // pair of comma-separated fields also collected an Arabic line that was
  // never sent anywhere, so a host's Arabic amenities were silently dropped.
  const [selectedAmenities, setSelectedAmenities] = useState<AmenityKey[]>([]);
  const toggleAmenity = (key: AmenityKey) =>
    setSelectedAmenities((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  const [images, setImages] = useState<string[]>([]);

  // Fill the form the first time the listing lands, and only then: re-running
  // this on every render of a live query would overwrite whatever is being
  // typed each time anything else on the account changes.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!existing || prefilled.current) return;
    prefilled.current = true;
    setName(existing.name_en ?? "");
    setNameAr(existing.name_ar ?? "");
    setType((existing.category as LodgingType) ?? "hotel");
    setCity(canonicalCity(existing.city ?? ""));
    setNeighborhood(existing.region ?? "");
    setPriceRange(existing.priceRange ?? "");
    setPricePerNight(existing.pricePerNight != null ? String(existing.pricePerNight) : "");
    setMaxGuests(existing.maxGuests != null ? String(existing.maxGuests) : "2");
    setUnitCount(existing.unitCount != null ? String(existing.unitCount) : "1");
    setCheckInTime(existing.checkInTime ?? "15:00");
    setCheckOutTime(existing.checkOutTime ?? "12:00");
    setDescription(existing.description_en ?? "");
    setDescriptionAr(existing.description_ar ?? "");
    setSelectedAmenities((existing.amenities ?? []) as AmenityKey[]);
    setImages(existing.images ?? []);
  }, [existing]);

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
      setImages([...images, ...newImages].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (isLoading) return;

    // Validation
    if (!name.trim() || !nameAr.trim() || !city.trim()) {
      appAlert(t("error"), t("fillRequiredFields"));
      return;
    }

    // The booking fields are optional as a group, but each one that is filled
    // in has to be usable — the server rejects the rest, and finding that out
    // after an image upload is a poor trade.
    const nightly = pricePerNight.trim() ? Number(pricePerNight.trim()) : undefined;
    if (nightly !== undefined && (!Number.isInteger(nightly) || nightly <= 0 || nightly > 100000)) {
      appAlert(t("error"), t("invalidPrice"));
      return;
    }

    const guests = maxGuests.trim() ? Number(maxGuests.trim()) : undefined;
    if (guests !== undefined && (!Number.isInteger(guests) || guests < 1 || guests > 20)) {
      appAlert(t("error"), t("invalidGuestCount"));
      return;
    }

    const units = unitCount.trim() ? Number(unitCount.trim()) : undefined;
    if (units !== undefined && (!Number.isInteger(units) || units < 1 || units > 500)) {
      appAlert(t("error"), t("invalidUnitCount"));
      return;
    }

    const isHHMM = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!isHHMM(checkInTime.trim()) || !isHHMM(checkOutTime.trim())) {
      appAlert(t("error"), t("invalidTime"));
      return;
    }

    setIsLoading(true);

    try {
      // Anything already stored is an https URL and must not be re-uploaded;
      // only what the picker just handed us is a local file.
      const alreadyStored = images.filter((uri) => /^https?:/.test(uri));
      const freshPicks = images.filter((uri) => !/^https?:/.test(uri));
      const uploadedImages = [
        ...alreadyStored,
        ...(freshPicks.length > 0 ? await uploadMultipleToConvex(freshPicks) : []),
      ];

      const payload = {
        type: "hotel",
        name_en: name.trim(),
        name_ar: nameAr.trim(),
        category: type,
        description_en: description.trim() || undefined,
        description_ar: descriptionAr.trim() || undefined,
        address: neighborhood.trim() || city.trim(),
        city: city.trim(),
        region: neighborhood.trim() || undefined,
        // The city centre, not the oasis: this listing may be on the coast.
        coordinates: cityCoordinates(city),
        priceRange: priceRange.trim() || undefined,
        pricePerNight: nightly,
        currency: nightly !== undefined ? "SAR" : undefined,
        maxGuests: guests,
        unitCount: units,
        checkInTime: checkInTime.trim(),
        checkOutTime: checkOutTime.trim(),
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      } as const;

      if (isEditing && id) {
        // The server resets the listing to pending on any edit, which is why
        // the confirmation says "sent for review" rather than "saved".
        await updateMyListing({ listingId: id as Id<"listings">, ...payload });
      } else {
        await submitListing(payload);
      }

      appAlert(
        t("success"),
        isEditing ? t("listingUpdated") : t("listingSubmittedForReview"),
        [{ text: t("done"), onPress: () => router.back() }]
      );
    } catch (error) {
      appAlert(t("error"), t(getSubmitErrorKey(error)));
    } finally {
      setIsLoading(false);
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

        {/* Form */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.form}
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
                  type === item.value && styles.typeButtonSelected,
                ]}
                onPress={() => setType(item.value)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === item.value && styles.typeButtonTextSelected,
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
            value={name}
            onChangeText={setName}
            placeholder={t("placeholderNameEn")}
            placeholderTextColor="#A3A3A3"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingNameAr")} *
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={true}
            value={nameAr}
            onChangeText={setNameAr}
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
              const on = city === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setCity(option.key)}
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
            value={neighborhood}
            onChangeText={setNeighborhood}
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
            value={priceRange}
            onChangeText={setPriceRange}
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
            value={pricePerNight}
            onChangeText={setPricePerNight}
            placeholder={t("placeholderPricePerNight")}
            placeholderTextColor="#A3A3A3"
            keyboardType="number-pad"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>{t("maxGuestsLabel")}</Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={maxGuests}
            onChangeText={setMaxGuests}
            keyboardType="number-pad"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>{t("unitCountLabel")}</Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={unitCount}
            onChangeText={setUnitCount}
            keyboardType="number-pad"
          />

          {/* Times stay left-aligned in both languages: "15:00" is a fixed
              pattern, and mirroring it puts the minutes before the hour. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>{t("checkInTimeLabel")}</Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={false}
            value={checkInTime}
            onChangeText={setCheckInTime}
            placeholder="15:00"
            placeholderTextColor="#A3A3A3"
            keyboardType="numbers-and-punctuation"
            textAlign="left"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>{t("checkOutTimeLabel")}</Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={false}
            value={checkOutTime}
            onChangeText={setCheckOutTime}
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
            value={description}
            onChangeText={setDescription}
            placeholder={t("placeholderDescriptionEn")}
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
          />

          <ThemedTextInput
            style={[styles.input, styles.textArea]}
            isRTL={true}
            value={descriptionAr}
            onChangeText={setDescriptionAr}
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
              const on = selectedAmenities.includes(amenity.key);
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
              {t("selectPhoto")} ({images.length}/5)
            </Text>
          </Pressable>

          {images.length > 0 && (
            <View style={styles.imagesContainer}>
              {images.map((uri, index) => (
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

          {/* Submit Button */}
          <Button
            title={isLoading ? "" : isEditing ? t("saveChanges") : t("submitForReview")}
            onPress={handleSubmit}
            fullWidth
            disabled={isLoading}
            style={styles.submitButton}
          />

          {isLoading && (
            <ActivityIndicator
              size="small"
              color="#4F5E10"
              style={styles.loadingIndicator}
            />
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
  loadingIndicator: {
    marginTop: 16,
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

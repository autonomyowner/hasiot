import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation } from "convex/react";
import { api } from "@/convex";
import { useLanguage } from "@/hooks/useLanguage";
import { uploadMultipleToR2 } from "@/lib/r2Upload";
import { Button } from "@/components/ui";
import { ServiceType, PriceUnit } from "@/types";

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
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const createListing = useMutation(api.listings.mutations.createListing);

  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("tour_guide");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("per_hour");
  const [availability, setAvailability] = useState("");
  const [availabilityAr, setAvailabilityAr] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [languages, setLanguages] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (!title.trim() || !titleAr.trim() || !description.trim() || !descriptionAr.trim()) {
      Alert.alert(t("error"), t("fillRequiredFields"));
      return;
    }

    setIsLoading(true);

    try {
      const uploadedImages = images.length > 0
        ? await uploadMultipleToR2(images, "services")
        : [];

      await createListing({
        type: "service" as any,
        name_en: title.trim(),
        name_ar: titleAr.trim(),
        category: serviceType,
        description_en: description.trim() || undefined,
        description_ar: descriptionAr.trim() || undefined,
        address: title.trim(),
        city: "Saudi Arabia",
        coordinates: { lat: 24.7136, lng: 46.6753 },
        priceRange: priceRange.trim() ? `${priceRange.trim()} (${priceUnit})` : undefined,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      });

      Alert.alert(
        t("success"),
        t("listingSubmittedForReview"),
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Error creating service:", error);
      Alert.alert(
        t("error"),
        error instanceof Error ? error.message : t("somethingWentWrong")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.header, isRTL && styles.headerRTL]}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>{t("back")}</Text>
          </Pressable>
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t("postService")}
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.form}
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
                  serviceType === item.value && styles.typeButtonSelected,
                ]}
                onPress={() => setServiceType(item.value)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    serviceType === item.value && styles.typeButtonTextSelected,
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
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={title}
            onChangeText={setTitle}
            placeholder="Service title in English"
            placeholderTextColor="#A3A3A3"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingNameAr")} *
          </Text>
          <TextInput
            style={[styles.input, styles.inputRTL]}
            value={titleAr}
            onChangeText={setTitleAr}
            placeholder="عنوان الخدمة بالعربية"
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* Description */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingDescription")} *
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, isRTL && styles.inputRTL]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your service in English"
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
          />

          <TextInput
            style={[styles.input, styles.textArea, styles.inputRTL]}
            value={descriptionAr}
            onChangeText={setDescriptionAr}
            placeholder="وصف الخدمة بالعربية"
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
            textAlign="right"
          />

          {/* Price */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("priceRange")}
          </Text>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={priceRange}
            onChangeText={setPriceRange}
            placeholder="e.g., 100-200 SAR"
            placeholderTextColor="#A3A3A3"
          />

          {/* Price Unit */}
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {PRICE_UNITS.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.typeButton,
                  priceUnit === item.value && styles.typeButtonSelected,
                ]}
                onPress={() => setPriceUnit(item.value)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    priceUnit === item.value && styles.typeButtonTextSelected,
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
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={availability}
            onChangeText={setAvailability}
            placeholder="e.g., Weekends, Daily 9AM-6PM"
            placeholderTextColor="#A3A3A3"
          />

          <TextInput
            style={[styles.input, styles.inputRTL]}
            value={availabilityAr}
            onChangeText={setAvailabilityAr}
            placeholder="مثال: عطلة نهاية الأسبوع"
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* Contact Info */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("contactPhone")}
          </Text>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+966 5XX XXX XXXX"
            placeholderTextColor="#A3A3A3"
            keyboardType="phone-pad"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("contactEmail")}
          </Text>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="email@example.com"
            placeholderTextColor="#A3A3A3"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Languages */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("languages")} (comma separated)
          </Text>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={languages}
            onChangeText={setLanguages}
            placeholder="Arabic, English, French"
            placeholderTextColor="#A3A3A3"
          />

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
            title={isLoading ? "" : t("submitForReview")}
            onPress={handleSubmit}
            fullWidth
            disabled={isLoading}
            style={styles.submitButton}
          />

          {isLoading && (
            <ActivityIndicator
              size="small"
              color="#0D7A5F"
              style={styles.loadingIndicator}
            />
          )}
        </Animated.View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  backButton: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 15,
    color: "#0D7A5F",
    fontWeight: "500",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
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
    fontWeight: "600",
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
    backgroundColor: "#0D7A5F",
    borderColor: "#0D7A5F",
  },
  typeButtonText: {
    fontSize: 13,
    color: "#737373",
    fontWeight: "500",
  },
  typeButtonTextSelected: {
    color: "#FFFFFF",
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
    color: "#0D7A5F",
    fontWeight: "500",
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
    fontWeight: "700",
  },
  submitButton: {
    marginTop: 24,
  },
  loadingIndicator: {
    marginTop: 16,
  },
  bottomSpacing: {
    height: 32,
  },
});

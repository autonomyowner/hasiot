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
import { EventCategory } from "@/types";

const EVENT_CATEGORIES: { value: EventCategory; labelKey: string }[] = [
  { value: "festival", labelKey: "festivals" },
  { value: "conference", labelKey: "conferences" },
  { value: "outdoor", labelKey: "outdoor" },
  { value: "indoor", labelKey: "indoor" },
  { value: "seasonal", labelKey: "seasonal" },
];

export default function PostEventScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const createListing = useMutation(api.listings.mutations.createListing);

  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [category, setCategory] = useState<EventCategory>("festival");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [locationAr, setLocationAr] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
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
    if (!title.trim() || !titleAr.trim() || !date.trim()) {
      Alert.alert(t("error"), t("fillRequiredFields"));
      return;
    }

    setIsLoading(true);

    try {
      const uploadedImages = images.length > 0
        ? await uploadMultipleToR2(images, "events")
        : [];

      await createListing({
        type: "event",
        name_en: title.trim(),
        name_ar: titleAr.trim(),
        category: category,
        description_en: description.trim() || undefined,
        description_ar: descriptionAr.trim() || undefined,
        address: location.trim() || title.trim(),
        city: location.trim() || "Saudi Arabia",
        coordinates: { lat: 24.7136, lng: 46.6753 },
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      });

      Alert.alert(
        t("success"),
        t("listingSubmittedForReview"),
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Error creating event:", error);
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
            {t("postEvent")}
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.form}
        >
          {/* Category Selection */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("selectCategory")} *
          </Text>
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {EVENT_CATEGORIES.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.typeButton,
                  category === item.value && styles.typeButtonSelected,
                ]}
                onPress={() => setCategory(item.value)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    category === item.value && styles.typeButtonTextSelected,
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
            placeholder="Event title in English"
            placeholderTextColor="#A3A3A3"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingNameAr")} *
          </Text>
          <TextInput
            style={[styles.input, styles.inputRTL]}
            value={titleAr}
            onChangeText={setTitleAr}
            placeholder="عنوان الفعالية بالعربية"
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* Date & Time */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("eventDate")} *
          </Text>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#A3A3A3"
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("eventTime")} *
          </Text>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={time}
            onChangeText={setTime}
            placeholder="e.g., 6:00 PM"
            placeholderTextColor="#A3A3A3"
          />

          {/* Location */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("location")}
          </Text>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={location}
            onChangeText={setLocation}
            placeholder="Location in English"
            placeholderTextColor="#A3A3A3"
          />

          <TextInput
            style={[styles.input, styles.inputRTL]}
            value={locationAr}
            onChangeText={setLocationAr}
            placeholder="الموقع بالعربية"
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* Description */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingDescription")}
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, isRTL && styles.inputRTL]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description in English"
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
          />

          <TextInput
            style={[styles.input, styles.textArea, styles.inputRTL]}
            value={descriptionAr}
            onChangeText={setDescriptionAr}
            placeholder="الوصف بالعربية"
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
    backgroundColor: "#0D7A5F",
    borderColor: "#0D7A5F",
  },
  typeButtonText: {
    fontSize: 14,
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

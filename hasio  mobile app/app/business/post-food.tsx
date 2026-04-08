import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { uploadMultipleToConvex } from "@/lib/convexUpload";
import { Button } from "@/components/ui";
import { FoodCategory } from "@/types";

const FOOD_CATEGORIES: { value: FoodCategory; labelKey: string }[] = [
  { value: "restaurant", labelKey: "restaurants" },
  { value: "home_kitchen", labelKey: "productiveFamilies" },
  { value: "fastfood", labelKey: "fastFood" },
  { value: "drinks", labelKey: "drinks" },
];

export default function PostFoodScreen() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const submitListing = useMutation(api.listings.mutations.submitListing);

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [category, setCategory] = useState<FoodCategory>("restaurant");
  const [cuisine, setCuisine] = useState("");
  const [cuisineAr, setCuisineAr] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
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
    if (isLoading) return;

    if (!name.trim() || !nameAr.trim()) {
      Alert.alert(t("error"), t("fillRequiredFields"));
      return;
    }

    setIsLoading(true);

    try {
      const uploadedImages = images.length > 0
        ? await uploadMultipleToConvex(images)
        : [];

      await submitListing({
        type: "restaurant",
        name_en: name.trim(),
        name_ar: nameAr.trim(),
        category: category,
        category_ar: cuisineAr.trim() || undefined,
        description_en: description.trim() || undefined,
        description_ar: descriptionAr.trim() || undefined,
        address: name.trim(),
        city: "Al-Ahsa",
        coordinates: { lat: 25.3854, lng: 49.5683 },
        priceRange: avgPrice.trim() || undefined,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      });

      Alert.alert(
        t("success"),
        t("listingSubmittedForReview"),
        [{ text: t("done"), onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert(t("error"), t("pleaseTryAgain"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
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
            {t("postFood")}
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
            {FOOD_CATEGORIES.map((item) => (
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

          {/* Cuisine */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("cuisine")} *
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={cuisine}
            onChangeText={setCuisine}
            placeholder={t("placeholderCuisineEn")}
            placeholderTextColor="#A3A3A3"
          />

          <ThemedTextInput
            style={[styles.input]}
            isRTL={true}
            value={cuisineAr}
            onChangeText={setCuisineAr}
            placeholder={t("placeholderCuisineAr")}
            placeholderTextColor="#A3A3A3"
            textAlign="right"
          />

          {/* Average Price */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("averagePrice")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={avgPrice}
            onChangeText={setAvgPrice}
            placeholder={t("placeholderPriceFood")}
            placeholderTextColor="#A3A3A3"
          />

          {/* Operating Hours */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("hours")}
          </Text>
          <ThemedTextInput
            style={[styles.input]}
            isRTL={isRTL}
            value={hours}
            onChangeText={setHours}
            placeholder={t("placeholderHours")}
            placeholderTextColor="#A3A3A3"
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
      </KeyboardAvoidingView>
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

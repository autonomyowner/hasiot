import { appAlert } from "@/stores/dialogStore";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { colors, fonts } from "@/constants/colors";
import { useLanguage } from "@/hooks/useLanguage";
import { useConvexUser } from "@/hooks/useConvexUser";
import { uploadDocumentToConvex } from "@/lib/convexUpload";

/**
 * Account verification screen for business owners and service providers.
 *
 * Mirrors the web `/business` flow: pick a document → upload to Convex storage
 * → `saveBusinessDoc` stores the storageId on the user record → an admin
 * reviews it at /admin and calls `approveBusinessAccount`, which flips
 * `isApproved` and unlocks `submitListing` / `submitService`.
 */
export default function VerificationScreenContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { verificationStatus, isUserLoading } = useConvexUser();

  const saveBusinessDoc = useMutation(api.users.mutations.saveBusinessDoc);

  const [docUri, setDocUri] = useState<string | null>(null);
  const [docMimeType, setDocMimeType] = useState<string>("image/jpeg");
  const [docName, setDocName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPending = verificationStatus === "pending";
  const isApproved = verificationStatus === "approved";
  // PDFs and other non-images can't go through <Image>, so they get a
  // filename chip preview instead of a thumbnail.
  const isImageDoc = docMimeType.startsWith("image/");

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      appAlert(t("permissionRequired"), t("photoPermissionMessage"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("openSettings"), onPress: () => Linking.openSettings() },
      ]);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setDocUri(asset.uri);
      setDocMimeType(asset.mimeType ?? "image/jpeg");
      setDocName(asset.fileName ?? null);
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setDocUri(asset.uri);
      setDocMimeType(asset.mimeType ?? "application/octet-stream");
      setDocName(asset.name ?? null);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!docUri) {
      appAlert(t("error"), t("verificationNoDocSelected"));
      return;
    }

    setIsSubmitting(true);
    try {
      const storageId = await uploadDocumentToConvex(docUri, docMimeType);
      await saveBusinessDoc({ fileId: storageId });

      appAlert(
        t("verificationSubmitted"),
        t("verificationSubmittedMessage"),
        [{ text: t("done"), onPress: () => router.back() }]
      );
    } catch (error) {
      // Surface the underlying reason too — a silent "try again later" made an
      // upload failure here impossible to diagnose from a tester's report.
      const detail = error instanceof Error ? error.message : String(error);
      appAlert(t("error"), `${t("pleaseTryAgain")}\n\n${detail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.headerBand, { paddingTop: insets.top + 16 }]}
        >
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, isRTL && styles.alignEndSelf]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? "رجوع" : "Go back"}
          >
            <Feather
              name={isRTL ? "arrow-right" : "arrow-left"}
              size={22}
              color="#FFFFFF"
            />
          </Pressable>

          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t("verificationTitle")}
          </Text>
          <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
            {t("verificationSubtitle")}
          </Text>
        </Animated.View>

        {/* Status pill */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={[
            styles.statusCard,
            isApproved && styles.statusCardApproved,
            isPending && styles.statusCardPending,
          ]}
        >
          <Feather
            name={isApproved ? "check-circle" : isPending ? "clock" : "alert-circle"}
            size={20}
            color={isApproved ? colors.success : isPending ? colors.warning : colors.attention}
          />
          <View style={styles.statusTextWrap}>
            <Text style={[styles.statusTitle, isRTL && styles.textRTL]}>
              {isApproved
                ? t("statusApproved")
                : isPending
                ? t("verificationPendingTitle")
                : t("verificationUnverifiedTitle")}
            </Text>
            <Text style={[styles.statusBody, isRTL && styles.textRTL]}>
              {isApproved
                ? t("firstListingNote")
                : isPending
                ? t("verificationPendingBody")
                : t("verificationUnverifiedBody")}
            </Text>
          </View>
        </Animated.View>

        {/* Upload — hidden once approved, since there is nothing left to do */}
        {!isApproved && (
          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              {t("verificationDocLabel")}
            </Text>
            <Text style={[styles.hint, isRTL && styles.textRTL]}>
              {t("verificationDocHint")}
            </Text>

            {docUri ? (
              <View style={styles.previewCard}>
                {isImageDoc ? (
                  <Image source={{ uri: docUri }} style={styles.preview} />
                ) : (
                  <View style={styles.filePreview}>
                    <Feather name="file-text" size={28} color={colors.primary.DEFAULT} />
                    <Text style={styles.filePreviewName} numberOfLines={2}>
                      {docName ?? t("verificationDocLabel")}
                    </Text>
                  </View>
                )}
                <Pressable
                  style={styles.replaceButton}
                  onPress={pickFile}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={t("verificationReplaceDoc")}
                >
                  <Text style={styles.replaceButtonText}>
                    {t("verificationReplaceDoc")}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.pickerRow}>
                <Pressable
                  style={styles.pickerCard}
                  onPress={pickPhoto}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={t("verificationChoosePhoto")}
                >
                  <Feather name="image" size={22} color={colors.primary.DEFAULT} />
                  <Text style={styles.pickerText}>{t("verificationChoosePhoto")}</Text>
                </Pressable>
                <Pressable
                  style={styles.pickerCard}
                  onPress={pickFile}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={t("verificationChooseFile")}
                >
                  <Feather name="file-text" size={22} color={colors.primary.DEFAULT} />
                  <Text style={styles.pickerText}>{t("verificationChooseFile")}</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.privacyRow}>
              <Feather name="lock" size={14} color={colors.onSurface.muted} />
              <Text style={[styles.privacyText, isRTL && styles.textRTL]}>
                {t("verificationPrivacyNote")}
              </Text>
            </View>

            <Pressable
              style={[
                styles.submitButton,
                (isSubmitting || !docUri) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || !docUri}
              accessibilityRole="button"
              accessibilityLabel={t("verificationSubmit")}
              accessibilityState={{ disabled: isSubmitting || !docUri, busy: isSubmitting }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {t("verificationSubmit")}
                </Text>
              )}
            </Pressable>
          </Animated.View>
        )}

        {/* Why we ask */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(600)}
          style={styles.whyCard}
        >
          <Text style={[styles.whyTitle, isRTL && styles.textRTL]}>
            {t("verificationWhyTitle")}
          </Text>
          <Text style={[styles.whyBody, isRTL && styles.textRTL]}>
            {t("verificationWhyBody")}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  headerBand: {
    backgroundColor: colors.ink,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  alignEndSelf: { alignSelf: "flex-end" },
  title: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.7)",
  },
  textRTL: { textAlign: "right" },

  statusCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginHorizontal: 24,
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusCardPending: { backgroundColor: "#FDF6EC", borderColor: "#F0DFC4" },
  statusCardApproved: { backgroundColor: colors.mint, borderColor: "#CFE4DA" },
  statusTextWrap: { flex: 1 },
  statusTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 2,
  },
  statusBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurface.variant,
  },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.onSurface.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 6,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurface.variant,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },

  pickerRow: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 24,
  },
  pickerCard: {
    flex: 1,
    height: 120,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary.DEFAULT,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pickerText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 8,
    color: colors.primary.DEFAULT,
  },

  filePreview: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  filePreviewName: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
    color: colors.onSurface.variant,
  },

  previewCard: {
    marginHorizontal: 24,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.sand,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: { width: "100%", height: 220, resizeMode: "cover" },
  replaceButton: {
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.surface.DEFAULT,
  },
  replaceButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary.DEFAULT,
  },

  privacyRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginHorizontal: 24,
    marginTop: 14,
  },
  privacyText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurface.muted,
  },

  submitButton: {
    marginHorizontal: 24,
    marginTop: 20,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: "#FFFFFF",
  },

  whyCard: {
    marginHorizontal: 24,
    marginTop: 28,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surface.variant,
  },
  whyTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 6,
  },
  whyBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurface.variant,
  },
});

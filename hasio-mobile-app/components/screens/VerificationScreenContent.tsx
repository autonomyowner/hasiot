import { appAlert } from "@/stores/dialogStore";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Animated from "react-native-reanimated";
import { enterFade } from "@/constants/motion";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { colors, type AppFonts } from "@/constants/colors";
import { ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { useNudge } from "@/hooks/useNudge";
import { useConvexUser } from "@/hooks/useConvexUser";
import { uploadDocumentToConvex } from "@/lib/convexUpload";
import { getSubmitErrorKey } from "@/lib/submitError";

/**
 * Account verification screen for business owners and service providers.
 *
 * Mirrors the web `/business` flow: pick a document → upload to Convex storage
 * → `saveBusinessDoc` stores the storageId on the user record → an admin
 * reviews it at /admin and calls `approveBusinessAccount`, which flips
 * `isApproved` and unlocks `submitListing` / `submitService`.
 */
export default function VerificationScreenContent() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { t, isRTL } = useLanguage();
  const { verificationStatus, isUserLoading } = useConvexUser();

  const saveBusinessDoc = useMutation(api.users.mutations.saveBusinessDoc);

  const [docUri, setDocUri] = useState<string | null>(null);
  const [docMimeType, setDocMimeType] = useState<string>("image/jpeg");
  const [docName, setDocName] = useState<string | null>(null);
  // Which picker the document came from, so "Replace document" opens the
  // same one: it always opened the file picker, which sent someone who had
  // chosen a photo into a Files browser to look for it.
  const [docSource, setDocSource] = useState<"photo" | "file">("file");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPending = verificationStatus === "pending";
  const isApproved = verificationStatus === "approved";
  // PDFs and other non-images can't go through <Image>, so they get a
  // filename chip preview instead of a thumbnail.
  const isImageDoc = docMimeType.startsWith("image/");

  const pickPhoto = async () => {
    let result: ImagePicker.ImagePickerResult;
    try {
      // Straight to the system picker, which needs no library permission
      // (see components/hosting/PhotoPickerField.tsx).
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.9,
      });
    } catch {
      appAlert(t("permissionRequired"), t("photoPermissionMessage"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("openSettings"), onPress: () => Linking.openSettings() },
      ]);
      return;
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setDocUri(asset.uri);
      setDocMimeType(asset.mimeType ?? "image/jpeg");
      setDocName(asset.fileName ?? null);
      setDocSource("photo");
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
      setDocSource("file");
    }
  };

  const { style: nudgeStyle, nudge } = useNudge();

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // The button stays lime with nothing picked (faded, it read as text on
    // Android — see useNudge), so this is reachable: point at the pickers.
    if (!docUri) {
      nudge(t("verificationNoDocSelected"));
      return;
    }

    setIsSubmitting(true);
    try {
      const storageId = await uploadDocumentToConvex(docUri, docMimeType);
      await saveBusinessDoc({ fileId: storageId });

      appAlert(t("verificationSubmitted"), t("verificationSubmittedMessage"), [
        {
          text: t("done"),
          // Only from this screen: the upload can outlast it, and back from
          // wherever the host went meanwhile popped an unrelated screen.
          onPress: () => {
            if (navigation.isFocused()) router.back();
          },
        },
      ]);
    } catch (error) {
      // A sentence, not the raw "[CONVEX M(users/mutations:saveBusinessDoc)]
      // … Server Error" the alert used to print under "please try again".
      // The detail still goes to the log, which is where a tester's report
      // can be diagnosed from.
      console.warn("Verification upload failed", error);
      const key = getSubmitErrorKey(error);
      appAlert(t("error"), t(key === "errorUploadFailed" ? "verificationUploadFailed" : key));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenGradient />
      {/* Light icons over the ink band while this screen is in front; the
          app's dark ones were invisible on it. */}
      {isFocused && <StatusBar style="light" />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Header — drawn while the account loads too: the screen used to be
            a lone spinner with no way back until it did. */}
        <Animated.View
          entering={enterFade(0)}
          style={[styles.headerBand, { paddingTop: insets.top + 16 }]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              isRTL && styles.alignEndSelf,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("back")}
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

        {isUserLoading ? (
          <View style={styles.loadingBody}>
            <ActivityIndicator color={colors.primary.deep} />
          </View>
        ) : (
          <>
            {/* Status */}
            <Animated.View
              entering={enterFade(1)}
              style={[
                styles.statusCard,
                isRTL && styles.rowRTL,
                isApproved && styles.statusCardApproved,
                isPending && styles.statusCardPending,
              ]}
            >
              <Feather
                name={isApproved ? "check-circle" : isPending ? "clock" : "alert-circle"}
                size={20}
                // The dark lime for the tick: the `success` token is the lime
                // fill, which on the mint card could not be seen.
                color={
                  isApproved
                    ? colors.primary.deep
                    : isPending
                      ? colors.warning
                      : colors.attention
                }
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
                  {/* Approved said "Your first listing requires approval" —
                      the opposite of the news. */}
                  {isApproved
                    ? t("verificationApprovedBody")
                    : isPending
                      ? t("verificationPendingBody")
                      : t("verificationUnverifiedBody")}
                </Text>
              </View>
            </Animated.View>

            {/* Upload — hidden once approved, since there is nothing left to do */}
            {!isApproved && (
              <Animated.View entering={enterFade(2)}>
                <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                  {t("verificationDocLabel")}
                </Text>
                <Text style={[styles.hint, isRTL && styles.textRTL]}>
                  {t("verificationDocHint")}
                </Text>

                {docUri ? (
                  <View style={styles.previewCard}>
                    {isImageDoc ? (
                      <Image source={{ uri: docUri }} style={styles.preview} contentFit="cover" />
                    ) : (
                      <View style={styles.filePreview}>
                        <Feather name="file-text" size={28} color={colors.primary.deep} />
                        <Text style={styles.filePreviewName} numberOfLines={2}>
                          {docName ?? t("verificationDocLabel")}
                        </Text>
                      </View>
                    )}
                    <Pressable
                      style={({ pressed }) => [styles.replaceButton, pressed && styles.pressed]}
                      onPress={docSource === "photo" ? pickPhoto : pickFile}
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
                  <Animated.View style={[styles.pickerRow, isRTL && styles.rowRTL, nudgeStyle]}>
                    <Pressable
                      style={({ pressed }) => [styles.pickerCard, pressed && styles.pressed]}
                      onPress={pickPhoto}
                      disabled={isSubmitting}
                      accessibilityRole="button"
                      accessibilityLabel={t("verificationChoosePhoto")}
                    >
                      <Feather name="image" size={22} color={colors.primary.deep} />
                      <Text style={styles.pickerText}>{t("verificationChoosePhoto")}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.pickerCard, pressed && styles.pressed]}
                      onPress={pickFile}
                      disabled={isSubmitting}
                      accessibilityRole="button"
                      accessibilityLabel={t("verificationChooseFile")}
                    >
                      <Feather name="file-text" size={22} color={colors.primary.deep} />
                      <Text style={styles.pickerText}>{t("verificationChooseFile")}</Text>
                    </Pressable>
                  </Animated.View>
                )}

                <View style={[styles.privacyRow, isRTL && styles.rowRTL]}>
                  <Feather name="lock" size={14} color={colors.onSurface.muted} />
                  <Text style={[styles.privacyText, isRTL && styles.textRTL]}>
                    {t("verificationPrivacyNote")}
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={t("verificationSubmit")}
                  accessibilityHint={docUri ? undefined : t("verificationNoDocSelected")}
                  accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                >
                  {isSubmitting ? (
                    // Ink on the lime fill, like the label it stands in for;
                    // it was white, which on lime barely shows.
                    <ActivityIndicator color={colors.ink} />
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
              entering={enterFade(3)}
              style={styles.whyCard}
            >
              <Text style={[styles.whyTitle, isRTL && styles.textRTL]}>
                {t("verificationWhyTitle")}
              </Text>
              <Text style={[styles.whyBody, isRTL && styles.textRTL]}>
                {t("verificationWhyBody")}
              </Text>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingBody: {
    paddingTop: 48,
    alignItems: "center",
  },

  headerBand: {
    backgroundColor: colors.ink,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  // 44pt, the smallest target a thumb can be expected to hit.
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  alignEndSelf: { alignSelf: "flex-end" },
  pressed: { opacity: 0.7 },
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
  rowRTL: { flexDirection: "row-reverse" },

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
  statusCardApproved: { backgroundColor: colors.mint, borderColor: "#E1E4CF" },
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
    borderColor: colors.primary.deep,
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
    color: colors.primary.deep,
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
  preview: { width: "100%", height: 220 },
  replaceButton: {
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.surface.DEFAULT,
  },
  replaceButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary.deep,
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
  submitButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
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

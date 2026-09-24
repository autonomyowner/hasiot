import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { appAlert } from "@/stores/dialogStore";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { addPhotos, makeCover, MAX_PHOTOS } from "@/lib/listingForm";

interface PhotoPickerFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
}

/**
 * The photos of a listing or service, for the three posting forms.
 *
 * Each form used to carry its own copy of this, and all three had the same
 * faults: the picker let a host select any number and then silently kept the
 * first five; there was no way to see or choose the cover, which is simply
 * the first photo everywhere it is shown; the remove button was a 24pt "X"
 * with no label, pinned top-right in Arabic too; tiles were keyed by index,
 * so removing one briefly showed the wrong photo in its neighbours; and a
 * photo-library permission prompt stood in front of a system picker that
 * does not need one.
 */
export function PhotoPickerField({ images, onChange }: PhotoPickerFieldProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const remaining = MAX_PHOTOS - images.length;
  const full = remaining <= 0;

  const pick = async () => {
    if (full) return;
    let result: ImagePicker.ImagePickerResult;
    try {
      // Straight to the system picker. On iOS 14+ and Android's photo picker
      // the app only ever receives what the host chose, so no library
      // permission is needed — asking first put a "full photo library"
      // prompt in front of hosts for nothing. The limit is what is left of
      // five, so the picker itself stops them rather than the form
      // discarding the extras afterwards.
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        orderedSelection: true,
        quality: 0.8,
      });
    } catch {
      // The picker failing to open at all is, in practice, a permission a
      // device still insists on; point at the setting rather than go quiet.
      appAlert(t("permissionRequired"), t("photoPermissionMessage"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("openSettings"), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    if (result.canceled) return;
    onChange(addPhotos(images, result.assets.map((asset) => asset.uri), MAX_PHOTOS));
  };

  return (
    <View>
      <Pressable
        onPress={pick}
        disabled={full}
        style={({ pressed }) => [
          styles.pickButton,
          isRTL && styles.rowRTL,
          full && styles.pickButtonFull,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: full }}
        accessibilityLabel={`${t("selectPhoto")} (${images.length}/${MAX_PHOTOS})`}
      >
        <Feather
          name="image"
          size={16}
          color={full ? colors.onSurface.muted : colors.primary.deep}
        />
        <Text style={[styles.pickText, full && styles.pickTextFull]}>
          {t("selectPhoto")} ({images.length}/{MAX_PHOTOS})
        </Text>
      </Pressable>

      {images.length > 1 && (
        <Text style={[styles.hint, isRTL && styles.textRTL]}>{t("photosCoverHint")}</Text>
      )}

      {images.length > 0 && (
        // Mirrored in Arabic, so the cover — the first photo — sits where
        // the reader starts.
        <View style={[styles.grid, isRTL && styles.rowRTL]}>
          {images.map((uri, index) => {
            const isCover = index === 0;
            return (
              <View
                // By the photo, not its position: keyed by index, removing
                // one photo re-used its neighbours' tiles for a frame.
                key={images.indexOf(uri) === index ? uri : `${uri}#${index}`}
                style={styles.tile}
              >
                <Pressable
                  onPress={() => onChange(makeCover(images, uri))}
                  disabled={isCover}
                  style={({ pressed }) => [styles.thumbFrame, pressed && styles.pressed]}
                  accessibilityRole={isCover ? undefined : "button"}
                  accessibilityLabel={isCover ? t("coverPhoto") : t("makeCover")}
                >
                  <Image
                    source={{ uri }}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={150}
                  />
                </Pressable>

                {isCover && (
                  <View
                    style={[styles.coverTag, isRTL ? styles.coverTagRTL : styles.coverTagLTR]}
                    pointerEvents="none"
                  >
                    <Text style={styles.coverText}>{t("coverPhoto")}</Text>
                  </View>
                )}

                {/* Inside the tile rather than hanging off its corner:
                    Android does not deliver touches outside a parent's
                    bounds, so the outer half of the old button was dead. */}
                <Pressable
                  onPress={() => onChange(images.filter((_, i) => i !== index))}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.remove,
                    isRTL ? styles.removeRTL : styles.removeLTR,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("removePhoto")}
                >
                  <Feather name="x" size={15} color="#FFFFFF" />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const TILE = 80;

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    pickButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: "#E5E5E5",
      borderStyle: "dashed",
    },
    pickButtonFull: {
      opacity: 0.6,
    },
    pickText: {
      fontSize: 15,
      color: colors.primary.deep,
      fontFamily: fonts.medium,
    },
    pickTextFull: {
      color: colors.onSurface.muted,
    },
    hint: {
      fontSize: 12.5,
      fontFamily: fonts.regular,
      color: colors.onSurface.muted,
      marginTop: 8,
      lineHeight: 18,
    },
    textRTL: {
      textAlign: "right",
    },
    rowRTL: {
      flexDirection: "row-reverse",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    tile: {
      width: TILE,
      height: TILE,
    },
    thumbFrame: {
      width: TILE,
      height: TILE,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: colors.sand,
    },
    thumb: {
      width: TILE,
      height: TILE,
    },
    // Lime is a fill, so the word on it is ink.
    coverTag: {
      position: "absolute",
      bottom: 5,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.primary.DEFAULT,
    },
    coverTagLTR: {
      left: 5,
    },
    coverTagRTL: {
      right: 5,
    },
    coverText: {
      fontSize: 11,
      fontFamily: fonts.semibold,
      color: colors.ink,
    },
    // 28pt plus an 8pt slop on every side is the 44pt target. The darker
    // destructive red keeps the white cross at 5.4:1.
    remove: {
      position: "absolute",
      top: 4,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.signOut,
      alignItems: "center",
      justifyContent: "center",
    },
    removeLTR: {
      right: 4,
    },
    removeRTL: {
      left: 4,
    },
    pressed: {
      opacity: 0.7,
    },
  });

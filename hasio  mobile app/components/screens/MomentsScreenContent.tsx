import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useLanguage } from "@/hooks/useLanguage";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useMomentsStore } from "@/stores/momentsStore";
import { MomentCard } from "@/components/moments/MomentCard";
import { Button } from "@/components/ui";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MomentsScreenContent() {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();

  const { userId, isLoaded } = useConvexUser();

  return <UserMomentsView insets={insets} t={t} isRTL={isRTL} userId={userId} isAuthLoaded={isLoaded} />;
}

// ============================================
// USER MOMENTS VIEW - Personal Moments
// ============================================
interface UserMomentsViewProps {
  insets: any;
  t: (key: any) => string;
  isRTL: boolean;
  userId: string | null;
  isAuthLoaded: boolean;
}

function UserMomentsView({ insets, t, isRTL, userId, isAuthLoaded }: UserMomentsViewProps) {
  const { moments, isLoading, fetchMoments, addMoment, deleteMoment, setUserId } = useMomentsStore();
  const mountedRef = useRef(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [newMomentImage, setNewMomentImage] = useState<string | null>(null);
  const [newMomentNote, setNewMomentNote] = useState("");
  const [newMomentLocation, setNewMomentLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [viewingMoment, setViewingMoment] = useState<{ image: string; note?: string; location?: string; timestamp: string } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    setUserId(userId).catch((err) => {
      if (mountedRef.current) {

      }
    });
    return () => {
      mountedRef.current = false;
    };
  }, [userId]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewMomentImage(result.assets[0].uri);
    }
  };

  const handleAddMoment = async () => {
    if (!newMomentImage || isSaving) return;

    setIsSaving(true);

    const success = await addMoment(
      newMomentImage,
      newMomentNote || undefined,
      newMomentLocation || undefined
    );

    if (!mountedRef.current) return;

    setIsSaving(false);

    if (success) {
      setModalVisible(false);
      setNewMomentImage(null);
      setNewMomentNote("");
      setNewMomentLocation("");
    } else {
      Alert.alert(t("error"), t("momentSaveError"));
    }
  };

  const handleDeleteMoment = async (id: string, imageUrl: string) => {
    Alert.alert(
      t("delete"),
      t("deleteMomentConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            await deleteMoment(id, imageUrl);
          },
        },
      ]
    );
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(600)}
      style={styles.cardWrapper}
    >
      <MomentCard
        moment={{
          id: item.id,
          image: item.image_url,
          note: item.note || "",
          location: item.location || undefined,
          timestamp: item.created_at,
        }}
        isRTL={isRTL}
        onPress={() => setViewingMoment({
          image: item.image_url,
          note: item.note || undefined,
          location: item.location || undefined,
          timestamp: item.created_at,
        })}
        onDelete={() => handleDeleteMoment(item.id, item.image_url)}
      />
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(600)}
        style={[styles.header, isRTL && styles.headerRTL]}
      >
        <Text style={[styles.title, isRTL && styles.textRTL]}>
          {t("myMoments")}
        </Text>
        {userId && <AddButton label={t("addMoment")} onPress={() => setModalVisible(true)} />}
      </Animated.View>

      {/* Not logged in */}
      {isAuthLoaded && !userId ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
            {t("myMoments")}
          </Text>
          <Text style={[styles.emptyMessage, isRTL && styles.textRTL]}>
            {isRTL ? "سجل دخولك لحفظ لحظاتك" : "Sign in to save your moments"}
          </Text>
        </View>
      ) : /* Loading State */
      isLoading && moments.length === 0 ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#0D7A5F" />
        </View>
      ) : moments.length > 0 ? (
        <FlatList
          data={moments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchMoments}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
            {t("emptyMomentsTitle")}
          </Text>
          <Text style={[styles.emptyMessage, isRTL && styles.textRTL]}>
            {t("emptyMomentsMessage")}
          </Text>
          <Button
            title={t("emptyMomentsAction")}
            onPress={() => setModalVisible(true)}
            style={styles.emptyButton}
          />
        </View>
      )}

      {/* Image Viewer Modal */}
      <Modal
        visible={!!viewingMoment}
        animationType="fade"
        transparent
        onRequestClose={() => setViewingMoment(null)}
      >
        <Pressable style={styles.viewerOverlay} onPress={() => setViewingMoment(null)}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => setViewingMoment(null)} style={styles.viewerClose}>
              <Text style={styles.viewerCloseText}>✕</Text>
            </Pressable>
          </View>
          {viewingMoment && (
            <View style={styles.viewerContent}>
              <Animated.Image
                source={{ uri: viewingMoment.image }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
              {(viewingMoment.note || viewingMoment.location) && (
                <View style={styles.viewerInfo}>
                  {viewingMoment.note && (
                    <Text style={[styles.viewerNote, isRTL && styles.textRTL]}>{viewingMoment.note}</Text>
                  )}
                  {viewingMoment.location && (
                    <Text style={[styles.viewerLocation, isRTL && styles.textRTL]}>{viewingMoment.location}</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </Pressable>
      </Modal>

      {/* Add Moment Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}>
              <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
                {t("addMoment")}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} disabled={isSaving}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </Pressable>
            </View>

            <Pressable style={styles.imagePicker} onPress={pickImage} disabled={isSaving}>
              {newMomentImage ? (
                <Animated.Image
                  source={{ uri: newMomentImage }}
                  style={styles.previewImage}
                />
              ) : (
                <Text style={styles.imagePickerText}>{t("selectPhoto")}</Text>
              )}
            </Pressable>

            <TextInput
              style={[styles.input, isRTL && styles.inputRTL]}
              placeholder={t("writeNote")}
              placeholderTextColor="#A3A3A3"
              value={newMomentNote}
              onChangeText={setNewMomentNote}
              multiline
              numberOfLines={3}
              textAlign={isRTL ? "right" : "left"}
              editable={!isSaving}
            />

            <TextInput
              style={[styles.input, isRTL && styles.inputRTL]}
              placeholder={t("addLocation")}
              placeholderTextColor="#A3A3A3"
              value={newMomentLocation}
              onChangeText={setNewMomentLocation}
              textAlign={isRTL ? "right" : "left"}
              editable={!isSaving}
            />

            <Button
              title={isSaving ? t("saving") : t("save")}
              onPress={handleAddMoment}
              fullWidth
              disabled={!newMomentImage || isSaving}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================
// SHARED COMPONENTS
// ============================================
interface AddButtonProps {
  label: string;
  onPress: () => void;
}

function AddButton({ label, onPress }: AddButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      style={[styles.addButton, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Text style={styles.addButtonText}>+ {label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerRTL: {
    flexDirection: "row-reverse",
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
  addButton: {
    backgroundColor: "#0D7A5F",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  // Moments
  row: {
    justifyContent: "space-between",
  },
  cardWrapper: {
    marginBottom: 0,
  },
  // States
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    color: "#737373",
    textAlign: "center",
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 32,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalHeaderRTL: {
    flexDirection: "row-reverse",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  cancelText: {
    fontSize: 16,
    color: "#737373",
  },
  imagePicker: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#F5F1EB",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  imagePickerText: {
    fontSize: 16,
    color: "#737373",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  input: {
    backgroundColor: "#F5F1EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1A1A1A",
    marginBottom: 12,
  },
  inputRTL: {
    writingDirection: "rtl",
  },
  // Image Viewer
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
  },
  viewerHeader: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    zIndex: 10,
    alignItems: "flex-end",
    paddingHorizontal: 16,
  },
  viewerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCloseText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  viewerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: {
    width: "100%",
    height: "70%",
  },
  viewerInfo: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: "center",
  },
  viewerNote: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 6,
  },
  viewerLocation: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
});

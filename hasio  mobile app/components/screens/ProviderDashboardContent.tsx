import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useLanguage } from "@/hooks/useLanguage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ProviderDashboardContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useLanguage();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.header, isRTL && styles.headerRTL]}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>{t("back")}</Text>
          </Pressable>
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t("providerDashboard")}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(250).duration(600)}
          style={styles.noteContainer}
        >
          <Text style={[styles.noteText, isRTL && styles.textRTL]}>
            {t("firstListingNote")}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <ActionButton
            label={t("postService")}
            onPress={() => router.push("/provider/post-service")}
            isRTL={isRTL}
            primary
          />
          <ActionButton
            label={t("myServices")}
            onPress={() => router.push("/provider/my-services")}
            isRTL={isRTL}
          />
        </Animated.View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

function ActionButton({ label, onPress, isRTL, primary }: { label: string; onPress: () => void; isRTL: boolean; primary?: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      style={[styles.actionButton, primary && styles.actionButtonPrimary, animatedStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
    >
      <Text style={[styles.actionButtonText, primary && styles.actionButtonTextPrimary, isRTL && styles.textRTL]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F2" },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  headerRTL: { alignItems: "flex-end" },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 15, color: "#0D7A5F", fontWeight: "500" },
  title: { fontSize: 28, fontWeight: "700", color: "#1A1A1A", letterSpacing: -0.5 },
  textRTL: { textAlign: "right" },
  noteContainer: { marginHorizontal: 24, backgroundColor: "#DBEAFE", borderRadius: 8, padding: 12, marginBottom: 16 },
  noteText: { fontSize: 14, color: "#1E40AF", textAlign: "center" },
  actionButton: { marginHorizontal: 24, marginTop: 12, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#E5E5E5" },
  actionButtonPrimary: { backgroundColor: "#0D7A5F", borderColor: "#0D7A5F" },
  actionButtonText: { fontSize: 16, fontWeight: "600", color: "#1A1A1A" },
  actionButtonTextPrimary: { color: "#FFFFFF" },
  bottomSpacing: { height: 32 },
});

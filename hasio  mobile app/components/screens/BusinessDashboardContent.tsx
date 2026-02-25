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

export default function BusinessDashboardContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useLanguage();

  const quickActions = [
    { key: "postLodging", route: "/business/post-lodging" },
    { key: "postFood", route: "/business/post-food" },
    { key: "postEvent", route: "/business/post-event" },
    { key: "postDestination", route: "/business/post-destination" },
  ];

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
            {t("businessDashboard")}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.noteContainer}
        >
          <Text style={[styles.noteText, isRTL && styles.textRTL]}>
            {t("firstListingNote")}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>
            {t("addNew")}
          </Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <ActionCard
                key={action.key}
                label={t(action.key as any)}
                onPress={() => router.push(action.route as any)}
                isRTL={isRTL}
              />
            ))}
          </View>
        </Animated.View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

function ActionCard({ label, onPress, isRTL }: { label: string; onPress: () => void; isRTL: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      style={[styles.actionCard, animatedStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.95, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
    >
      <Text style={[styles.actionLabel, isRTL && styles.textRTL]}>{label}</Text>
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
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#737373", textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  sectionTitleRTL: { textAlign: "right" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 12 },
  actionCard: { width: "47%", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, minHeight: 80 },
  actionLabel: { fontSize: 15, fontWeight: "600", color: "#1A1A1A", textAlign: "center" },
  bottomSpacing: { height: 32 },
});

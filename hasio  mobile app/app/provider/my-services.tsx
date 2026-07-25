import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "@/components/ui";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { ApprovalStatus } from "@/types";
import { fonts } from "@/constants/colors";

const STATUS_COLORS: Record<string, string> = {
  pending: "#D97706",
  approved: "#059669",
  rejected: "#DC2626",
};

export default function MyServicesScreen() {
  const { t, isRTL, language } = useLanguage();
  const [filter, setFilter] = useState<"all" | string>("all");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const myServices = useQuery(api.services.queries.getMyServices, {});
  const isLoading = myServices === undefined;

  const services = myServices ?? [];

  const filteredServices = filter === "all"
    ? services
    : services.filter((s: any) => s.status === filter);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0D7A5F"
            colors={["#0D7A5F"]}
          />
        }
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.header, isRTL && styles.headerRTL]}
        >
          <BackButton />
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t("myServices")}
          </Text>
        </Animated.View>

        {/* Filters */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.filterContainer}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.filterScroll,
              isRTL && styles.filterScrollRTL,
            ]}
          >
            {(["all", "pending", "approved", "rejected"] as const).map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.filterButton,
                  filter === status && styles.filterButtonActive,
                ]}
                onPress={() => setFilter(status)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === status && styles.filterTextActive,
                  ]}
                >
                  {status === "all" ? t("all") : t(`status${status.charAt(0).toUpperCase() + status.slice(1)}` as any)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0D7A5F" />
          </View>
        )}

        {/* Services List */}
        {!isLoading && filteredServices.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(300).duration(600)}
            style={styles.listingsContainer}
          >
            {filteredServices.map((service: any) => (
              <View key={service._id} style={styles.listingCard}>
                {service.images && service.images.length > 0 && (
                  <Image
                    source={{ uri: service.images[0] }}
                    style={styles.listingImage}
                  />
                )}
                <View style={styles.listingInfo}>
                  <Text style={[styles.listingName, isRTL && styles.textRTL]}>
                    {language === "ar" ? (service.title_ar || service.title_en || "—") : (service.title_en || "—")}
                  </Text>
                  <Text style={[styles.listingType, isRTL && styles.textRTL]}>
                    {service.serviceType === "tour_guide" ? t("tourGuide") : service.serviceType === "photographer" ? t("photographer") : service.serviceType === "driver" ? t("driver") : service.serviceType === "translator" ? t("translator") : service.serviceType === "event_planner" ? t("eventPlanner") : service.serviceType === "catering" ? t("catering") : service.serviceType === "equipment_rental" ? t("equipmentRental") : t("otherService")}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[service.status] || "#737373" }]}>
                    <Text style={styles.statusText}>
                      {service.status === "pending" ? t("statusPending") : service.status === "approved" ? t("statusApproved") : t("statusRejected")}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Empty State */}
        {!isLoading && filteredServices.length === 0 && (
          <Animated.View
            entering={FadeInDown.delay(300).duration(600)}
            style={styles.emptyContainer}
          >
            <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
              {t("noListingsYet" as any)}
            </Text>
          </Animated.View>
        )}

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
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  textRTL: {
    textAlign: "right",
  },
  filterContainer: {
    paddingVertical: 16,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterScrollRTL: {
    flexDirection: "row-reverse",
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  filterButtonActive: {
    backgroundColor: "#0D7A5F",
    borderColor: "#0D7A5F",
  },
  filterText: {
    fontSize: 14,
    color: "#737373",
    fontFamily: fonts.medium,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    paddingTop: 40,
    alignItems: "center",
  },
  listingsContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  listingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listingImage: {
    width: "100%",
    height: 140,
  },
  listingInfo: {
    padding: 16,
  },
  listingName: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
    marginBottom: 4,
  },
  listingType: {
    fontSize: 13,
    color: "#737373",
    marginBottom: 8,
    textTransform: "capitalize",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: fonts.semibold,
    textTransform: "capitalize",
  },
  emptyContainer: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#737373",
    textAlign: "center",
  },
  bottomSpacing: {
    height: 32,
  },
});

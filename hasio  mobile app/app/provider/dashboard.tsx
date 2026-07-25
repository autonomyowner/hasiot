import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ProviderDashboardContent from "@/components/screens/ProviderDashboardContent";

export default function ProviderDashboard() {
  return (
    <SafeAreaView style={styles.container}>
      <ProviderDashboardContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
});

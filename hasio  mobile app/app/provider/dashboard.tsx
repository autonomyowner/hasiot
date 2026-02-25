import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
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

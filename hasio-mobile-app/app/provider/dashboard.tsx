import React from "react";
import { StyleSheet, View } from "react-native";
import ProviderDashboardContent from "@/components/screens/ProviderDashboardContent";

/**
 * A plain View, not a SafeAreaView — the content pads its own ink band by the
 * top inset, and the SafeAreaView paid it a second time. See the business
 * dashboard's route file.
 */
export default function ProviderDashboard() {
  return (
    <View style={styles.container}>
      <ProviderDashboardContent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
});

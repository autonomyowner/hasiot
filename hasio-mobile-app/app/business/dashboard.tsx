import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BusinessDashboardContent from "@/components/screens/BusinessDashboardContent";

export default function BusinessDashboard() {
  return (
    <SafeAreaView style={styles.container}>
      <BusinessDashboardContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
});

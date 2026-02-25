import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
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

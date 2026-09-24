import React from "react";
import { StyleSheet, View } from "react-native";
import BusinessDashboardContent from "@/components/screens/BusinessDashboardContent";

/**
 * A plain View, not a SafeAreaView: the content's ink band runs up under the
 * status bar and pads itself by the top inset. Wrapped in a SafeAreaView the
 * inset was paid twice — a cream strip above the band and a band twice as
 * tall as it looks in the design.
 */
export default function BusinessDashboard() {
  return (
    <View style={styles.container}>
      <BusinessDashboardContent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
});

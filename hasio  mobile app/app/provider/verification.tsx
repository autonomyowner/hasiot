import React from "react";
import { View, StyleSheet } from "react-native";
import VerificationScreenContent from "@/components/screens/VerificationScreenContent";

export default function ProviderVerification() {
  return (
    <View style={styles.container}>
      <VerificationScreenContent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
});

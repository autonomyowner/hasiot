import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppStore } from "@/stores/appStore";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      const language = useAppStore.getState().language;
      const isArabic = language === "ar";

      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>!</Text>
          <Text style={styles.title}>
            {isArabic ? "حدث خطأ غير متوقع" : "Something went wrong"}
          </Text>
          <Text style={styles.subtitle}>
            {isArabic
              ? "نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى."
              : "We're sorry for the inconvenience. Please try again."}
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>
              {isArabic ? "إعادة المحاولة" : "Try Again"}
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 48,
    fontWeight: "700",
    color: "#DC6B5A",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#737373",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#0D7A5F",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppStore } from "@/stores/appStore";

const translations = {
  en: {
    title: "Something went wrong",
    subtitle: "We're sorry for the inconvenience. Please try again.",
    tryAgain: "Try Again",
  },
  ar: {
    title: "حدث خطأ غير متوقع",
    subtitle: "نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.",
    tryAgain: "إعادة المحاولة",
  },
};

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? String(error) };
  }

  // Swallowing the error here left crashes undiagnosable in release builds —
  // the only signal was the fallback UI itself. Log it so it reaches the
  // device console (Xcode / Console.app / adb logcat) on a tester's machine.
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "[ErrorBoundary]",
      error?.message,
      "\n",
      error?.stack,
      "\n",
      errorInfo?.componentStack
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: null });
  };

  render() {
    if (this.state.hasError) {
      const language = useAppStore.getState().language;
      const t = translations[language] || translations.en;

      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>!</Text>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{t.subtitle}</Text>
          {this.state.message ? (
            <Text style={styles.detail} numberOfLines={4}>
              {this.state.message}
            </Text>
          ) : null}
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>{t.tryAgain}</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

// Deliberately the one place in the app that still uses `fontWeight` instead of
// a `fontFamily` from `constants/colors`. This boundary is mounted outside the
// font-loading gate in app/_layout.tsx, so a custom family may not be
// registered when it paints — and it renders Arabic, which our Latin-only
// families do not cover. A crash screen should favour legibility over branding.
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
  // Small and muted: useful to a tester reading a screenshot, quiet enough
  // that it does not compete with the apology above it.
  detail: {
    fontSize: 12,
    color: "#A3A3A3",
    textAlign: "center",
    lineHeight: 17,
    marginTop: -20,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: "#CCE745",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: "#1F1D17",
    fontSize: 16,
    fontWeight: "600",
  },
});

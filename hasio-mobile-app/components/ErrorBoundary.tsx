import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useAppStore } from "@/stores/appStore";

const translations = {
  en: {
    title: "Something went wrong",
    subtitle:
      "Hasio ran into a problem it couldn't recover from. Try again — if it keeps happening, close the app and open it again.",
    tryAgain: "Try again",
    showDetails: "Show details",
    hideDetails: "Hide details",
  },
  ar: {
    title: "حدث خطأ غير متوقع",
    subtitle:
      "واجه Hasio مشكلة لم يستطع تجاوزها. حاول مرة أخرى، وإذا تكرر ذلك فأغلق التطبيق وافتحه من جديد.",
    tryAgain: "إعادة المحاولة",
    showDetails: "عرض التفاصيل",
    hideDetails: "إخفاء التفاصيل",
  },
};

// The stack is for whoever reads a tester's screenshot; its first lines are
// the ones that point somewhere.
const STACK_LINES = 6;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  detail: string | null;
  showDetails: boolean;
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const head = `${error.name}: ${error.message}`;
  const stack = (error.stack ?? "")
    .split("\n")
    .map((line) => line.trim())
    // Hermes repeats "Name: message" as the stack's first line.
    .filter((line) => line && line !== head)
    .slice(0, STACK_LINES);
  return [head, ...stack].join("\n");
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, detail: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, detail: describe(error), showDetails: false };
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
    this.setState({ hasError: false, detail: null, showDetails: false });
  };

  toggleDetails = () => {
    this.setState((state) => ({ showDetails: !state.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const language = useAppStore.getState().language;
      const t = translations[language] || translations.en;
      const rtl = language === "ar";
      const { detail, showDetails } = this.state;

      // The apology and the way out come first. The error itself used to sit
      // under the apology in full — "undefined is not a function (evaluating
      // …)" in front of every guest — and it is kept, for testers, behind a
      // toggle.
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>!</Text>
          <Text style={[styles.title, rtl && styles.rtl]}>{t.title}</Text>
          <Text style={[styles.subtitle, rtl && styles.rtl]}>{t.subtitle}</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel={t.tryAgain}
          >
            <Text style={styles.buttonText}>{t.tryAgain}</Text>
          </Pressable>

          {detail ? (
            <>
              <Pressable
                style={({ pressed }) => [styles.detailsToggle, pressed && styles.pressed]}
                onPress={this.toggleDetails}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ expanded: showDetails }}
              >
                <Text style={styles.detailsToggleText}>
                  {showDetails ? t.hideDetails : t.showDetails}
                </Text>
              </Pressable>
              {showDetails ? (
                <ScrollView
                  style={styles.detailBox}
                  contentContainerStyle={styles.detailContent}
                >
                  {/* Selectable, so a tester can copy it into a report. */}
                  <Text style={styles.detail} selectable>
                    {detail}
                  </Text>
                </ScrollView>
              ) : null}
            </>
          ) : null}
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
  // Centred text either way; this only gives the bidi algorithm the right
  // paragraph direction for the Arabic sentences.
  rtl: {
    writingDirection: "rtl",
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
  pressed: {
    opacity: 0.7,
  },
  detailsToggle: {
    marginTop: 20,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  // The palette's dark lime: lime itself is unreadable as text on this cream.
  detailsToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4F5E10",
  },
  detailBox: {
    alignSelf: "stretch",
    maxHeight: 200,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#F1EDE6",
  },
  detailContent: {
    padding: 12,
  },
  // Small and muted, and left-aligned in both languages: it is code.
  detail: {
    fontSize: 12,
    color: "#6E6859",
    lineHeight: 17,
    textAlign: "left",
  },
});

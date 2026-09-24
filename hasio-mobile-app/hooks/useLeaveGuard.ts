import { usePreventRemove } from "expo-router/react-navigation";
import { useNavigation } from "expo-router";
import { Keyboard } from "react-native";
import { appAlert } from "@/stores/dialogStore";
import { useLanguage } from "./useLanguage";

/**
 * Ask before a screen with unsaved work is left.
 *
 * The posting forms used to discard a half-filled listing — photos included —
 * the moment the back button, the Android back key or the iOS edge swipe was
 * used, with nothing to say so. While `active`, every one of those asks first;
 * "Discard" then finishes the navigation that was interrupted, whichever it was.
 *
 * `usePreventRemove` rather than a bare `beforeRemove` listener: the native
 * stack reads the same flag to block the iOS back swipe natively
 * (`preventNativeDismiss`), which a listener alone cannot stop — the screen
 * would already be gone by the time it ran.
 *
 * Pass `active: false` once the work is saved, before navigating away from
 * the success message, or that navigation is intercepted too.
 */
export function useLeaveGuard(active: boolean) {
  const navigation = useNavigation();
  const { t } = useLanguage();

  usePreventRemove(active, ({ data }) => {
    Keyboard.dismiss();
    appAlert(t("discardChangesTitle"), t("discardChangesMessage"), [
      { text: t("keepEditing"), style: "cancel" },
      {
        text: t("discardChanges"),
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });
}

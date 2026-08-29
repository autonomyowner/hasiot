import { create } from "zustand";
import { useAppStore } from "./appStore";

export interface AppAlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface DialogState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  /**
   * Stack of mounted AppDialogHost ids. The dialog renders in the topmost
   * host only, so an alert fired from inside an open native Modal (report
   * sheet, detail sheet, ...) appears above that modal instead of behind it.
   */
  hosts: string[];
  show: (title: string, message?: string, buttons?: AppAlertButton[]) => void;
  hide: () => void;
  registerHost: (id: string) => void;
  unregisterHost: (id: string) => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  visible: false,
  title: "",
  message: undefined,
  buttons: [],
  hosts: [],
  show: (title, message, buttons) =>
    set({
      visible: true,
      title,
      message,
      buttons:
        buttons && buttons.length > 0
          ? buttons
          : [{ text: useAppStore.getState().language === "ar" ? "حسناً" : "OK" }],
    }),
  hide: () => set({ visible: false }),
  registerHost: (id) => set((s) => ({ hosts: [...s.hosts.filter((h) => h !== id), id] })),
  unregisterHost: (id) => set((s) => ({ hosts: s.hosts.filter((h) => h !== id) })),
}));

/**
 * Drop-in replacement for React Native's Alert.alert with the app's branding
 * (fonts, colors, rounded card). Same signature for the common cases.
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[]
) {
  useDialogStore.getState().show(title, message, buttons);
}

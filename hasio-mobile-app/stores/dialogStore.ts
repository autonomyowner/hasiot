import { Keyboard } from "react-native";
import { create } from "zustand";
import { useAppStore } from "./appStore";

export interface AppAlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

export interface AppDialog {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
}

interface DialogState {
  /**
   * The dialog on screen — or, while `visible` is false, the one still fading
   * out, kept so its card does not go blank mid-fade.
   */
  current: AppDialog | null;
  visible: boolean;
  /**
   * Dialogs asked for while another was up or still leaving, shown in order
   * once it has gone.
   *
   * On iOS a Modal cannot be presented while another is presenting or being
   * dismissed: UIKit refuses, React Native has already marked it presented and
   * never retries, and the store is left "visible" with nothing on screen — so
   * every later alert of the session is invisible too. The typical trigger was
   * a button whose action awaited a mutation and then raised a second alert
   * ("Cancel booking?" → "Booking cancelled") while the first was fading out.
   * Queueing makes that impossible, and no longer drops the first of two quick
   * alerts, which replacing the current one used to do.
   */
  queue: AppDialog[];
  /**
   * Stack of mounted AppDialogHost ids. The dialog renders in the topmost
   * host only, so an alert fired from inside an open native Modal (report
   * sheet, detail sheet, ...) appears above that modal instead of behind it.
   */
  hosts: string[];
  show: (title: string, message?: string, buttons?: AppAlertButton[]) => void;
  /** A button or the backdrop closed the dialog; its Modal starts leaving. */
  hide: () => void;
  /** The dialog has fully left the screen: show the next one, if any. */
  settled: () => void;
  registerHost: (id: string) => void;
  unregisterHost: (id: string) => void;
}

const sameDialog = (a: AppDialog | null | undefined, b: AppDialog) =>
  !!a && a.title === b.title && a.message === b.message;

export const useDialogStore = create<DialogState>((set) => ({
  current: null,
  visible: false,
  queue: [],
  hosts: [],
  show: (title, message, buttons) => {
    // A dialog over a raised keyboard has its buttons under the keyboard on
    // most phones, and the field behind it cannot be typed into anyway.
    Keyboard.dismiss();
    const dialog: AppDialog = {
      title,
      message,
      buttons:
        buttons && buttons.length > 0
          ? buttons
          : [{ text: useAppStore.getState().language === "ar" ? "حسناً" : "OK" }],
    };
    set((state) => {
      if (!state.current) return { current: dialog, visible: true };
      // The same thing said twice in a row is said once — two code paths
      // reporting one event used to show one "thank you" and hide another.
      const last = state.queue[state.queue.length - 1] ?? (state.visible ? state.current : null);
      if (sameDialog(last, dialog)) return state;
      return { queue: [...state.queue, dialog] };
    });
  },
  hide: () => set({ visible: false }),
  settled: () =>
    set((state) => {
      const [next, ...rest] = state.queue;
      return next
        ? { current: next, visible: true, queue: rest }
        : { current: null, visible: false };
    }),
  registerHost: (id) => set((s) => ({ hosts: [...s.hosts.filter((h) => h !== id), id] })),
  unregisterHost: (id) => set((s) => ({ hosts: s.hosts.filter((h) => h !== id) })),
}));

/**
 * Drop-in replacement for React Native's Alert.alert with the app's branding
 * (fonts, colors, rounded card). Same signature for the common cases.
 *
 * A button's `onPress` runs once its dialog has left the screen, not the
 * moment it is tapped — so an action that closes a sheet, opens one, navigates
 * or raises the next alert never collides with the dialog still fading out.
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[]
) {
  useDialogStore.getState().show(title, message, buttons);
}

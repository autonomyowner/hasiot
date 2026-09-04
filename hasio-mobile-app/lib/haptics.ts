/**
 * Haptic feedback — currently a no-op.
 *
 * The real implementation needs `expo-haptics`, which is a native module. This
 * code ships as an over-the-air update to binaries already in the stores, and
 * a bundle that references a native module the binary lacks crashes on launch.
 *
 * The signature is the one the real version has, so every call site is already
 * written correctly: the next native build swaps this file's body for the
 * `expo-haptics` calls and nothing else changes.
 *
 * Three verbs, on purpose. "light" for a selection (a date, a tab), "success"
 * for the moment a request is accepted, "warning" before something the user
 * cannot take back. Anything finer becomes noise.
 */
export type HapticKind = "light" | "success" | "warning";

export async function haptic(_kind: HapticKind): Promise<void> {
  // Intentionally empty. See the note above before adding an import here.
}

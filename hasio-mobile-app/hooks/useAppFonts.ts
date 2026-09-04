import { useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { arabicFonts, fonts, type AppFonts } from "@/constants/colors";

/**
 * The font family names for the language currently selected.
 *
 * Latin and Arabic need different files — Outfit and Instrument Serif have no
 * Arabic glyphs at all — but every screen wants the same six roles, so both
 * maps share a shape and only the values change.
 */
export function useAppFonts(): AppFonts {
  const language = useAppStore((state) => state.language);
  return language === "ar" ? arabicFonts : fonts;
}

/**
 * Build a screen's StyleSheet from the active font map, rebuilding it only when
 * the language changes.
 *
 * `StyleSheet.create` runs once per module, at import time, so a stylesheet
 * that reads `fonts.bold` directly captures whichever language was active when
 * the file first loaded and then never changes. Passing the map in as an
 * argument is what lets the toggle actually re-render in the other family:
 *
 *     const makeStyles = (fonts: AppFonts) =>
 *       StyleSheet.create({ title: { fontFamily: fonts.bold } });
 *
 *     function Screen() {
 *       const styles = useThemedStyles(makeStyles);
 *
 * Every `styles.x` reference in the component stays exactly as it was. Where a
 * file defines more than one component off the same stylesheet, each one calls
 * this — the memo is keyed on the factory, so they share the same object.
 */
const cache = new WeakMap<(fonts: AppFonts) => unknown, Map<string, unknown>>();

export function useThemedStyles<T>(factory: (fonts: AppFonts) => T): T {
  const language = useAppStore((state) => state.language);

  return useMemo(() => {
    let byLanguage = cache.get(factory);
    if (!byLanguage) {
      byLanguage = new Map();
      cache.set(factory, byLanguage);
    }
    if (!byLanguage.has(language)) {
      byLanguage.set(language, factory(language === "ar" ? arabicFonts : fonts));
    }
    return byLanguage.get(language) as T;
  }, [factory, language]);
}

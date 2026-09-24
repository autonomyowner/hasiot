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
      byLanguage.set(
        language,
        language === "ar" ? adaptForArabic(factory(arabicFonts)) : factory(fonts)
      );
    }
    return byLanguage.get(language) as T;
  }, [factory, language]);
}

/**
 * Cairo clips its ascenders, hamzas and diacritics when set tighter than this
 * multiple of its size — see the lodging card's name, which learned it at 20px.
 */
const MIN_ARABIC_LINE_HEIGHT = 1.4;

/**
 * Undo the two things a Latin stylesheet does that Arabic cannot take.
 *
 * Letter-spacing: Arabic letters join, and spacing them pulls the joins
 * apart — on iOS "صباح الخير" set with the eyebrow's 1.5 tracking comes out
 * as separate letters. Every tracked eyebrow and caption in the app was
 * written for Outfit, so in Arabic tracking is simply off.
 *
 * Line height: the Latin faces run fine at 1.1–1.2× their size; Cairo's tall
 * marks are cut off below about 1.4×, which is how the Home title and the
 * card prices lost the tops of their letters. A line height is only ever
 * raised to that floor, never lowered.
 *
 * Done once here, where each screen's stylesheet is built for Arabic, rather
 * than in two dozen style factories that would each have to remember.
 */
function adaptForArabic<T>(sheet: T): T {
  if (!sheet || typeof sheet !== "object") return sheet;
  const adapted: Record<string, unknown> = {};
  for (const [key, style] of Object.entries(sheet as Record<string, unknown>)) {
    if (!style || typeof style !== "object" || Array.isArray(style)) {
      adapted[key] = style;
      continue;
    }
    const s = style as Record<string, unknown>;
    let next = s;
    if (typeof s.letterSpacing === "number" && s.letterSpacing !== 0) {
      next = { ...next, letterSpacing: 0 };
    }
    if (
      typeof s.fontSize === "number" &&
      typeof s.lineHeight === "number" &&
      s.lineHeight < s.fontSize * MIN_ARABIC_LINE_HEIGHT
    ) {
      next = { ...next, lineHeight: Math.ceil(s.fontSize * MIN_ARABIC_LINE_HEIGHT) };
    }
    adapted[key] = next;
  }
  return adapted as T;
}

import { useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { translations, type TranslationKey } from "@/constants/translations";
import type { Language } from "@/types";

export function useLanguage() {
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  const isRTL = language === "ar";

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] || translations.en[key] || key;
    },
    [language]
  );

  const changeLanguage = useCallback(
    (newLang: Language) => {
      setLanguage(newLang);
      // Deliberately no I18nManager.forceRTL: that only takes effect after a
      // restart. Native layout stays left-to-right, and every screen mirrors
      // itself from `isRTL`, so the switch is instant.
    },
    [setLanguage]
  );

  return {
    language,
    isRTL,
    t,
    changeLanguage,
  };
}

// Helper function to get localized content from data objects
export function getLocalizedText(
  en: string,
  ar: string,
  language: Language
): string {
  return language === "ar" ? ar : en;
}

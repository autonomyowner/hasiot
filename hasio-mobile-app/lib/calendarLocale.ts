import { LocaleConfig } from "react-native-calendars";
import type { Language } from "@/types";

/**
 * Arabic month and day names for the booking calendar.
 *
 * react-native-calendars ships English only, and its locale registry is a
 * module-level global rather than a prop — so this has to be applied before the
 * calendar renders, and the calendar needs remounting (key={language}) when the
 * guest switches language, since it reads the locale once on mount.
 *
 * Note that `I18nManager.forceRTL` is never called: this app has always laid
 * out RTL screens with explicit styles rather than flipping the whole native
 * layout, and turning it on here would mirror every screen in the app.
 */

LocaleConfig.locales.en = LocaleConfig.locales[""];

LocaleConfig.locales.ar = {
  monthNames: [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ],
  monthNamesShort: [
    "ينا",
    "فبر",
    "مار",
    "أبر",
    "مايو",
    "يون",
    "يول",
    "أغس",
    "سبت",
    "أكت",
    "نوف",
    "ديس",
  ],
  // Sunday first, matching the library's week order.
  dayNames: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  dayNamesShort: ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"],
  today: "اليوم",
};

export function applyCalendarLocale(language: Language): void {
  LocaleConfig.defaultLocale = language === "ar" ? "ar" : "en";
}

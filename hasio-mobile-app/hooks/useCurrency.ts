import { useCallback, useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { useLanguage } from "@/hooks/useLanguage";
import { formatPrice, type Currency } from "@/lib/currency";

/**
 * The viewer's display currency and a formatter bound to it.
 *
 * `format` takes the amount as it is *stored* — riyals — and returns the string
 * to render. Every price the guest sees goes through it; host price *inputs*
 * stay in riyals and never touch this.
 *
 * The returned `format` is stable for a given currency + language, so screens
 * can hand it to memoised rows without re-rendering the list on every keystroke.
 */
export function useCurrency() {
  const currency = useAppStore((state) => state.currency);
  const setCurrency = useAppStore((state) => state.setCurrency);
  const { t } = useLanguage();

  const unit = useMemo(() => ({ sar: t("sar"), usd: t("usd") }), [t]);

  const format = useCallback(
    (amountSar: number) => formatPrice(amountSar, currency, unit),
    [currency, unit]
  );

  return { currency, setCurrency, format };
}

export type { Currency };

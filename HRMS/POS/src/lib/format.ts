import { getCurrency } from "./currencies";

let activeCode = "PHP";

export const setActiveCurrency = (code?: string | null) => {
  activeCode = (code || "PHP").toUpperCase();
};

export const formatMoney = (n: number | string, code?: string | null) => {
  const c = getCurrency(code || activeCode);
  const isZeroDecimal = c.code === "JPY" || c.code === "KRW" || c.code === "VND" || c.code === "IDR";
  const digits = isZeroDecimal ? 0 : 2;
  return `${c.symbol}${Number(n).toLocaleString(c.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
};

// Backwards-compatible alias — now currency-aware via active store currency.
export const PESO = (n: number | string) => formatMoney(n);

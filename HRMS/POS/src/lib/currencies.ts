export type Currency = {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  locale: string;
};

export const CURRENCIES: Currency[] = [
  { code: "PHP", symbol: "₱", name: "Philippine Peso", flag: "🇵🇭", locale: "en-PH" },
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", locale: "de-DE" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧", locale: "en-GB" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵", locale: "ja-JP" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", flag: "🇨🇳", locale: "zh-CN" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc", flag: "🇨🇭", locale: "de-CH" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦", locale: "en-CA" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺", locale: "en-AU" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", flag: "🇳🇿", locale: "en-NZ" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳", locale: "en-IN" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬", locale: "en-SG" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", flag: "🇭🇰", locale: "en-HK" },
  { code: "KRW", symbol: "₩", name: "South Korean Won", flag: "🇰🇷", locale: "ko-KR" },
  { code: "THB", symbol: "฿", name: "Thai Baht", flag: "🇹🇭", locale: "th-TH" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", flag: "🇲🇾", locale: "ms-MY" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", flag: "🇮🇩", locale: "id-ID" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong", flag: "🇻🇳", locale: "vi-VN" },
  { code: "TWD", symbol: "NT$", name: "Taiwan Dollar", flag: "🇹🇼", locale: "zh-TW" },
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee", flag: "🇵🇰", locale: "en-PK" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪", locale: "ar-AE" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", flag: "🇸🇦", locale: "ar-SA" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "🇧🇷", locale: "pt-BR" },
  { code: "MXN", symbol: "Mex$", name: "Mexican Peso", flag: "🇲🇽", locale: "es-MX" },
];

export const getCurrency = (code?: string | null): Currency =>
  CURRENCIES.find((c) => c.code === (code || "PHP").toUpperCase()) || CURRENCIES[0];

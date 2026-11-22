import dayjs from 'dayjs';

// EU-style formats chosen by the user: 1 234 567,89 and DD.MM.YYYY.
const numberFormats = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number | string, fractionDigits = 2): string {
  let fmt = numberFormats.get(fractionDigits);
  if (!fmt) {
    fmt = new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    numberFormats.set(fractionDigits, fmt);
  }
  return fmt.format(Number(value)).replace(/[\u00a0\u202f]/g, ' ');
}

const CURRENCY_SIGNS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' };

export function formatMoney(value: number | string, currency: string): string {
  return `${formatNumber(value)} ${CURRENCY_SIGNS[currency] ?? currency}`;
}

export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${formatNumber(Number(value) * 100)} %`;
}

export function formatDate(value: string | null | undefined): string {
  return value ? dayjs(value).format('DD.MM.YYYY') : '—';
}

/** ISO date (YYYY-MM-DD) as the backend expects it. */
export function toIsoDate(value: Date | string): string {
  return dayjs(value).format('YYYY-MM-DD');
}

const compactFormats = new Map<string, Intl.NumberFormat>();

/** Short form for large amounts, e.g. "1,98 трлн ₴" or "1.98T ₴", in the UI language. */
export function formatCompact(value: number | string, currency: string, locale: string): string {
  let fmt = compactFormats.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    compactFormats.set(locale, fmt);
  }
  const text = fmt.format(Number(value)).replace(/[\u00a0\u202f]/g, ' ');
  return `${text} ${CURRENCY_SIGNS[currency] ?? currency}`;
}

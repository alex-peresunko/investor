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

export function formatMoney(value: number | string, currency: 'UAH' | 'USD'): string {
  return `${formatNumber(value)} ${currency === 'UAH' ? '₴' : '$'}`;
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

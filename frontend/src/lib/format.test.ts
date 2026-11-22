import { describe, expect, it } from 'vitest';

import { formatCompact, formatDate, formatMoney, formatNumber, formatPercent } from './format';

describe('format', () => {
  it('formats numbers with space grouping and comma decimals', () => {
    expect(formatNumber(1234567.891)).toBe('1 234 567,89');
  });
  it('formats money with currency sign', () => {
    expect(formatMoney('1000', 'USD')).toBe('1 000,00 $');
    expect(formatMoney('5', 'EUR')).toBe('5,00 €');
  });
  it('formats percent from a fraction', () => {
    expect(formatPercent(0.1534)).toBe('15,34 %');
    expect(formatPercent(null)).toBe('—');
  });
  it('shortens large amounts in the UI language', () => {
    expect(formatCompact(1_975_956_577_585, 'UAH', 'en')).toBe('1.98T ₴');
    expect(formatCompact(25_000_000, 'USD', 'uk')).toBe('25 млн $');
  });
  it('formats dates as DD.MM.YYYY', () => {
    expect(formatDate('2026-03-05')).toBe('05.03.2026');
  });
});

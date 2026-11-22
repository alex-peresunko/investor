import { describe, expect, it } from 'vitest';

import { formatDate, formatMoney, formatNumber, formatPercent } from './format';

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
  it('formats dates as DD.MM.YYYY', () => {
    expect(formatDate('2026-03-05')).toBe('05.03.2026');
  });
});

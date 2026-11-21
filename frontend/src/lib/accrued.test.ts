import { describe, expect, it } from 'vitest';

import type { Instrument, ScheduledPayment } from '@/api/types';

import { accruedPerUnit } from './accrued';

const bond: Instrument = {
  id: 1,
  kind: 'bond',
  isin: 'UA4000227045',
  name: 'OVDP',
  currency: 'UAH',
  face_value: '1000.00',
  coupon_rate: '0.165000',
  coupon_frequency: 2,
  issue_date: '2025-03-05',
  maturity_date: '2027-09-01',
};

const schedule: ScheduledPayment[] = [
  { id: 1, kind: 'coupon', pay_date: '2025-09-01', amount_per_unit: '82.500000' },
  { id: 2, kind: 'coupon', pay_date: '2026-03-01', amount_per_unit: '82.500000' },
  { id: 3, kind: 'redemption', pay_date: '2027-09-01', amount_per_unit: '1000.000000' },
];

describe('accruedPerUnit', () => {
  it('is linear between coupon dates', () => {
    expect(accruedPerUnit(bond, schedule, '2026-01-10')).toBeCloseTo((82.5 * 131) / 181, 6);
  });
  it('is zero on a coupon date and after the last coupon', () => {
    expect(accruedPerUnit(bond, schedule, '2026-03-01')).toBe(0);
    expect(accruedPerUnit(bond, schedule, '2026-06-01')).toBe(0);
  });
  it('accrues from the issue date before the first coupon', () => {
    expect(accruedPerUnit(bond, schedule, '2025-03-05')).toBe(0);
  });
});

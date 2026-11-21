import dayjs from 'dayjs';

import type { Instrument, ScheduledPayment } from '@/api/types';

/**
 * Coupon accrued per unit at the end of `isoDate`, linear between coupon dates. Must match
 * `accrued_coupon` in backend/app/engine/portfolio.py.
 */
export function accruedPerUnit(
  instrument: Instrument,
  schedule: ScheduledPayment[],
  isoDate: string,
): number {
  const day = dayjs(isoDate);
  const coupons = schedule
    .filter((item) => item.kind === 'coupon')
    .sort((a, b) => a.pay_date.localeCompare(b.pay_date));
  const upcoming = coupons.find((c) => dayjs(c.pay_date).isAfter(day, 'day'));
  if (!upcoming || day.isBefore(dayjs(instrument.issue_date), 'day')) return 0;
  const past = coupons.filter((c) => !dayjs(c.pay_date).isAfter(day, 'day'));
  const previous = past.at(-1)?.pay_date ?? instrument.issue_date;
  const period = dayjs(upcoming.pay_date).diff(dayjs(previous), 'day');
  const elapsed = day.diff(dayjs(previous), 'day');
  return (Number(upcoming.amount_per_unit) * elapsed) / period;
}

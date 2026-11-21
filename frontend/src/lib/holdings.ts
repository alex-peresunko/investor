import type { Lot, Sale } from '@/api/types';

export function soldQuantity(lotId: number, sales: Sale[], excludeSaleId?: number): number {
  return sales
    .filter((s) => s.lot_id === lotId && s.id !== excludeSaleId)
    .reduce((sum, s) => sum + Number(s.quantity), 0);
}

/** Units of a bond held at the end of the day before `isoDate`; mirrors the backend rule. */
export function heldBefore(
  instrumentId: number,
  isoDate: string,
  lots: Lot[],
  sales: Sale[],
): number {
  const lotIds = new Set(
    lots.filter((l) => l.instrument_id === instrumentId && l.trade_date < isoDate).map((l) => l.id),
  );
  const bought = lots.filter((l) => lotIds.has(l.id)).reduce((s, l) => s + Number(l.quantity), 0);
  const sold = sales
    .filter((s) => lotIds.has(s.lot_id) && s.trade_date < isoDate)
    .reduce((sum, s) => sum + Number(s.quantity), 0);
  return bought - sold;
}

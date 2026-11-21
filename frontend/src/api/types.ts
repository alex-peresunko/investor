import type { components } from './schema';

type Schemas = components['schemas'];

export type Instrument = Schemas['InstrumentOut'];
export type InstrumentInput = Schemas['InstrumentIn'];
export type ScheduledPayment = Schemas['ScheduledPaymentOut'];
export type ScheduledPaymentInput = Schemas['ScheduledPaymentIn'];
export type Lot = Schemas['LotOut'];
export type LotInput = Schemas['LotIn'];
export type Sale = Schemas['SaleOut'];
export type SaleInput = Schemas['SaleIn'];
export type Payment = Schemas['PaymentOut'];
export type PaymentInput = Schemas['PaymentIn'];

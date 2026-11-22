import type { components } from './schema';

type Schemas = components['schemas'];

export type Instrument = Schemas['InstrumentOut'];
export type Currency = Instrument['currency'];
export type InstrumentInput = Schemas['InstrumentIn'];
export type InstrumentCreate = Schemas['InstrumentCreate'];
export type Security = Schemas['SecurityOut'];
export type ScheduledPayment = Schemas['ScheduledPaymentOut'];
export type ScheduledPaymentInput = Schemas['ScheduledPaymentIn'];
export type Lot = Schemas['LotOut'];
export type LotInput = Schemas['LotIn'];
export type Sale = Schemas['SaleOut'];
export type SaleInput = Schemas['SaleIn'];
export type Payment = Schemas['PaymentOut'];
export type PaymentInput = Schemas['PaymentIn'];
export type Preferences = Schemas['PreferencesOut'];
export type Language = Preferences['language'];

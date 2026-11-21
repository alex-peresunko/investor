import { NumberInput, type NumberInputProps } from '@mantine/core';

/** NumberInput with the app's EU number format (1 234 567,89). */
export function MoneyInput({ decimalScale = 2, ...props }: NumberInputProps) {
  return (
    <NumberInput
      decimalSeparator=","
      thousandSeparator=" "
      decimalScale={decimalScale}
      hideControls
      min={0}
      {...props}
    />
  );
}

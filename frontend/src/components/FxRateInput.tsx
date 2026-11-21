import { ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import type { NumberInputProps } from '@mantine/core';

import { MoneyInput } from './MoneyInput';

interface Props extends NumberInputProps {
  onRefresh: () => void;
  loading: boolean;
}

/** USD/UAH rate field; prefilled from NBU by the parent form, always editable. */
export function FxRateInput({ onRefresh, loading, ...props }: Props) {
  return (
    <MoneyInput
      label="USD/UAH rate"
      description="Official NBU rate is filled in; replace it with your bank's rate if different"
      decimalScale={6}
      rightSection={
        <Tooltip label="Fetch NBU rate for this date">
          <ActionIcon
            variant="subtle"
            onClick={onRefresh}
            loading={loading}
            aria-label="Fetch NBU rate"
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      }
      {...props}
    />
  );
}

import { ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import type { NumberInputProps } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { MoneyInput } from './MoneyInput';

interface Props extends NumberInputProps {
  onRefresh: () => void;
  loading: boolean;
}

/** USD/UAH rate field; prefilled from NBU by the parent form, always editable. */
export function FxRateInput({ onRefresh, loading, ...props }: Props) {
  const { t } = useTranslation();
  return (
    <MoneyInput
      label={t('fx.label')}
      description={t('fx.description')}
      decimalScale={6}
      rightSection={
        <Tooltip label={t('fx.fetch')}>
          <ActionIcon
            variant="subtle"
            onClick={onRefresh}
            loading={loading}
            aria-label={t('fx.fetchAria')}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      }
      {...props}
    />
  );
}

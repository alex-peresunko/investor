import { DateInput, type DateInputProps } from '@mantine/dates';
import { useTranslation } from 'react-i18next';

/** Date input showing DD.MM.YYYY; its value is an ISO YYYY-MM-DD string. */
export function DateField(props: DateInputProps) {
  const { t } = useTranslation();
  return (
    <DateInput
      valueFormat="DD.MM.YYYY"
      placeholder={t('date.placeholder')}
      clearable={false}
      {...props}
    />
  );
}

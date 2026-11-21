import { DateInput, type DateInputProps } from '@mantine/dates';

/** Date input showing DD.MM.YYYY; its value is an ISO YYYY-MM-DD string. */
export function DateField(props: DateInputProps) {
  return (
    <DateInput valueFormat="DD.MM.YYYY" placeholder="DD.MM.YYYY" clearable={false} {...props} />
  );
}

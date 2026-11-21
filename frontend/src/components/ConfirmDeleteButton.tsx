import { ActionIcon, Button, Group, Modal, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface Props {
  /** Object of the sentence "Delete …?", already translated. */
  what: string;
  onConfirm: () => Promise<unknown>;
  loading?: boolean;
}

export function ConfirmDeleteButton({ what, onConfirm, loading }: Props) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Tooltip label={t('common.delete')}>
        <ActionIcon
          variant="subtle"
          color="red"
          onClick={open}
          aria-label={t('confirmDelete.aria', { what })}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
      <Modal opened={opened} onClose={close} title={t('confirmDelete.title', { what })} centered>
        <Text size="sm">{t('confirmDelete.body')}</Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            color="red"
            loading={loading}
            onClick={async () => {
              await onConfirm().then(close, () => undefined);
            }}
          >
            {t('common.delete')}
          </Button>
        </Group>
      </Modal>
    </>
  );
}

import { ActionIcon, Button, Group, Modal, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash } from '@tabler/icons-react';

interface Props {
  what: string;
  onConfirm: () => Promise<unknown>;
  loading?: boolean;
}

export function ConfirmDeleteButton({ what, onConfirm, loading }: Props) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Tooltip label="Delete">
        <ActionIcon variant="subtle" color="red" onClick={open} aria-label={`Delete ${what}`}>
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
      <Modal opened={opened} onClose={close} title={`Delete ${what}?`} centered>
        <Text size="sm">This cannot be undone. All reports are recalculated without it.</Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={loading}
            onClick={async () => {
              await onConfirm().then(close, () => undefined);
            }}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </>
  );
}

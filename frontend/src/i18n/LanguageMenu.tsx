import { ActionIcon, Menu } from '@mantine/core';
import { IconCheck, IconLanguage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import type { Language } from '@/api/types';

import { LANGUAGES } from './languages';
import { useSetLanguage } from './preferences';

export function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const setLanguage = useSetLanguage();
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label={t('app.language')}
          title={t('app.language')}
        >
          <IconLanguage size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {(Object.entries(LANGUAGES) as [Language, (typeof LANGUAGES)[Language]][]).map(
          ([code, { label }]) => (
            <Menu.Item
              key={code}
              lang={code}
              onClick={() => setLanguage.mutate(code)}
              rightSection={i18n.language === code ? <IconCheck size={14} /> : null}
            >
              {label}
            </Menu.Item>
          ),
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

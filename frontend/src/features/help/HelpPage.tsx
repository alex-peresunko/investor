import {
  Alert,
  Code,
  Grid,
  List,
  NavLink,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBook2,
  IconDatabase,
  IconInfoCircle,
  IconMathFunction,
  IconRocket,
  type Icon,
} from '@tabler/icons-react';
import { Fragment, type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import { NAV, type Page } from '@/app/nav';
import { HELP_SECTIONS, HELP_TOPICS, type HelpSection } from '@/components/HelpLink';
import { PageTitle } from '@/components/PageTitle';

const OWN_ICONS: Record<string, { icon: Icon; color: string }> = {
  overview: { icon: IconRocket, color: 'brand' },
  terms: { icon: IconBook2, color: 'cyan' },
  calculations: { icon: IconMathFunction, color: 'pink' },
  data: { icon: IconDatabase, color: 'gray' },
};

function iconOf(section: HelpSection): { icon: Icon; color: string } {
  return OWN_ICONS[section] ?? NAV[section as Page];
}

export function HelpPage() {
  const { t } = useTranslation();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
  }, [hash]);

  return (
    <Stack gap="lg">
      <div>
        <PageTitle page="help">{t('help.title')}</PageTitle>
        <Text size="sm" c="dimmed">
          {t('help.subtitle')}
        </Text>
      </div>
      <Grid>
        <Grid.Col span={{ base: 12, md: 9 }}>
          <Stack gap="lg">
            {HELP_SECTIONS.map((id) => {
              const { icon: SectionIcon, color } = iconOf(id);
              return (
                <Paper key={id} id={id} withBorder p="lg" className="help-anchor">
                  <Title
                    order={3}
                    mb="sm"
                    style={{ display: 'flex', gap: 10, alignItems: 'center' }}
                  >
                    <ThemeIcon variant="light" color={color} size={32} radius="md">
                      <SectionIcon size={18} />
                    </ThemeIcon>
                    {t(`help.sections.${id}.title`)}
                  </Title>
                  <RichText text={t(`help.sections.${id}.body`)} />
                  {id === 'calculations' &&
                    HELP_TOPICS.map((topic) => (
                      <div key={topic} id={topic} className="help-anchor">
                        <Title order={4} mt="lg" mb="xs">
                          {t(`help.topics.${topic}.title`)}
                        </Title>
                        <RichText text={t(`help.topics.${topic}.body`)} />
                      </div>
                    ))}
                </Paper>
              );
            })}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ md: 3 }} visibleFrom="md">
          <Paper withBorder p="xs" pos="sticky" top={110}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} px="sm" py={4}>
              {t('help.contents')}
            </Text>
            {HELP_SECTIONS.map((id) => (
              <Fragment key={id}>
                <NavLink
                  href={`#${id}`}
                  label={t(`help.sections.${id}.title`)}
                  active={hash === `#${id}`}
                />
                {id === 'calculations' &&
                  HELP_TOPICS.map((topic) => (
                    <NavLink
                      key={topic}
                      href={`#${topic}`}
                      pl="xl"
                      label={t(`help.topics.${topic}.title`)}
                      active={hash === `#${topic}`}
                    />
                  ))}
              </Fragment>
            ))}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

/**
 * Renders the help markup used in the locales: blank-line separated blocks; a block of "- " lines
 * is a list, of "1. " lines a numbered list, "> " a note; lines starting with "= " are formulas;
 * **bold** and `code` inline.
 */
function RichText({ text }: { text: string }) {
  return (
    <Stack gap="sm">
      {text.split('\n\n').map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.startsWith('- ')))
          return (
            <List key={i} size="sm" spacing={6}>
              {lines.map((l, j) => (
                <List.Item key={j}>{inline(l.slice(2))}</List.Item>
              ))}
            </List>
          );
        if (lines.every((l) => /^\d+\. /.test(l)))
          return (
            <List key={i} type="ordered" size="sm" spacing={6}>
              {lines.map((l, j) => (
                <List.Item key={j}>{inline(l.replace(/^\d+\. /, ''))}</List.Item>
              ))}
            </List>
          );
        if (block.startsWith('> '))
          return (
            <Alert key={i} variant="light" color="blue" icon={<IconInfoCircle size={18} />}>
              {inline(block.slice(2))}
            </Alert>
          );
        return <Fragment key={i}>{lines.map((l, j) => line(l, j))}</Fragment>;
      })}
    </Stack>
  );
}

function line(text: string, key: number) {
  if (text.startsWith('= '))
    return (
      <Code key={key} block fz="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {text.slice(2)}
      </Code>
    );
  return (
    <Text key={key} size="sm" lh={1.65}>
      {inline(text)}
    </Text>
  );
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
    if (part.startsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>;
    if (part.startsWith('`')) return <Code key={i}>{part.slice(1, -1)}</Code>;
    return part;
  });
}

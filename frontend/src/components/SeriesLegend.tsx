import { ColorSwatch, Group, UnstyledButton, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SeriesDef {
  name: string;
  label: string;
  /** Mantine color reference such as 'teal.6'. */
  color: string;
}

function readHidden(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Which series of a chart are shown. Remembered per `storageKey` in this browser; the last
 * visible series cannot be switched off.
 */
export function useSeriesToggle(storageKey: string, series: readonly SeriesDef[]) {
  const [hidden, setHidden] = useState<string[]>(() => readHidden(storageKey));
  const visible = series.filter((s) => !hidden.includes(s.name));

  const toggle = (name: string) => {
    const next = hidden.includes(name) ? hidden.filter((n) => n !== name) : [...hidden, name];
    if (series.every((s) => next.includes(s.name))) return;
    setHidden(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode): the selection just isn't remembered.
    }
  };

  return { visible, isVisible: (name: string) => !hidden.includes(name), toggle };
}

function cssColor(color: string): string {
  const [name, shade] = color.split('.');
  return shade ? `var(--mantine-color-${name}-${shade})` : `var(--mantine-color-${name}-6)`;
}

interface LegendProps {
  series: readonly SeriesDef[];
  isVisible: (name: string) => boolean;
  onToggle: (name: string) => void;
}

/** Legend whose items switch series on and off (replaces the chart's hover-highlight legend). */
export function SeriesLegend({ series, isVisible, onToggle }: LegendProps) {
  const { t } = useTranslation();
  return (
    <Group gap="md">
      {series.map((s) => {
        const on = isVisible(s.name);
        return (
          <UnstyledButton
            key={s.name}
            onClick={() => onToggle(s.name)}
            aria-pressed={on}
            title={t(on ? 'series.hide' : 'series.show', { label: s.label })}
          >
            <Group gap={6} wrap="nowrap" opacity={on ? 1 : 0.4}>
              <ColorSwatch color={cssColor(s.color)} size={12} withShadow={false} />
              <Text size="sm" td={on ? undefined : 'line-through'}>
                {s.label}
              </Text>
            </Group>
          </UnstyledButton>
        );
      })}
    </Group>
  );
}

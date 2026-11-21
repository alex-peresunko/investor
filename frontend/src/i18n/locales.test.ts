import { expect, it } from 'vitest';

import { LANGUAGES } from './languages';

const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(tree: object, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out.set(prefix + key, value);
    else for (const entry of flatten(value as object, `${prefix}${key}.`)) out.set(...entry);
  }
  return out;
}

const variables = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

const english = flatten(LANGUAGES.en.messages);
const englishBase = new Set([...english.keys()].map((k) => k.replace(PLURAL, '')));

it.each(Object.entries(LANGUAGES))(
  '%s translates every key with the same placeholders',
  (code, lang) => {
    const messages = flatten(lang.messages);
    const base = new Set([...messages.keys()].map((k) => k.replace(PLURAL, '')));
    expect([...base].sort()).toEqual([...englishBase].sort());

    for (const [key, text] of messages) {
      expect(text.trim(), key).not.toBe('');
      const englishText = english.get(key) ?? english.get(key.replace(PLURAL, '_other'));
      expect(variables(text), key).toEqual(variables(englishText ?? ''));
    }

    const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    const pluralKeys = new Set(
      [...english.keys()].filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')),
    );
    for (const key of pluralKeys) {
      for (const category of categories)
        expect(messages.has(`${key}_${category}`), `${key}_${category}`).toBe(true);
    }
  },
);

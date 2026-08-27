/**
 * Adds any key present in en.json but missing from another locale file, using the English value
 * as a placeholder (untranslated but functionally present — i18next falls back to showing the key
 * path itself otherwise, which is worse than an English string). Never removes or overwrites an
 * existing translated value. Run with `npx tsx scripts/i18n-sync.ts`.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type LocaleTree = { [key: string]: string | LocaleTree };

const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');

function mergeMissing(
  base: LocaleTree,
  target: LocaleTree,
): { merged: LocaleTree; addedCount: number } {
  let addedCount = 0;
  const merged: LocaleTree = { ...target };

  for (const [key, baseValue] of Object.entries(base)) {
    const targetValue = target[key];
    if (targetValue === undefined) {
      merged[key] = baseValue;
      addedCount += typeof baseValue === 'object' ? countLeaves(baseValue) : 1;
    } else if (typeof baseValue === 'object' && typeof targetValue === 'object') {
      const result = mergeMissing(baseValue, targetValue);
      merged[key] = result.merged;
      addedCount += result.addedCount;
    }
  }

  return { merged, addedCount };
}

function countLeaves(tree: LocaleTree): number {
  return Object.values(tree).reduce<number>(
    (sum, value) => sum + (typeof value === 'object' ? countLeaves(value) : 1),
    0,
  );
}

function main() {
  const enPath = join(LOCALES_DIR, 'en.json');
  const en = JSON.parse(readFileSync(enPath, 'utf-8')) as LocaleTree;

  const files = readdirSync(LOCALES_DIR).filter(
    (name) => name.endsWith('.json') && name !== 'en.json',
  );

  for (const file of files) {
    const filePath = join(LOCALES_DIR, file);
    const existing = JSON.parse(readFileSync(filePath, 'utf-8')) as LocaleTree;
    const { merged, addedCount } = mergeMissing(en, existing);

    if (addedCount > 0) {
      writeFileSync(filePath, `${JSON.stringify(merged, null, 2)}\n`);
      // eslint-disable-next-line no-console -- CLI script output, not app runtime code.
      console.log(`${file}: added ${addedCount} missing key(s)`);
    }
  }
}

main();

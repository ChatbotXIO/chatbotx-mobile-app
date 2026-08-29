import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `pnpm brand:new <id>` — scaffolds `brands/<id>/` from `brands/_template/`, so a new white-label
 * brand starts from the placeholder brand.json + stock assets instead of an empty folder. See
 * docs/white-label.md for the full brand-onboarding flow.
 */
const repoRoot = join(__dirname, '..');
const brandId = process.argv[2];

if (!brandId) {
  console.error('Usage: pnpm brand:new <brand-id>');
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(brandId)) {
  console.error(`Invalid brand id "${brandId}": use lowercase letters, numbers, and hyphens only.`);
  process.exit(1);
}

const templateDir = join(repoRoot, 'brands', '_template');
const targetDir = join(repoRoot, 'brands', brandId);

if (existsSync(targetDir)) {
  console.error(`brands/${brandId} already exists.`);
  process.exit(1);
}

try {
  cpSync(templateDir, targetDir, { recursive: true });

  const brandJsonPath = join(targetDir, 'brand.json');
  const { '//': _templateNote, ...brandJson } = JSON.parse(
    readFileSync(brandJsonPath, 'utf8'),
  ) as Record<string, unknown>;
  writeFileSync(brandJsonPath, `${JSON.stringify({ ...brandJson, id: brandId }, null, 2)}\n`);
} catch (error) {
  // Don't leave a half-scaffolded folder behind — it would trip the "already exists" guard on retry.
  rmSync(targetDir, { recursive: true, force: true });
  throw error;
}

console.log(`Created brands/${brandId} from brands/_template.`);
console.log(
  `Next: edit brands/${brandId}/brand.json, replace brands/${brandId}/assets/*, then run`,
);
console.log(`  BRAND=${brandId} eas init`);
console.log('to create the EAS project and fill in eas.projectId. See docs/white-label.md.');

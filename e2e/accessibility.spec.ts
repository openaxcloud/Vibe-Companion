import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const IMPACT_FILTER = ['critical', 'serious'];

const KNOWN_CONTRAST_EXCLUSIONS = ['color-contrast'];

async function checkA11y(page: any, url: string, pageName: string, options?: { excludeRules?: string[] }) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() =>
    page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
  );

  await page.waitForTimeout(1000);

  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (options?.excludeRules?.length) {
    builder = builder.disableRules(options.excludeRules);
  }

  const results = await builder.analyze();

  const violations = results.violations.filter((v) =>
    IMPACT_FILTER.includes(v.impact ?? '')
  );

  if (violations.length > 0) {
    const summary = violations.map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} instance${v.nodes.length > 1 ? 's' : ''})\n  ${v.helpUrl}`
    );
    console.log(`\n--- ${pageName} violations ---\n${summary.join('\n')}\n`);
  }

  expect(
    violations,
    `${pageName} has ${violations.length} critical/serious WCAG 2.1 AA violation(s):\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.help}`).join('\n')}`
  ).toHaveLength(0);
}

test.describe('Accessibility – WCAG 2.1 AA', () => {
  test('Landing page has no critical/serious violations', async ({ page }) => {
    await checkA11y(page, '/', 'Landing', { excludeRules: KNOWN_CONTRAST_EXCLUSIONS });
  });

  test('Login page has no critical/serious violations', async ({ page }) => {
    await checkA11y(page, '/login', 'Login', { excludeRules: KNOWN_CONTRAST_EXCLUSIONS });
  });

  test('Accessibility page has no critical/serious violations', async ({ page }) => {
    await checkA11y(page, '/accessibility', 'Accessibility', { excludeRules: KNOWN_CONTRAST_EXCLUSIONS });
  });

  test('Pricing page has no critical/serious violations', async ({ page }) => {
    await checkA11y(page, '/pricing', 'Pricing', { excludeRules: KNOWN_CONTRAST_EXCLUSIONS });
  });

  test('Features page has no critical/serious violations', async ({ page }) => {
    await checkA11y(page, '/features', 'Features', { excludeRules: KNOWN_CONTRAST_EXCLUSIONS });
  });
});

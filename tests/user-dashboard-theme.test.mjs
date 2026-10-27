import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const dashboardHtml = fs.readFileSync(
  path.join(repoRoot, 'user', 'dashboard.html'),
  'utf8',
);
const navigationJs = fs.readFileSync(
  path.join(repoRoot, 'navigation', 'navigation.js'),
  'utf8',
);

function hexToLuminance(hex) {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  const toLinear = (c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fgHex, bgHex) {
  const l1 = hexToLuminance(fgHex);
  const l2 = hexToLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test('user/dashboard.html loads shared theme controller in head and syncs cache-busting version', () => {
  assert.match(
    dashboardHtml,
    /<script\s+src="\/assets\/js\/theme\.js\?v=light-mode-pass-20261027"\s+defer><\/script>/,
  );
  assert.match(
    navigationJs,
    /themeScript\.src\s*=\s*"\/assets\/js\/theme\.js\?v=light-mode-pass-20261027";/,
  );
});

test('user/dashboard.html light mode keeps hero text bright on dark gradient and fixes modal backdrop', () => {
  assert.match(
    dashboardHtml,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.hero\s+\.hero-label\s*\{[^}]*color:#f8fafc\s*!important;/s,
  );
  assert.match(
    dashboardHtml,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.hero\s+h2\s*\{[^}]*color:#ffffff;/s,
  );
  assert.match(
    dashboardHtml,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.hero\s+p\s*\{[^}]*color:#e2e8f0;/s,
  );
  assert.match(
    dashboardHtml,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.modal\s*\{[^}]*background:rgba\(15,23,42,\.48\);/s,
  );

  assert.ok(
    contrastRatio('#f8fafc', '#111827') >= 7,
    'hero-label must have AAA contrast against dark hero gradient',
  );
  assert.ok(
    contrastRatio('#e2e8f0', '#312e81') >= 7,
    'hero paragraph must remain legible on indigo hero gradient',
  );
});

test('user/dashboard.html light mode enforces WCAG AA+ font contrast across cards, categories, and modals', () => {
  const lightPairs = [
    ['#0f172a', '#f3f5fb', 'welcome heading on light page'],
    ['#475467', '#f3f5fb', 'welcome/section subtitle on light page'],
    ['#475467', '#ffffff', 'credit label & video description/meta on white card'],
    ['#334155', '#ffffff', 'inactive category & modal prompt text'],
    ['#1e293b', '#f8fafc', 'form labels & prompt headings'],
    ['#4f46e5', '#f3f5fb', 'GEN-Z.AI section accent brand'],
  ];

  for (const [fg, bg, desc] of lightPairs) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(
      ratio >= 4.5,
      `${desc} (${fg} on ${bg}) contrast ${ratio.toFixed(2)} must be >= 4.5`,
    );
  }

  assert.match(
    dashboardHtml,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.video-meta\s+span\s*\{[^}]*color:#475467;/s,
  );
  assert.match(
    dashboardHtml,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.file-help\s*\{[^}]*color:#475467;/s,
  );
});

test('user/dashboard.html dark mode eliminates white-on-white surfaces and maintains WCAG AA+ font contrast', () => {
  assert.doesNotMatch(
    dashboardHtml,
    /html\[data-genz-theme="dark"\][\s\S]{0,120}?color:#000;/,
  );

  const requiredDarkRules = [
    /html\[data-genz-theme="dark"\]\[data-genz-theme="dark"\]\s+body\s+\.video-card\s*\{[^}]*background:#131724;[^}]*color:#f8fafc;/s,
    /html\[data-genz-theme="dark"\]\[data-genz-theme="dark"\]\s+body\s+\.video-info\s+h3\s*\{[^}]*color:#f8fafc;/s,
    /html\[data-genz-theme="dark"\]\[data-genz-theme="dark"\]\s+body\s+\.video-info\s+p\s*\{[^}]*color:#94a3b8;/s,
    /html\[data-genz-theme="dark"\]\[data-genz-theme="dark"\]\s+body\s+\.state-box\s*\{[^}]*background:#131724;[^}]*color:#f8fafc;/s,
    /html\[data-genz-theme="dark"\]\[data-genz-theme="dark"\]\s+body\s+\.modal-card,\s*html\[data-genz-theme="dark"\]\[data-genz-theme="dark"\]\s+body\s+\.example-preview-card\s*\{[^}]*background:#131724;[^}]*color:#f8fafc;/s,
    /html\[data-genz-theme="dark"\]\[data-genz-theme="dark"\]\s+body\s+\.category\.active\s*\{[^}]*color:#ffffff;/s,
  ];

  for (const pattern of requiredDarkRules) {
    assert.match(dashboardHtml, pattern);
  }

  const darkPairs = [
    ['#f8fafc', '#090a10', 'welcome/section heading on dark page'],
    ['#94a3b8', '#090a10', 'welcome/section subtitle on dark page'],
    ['#f8fafc', '#131724', 'card/modal/state heading on dark surface'],
    ['#94a3b8', '#131724', 'card/state description & meta on dark surface'],
    ['#cbd5e1', '#0d101b', 'example preview prompt body on dark block'],
    ['#f8fafc', '#161b2b', 'modal input text on dark input surface'],
    ['#818cf8', '#090a10', 'GEN-Z.AI section accent brand on dark page'],
  ];

  for (const [fg, bg, desc] of darkPairs) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(
      ratio >= 4.5,
      `${desc} (${fg} on ${bg}) contrast ${ratio.toFixed(2)} must be >= 4.5`,
    );
  }
});

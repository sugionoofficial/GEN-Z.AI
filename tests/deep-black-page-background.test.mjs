import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function walkFiles(dir, extensions, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, extensions, results);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

test('assets/js/theme.js enforces deep pitch-black (#000000) page background in dark/default mode', () => {
  const themeJs = fs.readFileSync(
    path.join(repoRoot, 'assets', 'js', 'theme.js'),
    'utf8',
  );

  assert.match(
    themeJs,
    /const\s+STORAGE_KEY\s*=\s*"genz-theme-v2";/,
    'expected v2 theme storage key so stale light-mode preferences reset to deep black default',
  );
  assert.match(
    themeJs,
    /localStorage\.removeItem\(LEGACY_STORAGE_KEY\);/,
    'expected legacy genz-theme storage key cleanup',
  );
  assert.match(
    themeJs,
    /html\s*\{[^}]*background:\s*#000000;[^}]*--theme-page:\s*#000000;/s,
  );
  assert.match(
    themeJs,
    /html\[data-genz-theme="dark"\]\s*\{\s*background:\s*#000000\s*!important;\s*\}/s,
  );
  assert.match(
    themeJs,
    /html\[data-genz-theme="dark"\]\s+body\s*\{[^}]*background:\s*#000000\s*!important;[^}]*background-image:\s*none\s*!important;/s,
  );
  assert.match(
    themeJs,
    /html\[data-genz-theme="dark"\]\s+body::before,\s*html\[data-genz-theme="dark"\]\s+body::after\s*\{[^}]*background:\s*none\s*!important;[^}]*opacity:\s*0\s*!important;/s,
  );
});

test('manifest.webmanifest and HTML theme-color meta tags use #000000', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'manifest.webmanifest'), 'utf8'),
  );
  assert.equal(manifest.background_color, '#000000');
  assert.equal(manifest.theme_color, '#000000');

  const htmlFiles = walkFiles(repoRoot, ['.html']);
  assert.ok(htmlFiles.length >= 43, 'expected all repository HTML pages');

  for (const fullPath of htmlFiles) {
    const rel = path.relative(repoRoot, fullPath);
    const html = fs.readFileSync(fullPath, 'utf8');
    const metaMatches = [
      ...html.matchAll(
        /<meta\b[^>]*\bname="theme-color"[^>]*\bcontent="([^"]+)"/gi,
      ),
      ...html.matchAll(
        /<meta\b[^>]*\bcontent="([^"]+)"[^>]*\bname="theme-color"/gi,
      ),
    ];
    for (const match of metaMatches) {
      assert.equal(
        match[1].toLowerCase(),
        '#000000',
        `${rel} meta theme-color must be #000000`,
      );
    }
  }
});

test('all HTML pages and active CSS stylesheets use #000000 for default/dark page backgrounds without gray or tinted gradients', () => {
  const files = walkFiles(repoRoot, ['.html', '.css']).filter(
    (fullPath) =>
      path.relative(repoRoot, fullPath) !==
      path.join('assets', 'css', 'admin-premium.css'),
  );

  for (const fullPath of files) {
    const rel = path.relative(repoRoot, fullPath);
    const source = fs.readFileSync(fullPath, 'utf8');
    const blocks = source.match(/[^{}]+\{[^{}]*\}/g) || [];

    for (const block of blocks) {
      const braceIdx = block.indexOf('{');
      const selector = block
        .slice(0, braceIdx)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim()
        .replace(/\s+/g, ' ');
      const declarations = block
        .slice(braceIdx + 1, -1)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (/data-genz-theme="light"/.test(selector)) continue;
      if (!/background/i.test(declarations)) continue;

      const isPageRootSelector =
        /^(html|body|html,\s*body|body,\s*html|body::before|body::after|\.vision-video-page|\.vision-video-page::before|\.metadata-cleaner-page)$/i.test(
          selector,
        ) ||
        /^html\[data-genz-theme="dark"\]\s*(body|body::before|body::after)?$/i.test(
          selector,
        );

      if (!isPageRootSelector) continue;

      const varMatch = declarations.match(
        /background:\s*var\((--[a-z0-9-]+)\)/i,
      );
      if (varMatch) {
        const varName = varMatch[1];
        const rootDef = source.match(
          new RegExp(`${varName}\\s*:\\s*([^;\\n}]+)`),
        );
        assert.ok(
          rootDef && /^#(000000|000)$/i.test(rootDef[1].trim()),
          `${rel} (${selector}) variable ${varName} must resolve to #000000, got ${rootDef?.[1]?.trim()}`,
        );
        continue;
      }

      assert.match(
        declarations,
        /background:\s*(#000000|#000|none)(\s*!important)?\s*(;|$)/i,
        `${rel} (${selector}) must use pure black or none background, got: ${declarations}`,
      );
    }
  }
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const navigationJs = fs.readFileSync(
  path.join(repoRoot, 'navigation', 'navigation.js'),
  'utf8',
);
const themeJs = fs.readFileSync(
  path.join(repoRoot, 'assets', 'js', 'theme.js'),
  'utf8',
);

test('navigation.js preserves existing brand logo, icons, and navigation labels unchanged', () => {
  assert.match(
    navigationJs,
    /<a class="genz-logo" href="\/" title="gen-z\.ai" aria-label="gen-z\.ai — beranda">/,
  );
  assert.match(
    navigationJs,
    /src="\/assets\/brand\/gen-z-ai-mark-tile\.svg\?v=2"/,
  );
  assert.match(
    navigationJs,
    /<span class="genz-logo-text">gen-z<span class="genz-logo-ai">\.ai<\/span><\/span>/,
  );
  assert.match(
    navigationJs,
    /<span class="genz-nav-icon">\$\{item\.icon \|\| ""\}<\/span>\s*<span class="genz-nav-label">\$\{escapeHTML\(item\.label\)\}<\/span>/,
  );

  for (const label of [
    'Dashboard',
    'Generate',
    'Prompt Studio',
    'Vision Image',
    'Vision Video',
    'History',
    'Top Up',
  ]) {
    assert.ok(
      navigationJs.includes(`label: "${label}"`),
      `expected navigation label "${label}" to remain intact`,
    );
  }
});

test('navigation.js applies electric blue perimeter glow only on block hover/focus-visible', () => {
  assert.match(
    navigationJs,
    /\.genz-nav-item\s*\{[^}]*position:\s*relative;[^}]*border-radius:\s*10px;[^}]*overflow:\s*hidden;/s,
  );

  // ::before uses oversized centered square conic-gradient so the blue light wraps the full 228px+ width
  assert.match(
    navigationJs,
    /\.genz-nav-item::before\s*\{[^}]*width:\s*520px;[^}]*height:\s*520px;[^}]*conic-gradient\([^)]*#00eaff\s+330deg,\s*#ffffff\s+345deg,\s*#00eaff\s+355deg[^)]*\)[^}]*animation:\s*genz-nav-electric\s+2s\s+linear\s+infinite;[^}]*animation-play-state:\s*paused;[^}]*opacity:\s*0;/s,
  );

  // ::after masks the inner area (inset: 2px) and stays hidden until hover/focus
  assert.match(
    navigationJs,
    /\.genz-nav-item::after\s*\{[^}]*inset:\s*2px;[^}]*background:\s*#10151f;[^}]*border-radius:\s*8px;[^}]*opacity:\s*0;/s,
  );

  // Hover & focus-visible trigger the blue glow and start the rotating beam
  assert.match(
    navigationJs,
    /\.genz-nav-item:hover,\s*\.genz-nav-item:focus-visible\s*\{[^}]*color:\s*#ffffff;[^}]*transform:\s*translateY\(-2px\);[^}]*box-shadow:\s*0\s+0\s+10px\s+#00eaff,\s*0\s+0\s+25px\s+rgba\(0,\s*234,\s*255,\s*\.45\);/s,
  );
  assert.match(
    navigationJs,
    /\.genz-nav-item:hover::before,\s*\.genz-nav-item:focus-visible::before\s*\{[^}]*opacity:\s*1;[^}]*animation-play-state:\s*running;/s,
  );
  assert.match(
    navigationJs,
    /\.genz-nav-item:hover::after,\s*\.genz-nav-item:focus-visible::after\s*\{[^}]*opacity:\s*1;/s,
  );

  // Active item does NOT force ::before opacity: 1 when not hovered
  assert.doesNotMatch(
    navigationJs,
    /\.genz-nav-item\.active::before\s*\{[^}]*opacity:\s*1;/s,
  );

  // Icon and label sit above pseudo-elements
  assert.match(
    navigationJs,
    /\.genz-nav-icon\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*2;/s,
  );
  assert.match(
    navigationJs,
    /\.genz-nav-label\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*2;/s,
  );
});

test('electric navigation hover supports light mode cleanly across navigation.js and theme.js', () => {
  assert.match(
    navigationJs,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.genz-nav-item::after\s*\{[^}]*background:\s*#f0f8ff;/s,
  );
  assert.match(
    navigationJs,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.genz-nav-item:hover,[\s\S]*?color:\s*#0f172a;[\s\S]*?box-shadow:\s*0\s+0\s+10px\s+rgba\(0,\s*212,\s*255,\s*\.75\)/,
  );
  assert.match(
    themeJs,
    /html\[data-genz-theme="light"\]\s+body\s+\.genz-nav-item:hover,[\s\S]*?box-shadow:\s*0\s+0\s+10px\s+rgba\(0,\s*212,\s*255,\s*\.75\)/,
  );
});

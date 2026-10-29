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

test('navigation.js preserves existing brand logo, icons, and navigation labels unchanged without triggering browser URL status preview', () => {
  assert.match(
    navigationJs,
    /<a class="genz-logo" role="link" tabindex="0" data-genz-href="\/" aria-label="GEN-Z\.AI — beranda">/,
  );
  assert.match(
    navigationJs,
    /<img\s+class="genz-logo-img"\s+src="\/assets\/brand\/genz-ai-logo\.png\?v=genzai-logo-\d+"\s+alt="GEN-Z\.AI"/,
  );
  assert.doesNotMatch(navigationJs, /genz-logo-mark-img|genz-logo-text|genz-logo-ai/);
  assert.match(
    navigationJs,
    /<a class="genz-nav-item\$\{active \? " active" : ""\}" role="link" tabindex="0" data-genz-href="\$\{escapeHTML\(item\.href\)\}" data-genz-nav-link="true"/,
  );
  assert.match(
    navigationJs,
    /class="genz-account-box"\s+role="link"\s+tabindex="0"\s+data-genz-href="\/user\/profile\.html"/,
  );

  // Ensure sidebar markup contains no href= attribute that causes browser bottom-left URL preview
  const renderBlock = navigationJs.slice(
    navigationJs.indexOf('function renderNavigation()'),
    navigationJs.indexOf('function bindNavigationEvents()'),
  );
  assert.doesNotMatch(renderBlock, /\shref=/);

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

test('sidebar footer blocks (theme toggle, account box, logout button) spin bright neon red on hover in dark and light modes', () => {
  // All footer blocks create isolated stacking contexts so direct text nodes stay above ::before/::after
  for (const selector of [
    '\\.genz-sidebar-footer\\s+\\.genz-theme-toggle',
    '\\.genz-account-box',
    '\\.genz-logout-button',
  ]) {
    assert.match(
      navigationJs,
      new RegExp(`${selector}[\\s\\S]{0,220}?overflow:\\s*hidden;[\\s\\S]{0,80}?isolation:\\s*isolate;`),
      `expected ${selector} to have overflow: hidden and isolation: isolate`,
    );
  }

  // Shared rotating bright neon red conic-gradient on ::before (z-index: -2) and inner mask ::after (z-index: -1)
  assert.match(
    navigationJs,
    /\.genz-sidebar-footer\s+\.genz-theme-toggle::before,\s*\.genz-sidebar-footer\s+\.genz-refresh-button::before,\s*\.genz-account-box::before,\s*\.genz-logout-button::before\s*\{[^}]*width:\s*520px;[^}]*height:\s*520px;[^}]*conic-gradient\([^)]*#ff1a35\s+325deg,\s*#ff5263\s+338deg,\s*#ffffff\s+347deg,\s*#ff1a35\s+356deg[^)]*\)[^}]*animation:\s*genz-nav-electric\s+2s\s+linear\s+infinite;[^}]*animation-play-state:\s*paused;[^}]*opacity:\s*0;[^}]*z-index:\s*-2;/s,
  );

  assert.match(
    navigationJs,
    /\.genz-sidebar-footer\s+\.genz-theme-toggle::after,\s*\.genz-sidebar-footer\s+\.genz-refresh-button::after,\s*\.genz-account-box::after,\s*\.genz-logout-button::after\s*\{[^}]*inset:\s*2px;[^}]*background:\s*#140d12;[^}]*border-radius:\s*8px;[^}]*opacity:\s*0;[^}]*z-index:\s*-1;/s,
  );

  // Dark mode hover activates bright neon red outer glow and starts rotation
  assert.match(
    navigationJs,
    /\.genz-logout-button:focus-visible\s*\{[^}]*transform:\s*translateY\(-2px\);[^}]*box-shadow:\s*0\s+0\s+12px\s+#ff1e38,\s*0\s+0\s+26px\s+rgba\(255,\s*30,\s*56,\s*\.55\);/s,
  );
  assert.match(
    navigationJs,
    /\.genz-logout-button:focus-visible::before\s*\{[^}]*opacity:\s*1;[^}]*animation-play-state:\s*running;/s,
  );

  // Light mode hover keeps crisp bright neon red beam & readable text
  assert.match(
    navigationJs,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.genz-logout-button::before\s*\{[^}]*#ff1744\s+322deg/s,
  );
  assert.match(
    navigationJs,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.genz-logout-button::after\s*\{[^}]*background:\s*#fff5f6;/s,
  );
  assert.match(
    navigationJs,
    /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.genz-logout-button:focus-visible\s*\{[^}]*box-shadow:\s*0\s+0\s+11px\s+rgba\(255,\s*23,\s*68,\s*\.82\)/s,
  );
});

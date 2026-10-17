import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = new URL('../api/openkey-chat.js', import.meta.url);
const providerChatUrl = new URL('../provider/openkey/chat.js', import.meta.url).href;
const providerStreamUrl = new URL('../provider/openkey/stream.js', import.meta.url).href;
const providerModelsUrl = new URL('../provider/openkey/models.js', import.meta.url).href;
const webPageContextUrl = new URL('../lib/web-page-context.js', import.meta.url).href;
const mediaAnalysisGuidanceUrl = new URL('../live-chat/media-analysis-guidance.js', import.meta.url).href;

const source = await fs.readFile(moduleUrl, 'utf8');
const rewrittenSource = source
  .replace(/from\s+"\.\.\/provider\/openkey\/chat\.js"/g, `from "${providerChatUrl}"`)
  .replace(/from\s+"\.\.\/provider\/openkey\/stream\.js"/g, `from "${providerStreamUrl}"`)
  .replace(/from\s+"\.\.\/provider\/openkey\/models\.js"/g, `from "${providerModelsUrl}"`)
  .replace(/from\s+"\.\.\/lib\/web-page-context\.js"/g, `from "${webPageContextUrl}"`)
  .replace(/from\s+"\.\.\/live-chat\/media-analysis-guidance\.js"/g, `from "${mediaAnalysisGuidanceUrl}"`);

const module = await import(`data:text/javascript,${encodeURIComponent(rewrittenSource)}`);

test('returns OPENKEY_API_KEY when configured', () => {
  const previous = process.env.OPENKEY_API_KEY;
  process.env.OPENKEY_API_KEY = 'env-openkey-key';

  try {
    assert.equal(module.getOpenKeyApiKeyFromEnvironment(), 'env-openkey-key');
  } finally {
    if (previous === undefined) {
      delete process.env.OPENKEY_API_KEY;
    } else {
      process.env.OPENKEY_API_KEY = previous;
    }
  }
});

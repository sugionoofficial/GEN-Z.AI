import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/* =========================================================
   TEMPMAIL — ARTEFAK DEPLOY PERSISTEN
   ---------------------------------------------------------
   Menjaga agar jalur @gmail.com tanpa Codespace tetap terdokumentasi
   dan tidak ada kredensial / hasil clone yang masuk Git.
========================================================= */

const ROOT = process.cwd();
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");

test("artefak deploy Tempmail-MCP lengkap dan aman", () => {
    const files = [
        "deploy/tempmail-mcp/README.md",
        "deploy/tempmail-mcp/docker-compose.yml",
        "deploy/tempmail-mcp/Caddyfile",
        "deploy/tempmail-mcp/.env.example",
        "deploy/tempmail-mcp/setup.sh",
        "deploy/tempmail-mcp/setup.ps1"
    ];
    for (const file of files) {
        assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} harus ada`);
    }

    const compose = read("deploy/tempmail-mcp/docker-compose.yml");
    assert.match(compose, /tempmail-api:/);
    assert.match(compose, /flaresolverr:/);
    assert.match(compose, /caddy:/);
    assert.match(compose, /build: \.\/Tempmail-MCP/);
    assert.match(compose, /"80:80"/);
    assert.match(compose, /"443:443"/);
    assert.doesNotMatch(compose, /"8000:8000"/);

    const caddy = read("deploy/tempmail-mcp/Caddyfile");
    assert.match(caddy, /\{\$TEMPMAIL_DOMAIN\}/);
    assert.match(caddy, /reverse_proxy tempmail-api:8000/);

    const example = read("deploy/tempmail-mcp/.env.example");
    assert.match(example, /TEMPMAIL_DOMAIN=/);
    assert.match(example, /GMAIL_APP_PASSWORD=/);
    assert.match(example, /Rotasi kredensial lama/);
    assert.doesNotMatch(example, /sb_publishable_|service-role-key/);

    const setup = read("deploy/tempmail-mcp/setup.sh");
    assert.match(setup, /#!\/usr\/bin\/env bash/);
    assert.match(setup, /git clone https:\/\/github\.com\/sugionoofficial\/Tempmail-MCP\.git/);
    assert.match(setup, /docker compose up -d --build/);
    assert.match(setup, /chmod 600 \.env/);
    assert.match(setup, /wrangler@4 secret put TEMPMAIL_API_URL/);
    assert.match(setup, /jangan tambahkan \/api di akhir/);

    const powershell = read("deploy/tempmail-mcp/setup.ps1");
    assert.match(powershell, /ASCII-only/);
    assert.ok(!/[^\x00-\x7F]/.test(powershell), "setup.ps1 harus ASCII-only untuk PowerShell 5.1");
    assert.doesNotMatch(powershell, /&/, "ampersand merusak parser PowerShell 5.1");
    assert.match(powershell, /ExecutionPolicy Bypass/);
    assert.match(powershell, /Read-Host "GMAIL_APP_PASSWORD/);
    assert.match(powershell, /docker compose up -d --build/);
    assert.match(powershell, /wrangler@4 secret put TEMPMAIL_API_URL/);
    assert.match(powershell, /curl\.exe -i/);

    const readme = read("deploy/tempmail-mcp/README.md");
    assert.match(readme, /setup\.ps1/);
    assert.match(readme, /curl\.exe/);
    assert.match(readme, /arena\/23682d30-gen-z-ai/);
    assert.match(readme, /Cloudflare Tunnel/);
    assert.match(readme, /Full \(strict\)/);
    assert.match(readme, /app\.github\.dev/);
});

test(".env dan clone upstream deploy tidak boleh masuk Git", () => {
    const ignore = read(".gitignore");
    assert.match(ignore, /deploy\/tempmail-mcp\/\.env/);
    assert.match(ignore, /deploy\/tempmail-mcp\/Tempmail-MCP\//);

    const setup = read("TEMPMAIL-SETUP.md");
    assert.match(setup, /deploy\/tempmail-mcp\/README\.md/);
    assert.match(setup, /Mode B/);
    assert.match(setup, /@gmail\.com/);

    const docs = read("docs/tempmail-setup.md");
    assert.match(docs, /deploy\/tempmail-mcp\/README\.md/);
});

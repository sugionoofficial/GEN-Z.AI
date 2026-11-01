import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const TOKEN_FILE = "tiktokRA1pfqteEbk7mpBgD70IGSxDBNEdACO7.txt";
const EXPECTED_CONTENT = "tiktok-developers-site-verification=RA1pfqteEbk7mpBgD70IGSxDBNEdACO7";

test("TikTok site verification token is copied to the website root during build", () => {
    const sourcePath = path.join(ROOT, TOKEN_FILE);
    assert.equal(fs.readFileSync(sourcePath, "utf8").trim(), EXPECTED_CONTENT);

    const buildScript = fs.readFileSync(path.join(ROOT, "scripts", "build-cloudflare-pages.mjs"), "utf8");
    assert.match(buildScript, new RegExp(`\\"${TOKEN_FILE}\\"`));
});

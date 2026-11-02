import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const VERIFICATION_FILES = [
    {
        name: "tiktokRA1pfqteEbk7mpBgD70IGSxDBNEdACO7.txt",
        content: "tiktok-developers-site-verification=RA1pfqteEbk7mpBgD70IGSxDBNEdACO7"
    },
    {
        name: "tiktokJAuujNzqwU5nBwfySSqkGfiWIECyRyqS.txt",
        content: "tiktok-developers-site-verification=JAuujNzqwU5nBwfySSqkGfiWIECyRyqS"
    }
];

test("TikTok site verification files are copied to the website root during build", () => {
    const buildScript = fs.readFileSync(path.join(ROOT, "scripts", "build-cloudflare-pages.mjs"), "utf8");

    for (const file of VERIFICATION_FILES) {
        const sourcePath = path.join(ROOT, file.name);
        assert.equal(fs.readFileSync(sourcePath, "utf8").trim(), file.content);
        assert.match(buildScript, new RegExp(`\\"${file.name}\\"`));
    }
});

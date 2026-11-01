import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function extractFunctionSource(source, signature) {
    const start = source.indexOf(signature);
    assert.notEqual(start, -1, `Expected to find ${signature}`);
    const openBrace = source.indexOf("{", start);
    assert.notEqual(openBrace, -1, `Expected opening brace for ${signature}`);

    let depth = 0;
    for (let index = openBrace; index < source.length; index += 1) {
        const ch = source[index];
        if (ch === "{") depth += 1;
        else if (ch === "}") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(start, index + 1);
            }
        }
    }

    assert.fail(`Unclosed function body for ${signature}`);
}

test("Live Chat AI appears in navigation/navigation.js for all roles (user, admin, owner)", () => {
    const navigationSource = readRepoFile("navigation/navigation.js");
    const getNavConfigSrc = extractFunctionSource(
        navigationSource,
        "function getNavigationConfig(role)"
    );

    const context = vm.createContext({ Object });
    vm.runInContext(`${getNavConfigSrc}\nthis.getNavigationConfig = getNavigationConfig;`, context);

    for (const role of ["user", "admin", "owner"]) {
        const items = context.getNavigationConfig(role);
        const liveChatItem = items.find((item) => item.label === "Live Chat AI");
        assert.ok(liveChatItem, `Expected Live Chat AI menu item for role="${role}"`);
        assert.equal(liveChatItem.href, "/live-chat/index.html");
        assert.match(liveChatItem.icon, /^<svg\b[\s\S]*<\/svg>$/);

        const promptStudioIndex = items.findIndex((item) => item.label === "Prompt Studio");
        const liveChatIndex = items.findIndex((item) => item.label === "Live Chat AI");
        assert.equal(
            liveChatIndex,
            promptStudioIndex + 1,
            `Expected Live Chat AI right after Prompt Studio for role="${role}"`
        );
    }
});

test("isActiveLink highlights Live Chat AI on both /live-chat/ and /live-chat/index.html without false positives", () => {
    const navigationSource = readRepoFile("navigation/navigation.js");
    const normalizeSrc = extractFunctionSource(
        navigationSource,
        "function normalizeNavPath(pathname)"
    );
    const isActiveSrc = extractFunctionSource(
        navigationSource,
        "function isActiveLink(href)"
    );

    let activePathname = "/live-chat/";
    const context = vm.createContext({
        URL,
        String,
        window: {
            location: {
                origin: "https://gen-z.ai"
            }
        },
        getCurrentPath: () => activePathname
    });

    vm.runInContext(
        `${normalizeSrc}\n${isActiveSrc}\nthis.isActiveLink = isActiveLink;`,
        context
    );

    activePathname = "/live-chat/";
    assert.equal(context.isActiveLink("/live-chat/index.html"), true);
    assert.equal(context.isActiveLink("/prompt-studio/index.html"), false);

    activePathname = "/live-chat/index.html";
    assert.equal(context.isActiveLink("/live-chat/index.html"), true);

    activePathname = "/vision-video/index.html";
    assert.equal(context.isActiveLink("/vision/index.html"), false);
    assert.equal(context.isActiveLink("/vision-video/index.html"), true);
});

test("Prompt Studio no longer embeds the Live Chat AI button in preview-footer", () => {
    const promptStudioHtml = readRepoFile("prompt-studio/index.html");

    assert.doesNotMatch(promptStudioHtml, /href=["']\/live-chat\/(?:index\.html)?["']/i);
    assert.doesNotMatch(promptStudioHtml, /Chat dengan AI/);
    assert.match(promptStudioHtml, /id="copyBtn"/);
    assert.match(promptStudioHtml, /id="enhanceBtn"/);
});

test("Live Chat AI page loads shared navigation and reserves top space for mobile menu toggle", () => {
    const liveChatHtml = readRepoFile("live-chat/index.html");

    assert.match(liveChatHtml, /<script\s+src="\/navigation\/navigation\.js\?v=/);
    assert.match(liveChatHtml, /@media\s*\(max-width:\s*768px\)\s*\{\s*\.chat-shell\s*\{\s*padding-top:\s*66px;/);
});

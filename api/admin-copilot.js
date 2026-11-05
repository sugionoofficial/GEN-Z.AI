import { getSupabaseConfig } from "../lib/admin-models/config.js";
import { verifyAdmin } from "../lib/admin-models/auth.js";

const REPOSITORY_OWNER = "sugionoofficial";
const REPOSITORY_NAME = "GEN-Z.AI";
const BASE_BRANCH = "main";
const MAX_FILE_BYTES = 500_000;
const MAX_FILE_PATH_LENGTH = 1024;
const ALLOWED_MERGE_CONCLUSIONS = new Set([
    "success",
    "neutral",
    "skipped"
]);

function json(res, status, body) {
    res.status(status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.end(JSON.stringify(body));
}

function getGithubToken(req) {
    return String(
        req?.env?.GITHUB_PAT ||
        process.env.GITHUB_PAT ||
        ""
    ).trim();
}

function validatePath(value) {
    const path = String(value || "").trim().replace(/^\/+|\/+$/g, "");

    if (
        !path ||
        path.length > MAX_FILE_PATH_LENGTH ||
        path.split("/").some(part =>
            !part ||
            part === "." ||
            part === ".." ||
            part.toLowerCase() === ".git"
        )
    ) {
        throw Object.assign(new Error("Path repo tidak valid."), {
            status: 400
        });
    }

    return path;
}

function encodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
}

function validateCopilotBranch(value) {
    const branch = String(value || "").trim();
    const segments = branch.split("/");

    if (
        !branch ||
        branch.length > 200 ||
        !branch.startsWith("copilot/") ||
        !/^copilot\/[a-zA-Z0-9._/-]+$/.test(branch) ||
        segments.some(part => !part || part === "." || part === "..")
    ) {
        throw Object.assign(new Error("Branch Copilot tidak valid."), {
            status: 400
        });
    }

    return branch;
}

async function githubRequest(token, path, options = {}) {
    const response = await fetch(
        `https://api.github.com/repos/${REPOSITORY_OWNER}/${encodeURIComponent(REPOSITORY_NAME)}${path}`,
        {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
                "User-Agent": "GENZ-AI-Admin-Copilot",
                ...(options.headers || {})
            }
        }
    );

    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }

    if (!response.ok) {
        const error = new Error(
            data?.message || `GitHub API gagal (${response.status}).`
        );
        error.status = response.status;
        throw error;
    }

    return { response, data };
}

function githubErrorStatus(error) {
    if (error?.status === 404) return 404;
    if (error?.status === 409 || error?.status === 422) return 409;
    return error?.status >= 400 && error?.status < 500 ? error.status : 502;
}

function requireGithubToken(req, res) {
    const token = getGithubToken(req);

    if (!token) {
        json(res, 503, {
            success: false,
            error: "GITHUB_PAT belum dikonfigurasi sebagai secret server."
        });
        return null;
    }

    return token;
}

async function handleRead(req, res, token, action) {
    const path = req.query?.path
        ? validatePath(req.query.path)
        : "";
    const ref = `?ref=${encodeURIComponent(BASE_BRANCH)}`;
    const apiPath = `/contents${path ? `/${encodePath(path)}` : ""}${ref}`;
    const { data } = await githubRequest(token, apiPath);

    if (action === "tree") {
        if (!Array.isArray(data)) {
            throw Object.assign(new Error("Path yang diminta bukan folder."), {
                status: 400
            });
        }

        return json(res, 200, {
            success: true,
            path,
            items: data
                .filter(item => item.type === "dir" || item.type === "file")
                .map(item => ({
                    name: item.name,
                    path: item.path,
                    type: item.type,
                    size: item.size,
                    sha: item.sha
                }))
        });
    }

    if (!data || data.type !== "file" || data.encoding !== "base64") {
        throw Object.assign(new Error("File tidak tersedia sebagai teks."), {
            status: 415
        });
    }

    const content = Buffer.from(data.content || "", "base64");
    if (content.byteLength > MAX_FILE_BYTES) {
        throw Object.assign(new Error("File lebih besar dari batas 500 KB untuk editor."), {
            status: 413
        });
    }

    let textContent;
    try {
        if (content.includes(0)) {
            throw new Error("Binary content");
        }
        textContent = new TextDecoder("utf-8", {
            fatal: true
        }).decode(content);
    } catch {
        throw Object.assign(new Error("File biner atau encoding-nya tidak didukung editor."), {
            status: 415
        });
    }

    return json(res, 200, {
        success: true,
        path: data.path,
        sha: data.sha,
        size: content.byteLength,
        content: textContent
    });
}

async function createBranch(token, baseSha, requestedBranch) {
    if (requestedBranch) {
        const branch = validateCopilotBranch(requestedBranch);
        const { data } = await githubRequest(
            token,
            `/git/ref/heads/${encodePath(branch)}`
        );
        return { branch, sha: data.object.sha };
    }

    const suffix = crypto.randomUUID().slice(0, 8);
    const timestamp = new Date().toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
    const branch = `copilot/admin-${timestamp}-${suffix}`;

    await githubRequest(token, "/git/refs", {
        method: "POST",
        body: JSON.stringify({
            ref: `refs/heads/${branch}`,
            sha: baseSha
        })
    });

    return { branch, sha: baseSha };
}

async function handleCommitFile(req, res, token, body) {
    const path = validatePath(body.path);
    const content = typeof body.content === "string" ? body.content : null;
    const message = String(body.message || "").trim().slice(0, 200);

    if (content === null || !message) {
        return json(res, 400, {
            success: false,
            error: "Isi file dan pesan commit wajib diisi."
        });
    }

    const contentBuffer = Buffer.from(content, "utf8");
    if (contentBuffer.byteLength > MAX_FILE_BYTES) {
        return json(res, 413, {
            success: false,
            error: "File lebih besar dari batas 500 KB."
        });
    }

    const baseRef = await githubRequest(
        token,
        `/git/ref/heads/${BASE_BRANCH}`
    );
    const { branch } = await createBranch(
        token,
        baseRef.data.object.sha,
        body.branch
    );

    let existingSha;
    try {
        const existing = await githubRequest(
            token,
            `/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`
        );
        if (existing.data.type !== "file") {
            return json(res, 400, {
                success: false,
                error: "Path yang dipilih bukan file."
            });
        }
        existingSha = existing.data.sha;
    } catch (error) {
        if (error.status !== 404) throw error;
    }

    const { data } = await githubRequest(
        token,
        `/contents/${encodePath(path)}`,
        {
            method: "PUT",
            body: JSON.stringify({
                message,
                content: contentBuffer.toString("base64"),
                branch,
                ...(existingSha ? { sha: existingSha } : {})
            })
        }
    );

    return json(res, 200, {
        success: true,
        branch,
        commit: {
            sha: data.commit?.sha || "",
            url: data.commit?.html_url || ""
        },
        file: path
    });
}

async function handleCreatePullRequest(res, token, body) {
    const head = validateCopilotBranch(body.branch);
    const title = String(body.title || "").trim().slice(0, 250);
    const description = String(body.body || "").trim().slice(0, 5000);

    if (!title) {
        return json(res, 400, {
            success: false,
            error: "Judul pull request wajib diisi."
        });
    }

    const { data } = await githubRequest(token, "/pulls", {
        method: "POST",
        body: JSON.stringify({
            title,
            body: description,
            head,
            base: BASE_BRANCH,
            maintainer_can_modify: false
        })
    });

    return json(res, 201, {
        success: true,
        pullRequest: {
            number: data.number,
            title: data.title,
            url: data.html_url,
            state: data.state,
            branch: data.head?.ref
        }
    });
}

async function handleListPullRequests(res, token) {
    const { data } = await githubRequest(
        token,
        `/pulls?state=open&base=${BASE_BRANCH}&per_page=50`
    );

    return json(res, 200, {
        success: true,
        pullRequests: data
            .filter(pull => pull.head?.ref?.startsWith("copilot/"))
            .map(pull => ({
                number: pull.number,
                title: pull.title,
                url: pull.html_url,
                branch: pull.head.ref,
                mergeable: pull.mergeable,
                mergeableState: pull.mergeable_state
            }))
    });
}

async function loadCheckRuns(token, commitSha) {
    const checkRuns = [];
    let totalCount = null;
    let page = 1;

    while (totalCount === null || checkRuns.length < totalCount) {
        const { data } = await githubRequest(
            token,
            `/commits/${commitSha}/check-runs?per_page=100&page=${page}`
        );
        const pageTotal = Number(data?.total_count);
        const pageRuns = Array.isArray(data?.check_runs)
            ? data.check_runs
            : null;

        if (!Number.isSafeInteger(pageTotal) || !pageRuns) {
            throw Object.assign(new Error("GitHub mengembalikan data pemeriksaan CI yang tidak valid."), {
                status: 502
            });
        }

        if (totalCount !== null && pageTotal !== totalCount) {
            throw Object.assign(new Error("Status CI berubah saat diperiksa. Coba lagi sebelum merge."), {
                status: 409
            });
        }
        totalCount = pageTotal;
        checkRuns.push(...pageRuns);

        if (checkRuns.length >= totalCount) return checkRuns;
        if (!pageRuns.length) break;
        page += 1;
    }

    throw Object.assign(new Error("Tidak semua pemeriksaan CI berhasil dimuat. PR tidak di-merge."), {
        status: 409
    });
}

async function handleMerge(res, token, body) {
    const number = Number(body.pullRequestNumber);
    if (!Number.isSafeInteger(number) || number < 1) {
        return json(res, 400, {
            success: false,
            error: "Nomor pull request tidak valid."
        });
    }

    const { data: pull } = await githubRequest(
        token,
        `/pulls/${number}`
    );

    if (
        pull.state !== "open" ||
        pull.base?.ref !== BASE_BRANCH ||
        !pull.head?.ref?.startsWith("copilot/")
    ) {
        return json(res, 403, {
            success: false,
            error: "Hanya PR Copilot terbuka yang menargetkan main yang dapat di-merge."
        });
    }

    if (pull.mergeable !== true || pull.mergeable_state !== "clean") {
        return json(res, 409, {
            success: false,
            error: "PR belum siap di-merge; pastikan tidak ada konflik dan semua pemeriksaan selesai."
        });
    }

    const headSha = pull.head.sha;
    const [checkRuns, { data: status }] = await Promise.all([
        loadCheckRuns(token, headSha),
        githubRequest(token, `/commits/${headSha}/status`)
    ]);

    if (
        checkRuns.length === 0 ||
        checkRuns.some(check =>
            check.status !== "completed" ||
            !ALLOWED_MERGE_CONCLUSIONS.has(check.conclusion)
        ) ||
        (status?.total_count > 0 &&
            (status.state !== "success" ||
                status.statuses.some(item => item.state !== "success")))
    ) {
        return json(res, 409, {
            success: false,
            error: "CI belum seluruhnya lulus. PR tidak di-merge."
        });
    }

    const { data: result } = await githubRequest(
        token,
        `/pulls/${number}/merge`,
        {
            method: "PUT",
            body: JSON.stringify({
                sha: headSha,
                merge_method: "merge"
            })
        }
    );

    if (!result.merged) {
        return json(res, 409, {
            success: false,
            error: result.message || "GitHub tidak meng-merge PR."
        });
    }

    return json(res, 200, {
        success: true,
        merged: true,
        message: result.message,
        sha: result.sha
    });
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (!["GET", "POST"].includes(req.method)) {
        return json(res, 405, {
            success: false,
            error: "Method tidak didukung."
        });
    }

    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey || !config.serviceRoleKey) {
        return json(res, 500, {
            success: false,
            error: "Konfigurasi Supabase server belum lengkap."
        });
    }

    let admin;
    try {
        admin = await verifyAdmin(req, config);
    } catch (error) {
        console.error("[admin-copilot] Admin verification failed:", error);
        return json(res, 500, {
            success: false,
            error: "Gagal memverifikasi akses admin."
        });
    }

    if (!admin.ok) {
        return json(res, admin.status, {
            success: false,
            error: admin.error
        });
    }

    const token = requireGithubToken(req, res);
    if (!token) return;

    try {
        if (req.method === "GET") {
            const action = String(req.query?.action || "");

            if (action === "tree" || action === "file") {
                return await handleRead(req, res, token, action);
            }

            if (action === "pulls") {
                return await handleListPullRequests(res, token);
            }

            return json(res, 400, {
                success: false,
                error: "Aksi baca repo tidak dikenal."
            });
        }

        const body = req.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return json(res, 400, {
                success: false,
                error: "Body request harus berupa object JSON."
            });
        }

        if (body.action === "commit_file") {
            return await handleCommitFile(req, res, token, body);
        }

        if (body.action === "create_pull_request") {
            return await handleCreatePullRequest(res, token, body);
        }

        if (body.action === "merge_pull_request") {
            return await handleMerge(res, token, body);
        }

        return json(res, 400, {
            success: false,
            error: "Aksi tulis repo tidak dikenal."
        });
    } catch (error) {
        console.error("[admin-copilot] GitHub operation failed:", {
            status: error.status || null,
            message: error.message
        });

        return json(res, githubErrorStatus(error), {
            success: false,
            error: error.message || "Operasi GitHub gagal."
        });
    }
}

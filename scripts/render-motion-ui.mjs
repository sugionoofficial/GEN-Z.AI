#!/usr/bin/env node
/* =========================================================
   GEN-Z.AI — MOTION UI REMOTION RENDERER (GITHUB ACTIONS)
   ---------------------------------------------------------
   File:
     scripts/render-motion-ui.mjs

   1. Membaca `public.motion_ui_jobs` berdasarkan `JOB_KEY`.
   2. Membangun komposisi Remotion React dinamis sesuai template
      (`tovo-saas-launch`, `website-builder-showcase`,
       `brand-manifesto-kinetic`, `mobile-app-spotlight`,
       `campaign-metrics-bento`, `diagonal-product-carousel`).
   3. Me-render video MP4 H.264 30fps dengan `@remotion/bundler`
      + `@remotion/renderer`, dilengkapi audio ambient UI sinematik
      halus via FFmpeg.
   4. Mengunggah hasil ke bucket publik `dashboard-videos/motion-ui/...`,
      memperbarui `motion_ui_jobs` & `generation_history.result_url`,
      serta memanggil `settle_feature_credits(..., 'complete')`.
   5. Pada `--finalize-emergency`, otomatis me-refund kredit user
      via `settle_feature_credits(..., 'refund')`.
========================================================= */

import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { MOTION_UI_ASPECT_CONFIGS } from "../provider/opusclip/motion-ui-templates.js";

const execFile = promisify(execFileCb);
const PUBLIC_VIDEO_BUCKET = "dashboard-videos";

function getEnv(name, fallback = "") {
    return String(process.env[name] || fallback).trim();
}

async function supabaseRest(supabaseUrl, serviceKey, pathname, init = {}) {
    const resp = await fetch(`${supabaseUrl}${pathname}`, {
        ...init,
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            ...(init.headers || {})
        }
    });
    const text = await resp.text().catch(() => "");
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    if (!resp.ok) {
        throw new Error(`Supabase HTTP ${resp.status} (${pathname}): ${text.slice(0, 240)}`);
    }
    return data;
}

export function buildRemotionEntrySource() {
    return `
import React from "react";
import { registerRoot, Composition, AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

const MotionScene = ({ templateId, props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const isDark = props.themeMode !== "light";
  const bg = isDark ? "#050507" : "#f8fafc";
  const fg = isDark ? "#ffffff" : "#09090b";
  const muted = isDark ? "rgba(255,255,255,0.68)" : "rgba(15,23,42,0.68)";
  const cardBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)";
  const cardBorder = isDark ? "rgba(255,255,255,0.13)" : "rgba(15,23,42,0.12)";
  const accent = props.accentColor || "#22c55e";
  const secondary = props.secondaryColor || "#06b6d4";
  const isVertical = height > width;

  const enterBadge = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const enterTitle = spring({ frame: frame - 8, fps, config: { damping: 15, stiffness: 110 } });
  const enterSub = spring({ frame: frame - 18, fps, config: { damping: 16, stiffness: 100 } });
  const enterCards = spring({ frame: frame - 28, fps, config: { damping: 14, stiffness: 105 } });
  const enterCta = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 130 } });
  const outroFade = interpolate(frame, [durationInFrames - 18, durationInFrames - 2], [1, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const orbShift = Math.sin(frame / 22) * 28;
  const diagonalTilt = templateId === "diagonal-product-carousel" ? -4 : 0;

  const metrics = Array.isArray(props.metrics) ? props.metrics : [];

  return React.createElement(
    AbsoluteFill,
    {
      style: {
        backgroundColor: bg,
        color: fg,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        padding: isVertical ? "88px 64px" : "76px 96px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        opacity: outroFade
      }
    },
    React.createElement("div", {
      style: {
        position: "absolute",
        width: isVertical ? 680 : 820,
        height: isVertical ? 680 : 820,
        borderRadius: "50%",
        background: \`radial-gradient(circle, \${accent}38 0%, transparent 68%)\`,
        top: -220 + orbShift,
        right: -180 - orbShift,
        filter: "blur(32px)"
      }
    }),
    React.createElement("div", {
      style: {
        position: "absolute",
        width: 640,
        height: 640,
        borderRadius: "50%",
        background: \`radial-gradient(circle, \${secondary}2e 0%, transparent 70%)\`,
        bottom: -240 - orbShift,
        left: -160 + orbShift,
        filter: "blur(36px)"
      }
    }),
    React.createElement(
      "div",
      {
        style: {
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transform: \`translateY(\${(1 - enterBadge) * -28}px)\`,
          opacity: enterBadge
        }
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontWeight: 800,
            fontSize: isVertical ? 28 : 26,
            letterSpacing: "0.08em"
          }
        },
        React.createElement("span", {
          style: {
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: \`linear-gradient(135deg, \${accent}, \${secondary})\`,
            boxShadow: \`0 0 20px \${accent}\`
          }
        }),
        props.brandName || "GEN-Z.AI"
      ),
      React.createElement(
        "div",
        {
          style: {
            padding: "10px 22px",
            borderRadius: 999,
            border: \`1px solid \${accent}66\`,
            background: \`\${accent}1c\`,
            color: accent,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.06em"
          }
        },
        props.badgeText || "MOTION UI"
      )
    ),
    React.createElement(
      "div",
      {
        style: {
          position: "relative",
          zIndex: 2,
          maxWidth: isVertical ? "100%" : "86%",
          transform: \`rotate(\${diagonalTilt}deg)\`
        }
      },
      React.createElement(
        "h1",
        {
          style: {
            margin: "0 0 26px 0",
            fontSize: isVertical ? 74 : 78,
            lineHeight: 1.07,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            transform: \`translateY(\${(1 - enterTitle) * 42}px)\`,
            opacity: enterTitle
          }
        },
        props.headline || ""
      ),
      React.createElement(
        "p",
        {
          style: {
            margin: 0,
            fontSize: isVertical ? 32 : 30,
            lineHeight: 1.45,
            color: muted,
            maxWidth: isVertical ? "100%" : "82%",
            transform: \`translateY(\${(1 - enterSub) * 30}px)\`,
            opacity: enterSub
          }
        },
        props.subheadline || ""
      )
    ),
    React.createElement(
      "div",
      {
        style: {
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          alignItems: isVertical ? "stretch" : "flex-end",
          justifyContent: "space-between",
          gap: 28
        }
      },
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: isVertical ? "1fr" : \`repeat(\${Math.max(1, metrics.length)}, minmax(210px, 1fr))\`,
            gap: 20,
            flex: 1,
            transform: \`translateY(\${(1 - enterCards) * 38}px) scale(\${0.94 + enterCards * 0.06})\`,
            opacity: enterCards
          }
        },
        metrics.map((m, idx) =>
          React.createElement(
            "div",
            {
              key: idx,
              style: {
                padding: "24px 28px",
                borderRadius: 24,
                background: cardBg,
                border: \`1px solid \${cardBorder}\`,
                backdropFilter: "blur(16px)"
              }
            },
            React.createElement(
              "div",
              {
                style: {
                  fontSize: 19,
                  fontWeight: 600,
                  color: muted,
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }
              },
              m.label
            ),
            React.createElement(
              "div",
              {
                style: {
                  fontSize: 38,
                  fontWeight: 900,
                  background: \`linear-gradient(135deg, \${fg}, \${accent})\`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }
              },
              m.value
            )
          )
        )
      ),
      React.createElement(
        "div",
        {
          style: {
            padding: "24px 40px",
            borderRadius: 999,
            background: \`linear-gradient(135deg, \${accent}, \${secondary})\`,
            color: "#04110a",
            fontWeight: 900,
            fontSize: 26,
            textAlign: "center",
            boxShadow: \`0 18px 44px \${accent}4d\`,
            transform: \`scale(\${0.88 + enterCta * 0.12})\`,
            opacity: enterCta,
            whiteSpace: "nowrap"
          }
        },
        props.ctaText || "Mulai Sekarang"
      )
    )
  );
};

export const RemotionRoot = () => {
  return React.createElement(Composition, {
    id: "MotionUIComposition",
    component: MotionScene,
    durationInFrames: 300,
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: {
      templateId: "tovo-saas-launch",
      props: {}
    }
  });
};

registerRoot(RemotionRoot);
`;
}

async function addAmbientAudioTrack(silentMp4Path, finalMp4Path, durationSec) {
    try {
        await execFile("ffmpeg", [
            "-y",
            "-i",
            silentMp4Path,
            "-f",
            "lavfi",
            "-i",
            `sine=frequency=196:duration=${durationSec}`,
            "-filter_complex",
            `[1:a]lowpass=f=320,volume=0.035,afade=t=in:st=0:d=0.8,afade=t=out:st=${Math.max(0.5, durationSec - 1.2)}:d=1.2[aout]`,
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-shortest",
            "-movflags",
            "+faststart",
            finalMp4Path
        ]);
        return finalMp4Path;
    } catch {
        return silentMp4Path;
    }
}

async function runEmergencyRefund({ supabaseUrl, serviceKey, jobKey, userId, transactionId }) {
    if (jobKey) {
        await supabaseRest(
            supabaseUrl,
            serviceKey,
            `/rest/v1/motion_ui_jobs?job_key=eq.${encodeURIComponent(jobKey)}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    status: "failed",
                    error_message: "Proses render Motion UI gagal di GitHub Actions. Kredit dikembalikan otomatis.",
                    updated_at: new Date().toISOString()
                })
            }
        ).catch(() => {});
    }

    if (userId && transactionId) {
        await supabaseRest(supabaseUrl, serviceKey, "/rest/v1/rpc/settle_feature_credits", {
            method: "POST",
            body: JSON.stringify({
                p_user_id: userId,
                p_transaction_id: transactionId,
                p_outcome: "refund",
                p_error_message: "Render Motion UI gagal; kredit telah dikembalikan otomatis."
            })
        }).catch(() => {});
    }
}

async function main() {
    const supabaseUrl = getEnv("GENZ_SUPABASE_URL") || getEnv("SUPABASE_URL");
    const serviceKey = getEnv("GENZ_SUPABASE_SERVICE_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const jobKey = getEnv("JOB_KEY");
    const userId = getEnv("USER_ID");
    const transactionId = getEnv("TRANSACTION_ID");
    const runnerDir = getEnv("REMOTION_RUNNER_DIR", "/tmp/remotion-runner");

    if (!supabaseUrl || !serviceKey) {
        throw new Error("GENZ_SUPABASE_URL dan GENZ_SUPABASE_SERVICE_KEY wajib tersedia.");
    }

    if (process.argv.includes("--finalize-emergency")) {
        await runEmergencyRefund({ supabaseUrl, serviceKey, jobKey, userId, transactionId });
        return;
    }

    const rows = await supabaseRest(
        supabaseUrl,
        serviceKey,
        `/rest/v1/motion_ui_jobs?job_key=eq.${encodeURIComponent(jobKey)}&limit=1`
    );
    const job = Array.isArray(rows) ? rows[0] : null;
    if (!job) {
        throw new Error(`Baris motion_ui_jobs '${jobKey}' tidak ditemukan.`);
    }

    await supabaseRest(
        supabaseUrl,
        serviceKey,
        `/rest/v1/motion_ui_jobs?job_key=eq.${encodeURIComponent(jobKey)}`,
        {
            method: "PATCH",
            body: JSON.stringify({
                status: "rendering",
                progress: 20,
                updated_at: new Date().toISOString()
            })
        }
    );

    const aspectCfg = MOTION_UI_ASPECT_CONFIGS[job.aspect_ratio] || MOTION_UI_ASPECT_CONFIGS["16:9"];
    const durationSec = Math.max(5, Math.min(20, Number(job.duration_sec) || 10));
    const fps = 30;
    const durationInFrames = durationSec * fps;

    const entryFile = path.join(runnerDir, "entry.jsx");
    await fs.writeFile(entryFile, buildRemotionEntrySource(), "utf8");

    const runnerRequire = createRequire(path.join(runnerDir, "package.json"));
    const { bundle } = runnerRequire("@remotion/bundler");
    const { selectComposition, renderMedia } = runnerRequire("@remotion/renderer");

    const bundledUrl = await bundle({
        entryPoint: entryFile
    });

    const inputProps = {
        templateId: job.template_id,
        props: job.props || {}
    };

    const composition = await selectComposition({
        serveUrl: bundledUrl,
        id: "MotionUIComposition",
        inputProps
    });

    composition.width = aspectCfg.width;
    composition.height = aspectCfg.height;
    composition.fps = fps;
    composition.durationInFrames = durationInFrames;

    const rawOutPath = path.join(runnerDir, `${jobKey}-raw.mp4`);
    const finalOutPath = path.join(runnerDir, `${jobKey}.mp4`);

    await renderMedia({
        composition,
        serveUrl: bundledUrl,
        codec: "h264",
        outputLocation: rawOutPath,
        inputProps
    });

    const uploadCandidate = await addAmbientAudioTrack(rawOutPath, finalOutPath, durationSec);
    const mp4Bytes = await fs.readFile(uploadCandidate);

    const objectPath = `motion-ui/${encodeURIComponent(job.user_id)}/${encodeURIComponent(jobKey)}.mp4`;
    const uploadResp = await fetch(
        `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${PUBLIC_VIDEO_BUCKET}/${objectPath}`,
        {
            method: "POST",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "video/mp4",
                "x-upsert": "true"
            },
            body: mp4Bytes
        }
    );
    if (!uploadResp.ok) {
        const errTxt = await uploadResp.text().catch(() => "");
        throw new Error(`Upload Storage gagal (${uploadResp.status}): ${errTxt.slice(0, 180)}`);
    }

    const publicUrl = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${PUBLIC_VIDEO_BUCKET}/${objectPath}`;
    const nowIso = new Date().toISOString();

    await supabaseRest(
        supabaseUrl,
        serviceKey,
        `/rest/v1/motion_ui_jobs?job_key=eq.${encodeURIComponent(jobKey)}`,
        {
            method: "PATCH",
            body: JSON.stringify({
                status: "completed",
                progress: 100,
                result_url: publicUrl,
                updated_at: nowIso,
                completed_at: nowIso
            })
        }
    );

    const txId = job.transaction_id || transactionId;
    if (txId) {
        const settled = await supabaseRest(
            supabaseUrl,
            serviceKey,
            "/rest/v1/rpc/settle_feature_credits",
            {
                method: "POST",
                body: JSON.stringify({
                    p_user_id: job.user_id,
                    p_transaction_id: txId,
                    p_outcome: "complete"
                })
            }
        );

        const taskId = settled?.task_id || `opusclip_mui_${txId}`;
        await supabaseRest(
            supabaseUrl,
            serviceKey,
            `/rest/v1/generation_history?user_id=eq.${encodeURIComponent(job.user_id)}&task_id=eq.${encodeURIComponent(taskId)}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    result_url: publicUrl,
                    status: "success",
                    completed_at: nowIso
                })
            }
        ).catch(() => {});
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(err => {
        console.error("[render-motion-ui] ERROR:", err);
        process.exit(1);
    });
}

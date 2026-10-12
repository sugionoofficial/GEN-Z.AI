import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const openKeySource = await fs.readFile(
  new URL("../metadata-cleaner/assets/js/metadata-openkey-detection.js", import.meta.url),
  "utf8"
);

const detectorSource = await fs.readFile(
  new URL("../metadata-cleaner/assets/js/metadata-detector.js", import.meta.url),
  "utf8"
);

const normalizerSource = await fs.readFile(
  new URL("../metadata-cleaner/assets/js/metadata-normalizer.js", import.meta.url),
  "utf8"
);

const ffmpegSource = await fs.readFile(
  new URL("../metadata-cleaner/assets/js/metadata-ffmpeg.js", import.meta.url),
  "utf8"
);

const videoSource = await fs.readFile(
  new URL("../metadata-cleaner/assets/js/metadata-video.js", import.meta.url),
  "utf8"
);

const openKeyModule = await import(
  `data:text/javascript,${encodeURIComponent(openKeySource)}`
);

const detectorModule = await import(
  `data:text/javascript,${encodeURIComponent(detectorSource)}`
);

const normalizerUrl =
  `data:text/javascript,${encodeURIComponent(normalizerSource)}`;

const ffmpegUrl =
  `data:text/javascript,${encodeURIComponent(ffmpegSource)}`;

const rewrittenVideoSource =
  videoSource
    .replace(
      /from "\.\/metadata-normalizer\.js"/g,
      `from "${normalizerUrl}"`
    )
    .replace(
      /from "\.\/metadata-ffmpeg\.js"/g,
      `from "${ffmpegUrl}"`
    );

const videoModule = await import(
  `data:text/javascript,${encodeURIComponent(rewrittenVideoSource)}`
);

test("selects a catalog model with image input capability", () => {
  const selected = openKeyModule.selectVisionModel([
    {
      id: "text-only",
      input_modalities: ["text"]
    },
    {
      id: "vision-model",
      input_modalities: ["text", "image"]
    }
  ]);

  assert.equal(selected.id, "vision-model");
});

test("accepts documented OpenKey vision models when catalog omits capabilities", () => {
  const selected = openKeyModule.selectVisionModel([
    { id: "text-only", input_modalities: ["text"] },
    { id: "qwen3-vl-max" }
  ]);

  assert.equal(selected.id, "qwen3-vl-max");
});

test("normalizes a structured OpenKey response", () => {
  assert.deepEqual(
    openKeyModule.parseOpenKeyAnalysis(
      '```json\n{"verdict":"likely_ai","confidence":0.86,"summary":"Ada indikasi visual.","evidence":["Pola tekstur berulang"]}\n```'
    ),
    {
      verdict: "likely_ai",
      confidence: 86,
      summary: "Ada indikasi visual.",
      evidence: ["Pola tekstur berulang"]
    }
  );
});

test("reads the normalized response shape returned by /api/openkey-chat", () => {
  assert.equal(
    openKeyModule.getMessageContent({
      content: '{"verdict":"uncertain","confidence":40}',
      model: "qwen3-vl-max"
    }),
    '{"verdict":"uncertain","confidence":40}'
  );
});

test("qualifies a negative visual result when metadata declares AI provenance", () => {
  const container = {
    hidden: true,
    children: [],
    replaceChildren() {
      this.children = [];
    },
    append(...children) {
      this.children.push(...children);
    }
  };

  globalThis.document = {
    getElementById() {
      return container;
    },
    createElement() {
      return {
        textContent: "",
        className: ""
      };
    }
  };

  try {
    openKeyModule.renderOpenKeyResult(
      {
        status: "complete",
        verdict: "likely_not_ai",
        confidence: 70,
        summary: "Kemungkinan besar bukan media AI.",
        evidence: [],
        model: "vision-model",
        frameCount: 1
      },
      [],
      {
        digitalSourceType: "trainedAlgorithmicMedia",
        verificationStatus: "NOT_VERIFIED"
      }
    );

    assert.equal(container.hidden, false);
    assert.equal(
      container.children[0].textContent,
      "OPENKEY: TIDAK ADA INDIKASI VISUAL AI"
    );
    assert.match(
      container.children[1].textContent,
      /sinyal AI ditemukan pada metadata\/provenance/
    );
    assert.match(
      container.children[1].textContent,
      /NOT_VERIFIED/
    );
    assert.doesNotMatch(
      container.children[1].textContent,
      /Kemungkinan besar bukan media AI/
    );
    assert.match(
      container.children[2].textContent,
      /Skor confidence visual OpenKey/
    );
  } finally {
    delete globalThis.document;
  }
});

test("does not treat AI names in a filename as media provenance", () => {
  assert.deepEqual(
    detectorModule.detectAIIndicators([
      {
        field: "File Name",
        value: "google-veo-output.mp4",
        source: "File"
      }
    ]),
    []
  );
});

test("detects a generator that remains in SoftwareAgent metadata", () => {
  const findings =
    detectorModule.detectAIIndicators([
      {
        field: "SoftwareAgent",
        value: "Google Veo",
        source: "FFprobe Format"
      }
    ]);

  assert.ok(
    findings.some(
      item => item.keyword === "veo"
    )
  );
});

test("scans trailing MP4 data for SoftwareAgent metadata", async () => {
  const bytes =
    new Uint8Array(16 * 1024 * 1024 + 64);

  bytes.set(
    new TextEncoder().encode("SoftwareAgent Google Veo"),
    bytes.length - 25
  );

  const metadata =
    await videoModule.readMp4ContainerMetadata(
      new Blob([bytes], { type: "video/mp4" })
    );

  assert.match(metadata.SoftwareAgent, /SoftwareAgent Google Veo/);
});

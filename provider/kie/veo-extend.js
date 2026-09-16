const MODEL_ID = "veo/extend";
const PROVIDER_ID = "kie_ai";
const API_ENDPOINT = "/api/generate";

function normalizeString(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function buildPayload(options = {}) {
  const prompt = normalizeString(options.prompt);
  const ratio = normalizeString(options.ratio, "9:16");
  const duration = normalizeString(options.duration, "8");
  const resolution = normalizeString(options.resolution, "720p");

  return {
    provider: PROVIDER_ID,
    model: MODEL_ID,
    prompt,
    ratio,
    duration,
    resolution
  };
}

function validate(options = {}) {
  const prompt = normalizeString(options.prompt);

  if (!prompt) {
    throw new Error("Prompt wajib diisi.");
  }

  return true;
}

async function generate(options = {}) {
  validate(options);

  const payload = buildPayload(options);

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get("content-type") || "";

  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        success: response.ok,
        message: text
      };
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Generation request gagal (${response.status}).`;

    throw new Error(message);
  }

  return data;
}

const adapter = {
  MODEL_ID,
  PROVIDER_ID,
  API_ENDPOINT,
  normalizeString,
  buildPayload,
  validate,
  generate
};

export {
  MODEL_ID,
  PROVIDER_ID,
  API_ENDPOINT,
  normalizeString,
  buildPayload,
  validate,
  generate
};

export default adapter;

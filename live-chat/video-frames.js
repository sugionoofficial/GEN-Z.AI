export const MAX_VIDEO_DURATION_SECONDS = 30;
const VIDEO_DURATION_ROUNDING_TOLERANCE_SECONDS = 0.1;

export function getVideoFrameTimestamps(duration) {
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Durasi video tidak valid.");
    }
    if (
        duration >
        MAX_VIDEO_DURATION_SECONDS + VIDEO_DURATION_ROUNDING_TOLERANCE_SECONDS
    ) {
        throw new Error(`Durasi video melebihi batas ${MAX_VIDEO_DURATION_SECONDS} detik. Potong video agar dapat dianalisis per detik.`);
    }

    const analysisDuration = Math.min(duration, MAX_VIDEO_DURATION_SECONDS);
    const count = Math.max(1, Math.ceil(analysisDuration));
    return Array.from({ length: count }, (_value, index) =>
        Math.max(0, Math.min(analysisDuration - 0.05, index + 0.5))
    );
}

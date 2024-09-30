export function delayExecution(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getExponentialBackoffDelay(
  attempt: number,
  baseDelay = 1000,
  maxDelay = 12000
) {
  const rawDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay - baseDelay / 2; // random value between -0.5*baseDelay and 0.5*baseDelay
  return Math.min(rawDelay + jitter, maxDelay);
}

export function minutesFromNow(minutes: number) {
  return new Date(new Date().getTime() + minutes * 60000);
}

export function mimeToExtension(mimeType: string) {
  const map: { [key: string]: string } = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/x-ms-wmv": "wmv",
    "video/mpeg": "mpeg",
    "video/webm": "webm",
    "video/ogg": "ogv",
  };
  return map[mimeType] || mimeType?.split("/")[1];
}

export function timeout(ms: number) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), ms)
  );
}

export function calculateTargetDimensions(
  originalWidth: number,
  originalHeight: number
) {
  let targetWidth, targetHeight;

  if (originalWidth > originalHeight) {
    if (originalWidth < 1920) {
      targetWidth = originalWidth;
      targetHeight = originalHeight;
    } else {
      targetWidth = 1920;
      targetHeight = (1920 / originalWidth) * originalHeight;
    }
  } else {
    if (originalHeight < 1920) {
      targetHeight = originalHeight;
      targetWidth = originalWidth;
    } else {
      targetHeight = 1920;
      targetWidth = (1920 / originalHeight) * originalWidth;
    }
  }

  return {
    targetWidth: Math.round(targetWidth),
    targetHeight: Math.round(targetHeight),
  };
}

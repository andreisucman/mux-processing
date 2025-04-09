import { TranslatedPoint } from "types.js";

export function delayExecution(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function upperFirst(string: string) {
  if (!string) return "";

  return string[0].toUpperCase() + string.slice(1);
}

export function getExponentialBackoffDelay(attempt: number, baseDelay = 5000, maxDelay = 24000) {
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
  return new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
}

export function calculateTargetDimensions(originalWidth: number, originalHeight: number) {
  let targetWidth, targetHeight;

  if (originalWidth > originalHeight) {
    if (originalWidth < 1280) {
      targetWidth = originalWidth;
      targetHeight = originalHeight;
    } else {
      targetWidth = 1280;
      targetHeight = (1280 / originalWidth) * originalHeight;
    }
  } else {
    if (originalHeight < 1280) {
      targetHeight = originalHeight;
      targetWidth = originalWidth;
    } else {
      targetHeight = 1280;
      targetWidth = (1280 / originalHeight) * originalWidth;
    }
  }

  return {
    targetWidth: Math.round(targetWidth),
    targetHeight: Math.round(targetHeight),
  };
}

function calculateCentroid(points: { x: number; y: number }[]) {
  const sum = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    },
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

function normalizePoints(points: TranslatedPoint[]) {
  const centroid = calculateCentroid(points);
  return points.map((point) => ({
    x: point.x - centroid.x,
    y: point.y - centroid.y,
  }));
}

function scaleToAverageRadius(points: TranslatedPoint[]) {
  const distances = points.map((point) => Math.sqrt(point.x ** 2 + point.y ** 2));
  const averageDistance = distances.reduce((acc, distance) => acc + distance, 0) / distances.length;

  return points.map((point) => {
    const scale = averageDistance / Math.sqrt(point.x ** 2 + point.y ** 2);
    return {
      x: point.x * scale,
      y: point.y * scale,
    };
  });
}

function smoothPoints(points: TranslatedPoint[], iterations = 1) {
  for (let i = 0; i < iterations; i++) {
    points = points.map((point, index, arr) => {
      const prev = arr[index === 0 ? arr.length - 1 : index - 1];
      const next = arr[(index + 1) % arr.length];
      return {
        x: (prev.x + point.x + next.x) / 3,
        y: (prev.y + point.y + next.y) / 3,
      };
    });
  }
  return points;
}

export function areLandmarksReliable(landmarks: number[][]): boolean {
  if (!landmarks || landmarks.length === 0) return false;
  return landmarks.every((point) => point.every((coord) => !isNaN(coord)));
}

export function computeEyeCenter(landmarks: number[][]) {
  return landmarks.reduce(
    (acc: { x: number; y: number }, point: number[]) => {
      acc.x += point[0] / landmarks.length;
      acc.y += point[1] / landmarks.length;
      return acc;
    },
    { x: 0, y: 0 }
  );
}

export function computeEyeRadius(landmarks: number[][]) {
  return euclideanDistance(landmarks[0], landmarks[2]) * 2;
}

function euclideanDistance(p1: number[], p2: number[]) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function setToUtcMidnight(date: Date) {
  return new Date(date.setUTCHours(0, 0, 0, 0));
}

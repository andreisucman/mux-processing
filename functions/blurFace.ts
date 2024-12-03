import httpError from "@/helpers/httpError.js";
import sharp from "sharp";

export default async function blurFace(
  imageBuffer: Buffer,
  silhouetteLandmarks: Array<{ x: number; y: number }>,
  format: "webp" | "png"
) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (
      silhouetteLandmarks &&
      silhouetteLandmarks.length > 0 &&
      width > 0 &&
      height > 0
    ) {
      const xs = silhouetteLandmarks.map((point) => point.x);
      const ys = silhouetteLandmarks.map((point) => point.y);

      const left = Math.max(0, Math.floor(Math.min(...xs)));
      const right = Math.min(width, Math.ceil(Math.max(...xs)));
      const top = Math.max(0, Math.floor(Math.min(...ys)));
      const bottom = Math.min(height, Math.ceil(Math.max(...ys)));

      const faceWidth = right - left;
      const faceHeight = bottom - top;

      const adjustedLandmarks = silhouetteLandmarks.map((point) => ({
        x: point.x - left,
        y: point.y - top,
      }));

      const faceRegion = await sharp(imageBuffer)
        .extract({ left, top, width: faceWidth, height: faceHeight })
        .toBuffer();

      const blurredFace = await sharp(faceRegion).blur(50).toBuffer();

      const points = adjustedLandmarks
        .map((point) => `${point.x},${point.y}`)
        .join(" ");

      const mask = `
        <svg width="${faceWidth}" height="${faceHeight}" xmlns="http://www.w3.org/2000/svg">
          <polygon points="${points}" fill="white" />
        </svg>
      `;

      const maskedFaceRegion = await sharp(blurredFace)
        .composite([
          {
            input: Buffer.from(mask),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();

      const overlay = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          {
            input: maskedFaceRegion,
            left,
            top,
          },
        ])
        .png()
        .toBuffer();

      const resultBuffer = await image
        .composite([
          {
            input: overlay,
            blend: "over",
          },
        ])
        .toFormat(format)
        .toBuffer();

      return resultBuffer;
    } else {
      return imageBuffer;
    }
  } catch (err) {
    throw httpError(err);
  }
}

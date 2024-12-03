import sharp from "sharp";
import { CoordinateType, EyeDataType } from "types.js";
import httpError from "@/helpers/httpError.js";

export default async function blurEyes(
  imageBuffer: Buffer,
  eyeData: EyeDataType,
  format: "webp" | "png"
) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width;
    const height = metadata.height;

    const overlays = [];

    if (eyeData.leftEyeCenter && eyeData.leftEyeRadius) {
      const leftEyeOverlay = await createBlurredEyeOverlay(
        imageBuffer,
        eyeData.leftEyeCenter,
        eyeData.leftEyeRadius,
        width,
        height
      );
      overlays.push({ input: leftEyeOverlay, blend: "over" });
    }

    // Process right eye
    if (eyeData.rightEyeCenter && eyeData.rightEyeRadius) {
      const rightEyeOverlay = await createBlurredEyeOverlay(
        imageBuffer,
        eyeData.rightEyeCenter,
        eyeData.rightEyeRadius,
        width,
        height
      );
      overlays.push({ input: rightEyeOverlay, blend: "over" });
    }

    const resultBuffer = await image
      .composite(overlays as any)
      .toFormat(format)
      .toBuffer();

    return resultBuffer;
  } catch (err) {
    throw httpError(err);
  }
}

async function createBlurredEyeOverlay(
  imageBuffer: Buffer,
  eyeCenter: CoordinateType,
  eyeRadius: number,
  imageWidth: number,
  imageHeight: number
) {
  try {
    const radiusX = eyeRadius * 1.5; // elongate
    const radiusY = eyeRadius;
    const left = Math.max(0, Math.round(eyeCenter.x - radiusX));
    const top = Math.max(0, Math.round(eyeCenter.y - radiusY));
    const width = Math.min(imageWidth - left, Math.round(radiusX * 2));
    const height = Math.min(imageHeight - top, Math.round(radiusY * 2));

    const eyeRegion = await sharp(imageBuffer)
      .extract({ left, top, width, height })
      .toBuffer();

    const blurredEye = await sharp(eyeRegion).blur(50).toBuffer();

    const mask = Buffer.from(
      `<svg width="${width}" height="${height}">
       <ellipse cx="${width / 2}" cy="${
        height / 2
      }" rx="${radiusX}" ry="${radiusY}" fill="white" />
     </svg>`
    );

    const maskedEyeRegion = await sharp(blurredEye)
      .composite([
        {
          input: mask,
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();

    const overlay = await sharp({
      create: {
        width: imageWidth,
        height: imageHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: maskedEyeRegion,
          left,
          top,
        },
      ])
      .png()
      .toBuffer();

    return overlay;
  } catch (err) {
    throw httpError(err);
  }
}

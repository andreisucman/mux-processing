import sharp from "sharp";
import uploadToSpaces from "../helpers/uploadToSpaces.js";
import { EyeDataType } from "../types.js";

export default async function blurEyes(
  imageBuffer: Buffer,
  eyeData: EyeDataType
) {
  try {
    const base64 = imageBuffer.toString("base64");

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width;
    const height = metadata.height;

    let leftEyeClipPath = "";
    let rightEyeClipPath = "";
    let leftEyeImage = "";
    let rightEyeImage = "";

    if (eyeData.leftEyeCenter && eyeData.leftEyeRadius) {
      leftEyeClipPath = `
        <clipPath id="leftEyeMask">
          <ellipse  cx="${eyeData.leftEyeCenter.x}" cy="${eyeData.leftEyeCenter.y}" rx="${eyeData.leftEyeRadius * 1.25}" ry="${eyeData.leftEyeRadius}" />
        </clipPath>
      `;
      leftEyeImage = `
        <!-- Blurred Left Eye -->
        <image
          clip-path="url(#leftEyeMask)"
          filter="url(#blur)"
          width="${width}"
          height="${height}"
          href="data:image/jpeg;base64,${base64}"
        />
      `;
    }

    if (eyeData.rightEyeCenter && eyeData.rightEyeRadius) {
      rightEyeClipPath = `
        <clipPath id="rightEyeMask">
          <ellipse  cx="${eyeData.rightEyeCenter.x}" cy="${eyeData.rightEyeCenter.y}" rx="${eyeData.rightEyeRadius * 1.25}" ry="${eyeData.rightEyeRadius}" />
        </clipPath>
      `;
      rightEyeImage = `
        <!-- Blurred Right Eye -->
        <image
          clip-path="url(#rightEyeMask)"
          filter="url(#blur)"
          width="${width}"
          height="${height}"
          href="data:image/jpeg;base64,${base64}"
        />
      `;
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${leftEyeClipPath}
        ${rightEyeClipPath}

        <filter id="blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="30" />
        </filter>

        <!-- Original Image -->
        <image width="${width}" height="${height}" href="data:image/jpeg;base64,${base64}" />

        ${leftEyeImage}
        ${rightEyeImage}
      </svg>
    `;

    const svgBuffer = Buffer.from(svg);

    const resultBuffer = await sharp(svgBuffer).toFormat("webp").toBuffer();

    const resultUrl = await uploadToSpaces({
      buffer: resultBuffer,
      mimeType: "image/webp",
    });

    return resultUrl;
  } catch (error) {
    console.error("Error in blurEyes:", error);
    throw error;
  }
}

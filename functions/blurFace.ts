import sharp from "sharp";
import uploadToSpaces from "../helpers/uploadToSpaces.js";

export default async function blurFace(
  imageBuffer: Buffer,
  silhouetteLandmarks: Array<{ x: number; y: number }>
) {
  try {
    const base64 = imageBuffer.toString("base64");

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width;
    const height = metadata.height;

    let faceClipPath = "";
    let faceImage = "";

    if (silhouetteLandmarks && silhouetteLandmarks.length > 0) {
      // Generate the points string for the polygon
      const points = silhouetteLandmarks
        .map((point) => `${point.x},${point.y}`)
        .join(" ");

      faceClipPath = `
        <clipPath id="faceMask">
          <polygon points="${points}" />
        </clipPath>
      `;
      faceImage = `
        <!-- Blurred face -->
        <image
          clip-path="url(#faceMask)"
          filter="url(#blur)"
          width="${width}"
          height="${height}"
          href="data:image/jpeg;base64,${base64}"
        />
      `;
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${faceClipPath}

        <filter id="blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="30" />
        </filter>

        <!-- Original Image -->
        <image width="${width}" height="${height}" href="data:image/jpeg;base64,${base64}" />
        ${faceImage}
      </svg>
    `;

    const svgBuffer = Buffer.from(svg);

    const resultBuffer = await sharp(svgBuffer).toFormat("jpeg").toBuffer();

    const resultUrl = await uploadToSpaces({
      buffer: resultBuffer,
      mimeType: "image/jpeg",
    });

    return resultUrl;
  } catch (error) {
    console.error("Error in blurFace:", error);
    throw error;
  }
}

import httpError from "@/helpers/httpError.js";
import sharp from "sharp";

export default async function combineImages(
  imageBuffers: Buffer[]
): Promise<Buffer> {
  if (imageBuffers.length < 2 || imageBuffers.length > 4) {
    throw httpError("You must provide between 2 and 4 image buffers.");
  }

  try {
    const resizedImages = imageBuffers.map((buffer) =>
      sharp(buffer)
        .resize(256, 256, {
          fit: "contain",
        })
        .extend({
          top: 2,
          bottom: 2,
          left: 2,
          right: 0,
          background: { r: 0, g: 255, b: 0, alpha: 1 },
        })
    );

    const combinedImage = sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    });

    const positions = [
      { top: 0, left: 0 }, // Top-left
      { top: 0, left: 256 }, // Top-right
      { top: 256, left: 0 }, // Bottom-left
      { top: 256, left: 256 }, // Bottom-right
    ];

    const composites = [];

    for (let i = 0; i < imageBuffers.length; i++) {
      const imageBuffer = await resizedImages[i].toBuffer();
      const position = positions[i];

      const textImage = await sharp(imageBuffer)
        .composite([
          {
            input: Buffer.from(
              `<svg width="256" height="256">
                  <text x="10" y="30" font-family="Arial" font-size="24" fill="red">${i}</text>
                </svg>`
            ),
            top: 0,
            left: 0,
          },
        ])
        .toBuffer();

      composites.push({
        input: textImage,
        top: position.top,
        left: position.left,
      });
    }

    const finalImage = await combinedImage
      .composite(composites)
      .toFormat("webp")
      .toBuffer();

    return finalImage;
  } catch (error) {
    throw httpError(error);
  }
}

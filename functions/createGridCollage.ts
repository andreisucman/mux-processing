import httpError from "@/helpers/httpError.js";
import sharp from "sharp";

type Props = {
  imageBuffers: Buffer[];
  collageSize: number;
};

export default async function createGridCollage({
  imageBuffers,
  collageSize,
}: Props): Promise<Buffer> {
  const gridSize = Math.ceil(Math.sqrt(imageBuffers.length));
  const cellSize = Math.max(256, collageSize / gridSize);

  try {
    const resizedImages = imageBuffers.map((buffer) =>
      sharp(buffer).resize(cellSize, cellSize, {
        fit: "contain",
      })
    );

    const combinedImage = sharp({
      create: {
        width: collageSize,
        height: collageSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    });

    const composites = [];

    for (let i = 0; i < imageBuffers.length; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;

      const imageBuffer = await resizedImages[i].toBuffer();
      const position = {
        top: row * cellSize,
        left: col * cellSize,
      };

      const textImage = await sharp(imageBuffer)
        .composite([
          {
            input: Buffer.from(
              `<svg width="${cellSize}" height="${cellSize}">
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

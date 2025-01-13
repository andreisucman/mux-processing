import httpError from "@/helpers/httpError.js";
import sharp from "sharp";

type Props = {
  bufferGroups: Buffer[][];
  collageSize: number;
};

export default async function createCollage({
  bufferGroups,
  collageSize,
}: Props): Promise<Buffer> {
  try {
    const rows = bufferGroups.length;
    const groupLengths = bufferGroups.map((g) => g.length);
    const singleImageSize = Math.round(collageSize / Math.max(...groupLengths));

    const resizedImages = bufferGroups.map((group) =>
      group.map((buffer) =>
        sharp(buffer).resize(singleImageSize, singleImageSize, {
          fit: "contain",
        })
      )
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

    // First, add all the image buffers to the composites array
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const columns = bufferGroups[rowIndex].length;

      for (let colIndex = 0; colIndex < columns; colIndex++) {
        const record = resizedImages[rowIndex][colIndex];
        const imageBuffer = record
          ? await record.toFormat("png").toBuffer()
          : null;

        if (!imageBuffer) continue;

        const top = rowIndex * singleImageSize;
        const left = colIndex * singleImageSize;

        composites.push({
          input: imageBuffer,
          top: top,
          left: left,
        });
      }
    }

    // Add the green row line **above** the images but **below** the text
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const rowLine = await sharp({
        create: {
          width: collageSize,
          height: 2,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 },
        },
      })
        .toFormat("png")
        .toBuffer();

      composites.push({
        input: rowLine,
        top: (rowIndex + 1) * singleImageSize, // Place below each image row
        left: 0,
      });
    }

    // Now, add text overlays after the images and row lines are placed
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const rowText = await sharp({
        create: {
          width: collageSize,
          height: singleImageSize,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${collageSize}" height="${singleImageSize}">
                <text x="10" y="30" font-family="Arial" font-size="24" fill="red">${rowIndex}</text>
              </svg>`
            ),
            top: 0,
            left: 0,
          },
        ])
        .toFormat("png")
        .toBuffer();

      composites.push({
        input: rowText,
        top: rowIndex * singleImageSize,
        left: 0,
      });
    }

    // Finally, compose everything and generate the final image
    const finalImage = await combinedImage
      .composite(composites)
      .toFormat("png")
      .toBuffer();

    return finalImage;
  } catch (error) {
    throw httpError(error);
  }
}
